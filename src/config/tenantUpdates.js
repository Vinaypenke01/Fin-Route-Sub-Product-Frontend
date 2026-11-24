// Registry of tenant database updates. Each tenant has its own Supabase
// project, so every schema change is a numbered script the admin runs in each
// tenant's SQL Editor. The admin panel compares each tenant's version with
// LATEST_TENANT_VERSION and the Setup Guide lists these scripts with copy buttons.
//
// To add an update: create supabase/tenant_updates/NNN_name.sql (safe to run
// twice, ends by inserting its version into finroute_schema_version), then add
// an entry below.
import update001 from '../../supabase/tenant_updates/001_schema_version.sql?raw';
import update002 from '../../supabase/tenant_updates/002_session_control.sql?raw';
import update003 from '../../supabase/tenant_updates/003_change_log.sql?raw';
import update004 from '../../supabase/tenant_updates/004_database_size.sql?raw';

export const TENANT_UPDATES = [
  {
    version: 1,
    file: 'supabase/tenant_updates/001_schema_version.sql',
    title: 'Schema version tracking',
    summary: 'Adds a small table that records which updates this tenant database has, so the admin panel can show who is up to date.',
    sql: update001,
  },
  {
    version: 2,
    file: 'supabase/tenant_updates/002_session_control.sql',
    title: 'Session control',
    summary: 'Lets the admin "End session" button sign the operator out of their database immediately (for a lost or stolen phone).',
    sql: update002,
  },
  {
    version: 3,
    file: 'supabase/tenant_updates/003_change_log.sql',
    title: 'Change history',
    summary: 'The database records every change to payments, customers, weeks and cash settlements (old value, new value, who, when). Shown under History in the app and in the admin activity view.',
    sql: update003,
  },
  {
    version: 4,
    file: 'supabase/tenant_updates/004_database_size.sql',
    title: 'Database size reporting',
    summary: 'Shows how full this database is in the Tenants Directory, with a warning before the free-tier limit is reached.',
    sql: update004,
  },
];

export const LATEST_TENANT_VERSION = TENANT_UPDATES.reduce((max, u) => Math.max(max, u.version), 0);
