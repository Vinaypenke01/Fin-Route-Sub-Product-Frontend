import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import KpiDeck from './components/KpiDeck';
import Toolbar from './components/Toolbar';
import TrackerTable from './components/TrackerTable';
import AppModals from './components/AppModals';
import ToastContainer from './components/Toast';
import LoadingScreen, { TableSkeleton } from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import { getCustomerTotalPaid, getCustomerBalance, getCustomerStatus, parseDate, recalculateWeeksFromWeekOne } from './utils/formatters';
import { normalizeCustomers, getCustomerVillageName } from './utils/customerNormalization';
import { generatePdfReport } from './utils/generatePdfReport';
import { useTrackerSync } from './hooks/useTrackerSync';
import { exportTrackerToCSV } from './utils/exportCSV';
import { getSavedLanguage, setSavedLanguage } from './utils/translations';
import {
  getTenantClient,
  syncPaymentToTenantDb,
  syncCustomerFieldToTenantDb,
  updateTenantReconciliation,
  addTenantCustomer,
  deleteTenantCustomer,
  archiveAndRenewCustomerInTenantDb,
  archiveLoansInTenantDb,
  addTenantWeek,
  deleteTenantWeek,
  updateTenantRowOrder
} from './services/tenantDatabaseService';

// Lazy-loaded components for optimal initial bundle and performance
const LoginScreen = lazy(() => import('./components/LoginScreen'));
const ArchiveTable = lazy(() => import('./components/ArchiveTable'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const SuperAdminPanel = lazy(() => import('./components/SuperAdminPanel'));

import {
  SESSION_AUTH_KEY,
  LEGACY_SHEET_URL_KEY,
  getTenantStorageKey,
  getValidStoredSession
} from './services/sessionService';
import { useLedgerCalculations } from './hooks/useLedgerCalculations';

export default function App() {

  // Initial Session Hydration State (Prevents flash of login screen on reload)
  const [isHydratingSession, setIsHydratingSession] = useState(true);

  // PDF Export Generation State
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Authentication State with expiration validation
  const [auth, setAuth] = useState(() => getValidStoredSession());

  // Selected Localization Language ('en' | 'te') with localStorage persistence
  const [language, setLanguage] = useState(() => getSavedLanguage());
  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setSavedLanguage(newLang);
  };

  // Application View Mode: 'app' (authenticated ledger) | 'landing' (showcase) | 'login' (portal sign in) | 'admin' (super admin panel)
  const [viewMode, setViewMode] = useState(() => {
    const hash = window.location.hash;
    if (hash === '#admin') return 'admin';
    if (hash === '#login') return 'login';
    const session = getValidStoredSession();
    if (session) return 'app';
    return 'landing';
  });

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#admin') setViewMode('admin');
      else if (hash === '#login') setViewMode('login');
      else if (hash === '#landing') setViewMode('landing');
      else if (auth) setViewMode('app');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [auth]);

  // Dynamic Tenant Supabase Client (Acquires connection to tenant's dedicated DB)
  const tenantClient = useMemo(() => {
    const dbUrl = auth?.tenantDbUrl;
    const anonKey = auth?.tenantAnonKey;
    if (!dbUrl || !anonKey) return null;
    return getTenantClient(dbUrl, anonKey, { remember: Boolean(auth?.rememberMe) });
  }, [auth?.tenantDbUrl, auth?.tenantAnonKey, auth?.rememberMe]);

  // Toasts Notification System (Declared early for lifecycle use)
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  // Unexpected errors outside React rendering (e.g. a failed promise nobody
  // handled): tell the user calmly instead of failing silently.
  useEffect(() => {
    let lastShown = 0;
    const notify = (reason) => {
      console.error('Unhandled error:', reason);
      if (Date.now() - lastShown < 5000) return; // avoid a burst of identical toasts
      lastShown = Date.now();
      setToasts(prev => [...prev.slice(-3), {
        id: Date.now() + Math.random(),
        message: 'Something didn’t work. Your saved data is safe; please try that again.',
        type: 'error'
      }]);
    };
    const onRejection = (e) => notify(e.reason);
    const onError = (e) => notify(e.error || e.message);
    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
    };
  }, []);

  // Dynamic tenant-scoped data initialization
  const initialSession = getValidStoredSession();
  const initialTenantKey = getTenantStorageKey(initialSession?.email);

  // Application Data State (Tenant-isolated)
  const [weeks, setWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem(initialTenantKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.weeks) && parsed.weeks.length > 0) return parsed.weeks;
      }
    } catch { }
    return [];
  });

  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem(initialTenantKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.customers)) return normalizeCustomers(parsed.customers);
      }
    } catch { }
    return [];
  });

  const [weeklyReconciliation, setWeeklyReconciliation] = useState(() => {
    try {
      const saved = localStorage.getItem(initialTenantKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.weeklyReconciliation) return parsed.weeklyReconciliation;
      }
    } catch { }
    return {};
  });

  const [archive, setArchive] = useState(() => {
    try {
      const saved = localStorage.getItem(initialTenantKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.archive)) return parsed.archive;
      }
    } catch { }
    return [];
  });

  // Handle Logout (Multi-tenant clean state purge)
  const isLoggingOutRef = useRef(false);
  const handleLogout = () => {
    // End the operator's tenant DB session (clears its stored tokens locally)
    isLoggingOutRef.current = true;
    tenantClient?.auth.signOut({ scope: 'local' }).catch(() => {});
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    localStorage.removeItem(SESSION_AUTH_KEY);
    localStorage.removeItem(LEGACY_SHEET_URL_KEY);
    setAuth(null);
    setViewMode('landing');
    window.location.hash = '';
    setWeeks([]);
    setCustomers([]);
    setWeeklyReconciliation({});
    setArchive([]);
    addToast('Logged out successfully.', 'info');
  };

  useEffect(() => {
    // Graceful brief hydration check
    const timer = setTimeout(() => setIsHydratingSession(false), 200);
    return () => clearTimeout(timer);
  }, []);

  // Periodic Session Expiration Monitor (Runs every 30 seconds)
  useEffect(() => {
    if (!auth) return;
    const interval = setInterval(() => {
      if (auth.expiresAt && Date.now() > auth.expiresAt) {
        handleLogout();
        addToast('Your session has expired for security. Please sign in again.', 'warning');
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [auth]);

  // UI Navigation & Search State
  const [activeTab, setActiveTab] = useState('tracker');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Cloud Status & Indicator
  const [cloudStatus, setCloudStatus] = useState({
    connected: false,
    isSyncing: false,
    text: 'Local Mode',
    error: null
  });

  // Modals state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddVillageOpen, setIsAddVillageOpen] = useState(false);
  const [isAddWeekOpen, setIsAddWeekOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewTargetCustomer, setRenewTargetCustomer] = useState(null);
  const [villageContext, setVillageContext] = useState(null);
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState(null);
  const [isDeleteCustomerOpen, setIsDeleteCustomerOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', type: 'warning', onConfirm: null });

  // Background Sync, Persistence, Auto-pull, and Unload Protection via custom hook
  const { debounceSync, enqueueSyncTask } = useTrackerSync({
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
    cloudStatus,
    setCloudStatus,
    addToast,
    handleLogout,
    getTenantStorageKey
  });

  // Tenant sign-in guard: when the tenant DB requires a signed-in operator,
  // a missing or ended session means sign in again (never fall back to the
  // public key, which the locked-down database rejects).
  useEffect(() => {
    if (!auth?.isSupabaseTenant || !auth?.tenantAuthRequired || !tenantClient) return;
    let cancelled = false;
    isLoggingOutRef.current = false;
    tenantClient.auth.getSession().then(({ data }) => {
      if (!cancelled && !data?.session && !isLoggingOutRef.current) {
        handleLogout();
        addToast('Please sign in again to open your private ledger.', 'warning');
      }
    });
    const { data: sub } = tenantClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && !cancelled && !isLoggingOutRef.current) {
        handleLogout();
        addToast('Your secure session ended. Please sign in again.', 'warning');
      }
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [auth?.isSupabaseTenant, auth?.tenantAuthRequired, tenantClient]);

  // Real-time Tenant DB Connection Health Monitor (Every 30 seconds)
  useEffect(() => {
    if (!auth?.isSupabaseTenant || !tenantClient) return;
    const interval = setInterval(async () => {
      try {
        const { error } = await tenantClient.from('customers').select('id').limit(1);
        if (!error) {
          setCloudStatus(prev => ({ ...prev, connected: true, error: null }));
        } else {
          setCloudStatus(prev => ({ ...prev, connected: false, error: error.message }));
        }
      } catch (e) {
        setCloudStatus(prev => ({ ...prev, connected: false, error: e.message }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [auth?.isSupabaseTenant, tenantClient]);


  // Handle Login with Session Expiration & Tenant Isolation
  const handleLoginSuccess = async ({
    email,
    clientName,
    businessName,
    tenantDbUrl,
    tenantAnonKey,
    tenantSession,
    tenantAuthRequired,
    expiry,
    rememberMe
  }) => {
    const sessionDuration = rememberMe ? (7 * 24 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000);

    // Install the tenant DB session BEFORE the ledger loads, so every query
    // runs as the signed-in operator.
    if (tenantDbUrl && tenantAnonKey) {
      const client = getTenantClient(tenantDbUrl, tenantAnonKey, { remember: !!rememberMe });
      if (tenantSession?.access_token && tenantSession?.refresh_token) {
        const { error } = await client.auth.setSession({
          access_token: tenantSession.access_token,
          refresh_token: tenantSession.refresh_token,
        });
        if (error && tenantAuthRequired) {
          addToast(`Could not open your private database session: ${error.message}`, 'error');
          return;
        }
      } else {
        // Legacy public-key mode: drop any stale session left by another operator
        await client.auth.signOut({ scope: 'local' }).catch(() => {});
      }
      import('./services/masterAuthService')
        .then(m => m.recordTenantLoginAudit(client, { email, clientName, businessName }))
        .catch(() => {});
    }

    // No password is ever stored: the tenant DB session is kept by supabase-js.
    const sessionObj = {
      email,
      clientName: clientName || 'Valued Partner',
      businessName: businessName || 'FinRoute Collect',
      tenantDbUrl: tenantDbUrl || null,
      tenantAnonKey: tenantAnonKey || null,
      tenantAuthRequired: Boolean(tenantAuthRequired),
      isSupabaseTenant: true,
      expiry: expiry || null,
      loginTimestamp: Date.now(),
      expiresAt: Date.now() + sessionDuration,
      rememberMe: !!rememberMe
    };

    if (rememberMe) {
      localStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(sessionObj));
      sessionStorage.removeItem(SESSION_AUTH_KEY);
    } else {
      sessionStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(sessionObj));
      localStorage.removeItem(SESSION_AUTH_KEY);
    }
    setAuth(sessionObj);
    setViewMode('app');
    window.location.hash = '#tracker';

    // Hydrate immediately from tenant's scoped local cache if exists
    try {
      const cached = localStorage.getItem(getTenantStorageKey(email));
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.customers)) setCustomers(normalizeCustomers(parsed.customers));
        if (Array.isArray(parsed.weeks) && parsed.weeks.length > 0) setWeeks(parsed.weeks);
        if (parsed.weeklyReconciliation) setWeeklyReconciliation(parsed.weeklyReconciliation);
        if (Array.isArray(parsed.archive)) setArchive(parsed.archive);
      } else {
        setCustomers([]);
        setWeeks([]);
        setWeeklyReconciliation({});
        setArchive([]);
      }
    } catch { /* ignore corrupt cache */ }

    addToast(`Welcome back, ${clientName || email}!`, 'success');
  };


  // Financial Calculations & Filtered Customer List
  const {
    totalCapitalDisbursed,
    totalDisbursed,
    totalCollected,
    totalBalance,
    activeCount,
    paidOffCount,
    reconciliationComputed,
    filteredCustomers
  } = useLedgerCalculations({
    customers,
    weeks,
    weeklyReconciliation,
    archive,
    searchQuery,
    statusFilter
  });

  // Customer Field Update & Autosave by _rowId (Prevents any customer overwriting)
  const handleUpdateCustomerField = (rowId, field, value) => {
    const prevCust = customers.find(c => c._rowId === rowId || c.id === rowId);
    if (!prevCust) {
      console.warn('Customer not found for rowId:', rowId);
      return;
    }

    const custIdToFind = prevCust.id;

    const updatedCustomer = {
      ...prevCust,
      [field]: value,
      ...(prevCust.isVillageDivider && (field === 'name' || field === 'villageName') ? { villageName: value, name: value } : {})
    };

    setCustomers(prev => prev.map(c => (c._rowId === rowId || c.id === rowId) ? updatedCustomer : c));

    const fieldLabels = {
      disbursedDate: 'Issue Date',
      name: prevCust.isVillageDivider ? 'Village Name' : 'Customer Name',
      villageName: 'Village Name',
      disbursed: 'Payable Amount',
      originalAmount: 'Original Amount',
      id: 'Customer ID',
      phone: 'Phone Number'
    };
    const label = fieldLabels[field] || field;

    if (!tenantClient) {
      addToast(`Saved ${label} locally (Offline mode)`, 'info');
      return;
    }

    const key = `field-${rowId}-${field}`;
    debounceSync(key, () => {
      enqueueSyncTask(key, async () => {
        if (tenantClient) {
          try {
            await syncCustomerFieldToTenantDb(tenantClient, custIdToFind, field, value, Boolean(prevCust.isVillageDivider));
            addToast(`Saved ${label} to Supabase!`, 'success');
          } catch (err) {
            console.error('Supabase customer update error:', err);
            addToast(`Supabase save error: ${err.message}`, 'error');
          }
          return;
        }
      });
    }, 300);
  };

  // Payment Update & Autosave by _rowId (Prevents any customer overwriting)
  const handleUpdatePayment = (rowId, weekId, amount) => {
    const prevCust = customers.find(c => c._rowId === rowId || c.id === rowId);
    if (!prevCust) return;

    const custId = prevCust.id;
    const weekObj = weeks.find(w => w.id === weekId);
    const weekLabel = weekObj?.label || weekId;

    const updatedCustomer = {
      ...prevCust,
      payments: {
        ...(prevCust.payments || {}),
        [weekId]: amount
      }
    };

    setCustomers(prev => prev.map(c => (c._rowId === rowId || c.id === rowId) ? updatedCustomer : c));

    const key = `payment-${rowId}-${weekId}`;
    debounceSync(key, () => {
      enqueueSyncTask(key, async () => {
        if (tenantClient) {
          try {
            await syncPaymentToTenantDb(tenantClient, custId, weekId, amount);
            addToast(`Saved Payment ₹${amount} (${weekLabel}) to Supabase!`, 'success');
          } catch (err) {
            addToast(`Supabase Payment Error: ${err.message}`, 'error');
          }
          return;
        }
      });
    }, 250);
  };

  // Reconciliation Update & Autosave (Includes Salaries deduction)
  const handleUpdateRecon = (weekId, prevCash, expenses, amountGiven, salaries) => {
    const updated = {
      ...weeklyReconciliation,
      [weekId]: {
        prevCash: prevCash !== undefined ? prevCash : (weeklyReconciliation[weekId]?.prevCash ?? null),
        expenses: expenses !== undefined ? expenses : (weeklyReconciliation[weekId]?.expenses ?? 0),
        amountGiven: amountGiven !== undefined ? amountGiven : (weeklyReconciliation[weekId]?.amountGiven ?? 0),
        salaries: salaries !== undefined ? salaries : (weeklyReconciliation[weekId]?.salaries ?? 0)
      }
    };
    setWeeklyReconciliation(updated);

    const weekObj = weeks.find(w => w.id === weekId);
    const weekLabel = weekObj?.label || weekId;

    const key = `recon-${weekId}`;
    debounceSync(key, () => {
      enqueueSyncTask(key, async () => {
        const r = updated[weekId];
        if (tenantClient) {
          try {
            await updateTenantReconciliation(tenantClient, weekId, {
              prevCash: r.prevCash,
              expenses: r.expenses,
              amountGiven: r.amountGiven,
              salaries: r.salaries,
              notes: r.notes
            });
            addToast(`Saved Reconciliation for ${weekLabel} to Supabase!`, 'success');
          } catch (err) {
            addToast(`Supabase recon error: ${err.message}`, 'error');
          }
          return;
        }
      });
    }, 450);
  };

  // Delete Customer by _rowId (with Reason & Automatic Archive Preservation)
  const handleDeleteCustomer = (rowId, custName) => {
    const targetCust = customers.find(c => c._rowId === rowId);
    if (!targetCust) return;

    if (targetCust.isVillageDivider) {
      // Village Divider: Simple confirm dialog
      setConfirmDialog({
        isOpen: true,
        title: 'Delete Village Divider',
        message: `Are you sure you want to delete the divider "${custName}"?`,
        type: 'danger',
        onConfirm: () => {
          setCustomers(prev => prev.filter(c => c._rowId !== rowId));
          setConfirmDialog({ isOpen: false });
          if (tenantClient) {
            deleteTenantCustomer(tenantClient, targetCust.id);
            addToast(`Deleted village divider "${custName}" from Supabase.`, 'info');
            return;
          }
          addToast(`Deleted village divider "${custName}".`, 'info');
        }
      });
      return;
    }

    // Customer: Open dedicated Reason & Archive Deletion Modal
    setDeleteTargetCustomer(targetCust);
    setIsDeleteCustomerOpen(true);
  };

  // Confirm Customer Deletion with Reason (Saves to Loan Archive & Removes from Active Tracker)
  const handleConfirmDeleteCustomer = (rowId, reason) => {
    const targetCust = customers.find(c => c._rowId === rowId);
    if (!targetCust) return;

    const vName = getCustomerVillageName(customers, rowId);
    const today = new Date().toLocaleDateString('en-GB');
    const totalPaid = getCustomerTotalPaid(targetCust);
    const balance = getCustomerBalance(targetCust);

    const archiveRecord = {
      id: `ARC-DEL-${Date.now()}-${targetCust.id}`,
      originalId: targetCust.id,
      name: targetCust.name,
      villageName: vName,
      villageId: targetCust.villageId || targetCust.village_id || null,
      disbursed: targetCust.disbursed,
      originalAmount: targetCust.originalAmount || targetCust.disbursed,
      totalRepaid: totalPaid,
      finalBalance: balance,
      status: 'Deleted',
      reason: reason || 'Customer deleted by user',
      dateArchived: today,
      payments: { ...(targetCust.payments || {}) }
    };

    // 1. Add to local archive immediately
    setArchive(prev => [archiveRecord, ...prev]);

    // 2. Remove from active tracker
    setCustomers(prev => prev.filter(c => c._rowId !== rowId));
    setIsDeleteCustomerOpen(false);
    setDeleteTargetCustomer(null);

    addToast(`Deleted "${targetCust.name}" and saved to Loan History Archive!`, 'info');

    // 3. Sync deletion and archive entry
    if (tenantClient) {
      deleteTenantCustomer(tenantClient, targetCust.id, archiveRecord)
        .then(() => addToast(`Stored "${targetCust.name}" in Supabase Archive!`, 'success'))
        .catch(err => addToast(`Supabase delete error: ${err.message}`, 'error'));
    }
  };

  // Permanently Delete Record from Loan History Archive
  const handleDeleteArchived = (archiveId, name) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Permanently Delete Archive Record',
      message: `Are you sure you want to permanently delete the archive record for "${name}"?\nThis cannot be undone.`,
      type: 'danger',
      onConfirm: () => {
        setArchive(prev => prev.filter(a => a.id !== archiveId && a.originalId !== archiveId));
        setConfirmDialog({ isOpen: false });
        addToast(`Permanently deleted archive record for "${name}".`, 'info');

        if (tenantClient) {
          tenantClient.from('loan_archive').delete().or(`id.eq.${archiveId},original_customer_id.eq.${archiveId}`)
            .then(() => addToast(`Removed "${name}" from Supabase Archive!`, 'success'))
            .catch(err => addToast(`Supabase archive delete error: ${err.message}`, 'error'));
        }
      }
    });
  };

  // Add Customer or Divider (Supports inserting directly under a village with Cloud Sync)
  const handleAddCustomer = (newCust, insertUnderVillageRowId = null) => {
    const custWithUid = {
      ...newCust,
      startWeekId: newCust.startWeekId || weeks[0]?.id || 'week_1',
      _rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    };

    if (newCust.insertAtBeginning) {
      setCustomers(prev => [custWithUid, ...prev]);
    } else if (insertUnderVillageRowId) {
      setCustomers(prev => {
        const vIdx = prev.findIndex(item => item._rowId === insertUnderVillageRowId);
        if (vIdx === -1) return [...prev, custWithUid];
        let insertIdx = vIdx + 1;
        while (insertIdx < prev.length && !prev[insertIdx].isVillageDivider) {
          insertIdx++;
        }
        const next = [...prev];
        next.splice(insertIdx, 0, custWithUid);
        return next;
      });
    } else {
      setCustomers(prev => [...prev, custWithUid]);
    }
    setVillageContext(null);

    // Synchronize newly added record to Database / Cloud
    if (tenantClient) {
      const resolvedVName = newCust.villageName || getCustomerVillageName(customers, insertUnderVillageRowId || custWithUid._rowId) || '';
      const matchingDivider = customers.find(c => c.isVillageDivider && (c._rowId === insertUnderVillageRowId || c.villageName === resolvedVName || c.name === resolvedVName));
      const resolvedVId = newCust.villageId || matchingDivider?.villageId || matchingDivider?.id || null;

      addTenantCustomer(tenantClient, {
        id: newCust.id,
        name: newCust.name,
        phone: newCust.phone,
        disbursed: newCust.disbursed,
        originalAmount: newCust.originalAmount,
        disbursedDate: newCust.disbursedDate,
        startWeekId: custWithUid.startWeekId,
        isVillageDivider: newCust.isVillageDivider,
        villageName: resolvedVName,
        villageId: resolvedVId,
        rowOrder: customers.length + 1
      })
        .then(() => addToast(`Added "${newCust.name}" to Supabase!`, 'success'))
        .catch(err => addToast(`Supabase add error: ${err.message}`, 'error'));
      return;
    }

    addToast(`Added "${newCust.name}" locally (Offline mode)`, 'info');
  };

  // Move Row (reorder customer / village with Cloud Sync)
  const handleMoveRow = (rowId, direction) => {
    setCustomers(prev => {
      const idx = prev.findIndex(item => item._rowId === rowId);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;

      // Debounce sync row order to Database / Cloud
      const key = 'sync-row-order';
      debounceSync(key, () => {
        const orderedIds = next.map(c => c.id || c.name);
        if (tenantClient) {
          updateTenantRowOrder(tenantClient, orderedIds);
        }
      }, 500);

      return next;
    });
  };

  // Open Add Customer Under Village
  const handleOpenAddCustomerUnderVillage = (villageRowId, villageName) => {
    setVillageContext({ rowId: villageRowId, name: villageName });
    setIsAddCustomerOpen(true);
  };

  // Open Single Customer Renew Modal
  const handleOpenRenewCustomer = (cust) => {
    setRenewTargetCustomer(cust);
    setIsRenewModalOpen(true);
  };

  // Renew Customer: Archives current loan cycle and starts new one with Cloud Sync
  const handleRenewCustomer = (rowId, newAmount, newDate, renewWeekId) => {
    const cust = customers.find(c => c._rowId === rowId);
    if (!cust) return;

    const today = new Date().toLocaleDateString('en-GB');
    const targetWeekId = renewWeekId || weeks[weeks.length - 1]?.id || 'week_1';

    const archiveRecord = {
      id: `ARC-${Date.now()}-${cust.id}`,
      originalId: cust.id,
      name: cust.name,
      phone: cust.phone || '',
      villageName: cust.villageName || getCustomerVillageName(customers, cust._rowId || cust.id) || '',
      villageId: cust.villageId || cust.village_id || null,
      disbursed: cust.disbursed,
      originalAmount: cust.originalAmount || cust.disbursed,
      totalRepaid: getCustomerTotalPaid(cust),
      finalBalance: getCustomerBalance(cust),
      status: getCustomerStatus(cust),
      disbursedDate: cust.disbursedDate || '',
      dateArchived: today,
      reason: 'Loan Renewed',
      payments: { ...(cust.payments || {}) }
    };

    setArchive(prev => [archiveRecord, ...prev]);

    // Preserve past cycle payments to display them striked-off on earlier weeks
    const matchingArchive = archive.find(a => (
      (a.originalId && a.originalId === cust.id) ||
      (a.id && (a.id === cust.id || a.id.includes(cust.id))) ||
      (a.name && cust.name && a.name.trim().toLowerCase() === cust.name.trim().toLowerCase())
    ));

    const previousPayments = {
      ...(matchingArchive?.payments || {}),
      ...(cust.pastCyclePayments || {}),
      ...(cust.payments || {})
    };

    setCustomers(prev => prev.map(c => {
      if (c._rowId !== rowId) return c;
      return {
        ...c,
        disbursed: newAmount,
        originalAmount: newAmount,
        disbursedDate: newDate || today,
        renewedAtWeek: targetWeekId,
        pastCyclePayments: previousPayments,
        payments: {}
      };
    }));

    addToast(`Archived past loan for ${cust.name} & renewed with ₹${newAmount.toLocaleString('en-IN')}`, 'success');

    // Synchronize renewal to Database / Cloud
    if (tenantClient) {
      archiveAndRenewCustomerInTenantDb(tenantClient, cust.id, {
        newAmount: newAmount,
        newDate: newDate || today,
        renewedAtWeek: targetWeekId,
        pastCyclePayments: previousPayments,
        archiveRecord: archiveRecord
      })
        .then(() => addToast(`Renewed loan in Supabase for "${cust.name}"!`, 'success'))
        .catch(err => addToast(`Supabase renew error: ${err.message}`, 'error'));
      return;
    }

    addToast(`Renewed loan for "${cust.name}" locally (Offline mode)`, 'info');
  };

  // Restore Archived Customer back to active tracker
  const handleRestoreArchived = (archiveId) => {
    const item = archive.find(a => (a.id === archiveId || a.originalId === archiveId));
    if (!item) return;

    setArchive(prev => prev.filter(a => (a.id !== archiveId && a.originalId !== archiveId)));
    const restoredCust = {
      id: item.originalId || item.id,
      _rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: item.name,
      disbursed: item.disbursed,
      originalAmount: item.disbursed,
      phone: item.phone || '',
      disbursedDate: item.disbursedDate || '',
      payments: item.payments || {}
    };

    setCustomers(prev => [...prev, restoredCust]);
    addToast(`Restored "${item.name}" back to Active Tracker`, 'success');
  };

  // Update Week 1 Date and cascade +7 days to all subsequent weeks
  const handleUpdateWeekOneDate = (newDateStr) => {
    const parsed = parseDate(newDateStr);
    if (!parsed) {
      addToast('Invalid date format. Use DD/MM/YYYY or DD-MM-YYYY.', 'warning');
      return;
    }

    const updatedWeeks = recalculateWeeksFromWeekOne(weeks, newDateStr);
    setWeeks(updatedWeeks);

    // Instantly synchronize updated week dates to Supabase or Google Sheet
    if (tenantClient) {
      const weekRows = updatedWeeks.map((w, idx) => {
        let formattedDate = new Date().toISOString().split('T')[0];
        if (w.date) {
          const parts = String(w.date).split(/[-/]/);
          if (parts.length === 3) {
            formattedDate = parts[0].length === 4 ? `${parts[0]}-${parts[1]}-${parts[2]}` : `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }
        return {
          id: w.id,
          col_index: Number(w.col_index || w.colIndex || idx + 1),
          label: w.label || `Week ${idx + 1}`,
          week_date: formattedDate
        };
      });
      tenantClient.from('weeks').upsert(weekRows, { onConflict: 'id' })
        .then(() => addToast(`Week 1 updated to ${newDateStr}. All week dates updated in Supabase!`, 'success'))
        .catch(err => addToast(`Supabase week update error: ${err.message}`, 'error'));
      return;
    }

    addToast(`Week 1 updated to ${newDateStr} locally (Offline mode)`, 'info');
  };

  // Add Week Column with Cloud Sync
  const handleAddWeek = (newWeek) => {
    setWeeks(prev => [...prev, newWeek]);

    if (tenantClient) {
      addTenantWeek(tenantClient, {
        id: newWeek.id,
        label: newWeek.label,
        date: newWeek.date,
        colIndex: newWeek.colIndex || weeks.length + 1
      })
        .then(() => addToast(`Added column "${newWeek.label}" to Supabase!`, 'success'))
        .catch(err => addToast(`Supabase week add error: ${err.message}`, 'error'));
      return;
    }

    addToast(`Added column "${newWeek.label}" locally (Offline mode)`, 'info');
  };

  // Delete Latest Week with Cloud Sync
  const handleOpenDeleteWeek = () => {
    if (weeks.length <= 1) {
      addToast('Cannot delete the last remaining week column.', 'warning');
      return;
    }
    const latestWeek = weeks[weeks.length - 1];
    setConfirmDialog({
      isOpen: true,
      title: `Delete Column: ${latestWeek.label}`,
      message: `Are you sure you want to remove "${latestWeek.label} (${latestWeek.date})"?\nAll payments entered in this column will be removed.`,
      type: 'danger',
      onConfirm: () => {
        setWeeks(prev => prev.slice(0, -1));
        setConfirmDialog({ isOpen: false });

        if (tenantClient) {
          deleteTenantWeek(tenantClient, latestWeek.id)
            .then(() => addToast(`Deleted column "${latestWeek.label}" from Supabase!`, 'success'))
            .catch(err => addToast(`Supabase delete week error: ${err.message}`, 'error'));
          return;
        }

        addToast(`Removed column: ${latestWeek.label} locally (Offline mode)`, 'info');
      }
    });
  };

  // Archive & Renew Loans with Cloud Sync
  const handleArchive = (paidOnly) => {
    const today = new Date().toLocaleDateString('en-GB');
    const toArchive = [];
    const remaining = [];

    customers.forEach(c => {
      if (c.isVillageDivider) {
        remaining.push(c);
        return;
      }
      const balance = getCustomerBalance(c);
      const isPaid = balance <= 0;

      if (paidOnly ? isPaid : true) {
        toArchive.push({
          id: `ARC-${Date.now()}-${c.id}`,
          originalId: c.id,
          name: c.name,
          phone: c.phone || '',
          villageName: c.villageName || getCustomerVillageName(customers, c._rowId || c.id) || '',
          villageId: c.villageId || c.village_id || null,
          disbursed: c.disbursed,
          originalAmount: c.originalAmount || c.disbursed,
          totalPaid: getCustomerTotalPaid(c),
          balance: balance,
          status: isPaid ? 'Paid Off' : 'Active',
          reason: isPaid ? 'Loan Completed / Paid Off' : 'Batch Archived',
          dateArchived: today,
          payments: { ...(c.payments || {}) }
        });
      } else {
        remaining.push(c);
      }
    });

    if (toArchive.length === 0) {
      addToast('No eligible customers found to archive.', 'warning');
      return;
    }

    setArchive(prev => [...toArchive, ...prev]);

    const activeWeekId = weeks[weeks.length - 1]?.id || 'week_1';
    // Keep archived customers visible on tracker with strikethrough past payments
    setCustomers(prev => prev.map(c => {
      if (c.isVillageDivider) return c;
      const balance = getCustomerBalance(c);
      const isPaid = balance <= 0;
      if (paidOnly ? isPaid : true) {
        return {
          ...c,
          isArchived: true,
          archivedAtWeek: activeWeekId,
          archivedDate: today
        };
      }
      return c;
    }));

    // Synchronize batch archive to Supabase or Google Sheet
    if (tenantClient) {
      archiveLoansInTenantDb(tenantClient, toArchive)
        .then(() => addToast(`Archived ${toArchive.length} loans in Supabase!`, 'success'))
        .catch(err => addToast(`Supabase archive error: ${err.message}`, 'error'));
      return;
    }

    addToast(`Archived ${toArchive.length} customers locally (Offline mode)`, 'info');
  };

  // Download PDF Report in Horizontal Landscape Format (Full Account Details, Logo & Cash Reconciliation)
  const handleDownloadPDF = () => {
    generatePdfReport({
      weeks,
      customers,
      weeklyReconciliation,
      reconciliationComputed,
      setIsGeneratingPDF,
      addToast
    });
  };

  // Export complete tracker records and financial reconciliation to CSV (Excel compatible with full Telugu support)
  const handleExportCSV = () => {
    try {
      const res = exportTrackerToCSV({
        weeks,
        customers: filteredCustomers.length > 0 && searchQuery ? filteredCustomers : customers,
        weeklyReconciliation,
        reconciliationComputed,
        clientName: auth?.businessName || auth?.clientName || 'FinRoute'
      });
      if (res?.success) {
        addToast(`Exported ${res.fileName} with Telugu records & reconciliation!`, 'success');
      }
    } catch (err) {
      console.error('CSV Export error:', err);
      addToast(`CSV export failed: ${err.message}`, 'error');
    }
  };

  // If hydrating session from storage, display smooth brand loading screen
  if (isHydratingSession) {
    return <LoadingScreen message="Verifying secure session..." />;
  }

  // Super Admin Portal View
  if (viewMode === 'admin') {
    return (
      <Suspense fallback={<LoadingScreen message="Loading Super-Admin Portal..." />}>
        <SuperAdminPanel
          onBackToApp={() => {
            const dest = auth ? 'app' : 'landing';
            setViewMode(dest);
            window.location.hash = auth ? '#tracker' : '';
          }}
        />
      </Suspense>
    );
  }

  // If not authenticated, render Landing Page or Login Screen
  if (!auth) {
    if (viewMode === 'login') {
      return (
        <Suspense fallback={<LoadingScreen message="Loading secure sign-in..." />}>
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            onBackToLanding={() => {
              setViewMode('landing');
              window.location.hash = '';
            }}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LoadingScreen message="Loading FinRoute Collect..." />}>
        <LandingPage
          onOpenLogin={() => {
            setViewMode('login');
            window.location.hash = '#login';
          }}
          onOpenAdmin={() => {
            setViewMode('admin');
            window.location.hash = '#admin';
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* 1. Header with Brand & Actions */}
      <Header
        cloudStatus={cloudStatus}
        onOpenAddCustomer={() => {
          setVillageContext(null);
          setIsAddCustomerOpen(true);
        }}
        onOpenAddVillage={() => {
          setIsAddVillageOpen(true);
        }}
        onOpenAddWeek={() => setIsAddWeekOpen(true)}
        onOpenDeleteWeek={handleOpenDeleteWeek}
        onOpenArchive={() => setIsArchiveOpen(true)}
        onDownloadPDF={handleDownloadPDF}
        isGeneratingPDF={isGeneratingPDF}
        onExportCSV={handleExportCSV}
        onLogout={handleLogout}
        clientName={auth?.clientName}
        isSupabaseTenant={Boolean(auth?.isSupabaseTenant)}
        language={language}
        onLanguageChange={handleLanguageChange}
      />

      {/* 2. Key Performance Indicators Deck */}
      <KpiDeck
        totalCapitalDisbursed={totalCapitalDisbursed}
        totalDisbursed={totalDisbursed}
        totalCollected={totalCollected}
        totalBalance={totalBalance}
        netCash={reconciliationComputed.rollingCash}
        language={language}
      />

      {/* 3. Toolbar with Tabs, Search & Status Filter */}
      <Toolbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeCount={activeCount}
        archiveCount={archive.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        language={language}
      />

      {/* 4. Tab Views (a crash here keeps the header and saved data usable) */}
      <ErrorBoundary variant="section" key={activeTab}>
        {activeTab === 'tracker' ? (
          <TrackerTable
            weeks={weeks}
            customers={filteredCustomers}
            weeklyReconciliation={weeklyReconciliation}
            reconciliationComputed={reconciliationComputed}
            archive={archive}
            onUpdateCustomerField={handleUpdateCustomerField}
            onUpdatePayment={handleUpdatePayment}
            onUpdateRecon={handleUpdateRecon}
            onDeleteCustomer={handleDeleteCustomer}
            onOpenRenewCustomer={handleOpenRenewCustomer}
            onOpenAddCustomerUnderVillage={handleOpenAddCustomerUnderVillage}
            onMoveRow={handleMoveRow}
            onUpdateWeekOneDate={handleUpdateWeekOneDate}
            language={language}
          />
        ) : (
          <Suspense fallback={<TableSkeleton />}>
            <ArchiveTable
              archive={archive}
              onRestore={handleRestoreArchived}
              onDeleteArchived={handleDeleteArchived}
            />
          </Suspense>
        )}
      </ErrorBoundary>

      {/* 5. Modals & Dialogs */}
      <AppModals
        isAddCustomerOpen={isAddCustomerOpen}
        setIsAddCustomerOpen={setIsAddCustomerOpen}
        isAddVillageOpen={isAddVillageOpen}
        setIsAddVillageOpen={setIsAddVillageOpen}
        villageContext={villageContext}
        setVillageContext={setVillageContext}
        handleAddCustomer={handleAddCustomer}
        weeks={weeks}
        isRenewModalOpen={isRenewModalOpen}
        setIsRenewModalOpen={setIsRenewModalOpen}
        renewTargetCustomer={renewTargetCustomer}
        handleRenewCustomer={handleRenewCustomer}
        isAddWeekOpen={isAddWeekOpen}
        setIsAddWeekOpen={setIsAddWeekOpen}
        handleAddWeek={handleAddWeek}
        isArchiveOpen={isArchiveOpen}
        setIsArchiveOpen={setIsArchiveOpen}
        handleArchive={handleArchive}
        activeCount={activeCount}
        paidOffCount={paidOffCount}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        isDeleteCustomerOpen={isDeleteCustomerOpen}
        setIsDeleteCustomerOpen={setIsDeleteCustomerOpen}
        deleteTargetCustomer={deleteTargetCustomer}
        setDeleteTargetCustomer={setDeleteTargetCustomer}
        customers={customers}
        handleConfirmDeleteCustomer={handleConfirmDeleteCustomer}
      />

      {/* 6. FinRoute Sub-Product Footer */}
      <Footer />

      {/* 7. Floating Toasts */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
