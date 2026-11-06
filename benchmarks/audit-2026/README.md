# Audit adversarial cases — November 2026

`cases.json` adds 24 synthetic, uniquely identified cases without changing either frozen benchmark.
Together with the existing v3.4 50-case set there are 74 distinct evaluation-ready scenarios.
The new cases have **not been evaluated with a live model or human reviewer**. Their evaluation-focus
notes are requirements for review, not observed scores or promised capability.

Validate runner selection without network calls or output artifacts:

```powershell
node scripts\run-benchmark.js --cases-file=benchmarks\audit-2026\cases.json
```

The existing runner evaluates the experimental v4 prompt/engine, not the production-selected
`baseline-v3.3` path. A separately authorized live comparison must choose fresh output directories,
record model/prompt/validator versions, preserve raw outputs, and include blinded human review.
Run the existing 50-case file and this 24-case file separately; do not overwrite historical artifacts.

Coverage includes sparse/rich requests, multiple/conflicting interests, £1/£3/no budget, negated
ceilings, different child-age forms, teens, adults, older recipients, owned items, niche interests
and multilingual instruction injection. English deterministic parsing is not comprehensive
multilingual understanding. A safe shortfall is preferable to inventing availability or affordability.
