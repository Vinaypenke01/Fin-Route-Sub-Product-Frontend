import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import KpiDeck from './components/KpiDeck';
import Toolbar from './components/Toolbar';
import TrackerTable from './components/TrackerTable';
import AppModals from './components/AppModals';
import ToastContainer from './components/Toast';
import LoadingScreen, { TableSkeleton } from './components/LoadingScreen';
import { initialData } from './initialData';
import { getCustomerTotalPaid, getCustomerBalance, getCustomerStatus, parseDate, recalculateWeeksFromWeekOne } from './utils/formatters';
import { normalizeCustomers, getCustomerVillageName } from './utils/customerNormalization';
import { generatePdfReport } from './utils/generatePdfReport';
import { useTrackerSync } from './hooks/useTrackerSync';
import { exportTrackerToCSV } from './utils/exportCSV';
import { getSavedLanguage, setSavedLanguage } from './utils/translations';
import {
  pullAllFromCloud,
  pushAllToCloud,
  syncPaymentToCloud,
  syncCustomerFieldToCloud,
  syncReconToCloud,
  syncWeeksToCloud,
  deleteCustomerFromCloud,
  deleteArchivedRecordFromCloud,
  addCustomerToCloud,
  syncRowOrderToCloud,
  archiveAndRenewCustomerInCloud,
  archiveLoansInCloud,
  addWeekToCloud,
  deleteWeekFromCloud
} from './services/cloudService';
import {
  getTenantClient,
  syncPaymentToTenantDb,
  syncCustomerFieldToTenantDb,
  updateTenantReconciliation,
  addTenantCustomer,
  deleteTenantCustomer,
  archiveAndRenewCustomerInTenantDb,
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
  GOOGLE_SCRIPT_URL_KEY,
  getTenantStorageKey,
  getValidStoredSession
} from './services/sessionService';
import { useLedgerCalculations } from './hooks/useLedgerCalculations';

export default function App() {
  // Read environment variables directly through Vite (No secrets exposed in client bundle)
  const envSheetUrl = (import.meta.env.VITE_GOOGLE_SHEET_URL || '').trim();
  const defaultEmail = '';

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
    return getTenantClient(dbUrl, anonKey);
  }, [auth?.tenantDbUrl, auth?.tenantAnonKey]);

  // Toasts Notification System (Declared early for lifecycle use)
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-3), { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3200);
  };

  // Google Sheet Web App URL (dynamically retrieved from tenant session)
  const [sheetUrl, setSheetUrl] = useState(() => {
    const session = getValidStoredSession();
    return session?.sheetUrl || envSheetUrl || localStorage.getItem(GOOGLE_SCRIPT_URL_KEY) || '';
  });

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
    return initialSession?.email ? [] : (initialData.weeks || []);
  });

  const [customers, setCustomers] = useState(() => {
    try {
      const saved = localStorage.getItem(initialTenantKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.customers)) return normalizeCustomers(parsed.customers);
      }
    } catch { }
    return initialSession?.email ? [] : normalizeCustomers(initialData.customers || []);
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
  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
    localStorage.removeItem(SESSION_AUTH_KEY);
    localStorage.removeItem(GOOGLE_SCRIPT_URL_KEY);
    setAuth(null);
    setViewMode('landing');
    window.location.hash = '';
    setSheetUrl('');
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
    connected: !!sheetUrl,
    isSyncing: false,
    text: sheetUrl ? 'Google Sheet' : 'Local Mode',
    error: null
  });

  // Modals state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddWeekOpen, setIsAddWeekOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewTargetCustomer, setRenewTargetCustomer] = useState(null);
  const [villageContext, setVillageContext] = useState(null);
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState(null);
  const [isDeleteCustomerOpen, setIsDeleteCustomerOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', type: 'warning', onConfirm: null });

  // Background Sync, Persistence, Auto-pull, and Unload Protection via custom hook
  const { debounceSync, enqueueSyncTask, ingestCloudData } = useTrackerSync({
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
  });

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

  // Import Modal State
  const [isImportSheetOpen, setIsImportSheetOpen] = useState(false);

  // Handle Login with Session Expiration & Tenant Isolation
  const handleLoginSuccess = ({
    email,
    password,
    clientName,
    businessName,
    sheetUrl: userSheetUrl,
    tenantDbUrl,
    tenantAnonKey,
    isSupabaseTenant,
    expiry,
    rememberMe,
    cloudData,
    needsCloudPull
  }) => {
    const sessionDuration = rememberMe ? (7 * 24 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000);
    const resolvedSheetUrl = userSheetUrl || sheetUrl;
    const sessionObj = {
      email,
      password,
      clientName: clientName || 'Valued Partner',
      businessName: businessName || 'FinRoute Collect',
      sheetUrl: resolvedSheetUrl,
      tenantDbUrl: tenantDbUrl || null,
      tenantAnonKey: tenantAnonKey || null,
      isSupabaseTenant: Boolean(isSupabaseTenant),
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

    if (resolvedSheetUrl) {
      setSheetUrl(resolvedSheetUrl);
      localStorage.setItem(GOOGLE_SCRIPT_URL_KEY, resolvedSheetUrl);
    }

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
    } catch (e) { }

    if (cloudData) {
      ingestCloudData(cloudData);
    } else if (needsCloudPull && resolvedSheetUrl) {
      pullAllFromCloud(sessionObj, resolvedSheetUrl).then(res => {
        if (res?.data) ingestCloudData(res.data);
      }).catch(err => {
        console.warn('Initial tenant pull failed:', err);
      });
    }
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
    const custName = prevCust.name || 'Customer';

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

    if (!tenantClient && (!sheetUrl || !auth)) {
      addToast(`Saved ${label} locally (Offline mode)`, 'info');
      return;
    }

    const key = `field-${rowId}-${field}`;
    debounceSync(key, () => {
      enqueueSyncTask(key, async () => {
        if (tenantClient) {
          try {
            await syncCustomerFieldToTenantDb(tenantClient, custIdToFind, field, value);
            addToast(`Saved ${label} to Supabase!`, 'success');
          } catch (err) {
            console.error('Supabase customer update error:', err);
            addToast(`Supabase save error: ${err.message}`, 'error');
          }
          return;
        }
        if (!sheetUrl || !auth) return;
        try {
          const res = await syncCustomerFieldToCloud(custIdToFind, field, value, custName, auth, sheetUrl);
          if (res && (res.status === 'success' || res.result?.success !== false)) {
            if (prevCust.isVillageDivider) {
              addToast(`Saved Village Name "${value}" to Sheet!`, 'success');
            } else {
              addToast(`Saved ${label} (${value}) for "${custName}" to Sheet!`, 'success');
            }
          } else {
            addToast(`Sheet Warning: ${res?.result?.message || res?.message || 'Could not save ' + label}`, 'warning');
          }
        } catch (err) {
          addToast(`Failed to save ${label} for "${custName}" to Sheet: ${err.message}`, 'error');
        }
      });
    }, 300);
  };

  // Payment Update & Autosave by _rowId (Prevents any customer overwriting)
  const handleUpdatePayment = (rowId, weekId, amount) => {
    const prevCust = customers.find(c => c._rowId === rowId || c.id === rowId);
    if (!prevCust) return;

    const custId = prevCust.id;
    const custName = prevCust.name || 'Customer';
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
        if (!sheetUrl || !auth) return;
        try {
          const res = await syncPaymentToCloud(custId, weekId, amount, custName, auth, sheetUrl);
          if (res && res.status === 'success' && res.result?.success !== false) {
            addToast(`Saved Payment ₹${amount} (${weekLabel}) for "${custName}" to Sheet!`, 'success');
          } else {
            addToast(`Sheet Warning: ${res?.result?.message || res?.message || 'Could not save payment'}`, 'warning');
          }
        } catch (err) {
          addToast(`Failed to save Payment for "${custName}" to Sheet: ${err.message}`, 'error');
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
        if (!sheetUrl || !auth) return;
        try {
          const res = await syncReconToCloud(weekId, r.prevCash, r.expenses, r.amountGiven, weeks, updated, auth, sheetUrl, r.salaries);
          if (res && (res.status === 'success' || res.result?.success !== false)) {
            addToast(`Saved Reconciliation for ${weekLabel} to Sheet!`, 'success');
          } else {
            addToast(`Sheet Warning: ${res?.result?.message || res?.message || 'Could not save reconciliation'}`, 'warning');
          }
        } catch (err) {
          addToast(`Failed to save Reconciliation for ${weekLabel} to Sheet: ${err.message}`, 'error');
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
          if (sheetUrl && auth) {
            deleteCustomerFromCloud(targetCust.id, targetCust.name, auth, sheetUrl);
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
      return;
    }

    if (sheetUrl && auth) {
      deleteCustomerFromCloud(targetCust.id, targetCust.name, auth, sheetUrl, {
        villageName: vName,
        reason: reason,
        disbursed: targetCust.disbursed,
        totalRepaid: totalPaid,
        finalBalance: balance,
        dateArchived: today,
        archiveRecord: archiveRecord
      })
        .then(res => {
          if (res && res.status === 'success' && res.result?.success !== false) {
            addToast(`Stored "${targetCust.name}" in Google Sheet Archive!`, 'success');
          } else {
            addToast(`Sheet Warning: ${res?.result?.message || 'Could not update archive on sheet'}`, 'warning');
          }
        })
        .catch(err => {
          addToast(`Failed to sync delete to Sheet: ${err.message}`, 'error');
        });
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
          return;
        }

        if (sheetUrl && auth) {
          deleteArchivedRecordFromCloud(archiveId, name, auth, sheetUrl)
            .then(res => {
              if (res && res.status === 'success' && res.result?.success !== false) {
                addToast(`Removed "${name}" from Google Sheet Archive!`, 'success');
              }
            })
            .catch(err => {
              addToast(`Failed to remove from Sheet Archive: ${err.message}`, 'error');
            });
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

    let prevRowCustId = null;
    if (insertUnderVillageRowId) {
      const vIdx = customers.findIndex(item => item._rowId === insertUnderVillageRowId);
      if (vIdx !== -1) {
        prevRowCustId = customers[vIdx].id;
      }
    }

    if (insertUnderVillageRowId) {
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
      addTenantCustomer(tenantClient, {
        id: newCust.id,
        name: newCust.name,
        phone: newCust.phone,
        disbursed: newCust.disbursed,
        originalAmount: newCust.originalAmount,
        disbursedDate: newCust.disbursedDate,
        startWeekId: custWithUid.startWeekId,
        isVillageDivider: newCust.isVillageDivider,
        villageName: newCust.villageName
      })
        .then(() => addToast(`Added "${newCust.name}" to Supabase!`, 'success'))
        .catch(err => addToast(`Supabase add error: ${err.message}`, 'error'));
      return;
    }

    if (sheetUrl && auth) {
      addCustomerToCloud({
        id: newCust.id,
        name: newCust.name,
        disbursed: newCust.disbursed,
        phone: newCust.phone,
        disbursedDate: newCust.disbursedDate,
        originalAmount: newCust.originalAmount,
        startWeekId: custWithUid.startWeekId,
        isVillageDivider: newCust.isVillageDivider,
        insertAfterId: prevRowCustId
      }, auth, sheetUrl)
        .then(res => {
          if (res && (res.status === 'success' || res.result?.success !== false)) {
            addToast(`Synchronized "${newCust.name}" to Google Sheet!`, 'success');
          } else {
            addToast(`Sheet Warning: ${res?.result?.message || 'Could not save customer to sheet'}`, 'warning');
          }
        })
        .catch(err => {
          addToast(`Failed to add "${newCust.name}" to Sheet: ${err.message}`, 'error');
        });
    } else {
      addToast(`Added "${newCust.name}" locally (Offline mode)`, 'info');
    }
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
          return;
        }
        if (!sheetUrl || !auth) return;
        syncRowOrderToCloud(orderedIds, auth, sheetUrl)
          .then(res => {
            if (res && (res.status === 'success' || res.result?.success !== false)) {
              addToast(`Saved route order to Sheet!`, 'success');
            } else {
              addToast(`Sheet Warning: ${res?.result?.message || 'Could not save row order'}`, 'warning');
            }
          })
          .catch(err => {
            addToast(`Failed to save route order to Sheet: ${err.message}`, 'error');
          });
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

    if (sheetUrl && auth) {
      archiveAndRenewCustomerInCloud({
        customerId: cust.id,
        customerName: cust.name,
        newAmount: newAmount,
        newDate: newDate || today,
        renewedAtWeek: targetWeekId,
        pastCyclePayments: previousPayments,
        archiveRecord: archiveRecord
      }, auth, sheetUrl)
        .then(res => {
          if (res && res.status === 'success' && res.result?.success !== false) {
            addToast(`Renewed loan in Google Sheet for "${cust.name}"!`, 'success');
          } else {
            addToast(`Sheet Warning: ${res?.result?.message || 'Could not renew in sheet'}`, 'warning');
          }
        })
        .catch(err => {
          addToast(`Failed to renew loan in Sheet: ${err.message}`, 'error');
        });
    } else {
      addToast(`Renewed loan for "${cust.name}" locally (Offline mode)`, 'info');
    }
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

    if (auth && sheetUrl) {
      setCloudStatus(prev => ({ ...prev, isSyncing: true, text: 'Saving dates...' }));
      syncWeeksToCloud(updatedWeeks, auth, sheetUrl)
        .then(res => {
          if (res && (res.status === 'success' || res.result?.success !== false)) {
            setCloudStatus({ connected: true, isSyncing: false, text: 'Google Sheet', error: null });
            addToast(`Week 1 updated to ${newDateStr}. All week dates synchronized in Sheet!`, 'success');
          } else {
            setCloudStatus({ connected: false, isSyncing: false, text: 'Sync Error', error: res?.message });
            addToast(`Sheet Warning: ${res?.result?.message || res?.message || 'Could not update week dates'}`, 'warning');
          }
        })
        .catch(err => {
          setCloudStatus({ connected: false, isSyncing: false, text: 'Offline Mode', error: err.message });
          addToast(`Failed to sync week dates to Sheet: ${err.message}`, 'error');
        });
    } else {
      addToast(`Week 1 updated to ${newDateStr} locally (Offline mode)`, 'info');
    }
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

    if (sheetUrl && auth) {
      addWeekToCloud({
        label: newWeek.label,
        date: newWeek.date,
        weeklyReconciliation: weeklyReconciliation
      }, auth, sheetUrl)
        .then(res => {
          if (res && (res.status === 'success' || res.result?.success !== false)) {
            addToast(`Added column "${newWeek.label}" to Google Sheet!`, 'success');
          } else {
            addToast(`Sheet Warning: ${res?.result?.message || 'Could not add week column to sheet'}`, 'warning');
          }
        })
        .catch(err => {
          addToast(`Failed to add week column to Sheet: ${err.message}`, 'error');
        });
    } else {
      addToast(`Added column "${newWeek.label}" locally (Offline mode)`, 'info');
    }
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

        if (sheetUrl && auth) {
          deleteWeekFromCloud(auth, sheetUrl)
            .then(res => {
              if (res && (res.status === 'success' || res.result?.success !== false)) {
                addToast(`Deleted column "${latestWeek.label}" from Google Sheet!`, 'success');
              } else {
                addToast(`Sheet Warning: ${res?.result?.message || 'Could not delete column from sheet'}`, 'warning');
              }
            })
            .catch(err => {
              addToast(`Failed to delete column from Sheet: ${err.message}`, 'error');
            });
        } else {
          addToast(`Removed column: ${latestWeek.label} locally (Offline mode)`, 'info');
        }
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
          phone: c.phone,
          villageName: c.villageName || getCustomerVillageName(customers, c._rowId || c.id) || '',
          disbursed: c.disbursed,
          totalPaid: getCustomerTotalPaid(c),
          balance: balance,
          status: isPaid ? 'Paid Off' : 'Active',
          reason: isPaid ? 'Loan Completed / Paid Off' : 'Batch Archived',
          dateArchived: today
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

    // Synchronize batch archive to Google Sheet
    if (sheetUrl && auth) {
      archiveLoansInCloud(toArchive, auth, sheetUrl)
        .then(res => {
          if (res && (res.status === 'success' || res.result?.success !== false)) {
            addToast(`Archived ${toArchive.length} loans in Google Sheet!`, 'success');
          } else {
            addToast(`Sheet Warning: ${res?.result?.message || 'Could not archive loans in sheet'}`, 'warning');
          }
        })
        .catch(err => {
          addToast(`Failed to archive loans in Sheet: ${err.message}`, 'error');
        });
    } else {
      addToast(`Archived ${toArchive.length} customers locally (Offline mode)`, 'info');
    }
  };

  // Manual Cloud Pull
  const handleManualPull = async () => {
    if (!sheetUrl) {
      addToast('Please configure your Google Apps Script URL first.', 'warning');
      setIsCloudSyncOpen(true);
      return;
    }
    setCloudStatus(prev => ({ ...prev, isSyncing: true, text: 'Pulling...' }));
    addToast('Fetching records from Google Sheet...', 'info');
    try {
      const res = await pullAllFromCloud(auth, sheetUrl);
      if (res && res.status === 'success' && res.data) {
        ingestCloudData(res.data);
        setCloudStatus({ connected: true, isSyncing: false, text: 'Google Sheet', error: null });
        addToast(`Loaded ${res.data.customers?.length || 0} records from Sheet!`, 'success');
        setIsCloudSyncOpen(false);
      } else {
        addToast('Error from Google Sheet: ' + (res?.message || 'Check deployment'), 'error');
        setCloudStatus({ connected: false, isSyncing: false, text: 'Sync Error', error: res?.message });
      }
    } catch (err) {
      addToast('Failed to pull from Google Sheet: ' + err.message, 'error');
      setCloudStatus({ connected: false, isSyncing: false, text: 'Offline Mode', error: err.message });
    }
  };

  // Manual Cloud Push
  const handleManualPush = async () => {
    if (!sheetUrl) {
      addToast('Please configure your Google Apps Script URL first.', 'warning');
      setIsCloudSyncOpen(true);
      return;
    }
    setCloudStatus(prev => ({ ...prev, isSyncing: true, text: 'Pushing...' }));
    addToast('Pushing all current records to Google Sheet...', 'info');
    try {
      const res = await pushAllToCloud({ weeks, customers, weeklyReconciliation }, auth, sheetUrl);
      if (res && res.status === 'success') {
        setCloudStatus({ connected: true, isSyncing: false, text: 'Google Sheet', error: null });
        addToast('Successfully synchronized all records to Google Sheet!', 'success');
        setIsCloudSyncOpen(false);
      } else {
        addToast('Error pushing to Sheet: ' + (res?.message || 'Check deployment'), 'error');
        setCloudStatus({ connected: false, isSyncing: false, text: 'Sync Error', error: res?.message });
      }
    } catch (err) {
      addToast('Failed to push to Google Sheet: ' + err.message, 'error');
      setCloudStatus({ connected: false, isSyncing: false, text: 'Offline Mode', error: err.message });
    }
  };

  // Save Sheet URL
  const handleSaveSheetUrl = (newUrl) => {
    setSheetUrl(newUrl);
    localStorage.setItem(GOOGLE_SCRIPT_URL_KEY, newUrl);
    addToast('Saved Google Sheet URL.', 'success');
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
        clientName: auth?.clientName || 'Sunday Kovuru'
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
            defaultEmail={defaultEmail}
            sheetUrl={sheetUrl}
            onSaveSheetUrl={handleSaveSheetUrl}
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
          setVillageContext(null);
          setIsAddCustomerOpen(true);
        }}
        onOpenAddWeek={() => setIsAddWeekOpen(true)}
        onOpenDeleteWeek={handleOpenDeleteWeek}
        onOpenArchive={() => setIsArchiveOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onPullFromCloud={handleManualPull}
        onPushToCloud={handleManualPush}
        onDownloadPDF={handleDownloadPDF}
        isGeneratingPDF={isGeneratingPDF}
        onExportCSV={handleExportCSV}
        onLogout={handleLogout}
        clientName={auth?.clientName}
        isSupabaseTenant={Boolean(auth?.isSupabaseTenant)}
        onOpenImportSheet={() => setIsImportSheetOpen(true)}
        language={language}
        onLanguageChange={handleLanguageChange}
      />

      {/* Supabase Dedicated Migration Banner (Shown when tenant connects with 0 or 1 customer in their private DB) */}
      {auth?.isSupabaseTenant && customers.length <= 1 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 border border-blue-500/40 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2">
                <span>🚀 Dedicated PostgreSQL Database Connected</span>
              </div>
              <h3 className="text-xl font-bold">Welcome to your private Supabase database!</h3>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                Your database is ready. Would you like to import all active customers, village routes, and past payment history from Google Sheets into your private database now?
              </p>
            </div>
            <button
              onClick={() => setIsImportSheetOpen(true)}
              className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <span>Import Google Sheet into Supabase</span>
            </button>
          </div>
        </div>
      )}

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

      {/* 4. Tab Views */}
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

      {/* 5. Modals & Dialogs */}
      <AppModals
        isAddCustomerOpen={isAddCustomerOpen}
        setIsAddCustomerOpen={setIsAddCustomerOpen}
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
        isCloudSyncOpen={isCloudSyncOpen}
        setIsCloudSyncOpen={setIsCloudSyncOpen}
        sheetUrl={sheetUrl}
        handleSaveSheetUrl={handleSaveSheetUrl}
        handleManualPull={handleManualPull}
        handleManualPush={handleManualPush}
        cloudStatus={cloudStatus}
        auth={auth}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        isDeleteCustomerOpen={isDeleteCustomerOpen}
        setIsDeleteCustomerOpen={setIsDeleteCustomerOpen}
        deleteTargetCustomer={deleteTargetCustomer}
        setDeleteTargetCustomer={setDeleteTargetCustomer}
        customers={customers}
        handleConfirmDeleteCustomer={handleConfirmDeleteCustomer}
        isImportSheetOpen={isImportSheetOpen}
        setIsImportSheetOpen={setIsImportSheetOpen}
        tenantClient={tenantClient}
        onImportSuccess={({ weeks: importedWeeks, customers: importedCusts, weeklyReconciliation: importedRecon, archive: importedArchive }) => {
          if (Array.isArray(importedCusts)) setCustomers(normalizeCustomers(importedCusts));
          if (Array.isArray(importedWeeks) && importedWeeks.length > 0) setWeeks(importedWeeks);
          if (importedRecon) setWeeklyReconciliation(importedRecon);
          if (Array.isArray(importedArchive)) setArchive(importedArchive);
          addToast(`Import complete! Loaded ${importedCusts.length} customer records into Supabase.`, 'success');
        }}
      />

      {/* 6. FinRoute Sub-Product Footer */}
      <Footer />

      {/* 7. Floating Toasts */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
