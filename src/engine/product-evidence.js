import { canonicalKey, normaliseGtin } from "./product-identity.js";
import { PRODUCT_EVIDENCE_POLICY } from "./product-evidence-policy.js";

const DAY = 86400_000;
export const EVIDENCE_WEIGHTS = Object.freeze({
  performance: 0.3, usability: 0.2, durability: 0.2, repairability: 0.15, reviews: 0.15,
});
const scopeOf = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

export function productIdentityKeys(product) {
  return [...new Set([canonicalKey(product), canonicalKey({
    ...product, gtin: undefined, ean: undefined, upc: undefined,
  })].filter(Boolean))];
}

export function isProductEvidenceKey(key) {
  if (typeof key !== "string") return false;
  if (key.startsWith("gtin:")) return normaliseGtin(key.slice(5)) === key.slice(5);
  const [provider, ...rest] = key.split(":");
  return ["amazon", "ebay", "awin"].includes(provider)
    && canonicalKey({ provider, productId: rest.join(":") }) === key;
}

function sourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password && !url.port && url.hostname.includes(".")) return url;
  } catch {
    // The policy validator below reports the invalid field.
  }
  return null;
}

function requireRecord(condition, index, field) {
  if (!condition) throw new TypeError(`Invalid product evidence record ${index}: ${field}`);
}

export function compileProductEvidence(policy = PRODUCT_EVIDENCE_POLICY, now = Date.now()) {
  if (!policy || !/^product-evidence-v[1-9]\d*$/.test(policy.version)
      || !Array.isArray(policy.assessments) || !Array.isArray(policy.exclusions)
      || !Number.isFinite(now)) throw new TypeError("Invalid product evidence policy");
  const assessments = new Map(), exclusions = new Map(), observations = new Set();
  for (const [index, record] of policy.assessments.entries()) {
    requireRecord(record && isProductEvidenceKey(record.key), index, "identity");
    const source = sourceUrl(record.sourceUrl);
    const observed = Date.parse(record.observedAt), expires = Date.parse(record.expiresAt);
    const review = record.criterion === "reviews";
    requireRecord(record.reviewed === true && record.permission === "permitted", index, "review and permission");
    requireRecord(source && sourceUrl(record.methodologyUrl), index, "source and methodology");
    requireRecord(typeof record.sourceGroup === "string" && /^[a-z0-9][a-z0-9.-]{0,79}$/.test(record.sourceGroup),
      index, "source ownership group");
    requireRecord(typeof record.scope === "string" && scopeOf(record.scope).length > 0
      && record.scope.length <= 120, index, "comparison scope");
    requireRecord(Object.hasOwn(EVIDENCE_WEIGHTS, record.criterion), index, "criterion");
    requireRecord(Number.isFinite(observed) && observed <= now && Number.isFinite(expires)
      && expires > observed && expires - observed <= (review ? 90 : 365) * DAY, index, "evidence dates");
    requireRecord(review ? record.kind === "product-reviews"
      && Number.isFinite(record.average) && record.average >= 1 && record.average <= 5
      && Number.isSafeInteger(record.count) && record.count > 0
      : record.kind === "independent-test" && Number.isFinite(record.value)
        && record.value >= 0 && record.value <= 1, index, "measurement");
    const key = `${record.key}|${scopeOf(record.scope)}`;
    const observation = `${key}|${record.criterion}|${record.sourceGroup}|${observed}`;
    requireRecord(!observations.has(observation), index, "duplicate source observation");
    observations.add(observation);
    if (!assessments.has(key)) assessments.set(key, []);
    assessments.get(key).push({ ...record, observed, expires, domain: source.hostname.replace(/^www\./, "") });
  }
  for (const [index, record] of policy.exclusions.entries()) {
    requireRecord(record && isProductEvidenceKey(record.key) && record.reviewed === true
      && sourceUrl(record.sourceUrl) && ["recall", "withdrawal"].includes(record.reason)
      && Number.isFinite(Date.parse(record.checkedAt)) && Date.parse(record.checkedAt) <= now, index, "safety exclusion");
    exclusions.set(record.key, record);
  }
  return { version: policy.version, assessments, exclusions, now };
}

export function assessProductEvidence(idea, product, evidence) {
  const keys = productIdentityKeys(product);
  const exclusion = keys.map((key) => evidence.exclusions.get(key)).find(Boolean);
  const records = keys.flatMap((key) => evidence.assessments.get(`${key}|${scopeOf(idea.concept || idea.title)}`) || []);
  const latest = new Map();
  let expired = 0;
  for (const record of records) {
    if (record.expires <= evidence.now) { expired++; continue; }
    const key = `${record.criterion}|${record.sourceGroup}`;
    const previous = latest.get(key);
    if (!previous || record.observed > previous.observed
        || (record.observed === previous.observed && record.sourceUrl < previous.sourceUrl)) latest.set(key, record);
  }
  let quality = 0, coverage = 0;
  const sources = new Set(), criteria = {};
  for (const [criterion, weight] of Object.entries(EVIDENCE_WEIGHTS)) {
    const relevant = [...latest.values()].filter((record) => record.criterion === criterion);
    const values = relevant.map((record) => {
      sources.add(record.sourceGroup);
      if (criterion !== "reviews") return record.value;
      // A heuristic neutral prior, not a confidence interval or a review-fraud detector.
      const count = Math.min(record.count, 1000);
      return ((record.average - 1) / 4 * count + 0.5 * 20) / (count + 20);
    });
    const score = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0.5;
    criteria[criterion] = score;
    quality += score * weight;
    if (values.length) coverage += weight;
  }
  return {
    blocked: Boolean(exclusion),
    qualityScore: quality,
    evidenceCoverage: coverage,
    sourceCount: sources.size,
    criteria,
    reasons: [
      ...(exclusion ? [`safety_${exclusion.reason}`] : []),
      ...(!sources.size ? ["quality_unassessed"] : []),
      ...(expired ? ["expired_evidence_ignored"] : []),
    ],
  };
}
