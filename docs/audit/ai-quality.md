# AI security, recommendation quality and benchmark evidence

## What actually runs

Repository production configuration retains **baseline-v3.3**. It uses the frozen
prompt, candidate validation and original-order selection. The experimental
recipient graph, BM25/graph retrieval, RRF, multi-objective ranking and MMR remain
available for research; the offline replay commands run this experimental path,
not the selected release path. Knowledge reuse is flagged on but the shipped
policy is empty/unapproved. Learning ranking stays off.

The release regression retains 29 exact historical title lists and the documented
case-12 kneeling-aid/apron consistency replacement. Frozen outputs and scored
review artefacts were not overwritten. Validator version advances to invalidate
old cached curation after the safety fixes.

## Confirmed defects corrected

- Negated ceilings ("no more than", "nothing over") were interpreted as floors.
  A synthetic high-price idea survived a stated low cap. Explicit ceilings now
  win over floor recognition, with floor/range/non-budget counterexamples.
- Recognized recipient exclusions were lost between idea validation and retailer
  enrichment. A leather journal could match a leather-excluding request.
  Bounded exclusions now propagate and gate retailer metadata; malformed or
  overflowing constraints abstain instead of silently weakening restrictions.
- Inline "no leather" clauses were missed, and commercial age parsing differed
  from backend parsing. The shared parser covers the reproduced forms.
- Size matching discarded short system/unit identifiers: UK 8 could match a US 8 /
  UK 6 listing. Explicit variants now preserve identifier-number relationships.
- Single-strategy diversity entropy produced NaN/null. Zero is now the finite
  result for a single observed strategy.

These are deterministic corrections, **not proof of comprehensive language,
allergen, factual, age-safety or semantic understanding**. Search-concept price
estimates remain different from verified offers and delivery-inclusive totals.

## Replayed historical evidence

| Measurement | v3.3 raw outputs through current experimental engine | v3.4 raw outputs through current experimental engine |
|---|---:|---:|
| Cases | 30 | 50 |
| Mean ideas | 7.9 | 8 |
| Shortfalls | 3 | 0 |
| Mean textual inter-list diversity | 0.953 | 0.958 |
| Mean grounded connections | 7.567 | 7.88 |
| Near-duplicate lexical pairs | 0 | 0 |
| Match caps >110% parsed budget | 0 | 0 |
| Corrected strategy balance | 0.776 | 0.926 |
| Historical generation cost, not this audit's spend | USD 0.057606 | USD 0.104119 |

The zero budget-violation metric is conditional on correct budget parsing, which
this audit found was incomplete. Lexical diversity is not semantic originality.
Grounded snippets are not complete factual verification. Different case sets
cannot be treated as a controlled quality comparison.

The completed paired sheet preferred baseline on **28/30**, experimental on 2/30.
A descriptive Wilson interval for 28/30 is approximately **78.7%-98.2%** under a
binomial model. One reviewer sheet, synthetic scenarios, fixed-seed assignment,
shared development examples and uncertain reviewer independence prevent a
population-level preference or significance claim. The result does not support
promoting the experimental system.

## Expanded evaluation suite

[24 additive audit scenarios](../../benchmarks/audit-2026/cases.json) bring distinct
scenarios to 74 alongside the existing 50. They cover sparse/rich and conflicting
descriptions, small/no budgets, negated caps, exclusions/ownership, different ages,
unusual interests and adversarial inputs. Runner validation/dry selection passed.
**There are no new live outputs or human quality scores for them.**

Before a paid evaluation:

1. Freeze model, prompt, validator, settings and case-set hashes.
2. Include exact-budget, ownership, identity, age and output-schema negative
   checks independently of human scores.
3. Randomize presentation and conceal model/prompt identities from at least two
   independent reviewers; calibrate scores and record disagreements.
4. Score recipient relevance, coverage, originality, meaningful diversity,
   specificity, budget, exclusions, age, grounding, identity, UK usefulness and
   emotional appropriateness separately.
5. Report paired case differences and uncertainty, not only an overall average.
6. Obtain explicit cost approval. For 24 cases and two systems the maximum planned
   generation count is 48 before any separately approved retries; quote current
   token prices and input/output estimates first.

## GenAI risk mapping and limitations

The official [OWASP GenAI index](https://genai.owasp.org/llm-top-10/) retrieved on
6 November linked the **2025** edition. A final 2026 edition was not verified.
This report covers all ten requested risk themes without inventing 2026 identifiers.

| Requested theme | Evidence-backed scope / remaining uncertainty |
|---|---|
| Prompt injection | Deterministic injection-echo and schema tests, bounded input/tool output; no exhaustive multilingual live jailbreak exercise |
| Sensitive information disclosure | No explicit PII detector in the request path; raw normalized input can reach Anthropic; logs hardened, caches still require privacy review |
| Excessive agency | No model-controlled purchasing/admin tool identified; provider destinations are validated independently |
| Supply chain | Lockfile/advisory/history scans; model and provider provenance/contracts external |
| Data/model poisoning | Signed issuance, expiry, dedupe, controlled concepts, human approval; receipts do not establish unique humans |
| Unbounded consumption | Request/output limits, quota tests and real local object concurrency; provider billing caps/account allocations unverified |
| Misinformation | Deterministic budget/identity/recipient checks; heuristics cannot establish factual truth or actual product safety |
| Hidden context exposure | No provider secrets intentionally included in prompt; prompt-extraction resistance not live-certified |
| Vector/embedding weaknesses | Not applicable to an implemented vector store: none is active in this architecture |
| Improper output handling | Schema/recipient/product validation and inspected safe DOM paths; no blanket all-sinks XSS certification |

The cache is shared by input/settings fingerprint, not user identity. It stores
validated response payloads, not raw model responses; descriptions and derived
explanations can still contain personal information. Fresh feedback receipts are
issued after cache retrieval, not reused from the shared cache.
