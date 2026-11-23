# Security fixes: verification guide (M0 → M2 step 3)

Use this to confirm each fix works in the real system. Work top to bottom; each
section assumes the one before it passed. Tick the boxes as you go.

| Section | Covers |
|---|---|
| [A. Setup](#a-setup) | What you need open before testing |
| [B. M0: master DB hardening + credential rotation](#b-m0-master-db-hardening--credential-rotation) | Migration `20261123_security_hardening.sql`, rotated passwords and keys |
| [C. M1: quick fixes](#c-m1-quick-fixes) | Sheets login, `/Code.gs`, CORS, keep-alive leak, workflow secret |
| [D. M2 step 1: tenant auth migration](#d-m2-step-1-tenant-auth-migration) | Migration `20261124_tenant_auth.sql` |
| [E. M2 step 2: edge functions deployed](#e-m2-step-2-edge-functions-deployed) | `tenant-login`, `admin-tenants`, `keep-alive`, `super-admin-login` |
| [F. M2 step 3: frontend (preview, then live)](#f-m2-step-3-frontend-preview-then-live) | Operator login, no stored password, admin panel |
| [G. Troubleshooting](#g-troubleshooting) | Symptom → cause → fix |

---

## A. Setup

- **Master SQL Editor**: Supabase dashboard → master project (`ubhwoicsjmxslggltvaa`) → SQL Editor.
- **Git Bash** for the `curl` commands (installed with Git; PowerShell mangles the quotes).
  Set these once per Git Bash window:
  ```bash
  MASTER=https://ubhwoicsjmxslggltvaa.supabase.co
  KEY=sb_publishable_raPNiMJx4rlabjgq3VGQAw_HSKpJ0P5   # master publishable key (public by design)
  SITE=https://sub-project.fin-route.site
  ```
- **Browser** with DevTools (F12): *Network* tab and *Application → Local Storage / Session Storage*.
- **Test accounts**: one super-admin, and one tenant you can safely test with (least critical first).

---

## B. M0: master DB hardening + credential rotation

### B1. Anonymous write policies are gone
SQL Editor:
```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
- [ ] No policy name starts with `Allow anon`.
- [ ] `master_tenants`, `master_credentials`, `master_db_configs` only have `Superadmins can …` policies for `{authenticated}`.
- [ ] `master_super_admins` has **no** policies.

### B2. Passwords are hashed
```sql
SELECT
  (SELECT count(*) FROM master_credentials  WHERE password_hash !~ '^\$2[abxy]\$\d{2}\$') AS plaintext_tenant_pw,
  (SELECT count(*) FROM master_super_admins WHERE password_hash !~ '^\$2[abxy]\$\d{2}\$') AS plaintext_admin_pw;
```
- [ ] Both counts are `0`.

### B3. The unsafe admin RPCs are gone
```sql
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND proname LIKE 'admin\_%'
ORDER BY proname;
```
- [ ] Only `admin_get_tenant_secret` and `admin_set_tenant_secret` (these appear after section D). No `admin_create_super_admin`, `admin_update_full_tenant`, `admin_set_tenant_db`.

Git Bash (anonymous caller trying the old attack path):
```bash
curl -s -X POST "$MASTER/rest/v1/rpc/admin_create_super_admin" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"p_email":"x@example.invalid","p_password":"x","p_name":"x"}'
```
- [ ] Response is an error (`PGRST202` "Could not find the function"). **Not** `{"success":true}`.

### B4. Master tables are not readable with the public key
```bash
for t in master_tenants master_credentials master_db_configs master_super_admins user_roles; do
  printf "%-22s " "$t"; curl -s "$MASTER/rest/v1/$t?select=*&limit=1" -H "apikey: $KEY"; echo
done
```
- [ ] Every line is `[]` or a permission error. No rows, emails or keys.

### B5. Login behaviour
- [ ] Super-admin login at `$SITE/#admin` works with the **new** root password.
- [ ] The **old** root password is rejected with *"Invalid administrator email or password."*
- [ ] A tenant login with a wrong password shows a generic error (does not say whether the email exists).
- [ ] 5 wrong passwords in a row for one tenant → *"Account temporarily locked…"* (unlocks after 15 min; or in SQL: `UPDATE master_credentials SET failed_attempts=0, locked_until=NULL WHERE email='<email>';`).

### B6. Rotated credentials
- [ ] Each seeded tenant (the ones whose passwords were in the old seed file) logs in with its **new** password; the old password fails.
- [ ] The tenant DB key that was committed is disabled. In Git Bash, with the **old** key:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" "https://<tenant-ref>.supabase.co/rest/v1/customers?select=id&limit=1" -H "apikey: <OLD key>"
  ```
  Expect `401`.
- [ ] That tenant still works in the app with the **new** key (admin panel shows it online).

---

## C. M1: quick fixes

### C1. CORS allowlist
```bash
for o in https://evil.example "$SITE"; do
  echo "Origin: $o"
  curl -s -o /dev/null -D - -X OPTIONS "$MASTER/functions/v1/admin-tenants" \
    -H "Origin: $o" -H "Access-Control-Request-Method: POST" | grep -i "^HTTP\|access-control-allow-origin"
done
```
- [ ] `evil.example`: `HTTP … 204` and **no** `Access-Control-Allow-Origin` line.
- [ ] Live site: `Access-Control-Allow-Origin: https://sub-project.fin-route.site`.
- [ ] Admin panel on a Netlify **deploy preview** loads tenants (proves the `*--sub-project001.netlify.app` entry in `ALLOWED_ORIGINS`). If it fails with a CORS error in the console, the secret is missing.

### C2. keep-alive no longer leaks tenant details
```bash
curl -s -X POST "$MASTER/functions/v1/keep-alive" -H "apikey: $KEY" -H "Content-Type: application/json"
```
- [ ] HTTP 200 with `"success":true` and a `summary`.
- [ ] The body has **no** `"results"` array (no tenant names, emails or URLs).
- [ ] Admin panel → health/DB logs (logged in as super-admin) **does** show per-tenant rows.

### C3. GitHub keep-alive workflow
GitHub → Actions → *Supabase Keep-Alive & Database Health Heartbeat* → Run workflow (branch `main`, after merge).
- [ ] Run is green; log shows `Response HTTP Status: 200`.
- [ ] `.github/workflows/supabase-keep-alive.yml` on `main` contains `secrets.SUPABASE_MASTER_PUBLISHABLE_KEY`, not a literal key.

### C4. `/Code.gs` not public
```bash
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/Code.gs"
```
- [ ] Not `200`. Netlify's SPA redirect may return `200` with the app's HTML; check the body is HTML, not Apps Script:
  `curl -s "$SITE/Code.gs" | head -c 200` should start with `<!doctype html>`.

### C5. Google Sheets tenants can log in (skip if you have none)
- [ ] A Sheets-based tenant logs in at `$SITE/#login` and sees their ledger.
- [ ] A Supabase tenant with a wrong password still gets an error (not a blank screen).

---

## D. M2 step 1: tenant auth migration

```sql
-- New columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'master_db_configs'
  AND column_name IN ('tenant_secret_id', 'tenant_auth_user_id', 'tenant_auth_required');

-- Vault available
SELECT extname FROM pg_extension WHERE extname = 'supabase_vault';

-- Who may run the secret helpers (only service_role should be true)
SELECT r AS role,
       has_function_privilege(r, 'public.admin_get_tenant_secret(uuid)', 'execute') AS can_read_secret,
       has_function_privilege(r, 'public.admin_set_tenant_secret(uuid,text)', 'execute') AS can_set_secret
FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r;
```
- [ ] 3 columns listed; `tenant_auth_required` defaults to `false`.
- [ ] `supabase_vault` listed.
- [ ] `anon` and `authenticated` are `false` for both; `service_role` is `true` for both.

From outside (Git Bash):
```bash
curl -s -X POST "$MASTER/rest/v1/rpc/admin_get_tenant_secret" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"p_tenant_id":"00000000-0000-0000-0000-000000000000"}'
```
- [ ] Error (permission denied / not found). Never a key.

---

## E. M2 step 2: edge functions deployed

```powershell
npx supabase functions list --project-ref ubhwoicsjmxslggltvaa
```
- [ ] `tenant-login`, `admin-tenants`, `keep-alive`, `super-admin-login` are listed with today's `UPDATED_AT`.

### E1. tenant-login basics
```bash
# Missing fields → 400
curl -s -w "\nHTTP %{http_code}\n" -X POST "$MASTER/functions/v1/tenant-login" \
  -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}'

# Unknown user → generic failure (HTTP 200, success:false)
curl -s -w "\nHTTP %{http_code}\n" -X POST "$MASTER/functions/v1/tenant-login" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.invalid","password":"wrong-password"}'
```
- [ ] First: `HTTP 400`, *"Email and password are required."*
- [ ] Second: `HTTP 200`, `{"success":false,"message":"Invalid email or password."}`.

### E2. Admin function needs a super-admin
```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST "$MASTER/functions/v1/admin-tenants" \
  -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"action":"list_tenants"}'
```
- [ ] `HTTP 401` (no Bearer token). No tenant data.

### E3. Logs
Supabase dashboard → Edge Functions → each function → Logs.
- [ ] No `boot error` / `module not found` entries after the deploy.

---

## F. M2 step 3: frontend (preview, then live)

Test on the PR's **Netlify deploy preview** first, then repeat F1–F3 on the live site after merging.

### F1. Operator login (tenant **without** a secret key yet: legacy mode)
1. Log in as the test tenant.
2. DevTools → Network: filter `tenant-login`.
   - [ ] One `POST …/functions/v1/tenant-login` with status 200. No `rpc/verify_tenant_login` call.
3. DevTools → Application → Session Storage (or Local Storage if "remember me" was ticked) → `SUNDAY_AUTH_SESSION_V1`:
   - [ ] Contains `"isSupabaseTenant":true` and **no** `"password"` field.
4. Ledger:
   - [ ] Customers and weeks load.
   - [ ] Enter a payment → reload the page → the payment is still there.
5. Log out:
   - [ ] Lands on the landing page; `SUNDAY_AUTH_SESSION_V1` is gone.

### F2. Operator login (tenant **with** a secret key: real tenant session)
1. Admin panel → Edit the test tenant → paste the tenant project's **secret key** (`sb_secret_…`) → Save.
   - [ ] Save succeeds (a "Note: …will be created on the operator's next login" message is expected).
   - [ ] Reopen Edit: the field label says *stored securely; leave blank to keep*.
   - [ ] Master SQL: `SELECT tenant_id, tenant_secret_id IS NOT NULL AS has_secret FROM master_db_configs;` shows `true` for this tenant, and `SELECT name FROM vault.secrets;` lists `finroute_tenant_secret_<tenant id>`.
2. Log in as the operator.
   - [ ] Storage now also has `finroute-tenant-auth-<tenant-ref>.supabase.co` (the tenant session).
   - [ ] Tenant project → Authentication → Users lists the operator's email; its *Raw app meta data* has `"finroute_role": "operator"`.
   - [ ] Master SQL: `SELECT tenant_auth_user_id FROM master_db_configs WHERE tenant_id = '<id>';` is filled in.
   - [ ] Ledger loads and saving a payment still works.
3. Password sync:
   - [ ] Admin panel → Edit tenant → set a new password → Save. Operator can log in with the new password; the old one fails.
4. Log out:
   - [ ] `finroute-tenant-auth-…` disappears from storage.

### F3. Admin panel
- [ ] Tenant list loads; no tenant passwords are shown (column says *Hashed*).
- [ ] View tenant → stats (customers, collected, balance) and the activity log load. In Network, the `admin-tenants` request body contains `"tenantId"` and **no** URL or key.
- [ ] "Ping all" / health screen shows each tenant's status.
- [ ] Tick *Require tenant sign-in* on a tenant **without** a secret key → Save → error *"Save the tenant secret key before requiring tenant sign-in."* (Untick afterwards.)
- [ ] Suspend the test tenant → operator login says *"Account is suspended…"* → if it has a secret key, tenant project → Authentication → Users shows the user as banned → Reactivate → operator can log in again.

### F4. Not yet: lockdown
Do **not** tick *Require tenant sign-in* or run `tenant_lockdown.sql` until F1–F3 pass. That is step 4, with its own checks in `supabase/TENANT_AUTH_ROLLOUT.md`.

---

## G. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin tenant list empty / "column … does not exist" | Functions deployed before `20261124_tenant_auth.sql` | Run the migration (section D), reload |
| Admin panel CORS error on a deploy preview | `ALLOWED_ORIGINS` secret missing the preview pattern | `npx supabase secrets set … ALLOWED_ORIGINS=…` then redeploy |
| Operator login: "Authentication service error." | `tenant-login` can't call `verify_tenant_login` | Edge Function logs; check D passed |
| Secret key save: "Tenant … has no database configuration yet" | Tenant has no URL/key row | Set the URL and publishable key first, then the secret key |
| Login works but no `finroute-tenant-auth-…` in storage | No secret key stored, or a wrong key | Re-enter the secret key; check `tenant-login` logs for "Tenant user sync failed" |
| Ledger shows "Please sign in again…" right after login | Tenant marked *Require sign-in* but session not created | Untick *Require sign-in*; fix the secret key; retry F2 |
| keep-alive shows tenants "error"/"sleeping" | Paused free-tier project or wrong key | Restore the project in its dashboard; update the key in admin panel |
| Sheets tenant can't log in | M1 not deployed on live | Merge the PR; hard-refresh the site |

---

**Result:** when every box in B–F is ticked, M0–M2 step 3 are working as intended and you can start switching tenants (step 4).
