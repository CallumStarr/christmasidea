# Isolated disaster-recovery validation

Assessment date: 6 November 2026. **Production recovery is not verified.**
All exercised databases, object state, credentials and provider responses
were synthetic and local. No production deployment, rollback, restore,
secret rotation or external account change occurred.

The website's [asset binding and Worker](../../wrangler.toml) are one Worker
release, not two independently deployed services. A Worker rollback does not
roll back D1, Durable Object data or externally managed credentials.
Cloudflare documents that [connected resources are not changed by a
rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/);
some resource or Durable Object class lifecycle changes can prevent it.

## Results

| Exercise | Actual observation | Classification / remaining evidence |
|---|---|---|
| Static assets and Worker version switch | Bundled the real baseline Worker and its baseline `site/index.html`, then the current local Worker and current HTML. In isolated workerd, served baseline → current → baseline → current. Each response body hash matched its selected release. | Partially verified. This is a local release-switch simulation, **not** `wrangler rollback`, a Cloudflare deployment or proof of a historical production release. |
| Configuration and secret recovery | With a synthetic 32-character salt and required Turnstile, current Worker readiness returned 503 when its dummy secret was missing and 200 after supplying a dummy secret and hostname. The historical baseline returned 200 without that check. | Partially verified. A readiness response does not test real Siteverify, secret availability, entropy or a secret-manager restore. Rollback to an older Worker can reintroduce a known security weakness; do not use it to bypass the current gate. |
| Durable Object state | An actual SQLite-backed `BudgetCounter` in local workerd accepted two synthetic reservations, survived process disposal/version switch, accepted a third, then rejected the fourth. It still rejected after local rollback and a further restart. | Partially verified for one local object's persisted quota state. This is not a backup or restore of production object state, feedback data, alarms, or other objects. |
| D1 migrations and backup | Applied the two real Awin migrations to an isolated local database, inserted one synthetic catalogue item and generation, and attempted a full `wrangler d1 export --local`. | **Confirmed limitation:** local Wrangler/Miniflare reported `cannot export databases with Virtual Tables (fts5)`. This does not establish that remote export behaves identically. |
| D1 selective restore | Exported only `awin_catalogue_state` and `awin_products` with `--no-schema`; applied the real migrations to a separate local database, removed only its migration-seeded state row, imported the export and let the insert trigger populate FTS. Source and restore both had generation `synthetic-recovery`, one product, one `garden` FTS hit and two applied migrations. | Partially verified for this tiny, two-table dataset and schema only. It is not a full database/backup integrity, restore-time, concurrent-write or production-provider test. |
| Migration failure | A third synthetic migration created a table then referenced a nonexistent table. Local apply failed; the partial table and failed migration-ledger row were absent and the existing synthetic product remained. | Partially verified for local Wrangler's transactional behavior; production failure handling and recovery point are not proven. |
| Scheduled cleanup failure | The real `scheduleBudgetPrune` received a synthetic object whose `prune()` rejected. The promise registered with `waitUntil` rejected; a subsequent explicit invocation with a successful stub resolved. A regression test covers both outcomes. | Partially verified. This is a manually simulated retry, **not** proof of Cloudflare cron retry, alerting, timing, or GitHub scheduled-workflow recovery. |
| Expired/invalid provider credentials | A mocked eBay OAuth invalid-client response was rejected; changing only the synthetic secret made the next mocked request succeed. Separately, a mocked expired access token caused one refreshed token and one extra reserved Browse retry. | Partially verified. No eBay account or actual credential was used; Anthropic, Amazon and other provider recovery remain untested. |
| Actual remote backup, restore and rollback | Not executed. | **Blocked** pending an authorized, isolated Cloudflare staging account/environment, an approved recovery plan and operator-controlled secrets. |

## Reproduce the local exercise

From the repository root with its already-installed, lockfile-resolved
dependencies, a Git checkout containing baseline commit
`74a6ddf2b5855710f2a2e762b0805e57645f85c1`, Node and Wrangler:

```powershell
node scripts\audit-recovery.mjs C:\path\to\new-empty-disposable-directory
```

The [harness](../../scripts/audit-recovery.mjs) refuses a nonempty directory or
the repository/its ancestors, never deletes existing files, creates only
dummy D1 identifiers, and passes `--local` to each Wrangler D1 command. It
captures synthetic state and expected error logs in the supplied directory;
choose a new empty directory for each run. Its full-export observation is
version-sensitive: if a later Wrangler supports FTS export, the harness
reports success but does **not** claim it restored that full export.

The tested run used Node 24.11.1, Wrangler 4.156.2 and Miniflare
5.20261102.0-beta. The local release simulation serves the actual HTML bytes
through a synthetic asset binding; it does not recreate Cloudflare routing,
CDN caches, staged deployments or release signing. The local cron test is
also covered by `node --test test\budget-retention.test.js`.

On 7 November 2026 the harness was rerun in a new empty directory after the
targeted fixes (admin throttle, charset, feedback signing, Awin caps). Its
reported results were textually identical to the previous run; only the log
file encoding differed. This rerun still exercises local workerd/Wrangler only;
remote D1 Time Travel/export, Cloudflare rollback and secret restoration remain
**Blocked** pending an authorized staging account.

## Operator recovery runbook and release gates

**Owner: operator/SRE**, with privacy and mobile owners where relevant.

1. Define and approve RPO/RTO, incident authority, escalation, monitoring and
   an isolated staging account. Inventory Worker release IDs, asset
   provenance, routes, bindings, D1 schema/migration versions, named Durable
   Object classes/state, cron schedules, GitHub jobs, secrets and their
   restoration owners. Record versions and hashes without recording secret
   values.
2. Verify an actual recoverable D1 backup and retention privately. Cloudflare's
   [D1 Time Travel documentation](https://developers.cloudflare.com/d1/reference/time-travel/)
   describes point-in-time recovery for supported databases; verify the
   account, database version, plan, retention and permissions rather than
   assuming them. A Time Travel restore overwrites the target database and is
   **destructive**. First exercise it only on an approved disposable database;
   preserve a rollback point and compare representative rows, FTS, triggers,
   migration ledger and application queries.
3. Before any authorized rollback, check that the target Worker version,
   assets, routes and resource bindings still exist and that newer D1/DO schema
   remains compatible. Confirm the rollback does not reintroduce a known
   issue. Test traffic, readiness, security controls and both canonical hosts
   in staging; document the operator-approved actual procedure separately.
4. Establish a separate Durable Object recovery strategy for quota and
   feedback state. A persistent local object across restart is not a remote
   snapshot. Decide acceptable loss, replay/duplicate effects and restoration
   verification; exercise it in staging. Do not copy production data into
   this synthetic drill.
5. Keep restorable secrets in an approved secret manager with least-privilege
   access and incident rotation procedures. Verify bindings privately without
   displaying values. `IP_SALT` also signs feedback receipts, so changing it
   affects both visitor counters and verification of existing receipts; plan
   compatibility and expiry rather than blindly replacing it.
6. Exercise cron and GitHub workflow failures, alert delivery, retry/repair,
   partial Awin import and external provider outages in staging. The Awin
   workflow can write remote D1 even when product discovery is disabled;
   never run its remote step as part of this local drill.
7. Record recovery duration, lost work and operator actions, revalidate
   security/accessibility and update the runbook. Native installed apps
   require separate app-store release and rollback procedures.

The production plan, live RPO/RTO, Cloudflare account configuration, remote
backups and actual secret restoration remain **Not verified**.
