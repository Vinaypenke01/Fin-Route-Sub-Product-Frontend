import { useEffect, useRef } from 'react';
import { pullAllFromCloud } from '../services/cloudService';
import { fetchTenantLedgerData } from '../services/tenantDatabaseService';
import { parseDate, formatDateDMY } from '../utils/formatters';
import { normalizeCustomers } from '../utils/customerNormalization';

const GOOGLE_SCRIPT_URL_KEY = 'SUNDAY_MONEY_TRACKER_GS_URL';

/**
 * Custom hook to manage sequential background syncing, tenant scoped localStorage persistence,
 * initial cloud and Supabase auto-pull, and browser tab unload protection.
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
  sheetUrl,
  setSheetUrl,
  envSheetUrl,
  cloudStatus,
  setCloudStatus,
  addToast,
  handleLogout,
  getTenantStorageKey
}) {
  const syncDebounceTimers = useRef({});
  const syncQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);

  // Sequential Background Queue Processor: ensures rapid-fire edits
  // are processed sequentially without concurrent lock collisions on Google Apps Script
  const processSyncQueue = async () => {
    if (isProcessingQueueRef.current) return;
    if (syncQueueRef.current.length === 0) return;

    isProcessingQueueRef.current = true;

    while (syncQueueRef.current.length > 0) {
      const remainingCount = syncQueueRef.current.length;
      setCloudStatus(prev => ({
        ...prev,
        isSyncing: true,
        text: remainingCount > 1 ? `Syncing (${remainingCount} left)...` : 'Syncing...'
      }));

      const task = syncQueueRef.current.shift();
      try {
        await task.execute();
      } catch (err) {
        console.error('Queue task error:', err);
      }
      // Brief pause between requests to respect rate limits
      await new Promise(r => setTimeout(r, 120));
    }

    isProcessingQueueRef.current = false;
    setCloudStatus(prev => ({ ...prev, isSyncing: false, text: 'Google Sheet', connected: true }));
  };

  const enqueueSyncTask = (taskKey, executeFn) => {
    const existingIdx = syncQueueRef.current.findIndex(t => t.key === taskKey);
    const taskObj = { key: taskKey, execute: executeFn };
    if (existingIdx !== -1) {
      syncQueueRef.current[existingIdx] = taskObj; // replace pending task with newer value
    } else {
      syncQueueRef.current.push(taskObj);
    }
    processSyncQueue();
  };

  // Browser Refresh / Tab Close Guard: Prevents losing pending queue tasks
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isProcessingQueueRef.current || syncQueueRef.current.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes syncing in the background. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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

  // Sync Sheet URL changes
  useEffect(() => {
    if (envSheetUrl && !auth?.sheetUrl && envSheetUrl !== sheetUrl) {
      setSheetUrl(envSheetUrl);
      localStorage.setItem(GOOGLE_SCRIPT_URL_KEY, envSheetUrl);
    }
  }, [envSheetUrl, auth?.sheetUrl, sheetUrl, setSheetUrl]);

  // Ingest cloud data
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

  // Auto-pull from cloud on initial authenticated load (Google Sheets flow)
  useEffect(() => {
    if (auth?.isSupabaseTenant) return; // Supabase tenants use direct PostgreSQL connection below
    const targetUrl = auth?.sheetUrl || sheetUrl;
    if (auth && targetUrl) {
      setCloudStatus(prev => ({ ...prev, isSyncing: true, text: 'Pulling...' }));
      pullAllFromCloud(auth, targetUrl)
        .then(res => {
          if (res && res.status === 'success' && res.data) {
            ingestCloudData(res.data);
            setCloudStatus({ connected: true, isSyncing: false, text: 'Google Sheet', error: null });
            addToast(`Synchronized ${res.data.customers?.length || 0} records from Sheet!`, 'success');
          } else if (res && res.status === 'unauthorized') {
            handleLogout();
          } else {
            setCloudStatus({ connected: false, isSyncing: false, text: 'Sync Error', error: res?.message });
          }
        })
        .catch(err => {
          setCloudStatus({ connected: false, isSyncing: false, text: 'Offline Mode', error: err.message });
        });
    }
  }, [auth, sheetUrl]);

  // Dedicated Supabase DB Auto-Pull (High-performance direct PostgreSQL query)
  useEffect(() => {
    if (auth?.isSupabaseTenant && tenantClient) {
      setCloudStatus({ connected: true, isSyncing: true, text: 'Supabase DB (Loading...)', error: null });
      fetchTenantLedgerData(tenantClient)
        .then(res => {
          if (res) {
            if (Array.isArray(res.customers)) setCustomers(normalizeCustomers(res.customers));
            if (Array.isArray(res.weeks) && res.weeks.length > 0) setWeeks(res.weeks);
            if (res.weeklyReconciliation) setWeeklyReconciliation(res.weeklyReconciliation);
            if (Array.isArray(res.archive)) setArchive(res.archive);
            setCloudStatus({ connected: true, isSyncing: false, text: 'Supabase DB (Private)', error: null });
            addToast(`Connected to private Supabase DB (${res.customers?.length || 0} records)!`, 'success');
          }
        })
        .catch(err => {
          console.error('Supabase load error:', err);
          setCloudStatus({ connected: false, isSyncing: false, text: 'Supabase Error', error: err.message });
          addToast(`Supabase connection error: ${err.message}`, 'error');
        });
    }
  }, [auth?.isSupabaseTenant, tenantClient]);

  const debounceSync = (key, fn, delay = 800) => {
    if (syncDebounceTimers.current[key]) clearTimeout(syncDebounceTimers.current[key]);
    syncDebounceTimers.current[key] = setTimeout(() => {
      delete syncDebounceTimers.current[key];
      fn();
    }, delay);
  };

  return {
    debounceSync,
    enqueueSyncTask,
    ingestCloudData
  };
}
