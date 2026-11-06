# Performance, reliability and cost assessment

## Measurements and what they do not prove

| Measurement | Observed | Scope |
|---|---:|---|
| Live homepage TTFB | 120.8 ms | One desktop Chromium navigation, no controlled device/network profile |
| FCP / buffered LCP | 508 / 508 ms | One lab observation, not field 75th percentile |
| Observed non-input layout shifts | 0.04843 total | Two observed shifts; not a complete field CLS distribution |
| DOMContentLoaded / load | 682.8 / 1043.7 ms | Single navigation |
| INP | Not established | No valid field/representative interaction distribution |
| Shared CSS gzip | 10,978 bytes | Existing 11,000-byte test budget; only 22 bytes headroom |
| Worker dry-run size | 323.13 KiB / 93.43 KiB gzip | Bundled release preparation, not measured CPU or memory |
| Android debug APK | Approximately 8.30 MB | Debug build; not release download/install size |

These values are not a Lighthouse score, production SLO, mobile experience
certificate or proof of passing Core Web Vitals. Required field thresholds
(LCP <=2.5 s, INP <=200 ms, CLS <=0.1 at the 75th percentile) cannot be accepted
from one desktop sample. RUM itself requires a privacy-aware purpose and data
minimisation decision.

## Isolated concurrency and quota integrity

Run [audit-load.mjs](../../scripts/audit-load.mjs) with:

```powershell
node scripts\audit-load.mjs
```

The harness bundles the actual `BudgetCounter` and runs real SQLite-backed Durable
Objects in local workerd/Miniflare. It has no model/provider fetch, disables
simulator telemetry/registry, and disposes the simulator in `finally`. Each scenario
uses a distinct object; repeat callers share the same object within that scenario.
Installed Miniflare v5 requires its worker manifest/config API, not v4 options.

| Concurrent unique callers | AI reserved (cap 25) | Product calls reserved (cap 40; two requested each) | AI / product wall time |
|---:|---:|---:|---:|
| 10 (1x) | 10 | 20 | 2,758 / 83 ms |
| 50 (5x) | 25 | 40 | 185 / 170 ms |
| 100 (10x) | 25 | 40 | 346 / 282 ms |
| 20, all same visitor | 3 | 4 | Correct per-visitor caps; not a latency benchmark |

The first timing includes cold simulator work. These are exact reservation
assertions at artificial small limits, **not production requests/second capacity**,
queue latency percentiles, object restart durability or a 10x production load test.
No adversarial or load traffic was sent to production.

## Current cost and failure boundaries

Repository production configuration caps AI reservations at 500/day, 15/visitor/day
and 4/visitor/minute; maximum output tokens are 4,500. Product lookup limits are
4,000/day, 1,000/hour, 32/second, 240/visitor/day and 64/visitor/minute.
Reservations limit lookup attempts, not number of displayed offers. Provider
retries/replacement searches must remain inside reserved capacity.

The checked Claude builder makes one upstream generation request, with a 25-second
default timeout; Siteverify has an 8-second timeout and product timeout is configured
at 8 seconds. No unbounded Claude retry loop was found on this path. The incoming
browser abort signal is **not explicitly propagated** to paid upstream work.
Canceling the UI therefore does not prove cancellation of provider expenditure.

For the currently configured 500 daily reserved calls:

- Maximum configured output allowance is 2.25 million tokens/day, or 67.5 million
  over 30 fully saturated days, before provider-side billing semantics.
- With mean input tokens `I`, actual output `O`, and account prices `Pi`/`Po` per
  million tokens, daily model cost is approximately
  `N * (I * Pi + O * Po) / 1,000,000`, where `N <= 500` for this reservation path.
- Add Worker/DO/D1 charges, provider allocations, monitoring, domains and stores.
  Actual paid plan, token prices, discounts, error billing, other consumers of
  the same credentials and separate operational scripts are external.
- Cached complete ideas (24h), shortfall cache (1h), approved knowledge if present
  and catalogue fallback can reduce generation. Cache hits are not guaranteed,
  and Turnstile still verifies before cached ideas are returned.

This is a cost model, not a currency spend ceiling or verified commercial margin.
No audit generation was purchased. Historical benchmark dollar totals are
historical, not this audit's expenditure.

## Availability and restoration

The global budget object is a hot coordination point and shared availability
dependency. Anthropic and Turnstile are external dependencies. Checked catalogue
fallback handles selected generation/budget failures, but fallback is not a
second independent live provider. Shared website/API releases and separately
installed app snapshots need staged compatibility checks.

Inspected SQL uses parameterized operations. Local migration checks found:

- First migration can be repeated safely.
- Second adds `facts_json`; repeating it directly fails duplicate-column
  validation, so execution must use the migration ledger rather than blindly
  replaying every SQL file.
- In-memory SQLite `integrity_check` returned `ok`.

These are not a production backup or restore drill. Scheduled pruning is configured
at 03:00 UTC and also occurs on relevant object access. Expiration does not imply
instant physical deletion; scheduler failure, external exports and review
acknowledgement retention need operational monitoring.

Cloudflare's [limits documentation](https://developers.cloudflare.com/workers/platform/limits/)
retrieved for this audit reports 128 MB memory, six simultaneous outgoing
connections, Free/Paid subrequest limits of 50/10,000 and plan-dependent CPU limits.
The actual account plan and allocations were not attested. Bundle size and Node
tests do not measure Worker CPU time or peak isolate memory.

## Recommended measurable follow-up

Define API availability/error/latency SLOs, quota saturation and fallback rates;
separate cold/warm latency, cache hit ratio, provider latency and UI render cost.
Run an approved isolated soak with storage/provider faults and restart recovery.
Conduct a non-production D1/object restoration and rollback exercise, documenting
RPO/RTO and alert delivery. Keep diagnostics free of recipient text and secrets.
