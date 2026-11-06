import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { csvRows, MAX_FEED_FIELD_CHARS, MAX_FEED_ROW_FIELDS } from "../scripts/import-awin-feed.mjs";
import { writeLimited } from "../scripts/sync-awin-catalogue.mjs";

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), "awin-limits-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

async function rows(path) {
  const out = [];
  for await (const row of csvRows(path)) out.push(row);
  return out;
}

const body = (...chunks) => new ReadableStream({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
    controller.close();
  },
});

test("feed downloads stop at the byte limit without echoing any URL", async (t) => {
  const dir = await tempDir(t);
  assert.equal(await writeLimited(body("abc", "def"), join(dir, "ok.csv"), 6, "Feed"), 6);
  assert.equal(await readFile(join(dir, "ok.csv"), "utf8"), "abcdef");
  await assert.rejects(writeLimited(body("abc", "defg"), join(dir, "big.csv"), 6, "An Awin product feed"),
    (error) => /An Awin product feed exceeded the 6-byte download limit/.test(error.message) && !/https?:/.test(error.message));
});

test("CSV parsing rejects oversized fields, escaped-quote growth and excessive columns, including gzip feeds", async (t) => {
  const dir = await tempDir(t);
  const normal = join(dir, "normal.csv");
  await writeFile(normal, `a,b\n"x ""quoted"" value",${"y".repeat(5000)}\n`);
  assert.deepEqual((await rows(normal))[1], ['x "quoted" value', "y".repeat(5000)]);

  const oversized = join(dir, "field.csv.gz");
  await writeFile(oversized, gzipSync(`a\n${"z".repeat(MAX_FEED_FIELD_CHARS + 10)}\n`));
  await assert.rejects(rows(oversized), /Feed field exceeds/);

  const escaped = join(dir, "escaped.csv");
  await writeFile(escaped, `a\n"${'""'.repeat(MAX_FEED_FIELD_CHARS + 10)}"\n`);
  await assert.rejects(rows(escaped), /Feed field exceeds/);

  const wide = join(dir, "wide.csv");
  await writeFile(wide, `${",".repeat(MAX_FEED_ROW_FIELDS + 5)}\n`);
  await assert.rejects(rows(wide), /Feed row exceeds/);
});
