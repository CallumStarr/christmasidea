// Shared deterministic language parsing for recommendation and commercial safety gates.
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
};
const NUM = `(\\d{1,2}|${Object.keys(NUMBER_WORDS).join("|")})`;

export function parseTextAge(text) {
  const lower = String(text || "").toLowerCase();
  for (const re of [
    new RegExp(`\\b${NUM}[- ]?(?:year|yr)s?[- ]?old\\b`),
    new RegExp(`\\baged?\\s+${NUM}\\b`),
    new RegExp(`\\b${NUM}[- ]?yo\\b`),
    new RegExp(`\\b(?:is|turning|turns|just turned)\\s+${NUM}\\b(?!\\s*(?:pounds|quid|minutes|mins|%|miles))`),
  ]) {
    const match = lower.match(re);
    if (match) {
      const age = /^\d+$/.test(match[1]) ? Number(match[1]) : NUMBER_WORDS[match[1]];
      if (Number.isFinite(age) && age < 110) return age;
    }
  }
  if (/\b\d{1,2}[- ]?months?[- ]?old\b|\b(?:newborn|new born|infant|baby)\b/.test(lower)) return 0;
  if (/\btoddler\b/.test(lower)) return 2;
  if (/\bteen(?:ager)?\b/.test(lower)) return 15;
  return null;
}

function phrases(text) {
  const clause = text.split(/\b(?:because|since|so\b|but\b|which|as they|as he|as she|while|however)\b|[.!?]/i)[0];
  return clause.split(/,|;|\band\b|\bor\b|\bnor\b|\/|\+/i)
    .map((phrase) => phrase.trim().replace(/^(?:a|an|the|any|more|another|all(?: the)?|plenty of|loads of|lots of|several|many|his|her|their|own|good)\s+/i, "").trim())
    .filter(Boolean);
}

export function constraintPhrases(text) {
  const avoid = [], owned = [];
  const avoidRules = [
    /(?:^|\b(?:please|and|but|,)\s*)(?:avoid|exclude|skip)\s+([^.;!?]+)/gi,
    /(?:^|[,.!?;]\s*|\b(?:but|and|please)\s+)no\s+(?!(?:(?:set\s+)?budget|(?:more|less)\s+than|(?:upper\s+)?limit|preferences?|problems?|longer)\b)([^.;!?]+)/gi,
    /\bwithout\s+([^.;!?]+)/gi,
    /\b(?:don'?t|do not|doesn'?t|does not|didn'?t)\s+(?:really\s+)?(?:want|like|need|suggest|recommend|buy|get|include|enjoy|use)\s+([^.;!?]+)/gi,
    /(?<!not )(?<!n't )\b(?:dislikes?|hates?|can'?t stand|allergic to|not a fan of|not keen on)\s+([^.;!?]+)/gi,
  ];
  const ownedRules = [
    /\balready\s+(?:has|have|owns?|got|having|own)\s+([^.;!?]+)/gi,
    /\b(?:has|have|owns?|got)\s+([^.;!?]+?)\s+already\b/gi,
    /\b(?:owns?|owned)\s+([^.;!?]+)/gi,
  ];
  for (const sentence of String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+/)) {
    for (const re of avoidRules) for (const match of sentence.matchAll(re)) avoid.push(...phrases(match[1]));
    for (const re of ownedRules) for (const match of sentence.matchAll(re)) owned.push(...phrases(match[1]));
  }
  return { avoid, owned };
}
