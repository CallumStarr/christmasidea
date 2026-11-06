import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip, gzipSync } from "node:zlib";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { DatabaseSync } from "node:sqlite";
import {
  boundedLimit, csvRows, feedLimits, FEED_LIMIT_DEFAULTS, generationDeleteSql, MAX_FEED_FIELD_CHARS, MAX_FEED_ROW_FIELDS,
} from "../scripts/import-awin-feed.mjs";
import {
  DEFAULT_MAX_FEED_BYTES, DEFAULT_MAX_TOTAL_DOWNLOAD_BYTES, downloadLimits, redactAwinDiagnostic, readAwinFeedList, writeLimited,
} from "../scripts/sync-awin-catalogue.mjs";

const importer = fileURLToPath(new URL("../scripts/import-awin-feed.mjs", import.meta.url));

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), "awin-adversarial-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const limits = (overrides = {}) => feedLimits({}, overrides);

async function rows(path, options) {
  const out = [];
  for await (const row of csvRows(path, options)) out.push(row);
  return out;
}

test("limits are conservative defaults and environment values must be bounded positive integers", () => {
  assert.equal(MAX_FEED_FIELD_CHARS, 65_536);
  assert.equal(MAX_FEED_ROW_FIELDS, 512);
  assert.equal(DEFAULT_MAX_FEED_BYTES, 256 * 1024 * 1024);
  assert.equal(DEFAULT_MAX_TOTAL_DOWNLOAD_BYTES, 1024 * 1024 * 1024);
  assert.equal(feedLimits({}).maxDecompressedBytes, FEED_LIMIT_DEFAULTS.maxDecompressedBytes);
  assert.equal(feedLimits({ AWIN_MAX_FEED_ROWS: " 1000 " }).maxRows, 1000);
  for (const value of ["0", "-1", "1e9", "12.5", "abc", "Infinity", "99999999999999999", "2000001"]) {
    assert.throws(() => feedLimits({ AWIN_MAX_FEED_ROWS: value }), /AWIN_MAX_FEED_ROWS must be a whole number/, value);
  }
  assert.throws(() => feedLimits({ AWIN_MAX_FEED_DECOMPRESSED_BYTES: String(3 * 1024 ** 3) }), /between 1 and/);
  assert.throws(() => downloadLimits({ AWIN_MAX_FEED_BYTES: String(2 * 1024 ** 3) }), /AWIN_MAX_FEED_BYTES/);
  assert.throws(() => downloadLimits({ AWIN_MAX_TOTAL_DOWNLOAD_BYTES: "0" }), /AWIN_MAX_TOTAL_DOWNLOAD_BYTES/);
  assert.equal(boundedLimit("", 7, 10, "X"), 7);
});

test("a high-ratio gzip bomb is stopped at the decompressed limit while streaming", async (t) => {
  const dir = await tempDir(t);
  const bomb = join(dir, "bomb.csv.gz");
  const chunk = Buffer.alloc(64 * 1024, "a,b\n");
  // Stream 256 MiB of plaintext into the bomb so building it never holds the expanded payload in memory.
  await pipeline(async function* () { for (let i = 0; i < 4096; i += 1) yield chunk; }, createGzip({ level: 9 }), createWriteStream(bomb));
  const compressed = await readFile(bomb);
  assert.ok(compressed.length < 512 * 1024, "synthetic bomb compresses by more than 500:1");
  const started = Date.now();
  let parsed = 0;
  await assert.rejects(async () => {
    for await (const _row of csvRows(bomb, limits({ maxDecompressedBytes: 1024 * 1024, maxRows: 10_000_000 }))) parsed += 1;
  }, /exceeds the 1048576-byte decompressed limit/);
  assert.ok(Date.now() - started < 5000, "rejection is prompt");
  // Each 4-byte "a,b\n" line is one row, so parsing must stop within the 1 MiB budget, not the 256 MiB payload.
  assert.ok(parsed > 0 && parsed <= (1024 * 1024) / 4, `parsed ${parsed} rows before rejection`);
});

test("row, time, nesting and corruption limits reject hostile feeds", async (t) => {
  const dir = await tempDir(t);
  const many = join(dir, "rows.csv");
  await writeFile(many, "a,b\n1,2\n3,4\n5,6\n");
  await assert.rejects(rows(many, limits({ maxRows: 3 })), /Feed exceeds 3 rows/);
  assert.equal((await rows(many, limits({ maxRows: 4 }))).length, 4);

  await assert.rejects(rows(many, limits({ deadline: Date.now() - 1 })), /processing time limit/);

  const text = `a,b\n${"x,y\n".repeat(2000)}`;
  const truncated = join(dir, "truncated.csv.gz");
  const full = gzipSync(text);
  await writeFile(truncated, full.subarray(0, full.length - 12));
  await assert.rejects(rows(truncated, limits()), /compression is truncated or corrupt/);

  const corrupt = join(dir, "corrupt.csv.gz");
  const damaged = Buffer.from(full);
  for (let index = 20; index < damaged.length - 8; index += 7) damaged[index] ^= 0xff;
  await writeFile(corrupt, damaged);
  await assert.rejects(rows(corrupt, limits()), /compression is truncated or corrupt|Feed /);

  const nested = join(dir, "nested.csv.gz");
  await writeFile(nested, gzipSync(gzipSync(text)));
  await assert.rejects(rows(nested, limits()), /nested or unsupported compression/);

  const zip = join(dir, "zip.csv");
  await writeFile(zip, Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("rest")]));
  await assert.rejects(rows(zip, limits()), /nested or unsupported compression/);

  const unterminated = join(dir, "quote.csv");
  await writeFile(unterminated, 'a,b\n"open,2\n');
  await assert.rejects(rows(unterminated, limits()), /unterminated quoted field/);

  const longLine = join(dir, "line.csv");
  await writeFile(longLine, `a\n${"z".repeat(MAX_FEED_FIELD_CHARS + 2)}`);
  await assert.rejects(rows(longLine, limits()), /Feed field exceeds/);
});

test("legitimate edge cases parse correctly: embedded newlines, Unicode across chunks, duplicates and empty feeds", async (t) => {
  const dir = await tempDir(t);
  const embedded = join(dir, "embedded.csv.gz");
  await writeFile(embedded, gzipSync('a,b\r\n"line one\nline two",2\r\n"dup",1\n"dup",1\n'));
  assert.deepEqual(await rows(embedded, limits()), [["a", "b"], ["line one\nline two", "2"], ["dup", "1"], ["dup", "1"]]);

  const unicode = join(dir, "unicode.csv");
  const prefix = "a\n" + "x".repeat(65_536 - 2 - 2);
  await writeFile(unicode, `${prefix}\u{1F384}é\u200D\n`);
  const parsed = await rows(unicode, limits());
  assert.equal(parsed[1][0], `${"x".repeat(65_536 - 4)}\u{1F384}é\u200D`);

  const bom = join(dir, "bom.csv");
  await writeFile(bom, "\uFEFFa,b\n1,2");
  assert.deepEqual(await rows(bom, limits()), [["a", "b"], ["1", "2"]]);

  const empty = join(dir, "empty.csv.gz");
  await writeFile(empty, gzipSync(""));
  assert.deepEqual(await rows(empty, limits()), []);
});

test("downloads enforce streamed bytes even when Content-Length lies, and fail cleanly on cancellation or disk errors", async (t) => {
  const dir = await tempDir(t);
  const stream = (chunks, failAfter = Infinity) => {
    let sent = 0;
    return new ReadableStream({
      pull(controller) {
        if (sent >= failAfter) return controller.error(new Error("socket hang up"));
        if (sent >= chunks.length) return controller.close();
        controller.enqueue(new TextEncoder().encode(chunks[sent++]));
      },
    });
  };
  let cancelled = false;
  const declared = new ReadableStream({ pull() { throw new Error("must not read"); }, cancel() { cancelled = true; } });
  await assert.rejects(writeLimited(declared, join(dir, "declared"), 10, "Feed", "11"), /exceeded the 10-byte download limit/);
  assert.equal(cancelled, true, "an over-declared body is cancelled without reading");
  await assert.rejects(writeLimited(stream(["12345", "678901"]), join(dir, "understated"), 10, "Feed", "2"),
    /exceeded the 10-byte download limit/);
  await assert.rejects(writeLimited(stream(["12345", "6"], 1), join(dir, "aborted"), 10, "Feed"), /socket hang up/);
  await assert.rejects(writeLimited(stream(["1"]), join(dir, "missing-dir", "file"), 10, "Feed"), /ENOENT/);
});

test("diagnostics never include feed URLs or the feed key", () => {
  const key = "synthetic-feed-key-1234567890";
  const message = `fetch failed for https://productdata.awin.com/datafeed/download/apikey/${key}/fid/1 and /publisher/3146453/${key}/1/feedList`;
  const redacted = redactAwinDiagnostic(message, [key]);
  assert.doesNotMatch(redacted, new RegExp(key));
  assert.doesNotMatch(redacted, /https?:|productdata|apikey\/[^[]/);
});

test("scheduled sync only selects advertisers Awin marks active or joined", async (t) => {
  const dir = await tempDir(t);
  const list = join(dir, "list.csv");
  const url = (fid) => `https://productdata.awin.com/datafeed/download/apikey/key/fid/${fid}/format/csv`;
  await writeFile(list, ["Advertiser ID,Advertiser Name,Primary Region,Membership Status,Datafeed Format,URL",
    ...["joined", "active", "pending", "suspended", "rejected", "notjoined", "", "Joined "].map((status, index) =>
      `${100 + index},Advertiser ${index},GB,${status},Awin,${url(index)}`)].join("\n"));
  const result = await readAwinFeedList(list, null);
  assert.deepEqual(result.feeds.map((feed) => feed.advertiserId).sort(), ["100", "101", "107"]);
  const restricted = await readAwinFeedList(list, new Set(["101"]));
  assert.deepEqual(restricted.feeds.map((feed) => feed.advertiserId), ["101"]);
});

test("generation cleanup preserves the live catalogue and discard never removes it", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec(await readFile(new URL("../migrations/0001_awin_catalog.sql", import.meta.url), "utf8"));
  db.exec(await readFile(new URL("../migrations/0002_awin_catalogue_facts.sql", import.meta.url), "utf8"));
  const insert = db.prepare(`INSERT INTO awin_products (generation, product_id, advertiser_id, title, price_gbp,
    currency, merchant_url, affiliate_url, in_stock, delivery_known) VALUES (?, ?, '1', 'Item', 1, 'GBP', 'https://m', 'https://a', 1, 0)`);
  for (const generation of ["live", "failed", "older"]) for (let i = 0; i < 3; i++) insert.run(generation, `1:${generation}${i}`);
  db.exec("UPDATE awin_catalogue_state SET active_generation = 'live' WHERE id = 1");
  const count = (generation) => db.prepare("SELECT COUNT(*) AS n FROM awin_products WHERE generation = ?").get(generation).n;

  db.exec(generationDeleteSql("live", true));
  assert.equal(count("live"), 3, "discarding the live generation (publish committed but reported failure) is a no-op");
  db.exec(generationDeleteSql("failed", true));
  assert.equal(count("failed"), 0);
  assert.equal(count("live"), 3);
  db.exec(generationDeleteSql("live", false));
  assert.equal(count("older"), 0);
  assert.equal(count("live"), 3);
  db.close();
});

test("importer dry run refuses to stage a publish when total rows or configured limits are exceeded", async (t) => {
  const dir = await tempDir(t);
  const feed = join(dir, "feed.csv");
  await writeFile(feed, "merchant_id,aw_product_id\n2500,a\n2500,b\n2500,c\n");
  const run = (env) => spawnSync(process.execPath, [importer, "--feed", feed, "--output", join(dir, "out"), "--advertisers", "2500"], {
    encoding: "utf8", env: { ...process.env, AWIN_PUBLISHER_ID: "3146453", ...env },
  });
  const tooMany = run({ AWIN_MAX_TOTAL_ROWS: "2" });
  assert.equal(tooMany.status, 1);
  assert.match(tooMany.stderr, /exceeds 2 rows in total/);
  const invalid = run({ AWIN_MAX_FEED_ROWS: "0" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /AWIN_MAX_FEED_ROWS must be a whole number/);
  const files = await readdir(join(dir, "out")).catch(() => []);
  assert.equal(files.includes("awin-publish.sql"), false, "no publish statement is produced for a rejected feed");
});
