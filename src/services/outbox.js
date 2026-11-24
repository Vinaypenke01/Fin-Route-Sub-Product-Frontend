// ==============================================================================
// On-device outbox for ledger changes
// ------------------------------------------------------------------------------
// Every change is written here (device storage) BEFORE it is sent to the tenant
// database, and removed only after the database confirms it. If the network is
// down, the database is waking up, or the tab is closed, the change survives and
// is sent later, in the order it was made.
// ==============================================================================

const STORAGE_PREFIX = 'FINROUTE_OUTBOX_';

export function outboxStorageKey(email) {
  return `${STORAGE_PREFIX}${encodeURIComponent(String(email || 'guest').trim().toLowerCase())}`;
}

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadOutbox(email) {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(outboxStorageKey(email)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(e => e && e.id && e.type) : [];
  } catch {
    return [];
  }
}

export function saveOutbox(email, entries) {
  const storage = getStorage();
  if (!storage) return false;
  try {
    if (!entries.length) storage.removeItem(outboxStorageKey(email));
    else storage.setItem(outboxStorageKey(email), JSON.stringify(entries));
    return true;
  } catch (e) {
    console.error('Could not save pending changes on this device:', e);
    return false;
  }
}

let counter = 0;
function newId() {
  counter = (counter + 1) % 1e6;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Adds a change. If `key` is given, an older *pending* change with the same key
 * (e.g. the same payment cell) is replaced: only the latest value is sent, and
 * it moves to the end so it still runs after everything that came before it.
 * Returns the new array (does not mutate the input).
 */
export function addEntry(entries, { type, payload, key = null, label = '' }, now = Date.now()) {
  const kept = key
    ? entries.filter(e => !(e.key === key && e.state !== 'sending'))
    : entries.slice();
  kept.push({
    id: newId(),
    type,
    key,
    label,
    payload,
    createdAt: now,
    attempts: 0,
    state: 'pending',
    lastError: null,
  });
  return kept;
}

export function removeEntry(entries, id) {
  return entries.filter(e => e.id !== id);
}

export function updateEntry(entries, id, patch) {
  return entries.map(e => (e.id === id ? { ...e, ...patch } : e));
}

/** First entry that should be sent next (failed entries are skipped). */
export function nextPending(entries) {
  return entries.find(e => e.state === 'pending' || e.state === 'sending') || null;
}

export function countByState(entries) {
  let pending = 0;
  let failed = 0;
  for (const e of entries) {
    if (e.state === 'failed') failed++;
    else pending++;
  }
  return { pending, failed };
}

/** Wait before retry number `attempts` (1-based): 5s, 15s, 60s, then every 2 min. */
export function retryDelayMs(attempts) {
  const steps = [5000, 15000, 60000];
  return steps[attempts - 1] ?? 120000;
}

/**
 * Decides what to do with an error from the database:
 *  - 'retry'  : temporary (no internet, server waking up, session refreshing)
 *  - 'auth'   : the database refused this login; pause until the user signs in again
 *  - 'failed' : the change itself is invalid; retrying won't help
 */
export function classifyError(err) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || '');
  const status = Number(err?.status || err?.statusCode || 0);

  if (code === '42501' || /permission denied/i.test(msg)) return 'auth';
  if (code === 'PGRST301' || code === 'PGRST303' || /jwt expired|invalid jwt|jwt/i.test(msg) || status === 401) return 'retry';
  if (/failed to fetch|networkerror|network request failed|load failed|timed? ?out|fetch/i.test(msg)) return 'retry';
  if (status >= 500 || status === 408 || status === 429) return 'retry';
  if (code && /^[0-9A-Z]{5}$/.test(code)) return 'failed'; // Postgres error (constraint, bad value, ...)
  if (code.startsWith('PGRST')) return 'failed';
  return 'retry';
}

/**
 * Sends pending changes in order until the outbox is empty or a change can't
 * be sent yet. Pure (no React), so it can be unit-tested.
 *   read()          -> current entries
 *   write(entries)  -> persist + publish the new list
 * Returns { outcome: 'done' } | { outcome: 'retry', attempts } | { outcome: 'auth' }
 */
export async function drainOutbox({ read, write, client, executors, onPermanentFailure }) {
  for (;;) {
    const entry = nextPending(read());
    if (!entry) return { outcome: 'done' };

    const run = executors[entry.type];
    if (!run) {
      write(updateEntry(read(), entry.id, { state: 'failed', lastError: `Unknown change type "${entry.type}"` }));
      continue;
    }

    write(updateEntry(read(), entry.id, { state: 'sending' }));
    try {
      await run(client, entry.payload);
      write(removeEntry(read(), entry.id));
    } catch (err) {
      const kind = classifyError(err);
      const message = String(err?.message || err || 'Unknown error');
      const attempts = (entry.attempts || 0) + 1;
      if (kind === 'failed') {
        write(updateEntry(read(), entry.id, { state: 'failed', attempts, lastError: message }));
        onPermanentFailure?.(entry, message);
        continue; // later changes can still go through
      }
      write(updateEntry(read(), entry.id, { state: 'pending', attempts, lastError: message }));
      // keep order: don't send later changes before this one
      return kind === 'auth' ? { outcome: 'auth' } : { outcome: 'retry', attempts };
    }
  }
}
