import { appFrameHeaders } from "./app-headers.js";
import { allowedOrigin, canonicalRedirect, corsHeaders, handleRequest } from "./core.js";
import { INLINE_SCRIPT_HASHES } from "./csp-hashes.js";
import { securityHeaders } from "./security-headers.js";

const SECURITY_HEADERS = securityHeaders(INLINE_SCRIPT_HASHES);

// Static assets are UTF-8; the asset binding omits the charset parameter for text types.
const TEXTUAL_TYPE = /^(?:text\/[^;]+|application\/(?:javascript|json|xml|manifest\+json)|[^;/]+\/[^;]+\+(?:xml|json))\s*(?:;|$)/i;

function withHeaders(res, extra, env = {}) {
  const out = new Response(res.body, res);
  if (!Object.hasOwn(extra, "X-Frame-Options")) out.headers.delete("X-Frame-Options");
  for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
  const type = out.headers.get("Content-Type");
  if (type && TEXTUAL_TYPE.test(type) && !/;\s*charset=/i.test(type)) {
    out.headers.set("Content-Type", `${type.trim().replace(/;\s*$/, "")}; charset=utf-8`);
  }
  const imageHosts = [...new Set(String(env.AWIN_IMAGE_HOSTS || "").split(",").map((host) => host.trim().toLowerCase())
    .filter((host) => /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(host)))];
  if (imageHosts.length) {
    const csp = out.headers.get("Content-Security-Policy");
    out.headers.set("Content-Security-Policy", csp.replace(/img-src ([^;]+)/, `$& ${imageHosts.map((host) => `https://${host}`).join(" ")}`));
  }
  const hosts = [env.MONETIZATION_AD_HOST, env.MONETIZATION_ANALYTICS_HOST]
    .filter((host) => typeof host === "string" && /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(host))
    .map((host) => `https://${host.toLowerCase()}`);
  if (hosts.length) {
    const csp = out.headers.get("Content-Security-Policy");
    out.headers.set("Content-Security-Policy", csp.replace(/script-src ([^;]+)/, `$& ${hosts.join(" ")}`)
      .replace(/connect-src ([^;]+)/, `$& ${hosts.join(" ")}`));
  }
  return out;
}

export async function fetchWorker(request, env, ctx) {
  let pathname = "";
  try {
    const url = new URL(request.url);
    pathname = url.pathname;
    const redirect = canonicalRedirect(request, env);
    if (redirect) return withHeaders(redirect, appFrameHeaders(pathname, SECURITY_HEADERS), env);

    if (pathname.startsWith("/api/")) {
      const stub = env.BUDGET.get(env.BUDGET.idFromName("global"));
      const res = await handleRequest(request, env, {
        fetch: (...args) => fetch(...args),
        budget: { consume: (ipHash) => stub.consume(ipHash), reuse: (ipHash) => stub.takeKnowledge(ipHash) },
        productBudget: { take: (ipHash, n) => stub.takeProducts(ipHash, n) },
        adminAuth: {
          reserve: (ipHash) => stub.reserveAdminAuth(ipHash),
          release: (ipHash, bucket) => stub.releaseAdminAuth(ipHash, bucket),
        },
        feedback: {
          record: (ipHash, keys, records) => stub.recordFeedback(ipHash, keys, records),
          export: (after, kind) => stub.exportFeedback(after, kind),
          review: (action, id) => stub.reviewFeedback(action, id),
        },
        cache: typeof caches !== "undefined" ? caches.default : null,
        waitUntil: (p) => ctx.waitUntil(p),
      });
      return withHeaders(res, SECURITY_HEADERS, env);
    }

    const res = await env.ASSETS.fetch(request);
    return withHeaders(res, appFrameHeaders(pathname, SECURITY_HEADERS), env);
  } catch (error) {
    const type = error instanceof Error && ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError"].includes(error.name)
      ? error.name : "other";
    console.error("Worker request failed unexpectedly.", { area: pathname.startsWith("/api/") ? "api" : "asset", type });
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(pathname.startsWith("/api/") ? corsHeaders(allowedOrigin(request.headers.get("Origin"), env)) : {}),
    };
    const response = new Response(JSON.stringify({
      error: "The service is temporarily unavailable. Please try again later.",
    }), { status: 500, headers });
    return withHeaders(response, appFrameHeaders(pathname, SECURITY_HEADERS), env);
  }
}
