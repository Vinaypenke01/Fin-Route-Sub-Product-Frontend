#!/usr/bin/env node
// ==============================================================================
// Restore a FinRoute tenant backup (nightly server backup or "My data" download)
// into a tenant Supabase project.
//
//   Dry run (default, writes nothing):
//     node scripts/restore-backup.mjs <backup.json> --url https://<ref>.supabase.co
//
//   Restore for real:
//     $env:TENANT_SECRET_KEY = "sb_secret_..."      # PowerShell
//     node scripts/restore-backup.mjs <backup.json> --url https://<ref>.supabase.co --apply
//
// The target project must already have the tenant tables (Setup Guide steps
// 2-3 and every tenant update). Rows are upserted, so running it twice is safe.
// See docs/RESTORE_BACKUP.md for the full procedure.
// ==============================================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { planRestore } from './lib/restorePlan.js';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
}

const file = process.argv[2];
const url = arg('--url');
const apply = process.argv.includes('--apply');

if (!file || !url || !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url)) {
  console.error('Usage: node scripts/restore-backup.mjs <backup.json> --url https://<project-ref>.supabase.co [--apply]');
  process.exit(1);
}

const backup = JSON.parse(readFileSync(file, 'utf8'));
const plan = planRestore(backup);

console.log(`Backup created: ${backup.createdAt}  (${backup.tenant?.email || 'unknown tenant'})`);
console.log(`Target:         ${url}`);
for (const step of plan) console.log(`  ${step.table.padEnd(24)} ${String(step.rowCount).padStart(6)} rows`);

if (!apply) {
  console.log('\nDry run only. Nothing was written. Add --apply to restore.');
  process.exit(0);
}

const secret = process.env.TENANT_SECRET_KEY || '';
if (!secret.startsWith('sb_secret_')) {
  console.error('Set TENANT_SECRET_KEY to the target project\'s secret key (sb_secret_...) first.');
  process.exit(1);
}

const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

for (const step of plan) {
  let done = 0;
  for (const batch of step.batches) {
    const q = step.onConflict
      ? client.from(step.table).upsert(batch, { onConflict: step.onConflict })
      : client.from(step.table).insert(batch);
    const { error } = await q;
    if (error) {
      console.error(`\nFailed on ${step.table} after ${done} rows: ${error.message}`);
      console.error('Nothing after this point was written. Fix the problem and run again (safe to repeat).');
      process.exit(1);
    }
    done += batch.length;
  }
  console.log(`  restored ${step.table}: ${done}`);
}

// Verify counts
console.log('\nChecking row counts in the target...');
let mismatch = false;
for (const step of plan) {
  if (step.table === 'change_log') continue; // the restore itself adds history rows
  const { count, error } = await client.from(step.table).select('*', { count: 'exact', head: true });
  const ok = !error && count >= step.rowCount;
  if (!ok) mismatch = true;
  console.log(`  ${step.table.padEnd(24)} backup ${step.rowCount}, target ${error ? 'error' : count} ${ok ? 'OK' : '<-- CHECK'}`);
}
console.log(mismatch ? '\nSome tables need checking (see above).' : '\nRestore complete.');
process.exit(mismatch ? 2 : 0);
