import React, { useState } from 'react';
import { KeyRound, X, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { passwordProblem, passwordStrength, PASSWORD_MIN_LENGTH } from '../../supabase/functions/_shared/password.ts';

const STRENGTH = {
  weak: { label: 'Too short', bar: 'w-1/3 bg-red-500' },
  ok: { label: 'OK', bar: 'w-2/3 bg-amber-500' },
  strong: { label: 'Strong', bar: 'w-full bg-emerald-500' },
};

/**
 * Operator password change. With `forced`, it can't be closed: used when the
 * current password doesn't meet the rule.
 */
export default function ChangePasswordModal({ email, forced = false, onClose, onChanged, changePassword }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const problem = next ? passwordProblem(next, email) : null;
  const strength = STRENGTH[passwordStrength(next)];
  const mismatch = confirm && next !== confirm;
  const canSubmit = current && next && !problem && !mismatch && confirm && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    const res = await changePassword(current, next);
    setBusy(false);
    if (res.success) onChanged?.();
    else setError(res.message || 'Could not change the password.');
  };

  const field = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">{forced ? 'Please choose a new password' : 'Change password'}</h3>
              <p className="text-[11px] text-slate-500">
                {forced
                  ? `Your current password is too short or too easy to guess. Choose one with at least ${PASSWORD_MIN_LENGTH} characters to continue.`
                  : `At least ${PASSWORD_MIN_LENGTH} characters. A short sentence is easy to remember.`}
              </p>
            </div>
          </div>
          {!forced && (
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <label className="block text-xs font-semibold text-slate-700">
          Current password
          <input type={show ? 'text' : 'password'} value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" className={`${field} mt-1`} />
        </label>

        <label className="block text-xs font-semibold text-slate-700">
          New password
          <input type={show ? 'text' : 'password'} value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" className={`${field} mt-1`} />
        </label>
        {next && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${strength.bar}`} /></div>
            <p className={`text-[11px] ${problem ? 'text-red-600' : 'text-slate-500'}`}>{problem || strength.label}</p>
          </div>
        )}

        <label className="block text-xs font-semibold text-slate-700">
          Type the new password again
          <input type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className={`${field} mt-1`} />
        </label>
        {mismatch && <p className="text-[11px] text-red-600">The two new passwords don&apos;t match.</p>}

        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} Show passwords
        </label>

        {error && <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  );
}
