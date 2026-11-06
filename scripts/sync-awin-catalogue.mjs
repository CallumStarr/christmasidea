import { createWriteStream } from "node:fs";
import { mkdtemp, open, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { isAwinAdvertiserName } from "../src/providers/awin-advertisers.js";
import { csvRows, field, headerMap } from "./import-awin-feed.mjs";

const FEED_LIST_ORIGIN = "https://ui.awin.com";
const FEED_ORIGINS = new Set([
  "https://productdata.awin.com",
  "https://datafeed.api.productserve.com",
]);
const MAX_REDIRECTS = 5;

function optionsFrom(argv) {
  const options = { mode: "", help: false, listOnly: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--database") options.database = argv[++index];
    else if (arg.startsWith("--database=")) options.database = arg.slice(11);
    else if (arg === "--advertisers") options.advertisers = argv[++index];
    else if (arg.startsWith("--advertisers=")) options.advertisers = arg.slice(14);
    else if (arg === "--remote" || arg === "--local") options.mode = arg.slice(2);
    else if (arg === "--output") options.output = argv[++index];
    else if (arg.startsWith("--output=")) options.output = arg.slice(9);
    else if (arg === "--list-only") options.listOnly = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

function usage() {
  return [
    "Download all joined Awin CSV product feeds in the publisher feed list, then publish one catalogue generation.",
    "",
    "  $env:AWIN_DATAFEEDS_API_KEY = '<Awin Create-a-Feed key>'",
    "  node scripts/sync-awin-catalogue.mjs --database christmasidea-awin-catalogue --remote",
    "",
    "Requires AWIN_PUBLISHER_ID and AWIN_DATAFEEDS_API_KEY. The OAuth2 Publisher API token is not a feed key.",
    "Use --advertisers to limit the sync; by default all joined advertisers with supported UK feeds are included.",
    "Use --list-only to inspect joined advertisers and feed formats without downloading product feeds.",
    "Use --output <directory> to generate SQL without applying it to D1.",
  ].join("\n");
}

function parseAllowlist(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const ids = String(value)
    .split(",").map((id) => id.trim()).filter((id) => /^\d{1,8}$/.test(id));
  return [...new Set(ids)];
}

export async function readAwinFeedList(path, allowedAdvertisers) {
  const feeds = [];
  const activeAdvertisers = new Set();
  const matchedAdvertisers = new Set();
  const formatsByAdvertiser = new Map();
  const iterator = csvRows(path);
  const first = await iterator.next();
  if (first.done || first.value.length < 2) throw new Error("Awin feed list has no usable header row.");
  const headers = headerMap(first.value);
  const required = ["advertiser_id", "advertiser_name", "primary_region", "membership_status", "datafeed_format", "url"];
  for (const name of required) {
    if (!headers.has(name)) throw new Error(`Awin feed list is missing its ${name} column.`);
  }

  for await (const row of iterator) {
    const advertiserId = field(row, headers, ["advertiser_id"]);
    const membership = field(row, headers, ["membership_status"]).toLowerCase();
    const advertiserName = field(row, headers, ["advertiser_name"]);
    if (!/^\d{1,8}$/.test(advertiserId)
        || (allowedAdvertisers && !allowedAdvertisers.has(advertiserId) && !isAwinAdvertiserName(advertiserName))
        || !["active", "joined"].includes(membership)) continue;
    activeAdvertisers.add(advertiserId);
    const format = field(row, headers, ["datafeed_format"]).toLowerCase();
    matchedAdvertisers.add(advertiserId);
    if (!formatsByAdvertiser.has(advertiserId)) formatsByAdvertiser.set(advertiserId, []);
    formatsByAdvertiser.get(advertiserId).push({
      advertiserName,
      region: field(row, headers, ["primary_region"]).toUpperCase(),
      format,
    });
    if (format !== "awin") continue;
    const region = field(row, headers, ["primary_region"]).toUpperCase();
    if (!["GB", "UK"].includes(region)) continue;
    const url = trustedFeedUrl(field(row, headers, ["url"]));
    if (url) feeds.push({ advertiserId, advertiserName: field(row, headers, ["advertiser_name"]), region, url });
  }

  const coveredAdvertisers = new Set(feeds.map((feed) => feed.advertiserId));
  const uncoveredAdvertisers = [...activeAdvertisers].filter((id) => !coveredAdvertisers.has(id));
  return {
    feeds: [...new Map(feeds.map((feed) => [feed.url, feed])).values()],
    activeAdvertisers: [...activeAdvertisers],
    uncoveredAdvertisers,
    formatsByAdvertiser: Object.fromEntries(formatsByAdvertiser),
    matchedAdvertisers: [...matchedAdvertisers],
  };
}

function trustedFeedUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !FEED_ORIGINS.has(url.origin)
        || url.username || url.password || url.port
        || !url.pathname.startsWith("/datafeed/download/")) return null;
    return url;
  } catch {
    return null;
  }
}

function assertFeedListUrl(value) {
  const url = new URL(value);
  if (url.origin !== FEED_LIST_ORIGIN || url.username || url.password || url.port) {
    throw new Error("Awin feed-list URL is not trusted.");
  }
  return url;
}

async function fetchFeedList({ publisherId, apiKey, signal } = {}) {
  if (!/^\d{1,8}$/.test(publisherId || "") || !apiKey?.trim() || /[\r\n]/.test(apiKey)) {
    throw new Error("Set a valid AWIN_PUBLISHER_ID and AWIN_DATAFEEDS_API_KEY.");
  }
  const url = assertFeedListUrl(
    `${FEED_LIST_ORIGIN}/productdata-darwin-download/publisher/${encodeURIComponent(publisherId)}/${encodeURIComponent(apiKey)}/1/feedList`
  );
  let response;
  try {
    response = await fetch(url, { redirect: "error", signal });
  } catch {
    throw new Error("Could not retrieve Awin's feed list. Check the feed key and network access.");
  }
  if (!response.ok || !response.body) {
    throw new Error(`Awin feed-list request failed with status ${response.status}.`);
  }
  return response;
}

async function downloadFeed(startUrl, destination, signal) {
  let url = trustedFeedUrl(startUrl);
  if (!url) throw new Error("Awin returned a product-feed URL outside the approved hosts.");
  let response;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    try {
      response = await fetch(url, { redirect: "manual", signal });
    } catch {
      throw new Error("Awin product-feed download failed.");
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location || redirects === MAX_REDIRECTS) throw new Error("Awin product-feed redirect limit exceeded.");
    await response.body?.cancel();
    url = trustedFeedUrl(new URL(location, url).href);
    if (!url) throw new Error("Awin redirected a product feed to an unapproved host.");
  }
  if (!response?.ok || !response.body) throw new Error(`Awin product-feed download failed with status ${response?.status || 0}.`);
  const downloaded = `${destination}.download`;
  await pipeline(response.body, createWriteStream(downloaded));
  const handle = await open(downloaded, "r");
  const prefix = Buffer.alloc(2);
  const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
  await handle.close();
  const path = `${destination}${bytesRead === 2 && prefix[0] === 0x1f && prefix[1] === 0x8b ? ".csv.gz" : ".csv"}`;
  await rename(downloaded, path);
  return path;
}

function runImporter(options, feeds, advertisers) {
  const script = fileURLToPath(new URL("./import-awin-feed.mjs", import.meta.url));
  const args = [script, ...feeds.flatMap((feed) => ["--feed", feed]), "--advertisers", advertisers.join(","), "--default-currency", "GBP"];
  if (options.output) args.push("--output", resolve(options.output));
  else args.push("--database", options.database, `--${options.mode}`, "--apply");
  const childEnv = { ...process.env, AWIN_PUBLISHER_ID: process.env.AWIN_PUBLISHER_ID || "3146453" };
  delete childEnv.AWIN_DATAFEEDS_API_KEY;
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: childEnv,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Awin catalogue import failed with exit code ${result.status}.`);
}

async function main() {
  const options = optionsFrom(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.listOnly && !options.output && (!options.database || !["remote", "local"].includes(options.mode))) {
    throw new Error("Specify --output for a dry run or --database with --remote/--local to publish.");
  }
  const advertiserIds = parseAllowlist(options.advertisers ?? process.env.AWIN_ALLOWED_ADVERTISERS);
  if (advertiserIds && !advertiserIds.length) throw new Error("The Awin advertiser allowlist is invalid.");
  const publisherId = String(process.env.AWIN_PUBLISHER_ID || "3146453").trim();
  const apiKey = process.env.AWIN_DATAFEEDS_API_KEY;
  const tempDir = await mkdtemp(join(tmpdir(), "awin-sync-"));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15 * 60 * 1000);
  try {
    const feedList = await fetchFeedList({ publisherId, apiKey, signal: controller.signal });
    const feedListPath = join(tempDir, "feed-list.csv");
    await pipeline(feedList.body, createWriteStream(feedListPath));
    const result = await readAwinFeedList(feedListPath, advertiserIds ? new Set(advertiserIds) : null);
    if (options.listOnly) {
      console.log("Joined advertisers in Awin's feed list:");
      for (const [advertiserId, entries] of Object.entries(result.formatsByAdvertiser)) {
        const summary = [...new Set(entries.map((entry) => `${entry.advertiserName} | ${entry.region || "region unknown"} | ${entry.format || "format unknown"}`))];
        const supportedFeeds = result.feeds.filter((feed) => feed.advertiserId === advertiserId).length;
        console.log(`${advertiserId}: ${summary.join("; ")} | supported UK Awin feeds: ${supportedFeeds}`);
      }
      return;
    }
    if (!result.feeds.length) {
      throw new Error("No joined, approved advertisers have downloadable Awin-format feeds.");
    }
    console.log(`Awin feed list: ${result.activeAdvertisers.length} joined advertisers; ${result.feeds.length} supported UK Awin feeds.`);
    if (result.uncoveredAdvertisers.length) {
      const details = result.uncoveredAdvertisers.map((advertiserId) => {
        const formats = result.formatsByAdvertiser[advertiserId] || [];
        const summary = [...new Set(formats.map(({ advertiserName, region, format }) =>
          `${advertiserName} (${region || "region unknown"}, ${format || "format unknown"})`))];
        return `${advertiserId}${summary.length ? `: ${summary.join("; ")}` : ""}`;
      });
      console.warn(`No supported UK Awin-format feed found for joined advertisers: ${details.join(", ")}.`);
    }
    const feeds = [];
    for (let index = 0; index < result.feeds.length; index++) {
      const path = await downloadFeed(result.feeds[index].url, join(tempDir, `feed-${index}`), controller.signal);
      feeds.push(path);
    }
    const supportedAdvertisers = [...new Set(result.feeds.map((feed) => feed.advertiserId))];
    runImporter(options, feeds, supportedAdvertisers);
  } finally {
    clearTimeout(timeout);
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
