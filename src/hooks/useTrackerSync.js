import { useEffect } from 'react';
import { fetchTenantLedgerData } from '../services/tenantDatabaseService';
import { parseDate, formatDateDMY } from '../utils/formatters';
import { normalizeCustomers } from '../utils/customerNormalization';

/**
 * Keeps the ledger on this device in step with the tenant database:
 * - saves the current ledger to device storage after every change
 * - loads the ledger from the database when the tenant session is ready,
 *   but only AFTER any unsent changes (outbox) have reached the database,
 *   so changes made offline are never overwritten by older server data
 * - warns before closing the tab while changes are still unsent
 */
export function useTrackerSync({
  auth,
  tenantClient,
  weeks,
  setWeeks,
  customers,
  setCustomers,
  weeklyReconciliation,
  setWeeklyReconciliation,
  archive,
  setArchive,
  setCloudStatus,
  addToast,
  handleLogout,
  getTenantStorageKey,
  flushOutbox,
  getPendingCount
}) {
  // Tab close / refresh guard while changes are still waiting to be sent
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (getPendingCount && getPendingCount() > 0) {
        e.preventDefault();
        e.returnValue = 'Some changes have not reached the server yet. They are kept on this device and will be sent next time you open the app online.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [getPendingCount]);

  // Persist State to Tenant-Scoped LocalStorage
  useEffect(() => {
    if (!auth?.email) return;
    try {
      const tenantKey = getTenantStorageKey(auth.email);
      localStorage.setItem(tenantKey, JSON.stringify({
        weeks,
        customers,
        weeklyReconciliation,
        archive
      }));
    } catch (e) {
      console.warn('Failed to save to scoped localStorage:', e);
    }
  }, [auth?.email, weeks, customers, weeklyReconciliation, archive, getTenantStorageKey]);

  // Ingest data loaded from elsewhere
  const ingestCloudData = (data) => {
    if (!data) return;
    if (Array.isArray(data.customers)) {
      setCustomers(normalizeCustomers(data.customers));
    }
    if (Array.isArray(data.weeks) && data.weeks.length > 0) {
      setWeeks(data.weeks.map(w => ({
        ...w,
        date: w.date ? (parseDate(w.date) ? formatDateDMY(parseDate(w.date), '/') : String(w.date).replace(/-/g, '/')) : ''
      })));
    }
    if (data.weeklyReconciliation) {
      setWeeklyReconciliation(data.weeklyReconciliation);
    }
    if (Array.isArray(data.archive)) {
      setArchive(data.archive);
    }
  };

  // Load the ledger from the tenant database (with sleeping-DB retry)
  useEffect(() => {
    if (!auth?.isSupabaseTenant || !tenantClient) return;
    let isMounted = true;
    let retryAttempts = 0;
    const maxRetries = 2;

    const attemptFetch = async () => {
      if (!isMounted) return;
      setCloudStatus({ connected: true, isSyncing: true, text: 'Supabase DB (Connecting...)', error: null });

      // 1. Send unsent changes first. If some can't be sent yet (offline),
      //    keep showing the copy on this device instead of older server data.
      if (flushOutbox) {
        const stillWaiting = await flushOutbox();
        if (!isMounted) return;
        if (stillWaiting > 0) {
          setCloudStatus({
            connected: false,
            isSyncing: false,
            text: 'Showing data saved on this device',
            error: null
          });
          addToast(`Showing data saved on this device. ${stillWaiting} change(s) will be sent when you're back online.`, 'warning');
          return;
        }
      }

      try {
        const res = await fetchTenantLedgerData(tenantClient);
        if (!isMounted || !res) return;
        if (Array.isArray(res.customers)) setCustomers(normalizeCustomers(res.customers));
        if (Array.isArray(res.weeks) && res.weeks.length > 0) setWeeks(res.weeks);
        if (res.weeklyReconciliation) setWeeklyReconciliation(res.weeklyReconciliation);
        if (Array.isArray(res.archive)) setArchive(res.archive);
        setCloudStatus({ connected: true, isSyncing: false, text: 'Supabase DB (Private)', error: null });
      } catch (err) {
        if (!isMounted) return;
        const errMsg = String(err?.message || err);

        // Tenant DB rejected the request (locked down, session missing or expired):
        // ask the operator to sign in again instead of showing an empty ledger.
        const code = String(err?.code || '');
        if (code === '42501' || code === 'PGRST301' || /permission denied|JWT expired|invalid jwt/i.test(errMsg)) {
          handleLogout();
          addToast('Please sign in again to open your private ledger.', 'warning');
          return;
        }

        const isSleepingOrTimeout = /Failed to fetch|503|504|timed out/i.test(errMsg);
        if (isSleepingOrTimeout && retryAttempts < maxRetries) {
          retryAttempts++;
          setCloudStatus({ connected: false, isSyncing: true, text: `Waking Database (Attempt ${retryAttempts}/${maxRetries})...`, error: errMsg });
          setTimeout(attemptFetch, 2500);
          return;
        }

        console.error('Supabase load error:', err);
        setCloudStatus({ connected: false, isSyncing: false, text: 'Showing data saved on this device', error: errMsg });
        addToast('Could not reach your database. Showing data saved on this device; changes will be sent when the connection is back.', 'warning');
      }
    };

    attemptFetch();
    return () => { isMounted = false; };
  }, [auth?.isSupabaseTenant, tenantClient]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ingestCloudData };
}
