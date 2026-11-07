// Small text helpers shared by the recipient parser and the output validators.

export function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// Words that carry no product or preference meaning.
export const STOP = new Set((
  "a an the and or of for to in on at by with without from into as is are was were be been it its this that these those " +
  "i my me we our you your he him his she her they them their who whom which what when so but not no nor than then " +
  "very really quite just also too some any all each every more most much many other another such own same " +
  "have has had having do does did get got gets will would can could should may might"
).split(" "));

// Words too vague to identify a product or an exclusion on their own.
export const VAGUE = new Set((
  "gift gifts present presents thing things item items product products stuff something anything " +
  "generic basic usual ordinary normal standard good great nice new old kind type sort set " +
  "equipment gear kit kits accessory accessories ideas idea"
).split(" "));

// Words that mean the same thing for the purpose of "was this supplied by the shopper?".
const IRREGULAR = {
  mum: "mother", mom: "mother", mother: "mother", mummy: "mother", dad: "father", father: "father", daddy: "father",
  teen: "teen", teens: "teen", teenage: "teen", teenager: "teen", teenaged: "teen",
  grandad: "grandparent", granddad: "grandparent", grandpa: "grandparent", grandfather: "grandparent",
  grandma: "grandparent", grandmother: "grandparent", nan: "grandparent", nana: "grandparent", granny: "grandparent",
  grandparent: "grandparent", grandparents: "grandparent",
  boyfriend: "partner", girlfriend: "partner", husband: "partner", wife: "partner", fiance: "partner", spouse: "partner",
  brother: "sibling", sister: "sibling", sibling: "sibling",
};

// stem and contentStems are pure and hot in the validator, so results are memoised per isolate.
// Caps bound memory for arbitrary visitor and AI text; cached arrays are copied before returning.
const MEMO_LIMIT = 20000;
const STEM_MEMO = new Map();
const CONTENT_STEMS_MEMO = [new Map(), new Map()];
function remember(memo, key, value) {
  if (memo.size >= MEMO_LIMIT) memo.clear();
  memo.set(key, value);
  return value;
}

export function stem(word) {
  const key = String(word);
  const memo = STEM_MEMO.get(key);
  return memo !== undefined ? memo : remember(STEM_MEMO, key, computeStem(key));
}

function computeStem(word) {
  let w = word.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("es") && /(ss|x|ch|sh|o)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export function words(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Stemmed meaningful words (no stop words or vague words). */
export function contentStems(text, { keepVague = false } = {}) {
  const key = String(text || "");
  const memo = CONTENT_STEMS_MEMO[keepVague ? 1 : 0];
  const cached = memo.get(key) || remember(memo, key, words(key)
    .filter((w) => !STOP.has(w) && (keepVague || !VAGUE.has(w)) && (w.length > 2 || /\d/.test(w)))
    .map(stem));
  return cached.slice();
}

export function stemSet(text, opts) {
  return new Set(contentStems(text, opts));
}

export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const x of a) if (b.has(x)) overlap++;
  return overlap / (a.size + b.size - overlap);
}

export function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

/** Splits "a, b and c" style lists into trimmed phrases. */
export function splitList(text) {
  return String(text || "")
    .split(/,|;|\band\b|\bor\b|\bnor\b|\/|\+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function sentences(text) {
  return String(text || "").match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) || [];
}
