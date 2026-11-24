// Sends crash and failed-save reports to the FinRoute master project (the
// report-error Edge Function), so problems on operators' phones are visible in
// the admin panel. Personal data is removed here AND again on the server.
import { scrubText } from '../../supabase/functions/_shared/scrub.ts';
import { getValidStoredSession } from './sessionService';
import { getDeviceLabel } from './deviceSession';

const MASTER_URL = (import.meta.env?.VITE_MASTER_SUPABASE_URL || '').replace(/\/$/, '');
const MASTER_KEY = import.meta.env?.VITE_MASTER_SUPABASE_ANON_KEY || '';
// eslint-disable-next-line no-undef
const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';

const recent = new Map(); // message -> last sent time
let sentThisMinute = [];

/** Pure throttle rule (exported for tests): max 5 per minute, same message once per 10 min. */
export function shouldSend(message, now, state = { recent, sent: sentThisMinute }) {
  state.sent = state.sent.filter(t => now - t < 60000);
  if (state.sent.length >= 5) return false;
  const last = state.recent.get(message);
  if (last !== undefined && now - last < 10 * 60000) return false;
  state.recent.set(message, now);
  state.sent.push(now);
  return true;
}

export function reportError(kind, error, detail = '') {
  try {
    if (!MASTER_URL || !MASTER_KEY || import.meta.env?.MODE === 'test') return;
    const email = getValidStoredSession()?.email || '';
    const message = scrubText(error?.message || error || 'Unknown error', email, 500);
    const state = { recent, sent: sentThisMinute };
    if (!shouldSend(message, Date.now(), state)) return;
    sentThisMinute = state.sent;

    const body = JSON.stringify({
      kind,
      email: email || null,
      message,
      detail: scrubText(`${detail || ''}\n${error?.stack || ''}`.trim(), email, 4000),
      page: (typeof location !== 'undefined' ? location.hash || location.pathname : '').slice(0, 200),
      device: getDeviceLabel(),
      appVersion: APP_BUILD,
    });
    fetch(`${MASTER_URL}/functions/v1/report-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: MASTER_KEY },
      body,
      keepalive: true,
    }).catch(() => { /* reporting must never break the app */ });
  } catch {
    /* ignore */
  }
}
