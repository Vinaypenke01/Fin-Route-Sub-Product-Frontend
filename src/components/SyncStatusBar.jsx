import React, { useEffect, useState } from 'react';
import { CloudOff, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react';

function useSecondsUntil(timestamp) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timestamp) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timestamp]);
  return timestamp ? Math.max(0, Math.ceil((timestamp - now) / 1000)) : null;
}

/**
 * Shown under the header only when something hasn't reached the server:
 * changes waiting for internet, changes that failed, or a sign-in problem.
 */
export default function SyncStatusBar({
  pendingCount,
  failedCount,
  isSending,
  authBlocked,
  nextRetryAt,
  entries = [],
  onRetry,
  onDiscard,
}) {
  const [open, setOpen] = useState(false);
  const seconds = useSecondsUntil(nextRetryAt);

  if (pendingCount === 0 && failedCount === 0) return null;

  const hasProblem = failedCount > 0 || authBlocked;
  const tone = hasProblem
    ? 'bg-red-50 border-red-200 text-red-900'
    : 'bg-amber-50 border-amber-200 text-amber-900';

  let headline;
  if (authBlocked) {
    headline = `${pendingCount} change(s) can't be sent: please log out and sign in again. They are kept on this device.`;
  } else if (failedCount > 0) {
    headline = `${failedCount} change(s) could not be saved and need your attention.`;
  } else if (isSending) {
    headline = `Saving ${pendingCount} change(s)…`;
  } else {
    headline = `${pendingCount} change(s) waiting for internet. They are kept on this device and will be sent automatically.`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3" role="status" aria-live="polite">
      <div className={`rounded-xl border ${tone} text-xs`}>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : hasProblem ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CloudOff className="w-4 h-4 shrink-0" />
          )}
          <span className="font-semibold flex-1 min-w-[200px]">{headline}</span>
          {!isSending && seconds !== null && !hasProblem && (
            <span className="text-[11px] opacity-80">Next try in {seconds}s</span>
          )}
          {!isSending && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-current/20 font-bold cursor-pointer hover:bg-white/70"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try now</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg font-semibold cursor-pointer hover:bg-white/60"
            aria-expanded={open}
          >
            <span>{open ? 'Hide' : 'Details'}</span>
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {open && (
          <ul className="border-t border-current/10 divide-y divide-current/10 max-h-60 overflow-y-auto">
            {entries.map(e => (
              <li key={e.id} className="flex items-start gap-2 px-3 py-2">
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${e.state === 'failed' ? 'bg-red-500' : e.state === 'sending' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold break-words">{e.label || e.type}</div>
                  <div className="text-[11px] opacity-75">
                    {new Date(e.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {e.state === 'failed' ? ' · not saved' : e.state === 'sending' ? ' · sending' : ' · waiting'}
                    {e.attempts > 0 && ` · ${e.attempts} attempt(s)`}
                  </div>
                  {e.lastError && <div className="text-[11px] font-mono opacity-75 break-words">{e.lastError}</div>}
                </div>
                {e.state === 'failed' && (
                  <button
                    type="button"
                    onClick={() => onDiscard(e.id)}
                    className="p-1 rounded hover:bg-white/70 cursor-pointer"
                    title="Discard this change"
                    aria-label="Discard this change"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
