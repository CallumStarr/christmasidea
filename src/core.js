// Core request handling for the Gift Helper API.
// Kept free of Cloudflare-only imports so it can be unit tested in Node.

import { AGES, BUDGETS, CATEGORIES, OCCASIONS, RELATIONS } from "./constants.js";
import { CANDIDATE_COUNT, GIFT_TOOL, PROMPT_VERSION, SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";
import { VALIDATOR_VERSION, curateIdeas, sanitiseIdeas } from "./validate.js";
import { cleanText } from "./text.js";
import { productDiscoveryAvailable, searchProductsForIdeas } from "./product-search.js";
import { ENGINE_VERSION, engineFallback, promptHints, runEngine, understand } from "./engine/index.js";
import { feedbackKeys } from "./engine/feedback.js";
import * as baselinePrompt from "./prompts/gift-curator-v3.3.js";
import { catalogueFallback } from "./catalogue.js";

export { AGES, BUDGETS, CATEGORIES, OCCASIONS, RELATIONS };
export { CANDIDATE_COUNT, GIFT_TOOL, PROMPT_VERSION, SYSTEM_PROMPT, buildUserMessage };
export { VALIDATOR_VERSION, curateIdeas, sanitiseIdeas };
export { ENGINE_VERSION, engineFallback, promptHints, runEngine, understand };

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2026-10-21";
// Twelve candidate ideas, discovery directions, the recipient profile and some adaptive-thinking headroom. Haiku 5.5 counts
// thinking tokens as output, so a limit sized only for the visible JSON truncates real responses.
export const DEFAULT_MAX_OUTPUT_TOKENS = 4500;
export const DEFAULT_EFFORT = "low";
const EFFORTS = ["low", "medium", "high"];

/** Effort is validated, never passed through blindly; an unknown value falls back to the default. */
export function resolveEffort(value) {
  const v = String(value || "").trim().toLowerCase();
  return EFFORTS.includes(v) ? v : DEFAULT_EFFORT;
}

/**
 * Generation settings shared by the production Worker and the benchmark runner so measured
 * behaviour is the behaviour visitors get. Haiku 5.5 rejects `budget_tokens` (400); it uses
 * adaptive thinking steered by `output_config.effort`.
 */
export function generationParams({ maxTokens, effort } = {}) {
  return {
    max_tokens: Number(maxTokens) || DEFAULT_MAX_OUTPUT_TOKENS,
    thinking: { type: "adaptive" },
    output_config: { effort: resolveEffort(effort) },
  };
}

/** Everything that changes what the model returns for the same input, for cache keys and metadata. */
export function generationFingerprint(env = {}) {
  const p = generationParams({ maxTokens: env.MAX_OUTPUT_TOKENS, effort: env.CLAUDE_EFFORT });
  return `${p.thinking.type}:${p.output_config.effort}:${p.max_tokens}:forced-strict-tool`;
}

const MAX = { description: 1200, interests: 200, about: 500, exclude: 24, excludeItem: 80, token: 2048 };

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function normaliseInput(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Send the form as JSON." };
  const mode = pick(body.mode, ["describe", "guided"], "guided");
  const input = {
    mode,
    description: cleanText(body.description, MAX.description),
    relation: pick(body.relation, RELATIONS, "other"),
    age: pick(body.age, AGES, "unknown"),
    budget: pick(body.budget, Object.keys(BUDGETS), "any"),
    occasion: pick(body.occasion, OCCASIONS, "christmas"),
    interests: cleanText(body.interests, MAX.interests),
    about: cleanText(body.about, MAX.about),
    exclude: Array.isArray(body.exclude)
      ? body.exclude.slice(0, MAX.exclude).map((s) => cleanText(s, MAX.excludeItem)).filter(Boolean)
      : [],
  };
  const hasDescription = Boolean(input.description);
  const hasGuidedDetails = Boolean(input.interests || input.about);
  if (mode === "describe" ? !hasDescription : !hasGuidedDetails) {
    return { ok: false, error: mode === "describe"
      ? "Describe the person you're buying for."
      : "Tell us at least one thing they're into." };
  }
  const token = typeof body.turnstileToken === "string" ? body.turnstileToken.slice(0, MAX.token) : "";
  return { ok: true, value: input, token };
}

export function allowedOrigin(origin, env) {
  const list = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!origin) return null;
  return list.includes(origin) ? origin : null;
}

export function corsHeaders(origin) {
  const h = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(data, status, origin, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
      ...extra,
    },
  });
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyTurnstile(token, ip, env, fetchImpl) {
  if (!env.TURNSTILE_SECRET) return true; // Turnstile not configured
  if (!token) return false;
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data && data.success === true;
  } catch {
    return false;
  }
}

export async function callClaude(input, env, fetchImpl) {
  return (await callClaudeDetailed(input, env, fetchImpl)).output;
}

/** Anthropic's constrained decoding rejects length/count keywords; those limits stay enforced by the prompt and server validation. */
function makeStrictSchema(schema) {
  const result = { ...schema };
  delete result.maxLength;
  delete result.minLength;
  delete result.maxItems;
  delete result.minItems;
  if (result.type === "object" && result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, makeStrictSchema(value)]),
    );
    result.required = Object.keys(result.properties);
    result.additionalProperties = false;
  }
  if (result.type === "array" && result.items) result.items = makeStrictSchema(result.items);
  return result;
}

export const STRICT_GIFT_TOOL = { ...GIFT_TOOL, strict: true, input_schema: makeStrictSchema(GIFT_TOOL.input_schema) };
const BASELINE_TOOL = { ...baselinePrompt.GIFT_TOOL, strict: true, input_schema: makeStrictSchema(baselinePrompt.GIFT_TOOL.input_schema) };

const STRICT_OUTPUT_NOTE = "\n\nOUTPUT REQUIREMENT\n- Include every field in the tool schema. Use an empty string for note when no additional note is needed.";
const AUTO_TOOL_NOTE = "\n- You must return the result by calling the gift_ideas tool exactly once. Do not answer with plain text instead.";

/**
 * The one request builder used by the Worker and by the Haiku benchmark. Haiku 5.5 accepts a forced
 * tool_choice; the response then starts with the tool call and has no thinking block. Models that
 * cannot force a tool (Sonnet 5.5) pass forceTool=false and get `auto` plus an explicit instruction.
 */
export function buildClaudeRequest({ model, userMessage, maxTokens, effort, forceTool = true, baseline = false }) {
  const system = baseline ? baselinePrompt.SYSTEM_PROMPT : SYSTEM_PROMPT;
  const tool = baseline ? BASELINE_TOOL : STRICT_GIFT_TOOL;
  return {
    model,
    ...generationParams({ maxTokens, effort }),
    system: forceTool ? `${system}${STRICT_OUTPUT_NOTE}` : `${system}${STRICT_OUTPUT_NOTE}${AUTO_TOOL_NOTE}`,
    tools: [tool],
    tool_choice: forceTool ? { type: "tool", name: tool.name } : { type: "auto" },
    messages: [{ role: "user", content: userMessage }],
  };
}

/** Like callClaude, but also reports why generation stopped so truncation is never mistaken for success. */
export async function callClaudeDetailed(input, env, fetchImpl, hints = null) {
  const baseline = env.RECOMMENDATION_MODE === "baseline-v3.3";
  const res = await fetchImpl(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(buildClaudeRequest({
      model: env.MODEL || "claude-haiku-5-5",
      userMessage: baseline ? baselinePrompt.buildUserMessage(input) : buildUserMessage(input, hints),
      maxTokens: env.MAX_OUTPUT_TOKENS,
      effort: env.CLAUDE_EFFORT,
      baseline,
    })),
    signal: AbortSignal.timeout(Number(env.UPSTREAM_TIMEOUT_MS) || 25000),
  });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.text()).slice(0, 300); } catch {}
    const err = new Error(`Upstream ${res.status}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  const data = await res.json();
  const block = Array.isArray(data.content) ? data.content.find((b) => b.type === "tool_use") : null;
  if (!block) throw new Error("No tool_use block in response");
  const stopReason = typeof data.stop_reason === "string" ? data.stop_reason : null;
  return { output: block.input, stopReason, truncated: stopReason === "max_tokens", usage: data.usage || {} };
}

async function visitorHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  return { ip, hash: (await sha256Hex(`${env.IP_SALT}:${day}:${ip}`)).slice(0, 32) };
}

/**
 * deps = {
 *   fetch: fetch implementation,
 *   budget: { consume(ipHash) -> Promise<{ok:boolean, reason?:string}> },
 *   productBudget: { take(ipHash, n) -> Promise<number> }  (how many product API calls are allowed)
 *   cache: optional Cache (caches.default),
 *   waitUntil: optional fn
 * }
 */
async function readJson(request, max) {
  const contentType = (request.headers.get("Content-Type") || "").split(";", 1)[0].trim();
  if (!/^application\/(?:[\w.-]+\+)?json$/i.test(contentType)) {
    return { error: "Send the form as JSON.", status: 415 };
  }
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength.trim())) return { error: "Send the form as JSON.", status: 400 };
    if (Number(declaredLength) > max) return { error: "Request too large.", status: 413 };
  }

  const reader = request.body?.getReader();
  if (!reader) return { error: "Send the form as JSON.", status: 400 };
  const chunks = [];
  let total = 0;
  let oversized = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        oversized = true;
        try {
          await reader.cancel();
        } catch {
          console.warn("Could not cancel oversized request body stream.");
        }
        break;
      }
      chunks.push(value);
    }
  } catch {
    return { error: "Send the form as JSON.", status: 400 };
  } finally {
    reader.releaseLock();
  }
  if (oversized) return { error: "Request too large.", status: 413 };

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { error: "Send the form as JSON.", status: 400 };
  }
}

// Counts of rejected/repaired/warned checks only. Never includes shopper text or model output.
function logCuration(diagnostics, stopReason, baseline = false) {
  const counts = {};
  for (const { code, action } of diagnostics.issues) counts[`${action}:${code}`] = (counts[`${action}:${code}`] || 0) + 1;
  for (const candidate of diagnostics.rejected || []) {
    for (const code of candidate.codes || []) counts[`rejected:${code}`] = (counts[`rejected:${code}`] || 0) + 1;
  }
  const fn = diagnostics.shortfall || diagnostics.truncated ? console.warn : console.log;
  fn("Gift curation", JSON.stringify({
    prompt: baseline ? baselinePrompt.PROMPT_VERSION : PROMPT_VERSION,
    engine: baseline ? "baseline-v3.3" : ENGINE_VERSION, validator: diagnostics.validator, stop_reason: stopReason,
    truncated: diagnostics.truncated, candidates: diagnostics.candidates, returned: diagnostics.returned,
    backups_used: diagnostics.backups_used || 0, discovery_shown: diagnostics.engine?.discovery_shown ?? null, issues: counts,
  }));
}

function fallbackResponse(input, message, status, origin, env) {
  const baseline = env.RECOMMENDATION_MODE === "baseline-v3.3";
  const result = baseline ? catalogueFallback(input) : engineFallback(input);
  logCuration(result.diagnostics, "catalogue_fallback", baseline);
  return json({
    error: message,
    fallback: true,
    source: "catalogue",
    ideas: result.ideas,
    recipient: result.recipient,
    engine_version: baseline ? "baseline-v3.3" : ENGINE_VERSION,
    shortfall: result.diagnostics.shortfall,
    product_discovery_enabled: productDiscoveryAvailable(env),
    note: result.ideas.length ? "" : "We couldn't find enough suitable ideas this time. Try adding a little more detail or adjusting the budget.",
  }, status, origin);
}

export async function handleRequest(request, env, deps) {
  const url = new URL(request.url);
  const origin = allowedOrigin(request.headers.get("Origin"), env);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: origin ? 204 : 403, headers: corsHeaders(origin) });
  }
  if (url.pathname === "/api/health") return json({ ok: true }, 200, origin);
  if (url.pathname === "/api/ready") {
    const ready = typeof env.IP_SALT === "string" && env.IP_SALT.length >= 32;
    return json({ ok: ready }, ready ? 200 : 503, origin);
  }
  if (!["/api/ideas", "/api/products", "/api/feedback"].includes(url.pathname)) return json({ error: "Not found" }, 404, origin);
  if (request.method !== "POST") return json({ error: "Use POST." }, 405, origin);
  if (!origin) return json({ error: "This site isn't allowed to use the API." }, 403, null);
  if (typeof env.IP_SALT !== "string" || env.IP_SALT.length < 32) {
    console.error("IP_SALT is missing or too short; refusing API request.");
    return json({ error: "The service is temporarily unavailable. Please try again later." }, 503, origin);
  }

  const { ip, hash: ipHash } = await visitorHash(request, env);

  /* ---- anonymous, aggregate feedback counters ---- */
  if (url.pathname === "/api/feedback") {
    const r = await readJson(request, 4000);
    if (r.error) return json({ error: r.error }, r.status, origin);
    const fb = feedbackKeys(r.body);
    if (!fb.ok) return json({ error: fb.error }, 400, origin);
    if (!deps.feedback) return json({ ok: true, recorded: false }, 202, origin);
    const done = await deps.feedback.record(ipHash, fb.keys);
    return done?.ok ? json({ ok: true, recorded: true }, 202, origin) : json({ error: "Too many events." }, 429, origin);
  }

  /* ---- optional, verified product enrichment ---- */
  if (url.pathname === "/api/products") {
    const r = await readJson(request, 12000);
    if (r.error) return json({ error: r.error }, r.status, origin);
    if (!Array.isArray(r.body?.ideas)) return json({ error: "Send product ideas as a list." }, 400, origin);
    const result = await searchProductsForIdeas(r.body.ideas, env, deps, ipHash);
    return json(result, 200, origin);
  }

  /* ---- AI ideas and recipient-aware catalogue fallback ---- */
  const r = await readJson(request, 8000);
  if (r.error) return json({ error: r.error }, r.status, origin);
  const parsed = normaliseInput(r.body);
  if (!parsed.ok) return json({ error: parsed.error }, 400, origin);
  const input = parsed.value;
  const baseline = env.RECOMMENDATION_MODE === "baseline-v3.3";
  const promptVersion = baseline ? baselinePrompt.PROMPT_VERSION : PROMPT_VERSION;
  const engineVersion = baseline ? "baseline-v3.3" : ENGINE_VERSION;
  if (!env.ANTHROPIC_API_KEY) {
    return fallbackResponse(input, "AI recommendations are temporarily unavailable. Here are catalogue suggestions checked against your answers.", 503, origin, env);
  }

  const human = await verifyTurnstile(parsed.token, ip, env, deps.fetch);
  if (!human) return json({ error: "Please complete the check and try again.", retryTurnstile: true }, 403, origin);

  // Identical requests are served from cache and cost nothing. The key covers everything that
  // changes the answer: prompt, validator rules, model and the visitor's input.
  const cacheKeyHash = await sha256Hex(JSON.stringify([promptVersion, VALIDATOR_VERSION, engineVersion, env.MODEL || "", generationFingerprint(env), input]));
  const cacheKey = new Request(`https://cache.gift-helper.internal/ideas/v7/${cacheKeyHash}`);
  if (deps.cache) {
    try {
      const hit = await deps.cache.match(cacheKey);
      if (hit) {
        const data = await hit.json();
        return json({ ...data, product_discovery_enabled: productDiscoveryAvailable(env), cached: true }, 200, origin);
      }
    } catch {}
  }

  const allowance = await deps.budget.consume(ipHash);
  if (!allowance.ok) {
    if (allowance.reason === "burst") {
      return json({ error: "That's a lot of requests in a row. Give it a minute and try again.", fallback: false, reason: allowance.reason }, 429, origin);
    }
    return fallbackResponse(input, "Our AI helper has reached today's limit. Here are catalogue suggestions checked against your answers.", 429, origin, env);
  }

  let result;
  let truncated = false;
  const understanding = baseline ? null : understand(input);
  try {
    const call = await callClaudeDetailed(input, env, deps.fetch, baseline ? null : promptHints(understanding));
    truncated = call.truncated;
    result = baseline
      ? curateIdeas(call.output, input, { truncated, decorate: () => ({ source: "model" }) })
      : runEngine(call.output, input, { truncated, understanding });
    logCuration(result.diagnostics, call.stopReason, baseline);
  } catch (err) {
    console.error("Claude call failed", err && err.status, err && err.detail, String(err));
    return fallbackResponse(input, "Our AI helper is busy right now. Here are catalogue suggestions checked against your answers.", 502, origin, env);
  }
  // A cut-off response with no surviving model ideas is a failure, even if graph backups could pad it.
  if (truncated && (baseline ? !result.ideas.length : !result.ideas.some((i) => i.source === "model"))) {
    return fallbackResponse(input, "Our AI response was incomplete. Here are catalogue suggestions checked against your answers.", 502, origin, env);
  }

  const payload = {
    ideas: result.ideas,
    note: result.note,
    recipient_summary: result.recipientSummary,
    recipient: result.recipient,
    source: "ai",
    product_discovery_enabled: productDiscoveryAvailable(env),
    prompt_version: promptVersion,
    engine_version: engineVersion,
    shortfall: result.diagnostics.shortfall,
  };
  if (truncated) payload.truncated = true;
  // A cut-off response is shown if it still holds valid ideas, but is never cached.
  if (deps.cache && result.ideas.length && !truncated) {
    const ttl = result.diagnostics.shortfall ? 3600 : 86400; // don't pin a thin result for a full day
    const p = deps.cache
      .put(cacheKey, new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttl}` },
      }))
      .catch(() => {});
    if (deps.waitUntil) deps.waitUntil(p);
  }
  return json(payload, 200, origin);
}

/** Returns a 301 to the canonical host for www or other aliases, otherwise null. */
export function canonicalRedirect(request, env) {
  const canonical = env.CANONICAL_HOST;
  if (!canonical) return null;
  const url = new URL(request.url);
  const h = url.hostname;
  if (h === canonical || h === "localhost" || h === "127.0.0.1" || h.endsWith(".workers.dev")) return null;
  url.hostname = canonical;
  url.protocol = "https:";
  url.port = "";
  return Response.redirect(url.toString(), 301);
}
