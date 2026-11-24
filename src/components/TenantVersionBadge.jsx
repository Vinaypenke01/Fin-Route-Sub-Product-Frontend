import React from 'react';
import { LATEST_TENANT_VERSION } from '../config/tenantUpdates';
import { describeDbSize } from '../utils/dbSize';

/**
 * Shows which tenant database update a tenant has applied.
 * info: { status: 'ok'|'no_key'|'unconfigured'|'error', version, message } | undefined (still loading)
 */
export default function TenantVersionBadge({ info, onOpenGuide }) {
  const base = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border';

  if (!info) {
    return <span className={`${base} bg-slate-50 text-slate-400 border-slate-200`}>DB version…</span>;
  }
  if (info.status === 'unconfigured') return null;
  if (info.status === 'no_key') {
    return (
      <span className={`${base} bg-slate-100 text-slate-600 border-slate-200`} title="Save the tenant secret key to check its database version">
        DB version unknown (no secret key)
      </span>
    );
  }
  if (info.status === 'error') {
    return (
      <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`} title={info.message || ''}>
        DB version check failed
      </span>
    );
  }

  const v = Number(info.version) || 0;
  const size = describeDbSize(info.sizeBytes);
  const sizeBadge = size && (
    <span
      className={`${base} ${size.level === 'danger' ? 'bg-red-50 text-red-700 border-red-300' : size.level === 'warn' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
      title={size.level === 'ok' ? 'Database size' : 'Nearly full: plan an upgrade of this Supabase project (see Setup Guide)'}
    >
      {size.level !== 'ok' && '⚠ '}{size.text}
    </span>
  );

  if (v >= LATEST_TENANT_VERSION) {
    return (
      <span className="inline-flex flex-wrap gap-1">
        <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`} title="All tenant updates applied">
          DB v{v} · up to date
        </span>
        {sizeBadge}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpenGuide}
      className={`${base} bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 cursor-pointer`}
      title="Open the Tenant Setup Guide → Tenant database updates"
    >
      DB v{v} · update needed (latest v{LATEST_TENANT_VERSION})
    </button>
  );
}
