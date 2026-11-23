# Tenant database lockdown: rollout guide

Goal: a tenant's public (publishable) key alone can no longer read or change that
tenant's ledger. Operators get a real sign-in session on their own tenant
project, created by the `tenant-login` Edge Function after the master password
check.

## One-time setup (master project)

1. SQL Editor (master): run `migrations/20261124_tenant_auth.sql`.
2. Deploy the functions:
   ```
   npx supabase functions deploy tenant-login admin-tenants keep-alive --project-ref ubhwoicsjmxslggltvaa
   ```
3. Merge the frontend PR so the app logs in through `tenant-login`.

Nothing changes for operators yet: tenants without a secret key keep working in
the old public-key mode.

## Per tenant (one at a time)

1. **Secret key**: in the tenant's Supabase project, go to Project Settings →
   API Keys, create a **secret key** (`sb_secret_…`). In the admin panel,
   Edit tenant → *Tenant Secret Key* → Save.
2. **Sign-in account**: ask the operator to log in once (this creates their
   account in the tenant project), or set a new password in Edit tenant.
   Check: tenant project → Authentication → Users shows their email.
3. **Disable sign-ups**: tenant project → Authentication → Sign In / Providers
   → turn off *Allow new users to sign up*.
4. **Lock the database**: tenant project → SQL Editor → run
   `tenant_lockdown.sql`.
5. **Require sign-in**: admin panel → Edit tenant → tick *Require tenant
   sign-in* → Save.
6. **Verify**:
   - Operator can log in, see the ledger, and save a payment.
   - Admin panel → View tenant shows stats and activity.
   - Health check shows the tenant online.
   - The public key alone is refused (should return an error, not rows):
     ```
     curl "https://<tenant>.supabase.co/rest/v1/customers?select=id&limit=1" -H "apikey: <publishable key>"
     ```

Rollback for one tenant: run the ROLLBACK block at the end of
`tenant_lockdown.sql` and untick *Require tenant sign-in*.

## Notes

- Suspending a tenant also bans their tenant sign-in account; an already-open
  session stops working when its access token expires (up to 1 hour).
- After every tenant is switched, revoke anon EXECUTE on
  `verify_tenant_login` in the master DB so logins only go through the server.
