import { STRATEGIES } from "../constants.js";
import { feedbackKeys, FEEDBACK_EVENTS, FEEDBACK_SOURCES } from "./feedback.js";
import { validLearning } from "./learning.js";
import { normaliseProductIdea } from "../product-validation.js";

export const RECEIPT_LIFETIME_MS = 86400_000;
const encoder = new TextEncoder();
const encode = (value) => btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const decode = (value) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (char) => char.charCodeAt(0));

async function signingKey(env) {
  if (typeof env.IP_SALT !== "string" || env.IP_SALT.length < 32) throw new Error("Feedback signing requires IP_SALT.");
  return crypto.subtle.importKey("raw", encoder.encode(env.IP_SALT), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const signedBytes = (payload) => encoder.encode(`santas-helper:feedback:v1:${payload}`);

async function productHash(idea) {
  const value = normaliseProductIdea(idea);
  if (!value) return null;
  return encode(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(JSON.stringify(value)))));
}

async function readReceipt(token, key, now) {
  try {
    if (typeof token !== "string" || token.length > 2000 || !/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]{43}$/.test(token)) return null;
    const [payload, signature] = token.split(".");
    if (!await crypto.subtle.verify("HMAC", key, decode(signature), signedBytes(payload))) return null;
    const receipt = JSON.parse(new TextDecoder().decode(decode(payload)));
    if (receipt?.v !== 1 || !/^[a-f0-9-]{36}$/.test(receipt.id)
        || !Number.isSafeInteger(receipt.expires) || receipt.expires <= now
        || receipt.expires > now + RECEIPT_LIFETIME_MS) return null;
    return receipt;
  } catch {
    return null;
  }
}

export async function issueFeedbackReceipts(ideas, env, now = Date.now()) {
  if (!Array.isArray(ideas) || ideas.length > 12) throw new Error("Feedback issuance supports at most twelve cards.");
  const key = await signingKey(env);
  return Promise.all(ideas.map(async (idea, position) => {
    if (!FEEDBACK_SOURCES.includes(idea.source)) throw new Error("Feedback issuance requires a valid card source.");
    const learning = validLearning(idea.learning) ? {
      topic: idea.learning.topic, age: idea.learning.age, budget: idea.learning.budget,
      category: idea.learning.category, policy: idea.learning.policy,
      ...(idea.learning.concept ? { concept: idea.learning.concept, graph: idea.learning.graph,
        singleTopic: idea.learning.singleTopic === true } : {}),
    } : undefined;
    const item = { source: idea.source, strategy: STRATEGIES.includes(idea.strategy) ? idea.strategy : "unknown",
      discovery: idea.discovery === true, position, ...(learning ? { learning } : {}) };
    const hash = await productHash(idea);
    const payload = encode(encoder.encode(JSON.stringify({
      v: 1, id: crypto.randomUUID(), expires: now + RECEIPT_LIFETIME_MS, item,
      ...(hash ? { productHash: hash } : {}),
    })));
    const signature = encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, signedBytes(payload))));
    return { ...idea, feedbackToken: `${payload}.${signature}` };
  }));
}

export async function verifyProductReceipts(ideas, env, now = Date.now()) {
  const signed = ideas.slice(0, 8).filter((idea) => idea?.feedbackToken !== undefined);
  if (!signed.length) return { ok: true, legacy: true };
  const key = await signingKey(env);
  for (const idea of signed) {
    const receipt = await readReceipt(idea.feedbackToken, key, now);
    if (!receipt || (receipt.productHash !== undefined && receipt.productHash !== await productHash(idea))) {
      return { ok: false, error: "Product details changed or their receipt expired. Request fresh ideas." };
    }
  }
  // Pre-upgrade clients/receipts remain compatible; only new issued receipts bind product constraints.
  return { ok: true };
}

export async function verifyFeedbackReceipts(body, env, now = Date.now()) {
  if (!body || !FEEDBACK_EVENTS.includes(body.event)) return { ok: false, error: "Unknown event." };
  if (body.event === "more") return { ok: true, legacy: true, body };
  const raw = body.event === "shown" ? body.items : [body.item];
  if (!Array.isArray(raw) || !raw.length || raw.length > 12) return { ok: false, error: "Send between one and twelve feedback items." };
  const signed = raw.filter((item) => item?.feedbackToken !== undefined);
  if (!signed.length) return { ok: true, legacy: true, body };
  if (signed.length !== raw.length) return { ok: false, error: "Do not mix signed and unsigned feedback." };
  const key = await signingKey(env);
  const records = [];
  for (const value of raw) {
    const receipt = await readReceipt(value?.feedbackToken, key, now);
    if (!receipt) return { ok: false, error: "Feedback receipt has expired or is invalid." };
    const event = body.event;
    if (!Number.isInteger(value.position) || value.position < 0 || value.position > 11) return { ok: false, error: "Invalid feedback position." };
    // Photo selection may compact/reorder issued cards. Only display position remains browser-reported.
    const item = { ...receipt.item, position: value.position };
    const counters = feedbackKeys({ event, item, items: [item] }, { verified: true });
    const shown = feedbackKeys({ event: "shown", items: [item] }, { verified: true });
    if (!counters.ok || !shown.ok) return { ok: false, error: "Invalid feedback dimensions." };
    records.push({ id: receipt.id, expires: receipt.expires, event, keys: counters.keys, shownKeys: shown.keys });
  }
  return { ok: true, legacy: false, records };
}
