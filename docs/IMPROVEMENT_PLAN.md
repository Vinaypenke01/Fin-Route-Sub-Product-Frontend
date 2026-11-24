# FinRoute Collect: reliability & product improvement plan

Scope agreed on 2026-11-23. **Out of scope (by decision):** multiple logins per
business, and safer week deletion.

Each phase ships as its own PR from `Dev` → `main`, passes CI, and is tested on
the Netlify deploy preview first. Phases that change tenant databases also get a
numbered **tenant update** script (see Phase 0).

| # | Phase | Why it matters | Size | Depends on |
|---|---|---|---|---|
| 0 | Foundations | Lets us roll database changes out to every tenant safely; removes customer-specific code; stops white-screen crashes | S | – |
| 1 | Reliable saving (offline outbox) | Edits made with weak signal are currently **lost** | M | 0 |
| 2 | One active session per tenant | Stops two devices overwriting each other | M | 0 |
| 3 | Change history (audit trail) | Answer "who changed this payment, when, from what" | S–M | 0 |
| 4 | Automatic backups | Free-tier tenant projects have no backups | M | – |
| 5 | Password rules & self-service change | 4-character passwords; operator can't change their own | S | 2 |
| 6 | Monitoring & free-tier limits | Know about crashes and full databases before customers call | S | 0 |
| 7 | Speed, tests & docs | Faster on rural mobile data; catch regressions; up-to-date README | M | 1–3 |

Recommended order: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7.**

---

## Phase 0: Foundations

**0.1 Tenant database versioning**
- Problem: each tenant has its own database, so every schema change must be run in
  every tenant project, and today nothing shows which tenant is up to date.
- New table in each tenant DB: `finroute_schema_version (version int, applied_at)`.
- Numbered scripts in `supabase/tenant_updates/` (`001_…sql`, `002_…sql`), each one
  safe to run twice and ending with its version insert.
- Admin panel → Tenants Directory: a **DB version** column (read server-side with the
  tenant secret key). Outdated tenants show "Update needed".
- Tenant Setup Guide gets an **Updates** section listing each script with a copy
  button and "run this in each tenant's SQL Editor".

**0.2 Remove customer-specific code**
- `customerNormalization.js` has a rule for one named borrower; replace it with a
  general rule (drop exact duplicate rows that have no ID, no phone and no payments),
  after checking real data for anything that rule would hide.
- CSV export default client name "Sunday Kovuru" → the logged-in tenant's name.

**0.3 Crash protection**
- React error boundary around the app and around the ledger table: shows
  "Something went wrong. Your saved data is safe. [Reload]" instead of a blank page.
- Global handler for unexpected promise errors → friendly toast.

**Done when:** admin panel shows each tenant's DB version; no customer names in source; a forced crash shows the recovery screen.

---

## Phase 1: Reliable saving (offline outbox)

**Problem today:** each edit is sent once. If it fails (no signal, DB waking up) the
operator sees a brief error, the screen keeps the new value, but the edit is never
retried. The next reload loads from the database and the edit is gone. Pending edits
live only in memory, so closing the tab loses them too.

**Design**
- **Outbox stored on the device** (IndexedDB, per tenant): every change is written to
  the outbox *before* it is sent. Each entry: id, type (payment, customer field,
  reconciliation, add/delete customer, week, archive…), payload, created time,
  attempts, last error.
- **Sender** processes the outbox in order; removes an entry only after the database
  confirms. Writes are already upserts, so retrying is safe; deletes become
  "delete if exists".
- **Automatic retry** with back-off (5 s, 15 s, 1 min, then every 2 min), and
  immediately when the browser comes back online or the tab becomes visible.
- **On app start:** load from the database, then re-apply anything still in the outbox
  on top, so unsent edits are never overwritten by older server data.
- **Clear status in the header:** "All changes saved ✓" / "Saving 2…" /
  "3 changes waiting for internet" (tap to see list and retry now).
- **Logout guard:** if the outbox is not empty, warn: "3 changes haven't reached the
  server yet. Stay online until they're saved." Option to stay or log out anyway
  (outbox is kept for the same user on the same device).
- **Permanent failures** (e.g. permission denied) stop retrying and are shown with a
  "copy details for support" button instead of silently looping.

**Tests:** unit tests for the outbox (ordering, merge of repeated edits to the same
cell, retry, restore after reload); manual test with DevTools → Offline.

**Done when:** go offline, enter 10 payments, close the tab, reopen online → all 10
are in the database.

---

## Phase 2: One active session per tenant

**Rule (as decided):** while a tenant is logged in on one device, a login from a second
device is **refused**.

**Design**
- Master table `master_active_sessions` (one row per tenant): session id, device
  label (browser + OS), IP, started at, last seen at.
- `tenant-login`:
  - if there is a session **seen in the last 5 minutes** from a *different* session id
    → refuse: "This account is already in use on another device (Chrome on Android,
    active 2 min ago). Log out there first, or ask your administrator."
  - same device (same session id stored in the browser) → allowed (page reloads,
    re-login after expiry).
  - otherwise → create/replace the session row and continue.
- **Heartbeat:** the app pings a small `tenant-session` function every 60 s while open
  (`last_seen_at`). If a phone is closed without logging out, the account frees itself
  after 5 minutes.
- **Logout** deletes the session row immediately.
- **Server-side enforcement, not just the UI:** the heartbeat answers "session ended"
  when the row is gone; the app then signs out. When an admin ends a session, the
  operator's tenant tokens are revoked too (tenant update script adds a
  service-role-only function that clears that user's sessions/refresh tokens).
- **Admin panel:** "Active now" badge per tenant with device and last seen, and an
  **End session** button for lost phones.

**Open decision:** the 5-minute timeout (shorter = less waiting after a phone dies;
longer = fewer false "in use" if the signal drops). Default: 5 minutes.

**Done when:** logged in on phone A → phone B is refused with the device message;
A logs out → B can log in; A closed without logout → B can log in after 5 minutes;
admin "End session" kicks A within a minute.

---

## Phase 3: Change history (audit trail)

**Design (tenant update 002)**
- Table `change_log`: table name, record id, action (insert/update/delete), old values,
  new values (JSON), changed by (tenant user id + email), changed at.
- Database triggers on `payments`, `customers`, `weekly_reconciliation`, `weeks`,
  `loan_archive`, `villages`. Written by the database itself, so the app can't skip or
  edit it. Operators can read but not change or delete history (RLS).
- Payments store only changed fields to keep it small; keep 2 years, then prune.
- **Operator view:** in the ledger, a small history icon on a payment cell →
  "₹500 → ₹50 by op@… on 23 Nov 10:42".
- **Admin view:** View tenant → "Change history" tab with filters (date, customer,
  type) and CSV export.

**Done when:** editing a payment shows the old and new value with time and user in
both views.

---

## Phase 4: Automatic backups

**Design**
- New Edge Function `tenant-backup` (master): for every tenant with a secret key,
  exports all ledger tables (+ `change_log`) to one JSON file and stores it in a
  **private** Storage bucket `tenant-backups/<tenant-id>/<date>.json` in the master
  project.
- Runs **nightly** from GitHub Actions (same pattern as keep-alive); keeps the last
  **30 daily + 12 monthly** copies, deletes older ones.
- Admin panel → View tenant → **Backups**: list with size/date, **Download**, and a
  "Back up now" button. Failures appear in Health Logs.
- Operator: "Download my data" (Excel-friendly CSV zip of every table).
- **Restore runbook** + script: restore a backup into a fresh tenant project
  (documented in the Setup Guide; tested once end-to-end).

**Notes:** master free storage is 1 GB; ledgers are small (KB–MB each), so this fits
for a long time. Backups contain borrower personal data, so the bucket is private and
only the Edge Functions / super-admins can read it.

**Done when:** a nightly run produces one file per tenant, and a restore drill into a
test project matches the original row counts.

---

## Phase 5: Password rules & self-service change

- Minimum **10 characters** for any new or changed password (operator and admin),
  checked in the forms **and** on the server; a short strength hint in the forms.
- Existing short passwords keep working, but at login the operator is asked to set a
  new one before continuing ("must change password").
- Operator **Change password** screen (current + new password), which updates both
  master and tenant sign-in.
- Forgot password: operator taps "Forgot password?" → message to contact the
  administrator, who resets it in Edit Tenant. (Email-based reset can be added later
  if you want to send emails.)

**Done when:** a 6-character password is rejected everywhere; a tenant with an old
short password is forced to change it at next login.

---

## Phase 6: Monitoring & free-tier limits

- **Error reporting:** send front-end crashes and failed saves to an error-tracking
  service (e.g. Sentry free tier). Personal data (names, phone numbers, amounts) is
  scrubbed before sending.
- **Database size per tenant** shown in the admin panel and Health Logs, with warnings
  at 70% / 90% of the free-tier limit.
- **Alerts:** keep-alive and backup jobs that fail turn the GitHub Action red; enable
  GitHub email notifications for failed workflows.
- **Upgrade guide** in the Setup Guide: when and how to move a tenant to a paid plan.

**Open decision:** use Sentry (needs a free account) or only the built-in logs.

---

## Phase 7: Speed, tests & docs

- **Speed**
  - The 906 kB PDF library loads on every page visit before the app starts; load it
    only when the user clicks *Download PDF*.
  - Split the 592 kB main bundle (lazy-load modals and export code).
  - Route reordering: one database call instead of one per customer.
  - Target: first load under ~250 kB of JavaScript.
- **Tests**
  - Unit tests for the outbox, session rules and audit helpers.
  - End-to-end smoke test (Playwright) against a dedicated **test tenant**: log in →
    add customer → add payment → reload → still there → second device refused.
    Runs on demand and before releases (needs test-tenant credentials as GitHub secrets).
- **Docs**
  - Rewrite README for the Supabase-only design (remove Google Sheets / Code.gs).
  - Keep the Setup Guide and verification guide in sync with each phase.

---

## Decisions needed before starting

1. Session timeout for Phase 2 (default **5 minutes**).
2. Backup schedule and retention (default **nightly, 30 daily + 12 monthly**).
3. Error tracking: **Sentry free tier** or built-in logs only.
4. Forgot password: **"contact administrator"** now, email reset later?
