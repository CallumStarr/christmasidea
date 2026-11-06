import { normaliseSavedList, verifiedGiftDisclosure } from "./monetization-data.js";

export const MAX_FRAGMENT_LENGTH = 12000;
const MAX_JSON_BYTES = 50000;

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new TypeError("Invalid shared-list encoding");
  const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function boundedStream(stream, maxBytes) {
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new RangeError("Shared list is too large");
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch { console.warn("Shared-list decoder could not be cancelled."); }
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function encodeWishlist(items, compress = true) {
  const safe = normaliseSavedList(items);
  if (!safe.length) throw new TypeError("Save at least one gift before sharing");
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, items: safe }));
  if (bytes.length > MAX_JSON_BYTES) throw new RangeError("This list is too long to share. Remove a few gifts and try again.");
  let payload = bytes, prefix = "j1.";
  if (compress && typeof CompressionStream === "function") {
    const compressed = await boundedStream(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")), MAX_JSON_BYTES);
    if (compressed.length < bytes.length) { payload = compressed; prefix = "g1."; }
  }
  const result = prefix + base64url(payload);
  if (result.length > MAX_FRAGMENT_LENGTH) throw new RangeError("This list is too long to share. Remove a few gifts and try again.");
  return result;
}

export async function decodeWishlist(value) {
  if (typeof value !== "string" || value.length > MAX_FRAGMENT_LENGTH) throw new RangeError("Shared list is too large");
  const [prefix, payload, extra] = value.split(".");
  if (!["j1", "g1"].includes(prefix) || !payload || extra !== undefined) throw new TypeError("Unsupported shared-list format");
  let bytes = fromBase64(payload);
  if (prefix === "g1") {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot open compressed lists. Try a newer browser.");
    bytes = await boundedStream(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")), MAX_JSON_BYTES);
  }
  if (bytes.length > MAX_JSON_BYTES) throw new RangeError("Shared list is too large");
  const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (data?.version !== 1) throw new TypeError("Unsupported shared-list version");
  return normaliseSavedList(data.items);
}

export async function wishlistUrl(items, origin) {
  const url = new URL("/", origin);
  url.search = "";
  url.hash = `list=${await encodeWishlist(items)}`;
  return url.toString();
}

export function sharedListText(items, url, linksFor) {
  const lines = ["My gift shortlist — Santa's Helper", "Shopping links may earn Santa's Helper a commission.", ""];
  for (const item of items) {
    const link = linksFor(item)[0];
    lines.push(`• ${item.title}${link ? `\n  ${link.href}` : "\n  Partner offer is no longer available."}`);
    if (item.verifiedGift) lines.push(`  ${verifiedGiftDisclosure(item.verifiedGift)}\n  Terms: ${item.verifiedGift.termsUrl}`);
    if (item.sponsored) lines.push(`  Sponsored Pick${item.demo ? " (demo placement)" : ""}`);
  }
  lines.push("", `See the full list: ${url}`);
  return lines.join("\n");
}

export function finderPreset(hash) {
  const state = new URLSearchParams(hash.replace(/^#/, ""));
  const topics = { coffee: "coffee and trying different brews", gardening: "gardening and growing plants", personalised: "thoughtful personalised everyday items" };
  const topic = state.get("finder");
  if (!topic) return null;
  const budget = Number(state.get("budget"));
  if (!topics[topic] || !Number.isInteger(budget) || budget < 1 || budget > 1000) throw new TypeError("Invalid gift-guide finder preset");
  return `Someone who enjoys ${topics[topic]}. Budget up to £${budget}.`;
}
