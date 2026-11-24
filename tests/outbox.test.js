import { describe, it, expect, beforeEach } from 'vitest';
import {
  addEntry,
  nextPending,
  countByState,
  retryDelayMs,
  classifyError,
  drainOutbox,
  loadOutbox,
  saveOutbox,
  outboxStorageKey,
} from '../src/services/outbox';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

// Simple harness around drainOutbox with an in-memory list
function harness(initial) {
  let entries = initial;
  return {
    read: () => entries,
    write: (next) => { entries = next; },
    get entries() { return entries; },
  };
}

const netErr = () => Object.assign(new Error('TypeError: Failed to fetch'), { code: '' });
const pgErr = (code, message = 'db error') => Object.assign(new Error(message), { code });

describe('addEntry', () => {
  it('appends in order', () => {
    let q = addEntry([], { type: 'payment', payload: { a: 1 } });
    q = addEntry(q, { type: 'addCustomer', payload: { b: 2 } });
    expect(q.map(e => e.type)).toEqual(['payment', 'addCustomer']);
    expect(q.every(e => e.state === 'pending' && e.attempts === 0)).toBe(true);
  });

  it('merges repeated edits of the same cell and keeps the latest at the end', () => {
    let q = addEntry([], { type: 'payment', key: 'payment:C1:w1', payload: { amount: 100 } });
    q = addEntry(q, { type: 'addWeek', payload: {} });
    q = addEntry(q, { type: 'payment', key: 'payment:C1:w1', payload: { amount: 150 } });
    expect(q).toHaveLength(2);
    expect(q[0].type).toBe('addWeek');
    expect(q[1].payload.amount).toBe(150);
  });

  it('does not replace a change that is currently being sent', () => {
    let q = addEntry([], { type: 'payment', key: 'k', payload: { amount: 1 } });
    q = q.map(e => ({ ...e, state: 'sending' }));
    q = addEntry(q, { type: 'payment', key: 'k', payload: { amount: 2 } });
    expect(q).toHaveLength(2);
  });

  it('does not mutate the input list', () => {
    const q = [];
    addEntry(q, { type: 'payment', payload: {} });
    expect(q).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('nextPending skips failed entries', () => {
    const q = [{ id: '1', type: 'x', state: 'failed' }, { id: '2', type: 'x', state: 'pending' }];
    expect(nextPending(q).id).toBe('2');
  });

  it('counts pending (incl. sending) and failed', () => {
    const q = [{ state: 'pending' }, { state: 'sending' }, { state: 'failed' }];
    expect(countByState(q)).toEqual({ pending: 2, failed: 1 });
  });

  it('backs off 5s, 15s, 60s, then every 2 minutes', () => {
    expect([1, 2, 3, 4, 9].map(retryDelayMs)).toEqual([5000, 15000, 60000, 120000, 120000]);
  });
});

describe('classifyError', () => {
  it('retries network problems and server hiccups', () => {
    expect(classifyError(netErr())).toBe('retry');
    expect(classifyError(new Error('Connection timed out'))).toBe('retry');
    expect(classifyError({ message: 'x', status: 503 })).toBe('retry');
    expect(classifyError({ message: 'JWT expired', code: 'PGRST301' })).toBe('retry');
  });

  it('pauses on permission problems (needs a new sign-in)', () => {
    expect(classifyError(pgErr('42501', 'permission denied for table payments'))).toBe('auth');
  });

  it('gives up on invalid data', () => {
    expect(classifyError(pgErr('23503', 'violates foreign key constraint'))).toBe('failed');
    expect(classifyError(pgErr('22P02', 'invalid input syntax'))).toBe('failed');
  });
});

describe('drainOutbox', () => {
  it('sends everything in order and empties the outbox', async () => {
    const sent = [];
    let q = addEntry([], { type: 'a', payload: 1 });
    q = addEntry(q, { type: 'b', payload: 2 });
    const h = harness(q);
    const res = await drainOutbox({
      ...h,
      client: {},
      executors: { a: async (_c, p) => sent.push(['a', p]), b: async (_c, p) => sent.push(['b', p]) },
    });
    expect(res).toEqual({ outcome: 'done' });
    expect(sent).toEqual([['a', 1], ['b', 2]]);
    expect(h.entries).toHaveLength(0);
  });

  it('stops at a network error, keeps the change and the order', async () => {
    const sent = [];
    let q = addEntry([], { type: 'ok', payload: 1 });
    q = addEntry(q, { type: 'flaky', payload: 2 });
    q = addEntry(q, { type: 'ok', payload: 3 });
    const h = harness(q);
    const res = await drainOutbox({
      ...h,
      client: {},
      executors: { ok: async (_c, p) => sent.push(p), flaky: async () => { throw netErr(); } },
    });
    expect(res).toEqual({ outcome: 'retry', attempts: 1 });
    expect(sent).toEqual([1]); // change 3 was NOT sent before change 2
    expect(h.entries.map(e => e.payload)).toEqual([2, 3]);
    expect(h.entries[0]).toMatchObject({ state: 'pending', attempts: 1 });
  });

  it('marks invalid changes as failed and carries on with the rest', async () => {
    const sent = [];
    const failures = [];
    let q = addEntry([], { type: 'bad', payload: 1, label: 'bad one' });
    q = addEntry(q, { type: 'ok', payload: 2 });
    const h = harness(q);
    const res = await drainOutbox({
      ...h,
      client: {},
      executors: { bad: async () => { throw pgErr('23503'); }, ok: async (_c, p) => sent.push(p) },
      onPermanentFailure: (entry) => failures.push(entry.label),
    });
    expect(res.outcome).toBe('done');
    expect(sent).toEqual([2]);
    expect(failures).toEqual(['bad one']);
    expect(h.entries).toHaveLength(1);
    expect(h.entries[0].state).toBe('failed');
  });

  it('pauses on a permission error without dropping anything', async () => {
    const h = harness(addEntry([], { type: 'x', payload: 1 }));
    const res = await drainOutbox({
      ...h,
      client: {},
      executors: { x: async () => { throw pgErr('42501', 'permission denied'); } },
    });
    expect(res).toEqual({ outcome: 'auth' });
    expect(h.entries).toHaveLength(1);
    expect(h.entries[0].state).toBe('pending');
  });

  it('a change added while another is sending is sent afterwards', async () => {
    const sent = [];
    const h = harness(addEntry([], { type: 'slow', payload: 1 }));
    const res = await drainOutbox({
      ...h,
      client: {},
      executors: {
        slow: async (_c, p) => {
          sent.push(p);
          h.write(addEntry(h.read(), { type: 'fast', payload: 2 })); // user edits meanwhile
        },
        fast: async (_c, p) => sent.push(p),
      },
    });
    expect(res.outcome).toBe('done');
    expect(sent).toEqual([1, 2]);
    expect(h.entries).toHaveLength(0);
  });
});

describe('device storage', () => {
  beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

  it('survives a reload (save then load)', () => {
    const q = addEntry([], { type: 'payment', payload: { amount: 5 } });
    saveOutbox('Op@Example.com', q);
    expect(loadOutbox('op@example.com')).toEqual(q);
  });

  it('is kept separately per user', () => {
    saveOutbox('a@x.com', addEntry([], { type: 'payment', payload: 1 }));
    expect(loadOutbox('b@x.com')).toEqual([]);
    expect(outboxStorageKey('a@x.com')).not.toBe(outboxStorageKey('b@x.com'));
  });

  it('removes the key when empty and ignores corrupt data', () => {
    saveOutbox('a@x.com', []);
    expect(localStorage.getItem(outboxStorageKey('a@x.com'))).toBeNull();
    localStorage.setItem(outboxStorageKey('a@x.com'), '{bad');
    expect(loadOutbox('a@x.com')).toEqual([]);
  });
});
