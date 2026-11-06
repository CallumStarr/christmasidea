import { DISLIKE_GROUPS } from "./rules.js";
import { cleanText, contentStems, stemSet } from "./text.js";

const MAX_EXCLUSIONS = 16;
const MAX_EXCLUSION_LENGTH = 80;

export function productConstraints(value = {}) {
  const raw = value.excludedTerms;
  const terms = Array.isArray(raw) ? raw : [];
  const incomplete = value.constraintsIncomplete === true
    || (raw !== undefined && !Array.isArray(raw))
    || terms.length > MAX_EXCLUSIONS
    || terms.some((term) => typeof term !== "string" || term.length > MAX_EXCLUSION_LENGTH);
  return {
    excludedTerms: terms.slice(0, MAX_EXCLUSIONS).map((term) => cleanText(term, MAX_EXCLUSION_LENGTH)).filter(Boolean),
    constraintsIncomplete: incomplete,
  };
}

export function violatesProductExclusions(spec, text) {
  const constraints = productConstraints(spec);
  if (constraints.constraintsIncomplete) return true;
  const stems = stemSet(text);
  return constraints.excludedTerms.some((phrase) => {
    const expected = contentStems(phrase);
    return (expected.length > 0 && expected.every((term) => stems.has(term)))
      || DISLIKE_GROUPS.some((group) => group.trigger.test(phrase) && group.terms.test(text));
  });
}
