import React, { useState } from 'react';
import { Smartphone, LogOut, Loader2 } from 'lucide-react';
import { endTenantSession } from '../services/masterAuthService';

const TIMEOUT_MS = 5 * 60 * 1000; // must match SESSION_TIMEOUT_MS on the server

function minutesAgo(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

/**
 * Shows whether the tenant is signed in on a device right now, and lets the
 * admin end that session (lost or stolen phone).
 */
export default function ActiveSessionInfo({ tenant, onEnded }) {
  const [busy, setBusy] = useState(false);
  const raw = tenant?.master_active_sessions;
  const session = Array.isArray(raw) ? raw[0] : raw;
  if (!session?.last_seen_at) return null;

  const mins = minutesAgo(session.last_seen_at);
  const active = mins !== null && Date.now() - new Date(session.last_seen_at).getTime() < TIMEOUT_MS;

  const handleEnd = async () => {
    const ok = window.confirm(
      `End the session for ${tenant.email} on ${session.device_label || 'their device'}?\n\n` +
      'That device will be signed out within a minute, and the account can then sign in on another device. ' +
      'Unsent changes stay on that device.'
    );
    if (!ok) return;
    setBusy(true);
    const res = await endTenantSession(tenant.id);
    setBusy(false);
    if (res.success) {
      alert(res.warning ? `Session ended. Note: ${res.warning}` : 'Session ended. The device will be signed out within a minute.');
      onEnded?.();
    } else {
      alert(`Could not end the session: ${res.message}`);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
          active ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'
        }`}
        title={session.started_at ? `Signed in ${new Date(session.started_at).toLocaleString('en-IN')}` : ''}
      >
        <Smartphone className="w-3 h-3" />
        {active
          ? `In use: ${session.device_label || 'device'} (${mins === 0 ? 'just now' : `${mins} min ago`})`
          : `Last used: ${session.device_label || 'device'} (${mins} min ago)`}
      </span>
      {active && (
        <button
          type="button"
          onClick={handleEnd}
          disabled={busy}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-200 text-red-700 bg-white hover:bg-red-50 cursor-pointer disabled:opacity-50"
          title="Sign this device out (lost or stolen phone)"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
          End session
        </button>
      )}
    </div>
  );
}
