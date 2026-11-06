import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normaliseGtin } from "../src/engine/product-identity.js";
import { words } from "../src/text.js";

const LICENCE = "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/";
const ATTRIBUTION = "Contains public sector information licensed under the Open Government Licence v3.0.";
const IGNORE = new Set(["limited", "company", "jewellery", "direct", "gifts", "fitness", "options",
  "stories", "social", "range", "professional", "design", "collection", "original", "home"]);

export function safetyCandidates(products, alerts) {
  const brands = products.map((product) => ({
    product,
    tokens: words(product.brand).filter((word) => word.length >= 5 && !IGNORE.has(word)),
  })).filter((entry) => entry.tokens.length);
  return alerts.flatMap((alert) => {
    if (typeof alert?.link !== "string"
        || !/^\/product-safety-alerts-reports-recalls\/[a-z0-9-]+$/.test(alert.link)
        || typeof alert.title !== "string") throw new TypeError("Invalid GOV.UK safety index result");
    const title = new Set(words(alert.title));
    const matches = brands.filter(({ tokens }) => tokens.every((token) => title.has(token)));
    return matches.length ? [{ alert, products: matches.map(({ product }) => product) }] : [];
  });
}

export function matchSafetyIdentifiers(products, document) {
  if (!document || document.document_type !== "product_safety_alert_report_recall"
      || typeof document.base_path !== "string"
      || !/^\/product-safety-alerts-reports-recalls\/[a-z0-9-]+$/.test(document.base_path)) {
    throw new TypeError("Invalid GOV.UK safety content");
  }
  // Matches are review leads only: GTIN text can refer to an unaffected variant or batch.
  const text = JSON.stringify(document.details || {});
  const gtins = new Set((text.match(/(?<!\d)(?:\d{14}|\d{13}|\d{12}|\d{8})(?!\d)/g) || [])
    .map(normaliseGtin).filter(Boolean));
  return products.filter((product) => {
    const gtin = normaliseGtin(product.gtin);
    return gtin && gtins.has(gtin);
  }).map((product) => product.product_id);
}

export async function screenSafety(products, {
  fetchImpl = fetch, now = Date.now(), maxDocuments = 30,
} = {}) {
  if (!Number.isInteger(maxDocuments) || maxDocuments < 0 || maxDocuments > 100) {
    throw new TypeError("maxDocuments must be between 0 and 100");
  }
  const request = async (url) => {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", "User-Agent": "SantasHelper-CatalogueSafetyReview/1.0 (christmasidea.co.uk)" },
      redirect: "error", signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`GOV.UK safety request failed: HTTP ${response.status}`);
    return response.json();
  };
  const alerts = new Map();
  let total = null, start = 0;
  while (total === null || start < total) {
    const url = new URL("https://www.gov.uk/api/search.json");
    url.searchParams.set("filter_content_store_document_type", "product_safety_alert_report_recall");
    url.searchParams.set("fields", "title,link");
    url.searchParams.set("count", "500");
    url.searchParams.set("start", String(start));
    const page = await request(url);
    if (!Array.isArray(page.results) || !Number.isSafeInteger(page.total) || page.total < 0
        || page.total > 20000 || start + page.results.length > page.total
        || (page.total > start && !page.results.length)) {
      throw new Error("Malformed or unexpectedly large GOV.UK safety index");
    }
    if (total !== null && total !== page.total) throw new Error("GOV.UK safety index changed; rerun screening");
    total = page.total;
    for (const alert of page.results) {
      safetyCandidates([], [alert]);
      alerts.set(alert.link, alert);
    }
    start += page.results.length;
  }
  if (alerts.size !== total) throw new Error("GOV.UK safety index has duplicate or missing results; rerun screening");
  const candidates = safetyCandidates(products, [...alerts.values()]);
  const leads = [];
  for (const { alert, products: matched } of candidates.slice(0, maxDocuments)) {
    const document = await request(`https://www.gov.uk/api/content${alert.link}`);
    if (document.base_path !== alert.link) throw new Error("GOV.UK safety content identity mismatch");
    const exact = matchSafetyIdentifiers(products, document);
    leads.push({
      sourceUrl: `https://www.gov.uk${alert.link}`, title: alert.title,
      brandCandidateProductIds: matched.map((product) => product.product_id),
      gtinCandidateProductIds: exact, reviewed: false,
    });
  }
  return {
    checkedAt: new Date(now).toISOString(), licence: LICENCE, attribution: ATTRIBUTION,
    catalogueProducts: products.length, indexTotal: total, indexDocumentsRead: alerts.size,
    brandCandidateDocuments: candidates.length, contentDocumentsRead: leads.length,
    truncated: candidates.length > leads.length,
    coverage: "brand-preselected-public-alerts-only",
    safetyCertification: false, automaticallyBlockedProducts: 0, leads,
  };
}

async function main() {
  const [, , snapshot, output, ...extra] = process.argv;
  if (!snapshot || !output || extra.length) {
    throw new Error("Usage: node scripts/screen-product-safety.mjs snapshot.sqlite report.json");
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(resolve(snapshot), { readOnly: true });
  let products;
  try {
    products = db.prepare(`SELECT product_id, brand, gtin FROM awin_products
      WHERE generation = (SELECT active_generation FROM awin_catalogue_state WHERE id=1)`).all();
  } finally { db.close(); }
  const report = await screenSafety(products);
  const file = await open(resolve(output), "wx");
  try { await file.writeFile(JSON.stringify(report, null, 2)); } finally { await file.close(); }
  console.log(JSON.stringify({
    products: report.catalogueProducts, publicAlerts: report.indexDocumentsRead,
    reviewLeads: report.leads.length, safetyCertification: false, output: resolve(output),
  }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
