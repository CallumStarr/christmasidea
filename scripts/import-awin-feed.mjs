import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createGunzip } from "node:zlib";
import { AWIN_ADVERTISER_IDS } from "../src/providers/awin-advertisers.js";
import { isAwinProductUrl } from "../src/providers/awin.js";

const INSERT_BATCH_SIZE = 50;
const SQL_FILE_SIZE = 1000;
const CLEANUP_BATCH_SIZE = 250;

function argumentsFrom(argv) {
  const options = { feeds: [], apply: false, mode: "" };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--feed") options.feeds.push(argv[++index]);
    else if (arg.startsWith("--feed=")) options.feeds.push(arg.slice(7));
    else if (arg === "--database") options.database = argv[++index];
    else if (arg.startsWith("--database=")) options.database = arg.slice(11);
    else if (arg === "--advertisers") options.advertisers = argv[++index];
    else if (arg.startsWith("--advertisers=")) options.advertisers = arg.slice(14);
    else if (arg === "--default-currency") options.defaultCurrency = argv[++index];
    else if (arg.startsWith("--default-currency=")) options.defaultCurrency = arg.slice(19);
    else if (arg === "--output") options.output = argv[++index];
    else if (arg.startsWith("--output=")) options.output = arg.slice(9);
    else if (arg === "--remote" || arg === "--local") options.mode = arg.slice(2);
    else if (arg === "--apply") options.apply = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function usage() {
  return [
    "Import one or more comma-delimited Awin CSV product feeds into the staged D1 catalogue.",
    "",
    "  node scripts/import-awin-feed.mjs --feed feed.csv.gz [--feed another.csv] --output path",
    "  node scripts/import-awin-feed.mjs --feed feed.csv.gz --database christmasidea-awin-catalogue --remote --apply",
    "",
    "--apply requires --database and exactly one of --remote or --local.",
    "--advertisers accepts a comma-separated allowlist; defaults to IDs supplied in src/providers/awin-advertisers.js.",
  ].join("\n");
}

export async function* csvRows(path) {
  const input = createReadStream(path);
  const stream = /\.gz$/i.test(path) ? input.pipe(createGunzip()) : input;
  stream.setEncoding("utf8");
  let field = "";
  let row = [];
  let quoted = false;
  let quotePending = false;
  let skipAfterQuote = false;
  let first = true;
  for await (const chunk of stream) {
    const text = chunk;
    for (let index = 0; index < text.length; index++) {
      const char = text[index];
      if (first) {
        first = false;
        if (char === "\uFEFF") continue;
      }
      if (quotePending) {
        quotePending = false;
        if (char === '"') {
          field += '"';
          continue;
        }
        quoted = false;
        skipAfterQuote = true;
      }
      if (quoted) {
        if (char === '"') {
          if (index + 1 < text.length) {
            if (text[index + 1] === '"') {
              field += '"';
              index++;
            } else {
              quoted = false;
              skipAfterQuote = true;
            }
          } else quotePending = true;
        } else field += char;
        continue;
      }
      if (skipAfterQuote && (char === " " || char === "\t")) continue;
      skipAfterQuote = false;
      if (char === '"' && field === "") quoted = true;
      else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field.replace(/\r$/, ""));
        yield row;
        row = [];
        field = "";
      } else field += char;
    }
  }
  if (quotePending) quoted = false;
  if (quoted) throw new Error(`Feed has an unterminated quoted field: ${path}`);
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    yield row;
  }
}

export function headerMap(headers) {
  return new Map(headers.map((header, index) => [
    String(header || "").trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[\s-]+/g, "_"), index,
  ]));
}

export function field(row, headers, names) {
  for (const name of names) {
    const index = headers.get(name);
    if (index !== undefined && String(row[index] || "").trim()) return String(row[index]).trim();
  }
  return "";
}

function clean(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function money(value) {
  const text = String(value || "").trim();
  if (/^(?:free|included|no charge)$/i.test(text)) return 0;
  const number = Number(text.replace(/[£,\s]/g, ""));
  return Number.isFinite(number) && number >= 0 && number <= 100000 ? Math.round(number * 100) / 100 : null;
}

function stockAvailable(value) {
  return /^(?:1|true|yes|y|in[\s_-]*stock|available)$/i.test(String(value || "").trim());
}

function awinLinkRejection(value, advertiserId, publisherId) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return "awin_deep_link_malformed";
  }
  if (!["https:", "http:"].includes(url.protocol)) return "awin_deep_link_not_http_or_https";
  if (url.hostname !== "www.awin1.com") return "awin_deep_link_host_unexpected";
  if (url.username || url.password || url.port) return "awin_deep_link_authority_invalid";
  if (!["/cread.php", "/pclick.php"].includes(url.pathname)) {
    const path = url.pathname.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    return `awin_deep_link_path_${path || "empty"}`;
  }
  const affiliateId = url.searchParams.get("awinmid") || url.searchParams.get("m");
  if (affiliateId !== advertiserId) return "awin_advertiser_id_mismatch";
  const publisher = url.searchParams.get("awinaffid") || url.searchParams.get("a");
  if (publisher !== publisherId) return "awin_publisher_id_mismatch";
  if (url.pathname === "/pclick.php" && url.searchParams.has("p")) return "";
  const destination = url.searchParams.get("ued");
  if (!destination) return "awin_destination_missing";
  const parsedDestination = safeHttpsUrl(destination);
  if (!parsedDestination) return "awin_destination_invalid";
  return "";
}

function secureAwinLink(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" && url.hostname === "www.awin1.com"
        && !url.username && !url.password && !url.port) url.protocol = "https:";
    return url.href;
  } catch {
    return String(value || "");
  }
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url : null;
  } catch {
    return null;
  }
}

function sql(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normaliseRow(row, headers, { allowed, publisherId, rejectionCounts, defaultCurrency }) {
  const advertiserId = field(row, headers, ["merchant_id", "advertiser_id", "awinmid"]);
  const sourceId = field(row, headers, ["aw_product_id", "product_id", "merchant_product_id"]);
  const productId = `${advertiserId}:${sourceId}`;
  const title = clean(field(row, headers, ["product_name", "title", "product_title"]), 240);
  const currency = (field(row, headers, ["currency", "currency_code"]) || defaultCurrency).toUpperCase();
  const price = money(field(row, headers, ["search_price", "price", "product_price"]));
  const stock = field(row, headers, ["in_stock", "stock_status", "availability"]);
  const merchantName = clean(field(row, headers, ["merchant_name", "advertiser_name"]), 80);
  const affiliateUrl = secureAwinLink(field(row, headers, ["aw_deep_link", "affiliate_url"]));
  const awinId = `${advertiserId}:${sourceId}`;
  const reject = (reason) => {
    rejectionCounts[reason] = (rejectionCounts[reason] || 0) + 1;
    return null;
  };
  if (!/^\d{1,8}$/.test(advertiserId) || !allowed.has(advertiserId)) return reject("advertiser_not_allowed_or_missing");
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(sourceId) || !PRODUCT_ID.test(productId)) return reject("product_id_missing_or_invalid");
  if (!title) return reject("title_missing");
  if (currency !== "GBP") return reject("currency_not_gbp");
  if (price === null || price <= 0) return reject("price_missing_or_invalid");
  if (!stock.trim()) return reject("stock_status_missing");
  if (!stockAvailable(stock)) return reject("not_in_stock");
  const linkRejection = awinLinkRejection(affiliateUrl, advertiserId, publisherId);
  if (linkRejection) return reject(linkRejection);
  const affiliate = safeHttpsUrl(affiliateUrl);
  const destination = affiliate?.searchParams.get("ued")
    ? safeHttpsUrl(affiliate.searchParams.get("ued")) : null;
  const feedDestination = field(row, headers, ["merchant_deep_link", "product_url", "merchant_product_url", "url"]);
  const merchantUrl = safeHttpsUrl(feedDestination) || destination;
  if (!merchantUrl || (destination && destination.href !== merchantUrl.href)) {
    return reject("destination_invalid_or_mismatched");
  }
  if (!isAwinProductUrl(affiliate.href, awinId, publisherId, allowed, merchantUrl.href)) {
    return reject("awin_deep_link_invalid");
  }

  const image = safeHttpsUrl(field(row, headers, ["merchant_image_url", "image_url", "product_image_url"]));
  const deliveryText = field(row, headers, ["delivery_cost", "shipping_cost"]);
  const deliveryCost = deliveryText ? money(deliveryText) : null;
  const deliveryKnown = deliveryCost !== null;
  const gtin = field(row, headers, ["ean", "gtin", "upc", "isbn"]).replace(/\D/g, "").slice(0, 14);
  return {
    advertiserId,
    productId,
    title,
    description: clean(field(row, headers, ["description", "product_description"]), 1000),
    brand: clean(field(row, headers, ["brand_name", "brand", "manufacturer"]), 80),
    merchantName,
    category: clean(field(row, headers, ["merchant_category", "product_type", "category"]), 160),
    price,
    deliveryCost,
    deliveryKnown,
    currency,
    imageUrl: image?.href || "",
    merchantUrl: merchantUrl.href,
    affiliateUrl: affiliate.href,
    gtin,
    inStock: 1,
  };
}

const PRODUCT_ID = /^(\d{1,8}):([A-Za-z0-9._-]{1,80})$/;

function insertStatement(generation, rows) {
  const columns = [
    "generation", "product_id", "advertiser_id", "title", "description", "brand", "merchant_name", "category",
    "price_gbp", "delivery_cost_gbp", "delivery_known", "currency", "image_url", "merchant_url", "affiliate_url",
    "gtin", "in_stock",
  ];
  const values = rows.map((row) => `(${[
    generation, row.productId, row.advertiserId, row.title, row.description, row.brand, row.merchantName, row.category,
    row.price, row.deliveryKnown ? row.deliveryCost : null, row.deliveryKnown ? 1 : 0, row.currency, row.imageUrl,
    row.merchantUrl, row.affiliateUrl, row.gtin, row.inStock,
  ].map(sql).join(",")})`).join(",\n");
  return `INSERT INTO awin_products (${columns.join(",")}) VALUES\n${values}\nON CONFLICT(generation, product_id) DO UPDATE SET\n${
    columns.filter((column) => column !== "generation" && column !== "product_id")
      .map((column) => `${column}=excluded.${column}`).join(",\n")
  };\n`;
}

function runWrangler(database, mode, file) {
  const args = ["wrangler", "d1", "execute", database, `--${mode}`, "--file", file, "--yes"];
  const result = spawnSync("npx", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler D1 import failed with exit code ${result.status}.`);
}

async function deleteOldProducts(database, mode, generation, file) {
  const command = `DELETE FROM awin_products WHERE id IN (` +
    `SELECT id FROM awin_products WHERE generation NOT IN (${sql(generation)}) LIMIT ${CLEANUP_BATCH_SIZE}` +
    ");\n";
  await writeFile(file, command, "utf8");
  const args = ["wrangler", "d1", "execute", database, `--${mode}`, "--file", file, "--json", "--yes"];
  const result = spawnSync("npx", args, { encoding: "utf8", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler D1 cleanup failed with exit code ${result.status}.`);
  try {
    const lines = result.stdout.split(/\r?\n/);
    const jsonStart = lines.findIndex((line) => /^\s*\[\s*$/.test(line));
    if (jsonStart === -1) throw new Error("JSON output missing");
    const responses = JSON.parse(lines.slice(jsonStart).join("\n"));
    return responses.some((response) => Number(response.meta?.changes || 0) > 0);
  } catch {
    throw new Error("Wrangler returned an invalid response while cleaning old Awin catalogue rows.");
  }
}

async function cleanupOldProducts(database, mode, generation, outputDir) {
  let batches = 0;
  while (true) {
    const changed = await deleteOldProducts(database, mode, generation, join(outputDir, "awin-cleanup.sql"));
    if (!changed) break;
    batches++;
    if (batches % 20 === 0) console.log(`Cleaned ${batches} batches of previous Awin-generation products.`);
  }
  console.log(`Cleaned previous Awin generations in ${batches} batches.`);
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.feeds.length) throw new Error(`At least one --feed is required.\n${usage()}`);
  if (options.apply && (!options.database || !["remote", "local"].includes(options.mode))) {
    throw new Error("--apply requires --database and either --remote or --local.");
  }
  if (!options.apply && !options.output) throw new Error("Use --output for a dry run or --apply to import the feed.");

  const ids = String(options.advertisers || process.env.AWIN_ALLOWED_ADVERTISERS || AWIN_ADVERTISER_IDS.join(","))
    .split(",").map((id) => id.trim()).filter((id) => /^\d{1,8}$/.test(id));
  const allowed = new Set(ids);
  const publisherId = String(process.env.AWIN_PUBLISHER_ID || "3146453").trim();
  const defaultCurrency = String(options.defaultCurrency || "").trim().toUpperCase();
  if (!allowed.size || !/^\d{1,8}$/.test(publisherId)) throw new Error("The Awin publisher or advertiser allowlist is invalid.");
  if (defaultCurrency && !/^[A-Z]{3}$/.test(defaultCurrency)) throw new Error("The default currency must be a three-letter currency code.");

  const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const publishedAt = new Date().toISOString();
  const outputDir = options.output ? resolve(options.output) : await mkdtemp(join(tmpdir(), "awin-feed-"));
  const temporary = !options.output;
  await mkdir(outputDir, { recursive: true });
  const staging = [];
  let accepted = 0;
  let rejected = 0;
  let rowsSeen = 0;
  const rejectionCounts = {};
  const feedHeaders = [];
  let batch = [];
  let statements = [];
  let fileIndex = 0;
  const flushFile = async () => {
    if (!statements.length) return;
    const file = join(outputDir, `awin-import-${String(fileIndex++).padStart(4, "0")}.sql`);
    await writeFile(file, statements.join("\n"), "utf8");
    staging.push(file);
    statements = [];
    if (options.apply) runWrangler(options.database, options.mode, file);
  };
  const flushRows = async () => {
    if (!batch.length) return;
    statements.push(insertStatement(generation, batch));
    batch = [];
    if (statements.length >= SQL_FILE_SIZE / INSERT_BATCH_SIZE) await flushFile();
  };

  try {
    for (const feed of options.feeds) {
      const path = resolve(feed);
      const iterator = csvRows(path);
      const first = await iterator.next();
      if (first.done || first.value.length < 2) throw new Error(`Feed has no usable header row: ${path}`);
      const headers = headerMap(first.value);
      feedHeaders.push([...headers.keys()]);
      for await (const row of iterator) {
        rowsSeen++;
        const product = normaliseRow(row, headers, { allowed, publisherId, rejectionCounts, defaultCurrency });
        if (!product) {
          rejected++;
          continue;
        }
        accepted++;
        batch.push(product);
        if (batch.length >= INSERT_BATCH_SIZE) await flushRows();
      }
    }
    await flushRows();
    await flushFile();
    if (!accepted) {
      const diagnostics = Object.entries(rejectionCounts).map(([reason, count]) => `${reason}=${count}`).join(", ");
      console.error(`Awin feed diagnostics: ${rowsSeen} rows; headers: ${JSON.stringify(feedHeaders)}; rejected: ${diagnostics || "none"}.`);
      throw new Error("No eligible in-stock GBP products were found. The active catalogue was not changed.");
    }

    const publishFile = join(outputDir, "awin-publish.sql");
    await writeFile(publishFile,
      `UPDATE awin_catalogue_state SET active_generation=${sql(generation)}, published_at=${sql(publishedAt)} WHERE id=1;\n`,
      "utf8");
    if (options.apply) {
      runWrangler(options.database, options.mode, publishFile);
      try {
        await cleanupOldProducts(options.database, options.mode, generation, outputDir);
      } catch (error) {
        throw new Error(`Generation ${generation} is active, but cleanup of previous products failed: ${error.message}`);
      }
    } else staging.push(publishFile);
    console.log(`Awin feed import prepared: ${accepted} eligible, ${rejected} rejected, generation ${generation}.`);
    if (!options.apply) console.log(`SQL files: ${staging.join(", ")}`);
    else console.log(`Generation published to ${options.mode} D1 database "${options.database}".`);
  } finally {
    if (temporary) await rm(outputDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
