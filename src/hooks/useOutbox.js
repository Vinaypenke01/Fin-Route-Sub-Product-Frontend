import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadOutbox,
  saveOutbox,
  addEntry,
  removeEntry,
  nextPending,
  countByState,
  retryDelayMs,
  drainOutbox,
} from '../services/outbox';
import { OUTBOX_EXECUTORS } from '../services/outboxExecutors';

const SEND_DELAY_MS = 500; // small pause so quick edits to the same cell merge

/**
 * Reliable saving for one tenant.
 * - enqueue(): stores the change on the device immediately, then sends it
 * - retries with back-off, and right away when the browser is back online
 * - flush(): send everything now; resolves with the number still waiting
 */
export function useOutbox({ tenantClient, email, onPermanentFailure }) {
  const entriesRef = useRef([]);
  const [entries, setEntries] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [authBlocked, setAuthBlocked] = useState(false);
  const [nextRetryAt, setNextRetryAt] = useState(null);
  const clientRef = useRef(tenantClient);
  const emailRef = useRef(email);
  const sendingRef = useRef(false);
  const timerRef = useRef(null);
  const authBlockedRef = useRef(false);
  const processRef = useRef(null);
  const failureCbRef = useRef(onPermanentFailure);
  useEffect(() => { failureCbRef.current = onPermanentFailure; }, [onPermanentFailure]);

  const commit = useCallback((next) => {
    entriesRef.current = next;
    saveOutbox(emailRef.current, next);
    setEntries(next);
  }, []);

  // Load this user's pending changes when the user changes
  useEffect(() => {
    emailRef.current = email;
    const loaded = email ? loadOutbox(email).map(e => (e.state === 'sending' ? { ...e, state: 'pending' } : e)) : [];
    entriesRef.current = loaded;
    setEntries(loaded);
    authBlockedRef.current = false;
    setAuthBlocked(false);
  }, [email]);

  const schedule = useCallback((delay) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setNextRetryAt(delay > SEND_DELAY_MS ? Date.now() + delay : null);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setNextRetryAt(null);
      processRef.current?.();
    }, delay);
  }, []);

  const processQueue = useCallback(async () => {
    if (sendingRef.current) return;
    const client = clientRef.current;
    if (!client || authBlockedRef.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    sendingRef.current = true;
    setIsSending(true);
    try {
      const result = await drainOutbox({
        read: () => entriesRef.current,
        write: commit,
        client,
        executors: OUTBOX_EXECUTORS,
        onPermanentFailure: (entry, message) => failureCbRef.current?.(entry, message),
      });
      if (result.outcome === 'auth') {
        authBlockedRef.current = true;
        setAuthBlocked(true);
      } else if (result.outcome === 'retry') {
        schedule(retryDelayMs(result.attempts));
      }
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }, [commit, schedule]);
  useEffect(() => { processRef.current = processQueue; }, [processQueue]);

  // New client (login / session restored): resume sending
  useEffect(() => {
    clientRef.current = tenantClient;
    if (tenantClient && nextPending(entriesRef.current)) schedule(SEND_DELAY_MS);
  }, [tenantClient, schedule]);

  // Back online / tab visible again: try right away
  useEffect(() => {
    const kick = () => {
      if (document.visibilityState === 'hidden') return;
      if (nextPending(entriesRef.current)) schedule(0);
    };
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', kick);
    return () => {
      window.removeEventListener('online', kick);
      document.removeEventListener('visibilitychange', kick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [schedule]);

  const enqueue = useCallback((type, payload, { key = null, label = '' } = {}) => {
    commit(addEntry(entriesRef.current, { type, payload, key, label }));
    schedule(SEND_DELAY_MS);
  }, [commit, schedule]);

  /** Send everything now. Resolves with how many changes are still waiting. */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // wait for an in-flight run to finish, then run once more
    for (let i = 0; i < 50 && sendingRef.current; i++) {
      await new Promise(r => setTimeout(r, 100));
    }
    await processQueue();
    return countByState(entriesRef.current).pending;
  }, [processQueue]);

  const retryNow = useCallback(() => {
    authBlockedRef.current = false;
    setAuthBlocked(false);
    commit(entriesRef.current.map(e => (e.state === 'failed' ? { ...e, state: 'pending' } : e)));
    schedule(0);
  }, [commit, schedule]);

  const discard = useCallback((id) => {
    commit(removeEntry(entriesRef.current, id));
  }, [commit]);

  const getPendingCount = useCallback(() => countByState(entriesRef.current).pending, []);

  const { pending, failed } = countByState(entries);

  return {
    entries,
    pendingCount: pending,
    failedCount: failed,
    isSending,
    authBlocked,
    nextRetryAt,
    enqueue,
    flush,
    retryNow,
    discard,
    getPendingCount,
  };
}
