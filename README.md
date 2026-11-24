# FinRoute Collect

> **A FinRoute Enterprise Microfinance Platform**  
> *Sunday Collections, Multi-Tenant PostgreSQL Ledger & Route Management System*  
> Official Website: [https://fin-route.site/](https://fin-route.site/)  
> Lead & Inquiries WhatsApp: [+91 8978388567](https://wa.me/918978388567?text=Hello%20FinRoute%2C%20I%20am%20interested%20in%20FinRoute%20Collector%20for%20microfinance%20loan%20tracking)

---

## What it is

FinRoute Collect is a web ledger for weekly (Sunday) microfinance collections. Each
business (**tenant**) gets its own private Supabase PostgreSQL database; field
operators record payments per customer per week, and the app works out balances,
weekly collections and rolling cash. English and Telugu (తెలుగు) are supported.

Live: https://sub-project.fin-route.site (operators) · `/#admin` (FinRoute administrators)

## Features

| Area | What you get |
|---|---|
| **Ledger** | Customers grouped by village, weekly payment columns (Week 1 date cascades +7 days), balances, Paid Off / Active status, loan renewal and archive |
| **Cash settlement** | Opening cash, collections, bank deposit, new loans, expenses and salaries, rolled forward week to week |
| **Reliable saving** | Every change is stored on the device first and sent to the database in order, retried automatically when the connection returns; nothing is lost if the tab closes or the signal drops |
| **One device at a time** | While an account is signed in on one device, another device is refused; admins can end a session for a lost phone |
| **Change history** | The database records every change (old value, new value, who, when); operators see it under **History** |
| **Backups** | Nightly server backups of every tenant (30 daily + 12 monthly), admin downloads, operator **My data** download, tested restore script |
| **Exports** | PDF ledger report (landscape) and CSV (Excel-safe, Telugu-friendly, protected against formula injection) |
| **Admin panel** | Tenants, admins, keep-alive and health, database version and size per tenant, active sessions, backups, app error reports, and a step-by-step **Tenant Setup Guide** |

## Architecture

```
Browser (React 19 + Vite, Netlify)
 ├─ Master Supabase project  (ubhwoicsjmxslggltvaa)
 │    • tenants, hashed credentials, tenant DB settings, secret keys in Vault
 │    • Edge Functions: tenant-login, tenant-session, admin-tenants,
 │      super-admin-login, keep-alive, tenant-backup, report-error
 │    • private Storage bucket "tenant-backups"
 └─ One Supabase project per tenant
      • ledger tables, change_log, operator-only access (RLS)
      • the operator signs in to it with a session issued by tenant-login
```

### Security model (short)
- Operators log in through `tenant-login`: master password check (bcrypt, lockout,
  status, expiry), one-active-device rule, then a real sign-in to their own tenant
  database. No passwords are stored in the browser.
- Tenant databases are locked down (`supabase/tenant_lockdown.sql`): the public key
  alone can read or write nothing; only signed-in operators can.
- Tenant secret keys live in the master project's Vault and are used only by Edge
  Functions. Edge Functions accept browser calls only from allowed origins.
- Passwords: at least 10 characters for new passwords; weak old ones must be changed at next login.

## Project layout

```
src/
  App.jsx                    ledger app (state, handlers)
  components/                screens and dialogs (TrackerTable, SuperAdminPanel, TenantSetupGuide, ...)
  hooks/useOutbox.js         reliable saving (device outbox + sender)
  hooks/useTrackerSync.js    load from DB, device cache, unload guard
  services/                  master/tenant DB access, outbox, sessions, error reporting
  config/tenantUpdates.js    list of tenant database updates
  utils/                     calculations, CSV/PDF export, change history text, backups
supabase/
  supabase_master_setup.sql, master_db_health_setup.sql, migrations/   master database
  supabase_tenant_template.sql, tenant_lockdown.sql, tenant_updates/   tenant databases
  functions/                 Edge Functions (+ _shared helpers)
scripts/restore-backup.mjs   restore a backup into a tenant project
tests/                       unit tests (Vitest)
e2e/                         browser smoke tests (Playwright)
docs/                        guides (verification, restore, improvement plan)
```

## Local development

```powershell
npm ci
copy .env.example .env.local   # then fill in the master URL and publishable key
npm run dev                    # http://localhost:5173
```

Only `VITE_*` variables reach the browser, and everything in them is public. Never
put secret keys or passwords in `.env` files.

## Tests

```powershell
npm test            # unit tests (ledger maths, outbox, sessions, backups, ...)
npm run lint
npm run test:e2e    # browser smoke tests on a local build
```

Signed-in end-to-end tests need a **dedicated test tenant**
(`E2E_TENANT_EMAIL`, `E2E_TENANT_PASSWORD`). CI (GitHub Actions) runs lint, unit tests,
the build, a check that no customer data or secret keys end up in the bundle, and the
public browser tests on every pull request.

## Deploying changes

1. **Master database** (SQL Editor, in order, each safe to re-run):
   `supabase_master_setup.sql`, `master_db_health_setup.sql`, then every file in
   `supabase/migrations/` by date.
2. **Edge Functions**
   ```powershell
   npx supabase functions deploy tenant-login tenant-session tenant-backup report-error admin-tenants keep-alive super-admin-login --project-ref ubhwoicsjmxslggltvaa
   ```
   Secrets: `ALLOWED_ORIGINS`, `BACKUP_CRON_SECRET` (see the Setup Guide → one-time setup).
3. **Tenant databases**: run any missing scripts from `supabase/tenant_updates/` in each
   tenant's SQL Editor. The admin panel shows each tenant's version.
4. **Frontend**: merge into `main`; Netlify builds and deploys.

GitHub repository secrets used by workflows: `SUPABASE_MASTER_PUBLISHABLE_KEY`,
`BACKUP_CRON_SECRET`, and optionally `E2E_TENANT_EMAIL` / `E2E_TENANT_PASSWORD`.

## Operations

- **Add a tenant**: Admin panel → **Tenant Setup Guide** (8 steps, copy buttons).
- **Backups and restore**: `docs/RESTORE_BACKUP.md`.
- **Health**: Admin panel → Keep-Alive & Health Logs (database status, app errors).
- **Checks after a release**: `docs/SECURITY_VERIFICATION_GUIDE.md`.
- **Roadmap / decisions**: `docs/IMPROVEMENT_PLAN.md`.
