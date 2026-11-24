# Restoring a tenant backup

Use this when a tenant's data was deleted or damaged, or to move a tenant to a
new Supabase project.

## Where backups come from
- **Nightly server backups**: Admin panel → Tenants Directory → **View** → **Backups** →
  **Download**. Kept: every night for 30 days, plus the first backup of each month for 12 months.
- **Operator download**: the **My data** button in the app. Same file format.

Backup files contain borrower personal data. Keep them private and delete
local copies once the restore is done.

## Restore into a fresh project (recommended)
Restoring into a **new, empty** project means you never overwrite good data by mistake.

1. Create a new tenant Supabase project and follow the **Tenant Setup Guide** steps 1–5
   (create the tables, lock them down, run **all** tenant database updates, turn off sign-ups,
   collect the URL and keys).
2. On your computer, in the project folder (PowerShell):
   ```powershell
   node scripts/restore-backup.mjs C:\path\to\backup.json --url https://NEWREF.supabase.co
   ```
   This is a **dry run**: it lists the tables and row counts and writes nothing.
3. If the numbers look right:
   ```powershell
   $env:TENANT_SECRET_KEY = "sb_secret_..."   # the NEW project's secret key
   node scripts/restore-backup.mjs C:\path\to\backup.json --url https://NEWREF.supabase.co --apply
   Remove-Item Env:TENANT_SECRET_KEY
   ```
   The script restores tables in the right order and then compares row counts.
   It's safe to run again if it stops part-way.
4. Admin panel → **Edit tenant** → change the **database URL**, **publishable key** and
   **secret key** to the new project → Save.
5. Ask the operator to log in. Check the ledger, then run the Setup Guide's final check (step 8).

## Restore into the existing project
Only if the project itself is fine and some rows were lost. Rows in the backup are
**upserted**: matching rows are overwritten with the backup values, and rows added
after the backup are kept. Do a dry run first and make a fresh backup ("Back up now")
before applying.

## Notes
- Change history is restored with its original contents; the restore itself also
  appears in History as changes made by "FinRoute server".
- The operator's sign-in account isn't part of the backup; it's created again
  automatically at their next login once the secret key is saved.
