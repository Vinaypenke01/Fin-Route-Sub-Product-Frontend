import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Database,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Lock,
  LogOut,
  ArrowLeft,
  Key,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  Activity,
  FileText,
  Calendar,
  Mail,
  Phone,
  Building,
  Clock,
  Copy,
  Check,
  Search,
  X,
  ExternalLink,
  Server,
  Zap,
  TrendingUp,
  CreditCard,
  Users,
  Edit3,
  Pencil,
  UserPlus,
  Trash2,
  ShieldCheck
} from 'lucide-react';
import {
  authenticateSuperAdmin,
  getSuperAdminSession,
  logoutSuperAdmin,
  getTenantsList,
  createTenantWithDb,
  updateTenantStatus,
  updateTenantDbConfig,
  updateTenantFullDetails,
  fetchTenantAuditLogs,
  fetchTenantStats,
  fetchSuperAdmins,
  createSuperAdmin,
  deleteSuperAdmin
} from '../services/masterAuthService';
import SuperAdminModals from './SuperAdminModals';

const masterUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MASTER_SUPABASE_URL) || 'https://ubhwoicsjmxslggltvaa.supabase.co';

export default function SuperAdminPanel({ onBackToApp }) {
  const [adminSession, setAdminSession] = useState(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [adminFieldErrors, setAdminFieldErrors] = useState({});
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Tenants Management
  const [tenants, setTenants] = useState([]);
  const [isFetchingTenants, setIsFetchingTenants] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal States
  const [isAddTenantModalOpen, setIsAddTenantModalOpen] = useState(false);
  const [viewingTenant, setViewingTenant] = useState(null);
  const [viewTab, setViewTab] = useState('details'); // 'details' | 'logs'
  const [tenantStats, setTenantStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [tenantLogs, setTenantLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);

  // Password Visibility States
  const [showPasswordMap, setShowPasswordMap] = useState({});
  const [showDetailPassword, setShowDetailPassword] = useState(false);

  // Edit Tenant Full Modal State
  const [editingTenant, setEditingTenant] = useState(null);
  const [editForm, setEditForm] = useState({
    tenantId: '',
    clientName: '',
    businessName: '',
    email: '',
    phone: '',
    status: 'active',
    password: '',
    tenantDbUrl: '',
    tenantAnonKey: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState(null);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Edit DB inside modal state
  const [isEditingDb, setIsEditingDb] = useState(false);
  const [editDbUrl, setEditDbUrl] = useState('');
  const [editAnonKey, setEditAnonKey] = useState('');
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [editDbMsg, setEditDbMsg] = useState(null);

  // New Tenant Form
  const [newEmail, setNewEmail] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('FinRoute Collect');
  const [newPassword, setNewPassword] = useState('');
  const [newDbUrl, setNewDbUrl] = useState('');
  const [newAnonKey, setNewAnonKey] = useState('');
  const [createError, setCreateError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Top Navigation Tabs ('tenants' | 'admins')
  const [activeAdminTab, setActiveAdminTab] = useState('tenants');

  // Administrator Configuration State
  const [adminsList, setAdminsList] = useState([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [newAdminForm, setNewAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'superadmin'
  });
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [addAdminError, setAddAdminError] = useState(null);
  const [addAdminSuccess, setAddAdminSuccess] = useState(null);
  const [showNewAdminPassword, setShowNewAdminPassword] = useState(false);
  const [showAdminPassMap, setShowAdminPassMap] = useState({});

  // Check stored Supabase Auth admin session on mount
  useEffect(() => {
    getSuperAdminSession().then((session) => {
      if (session) {
        setAdminSession(session);
        sessionStorage.setItem('FINROUTE_ADMIN_SESSION', JSON.stringify(session));
        return;
      }
      const saved = sessionStorage.getItem('FINROUTE_ADMIN_SESSION');
      if (saved) {
        try {
          setAdminSession(JSON.parse(saved));
        } catch (e) {}
      }
    });
  }, []);

  // Fetch tenants and admins once logged in
  useEffect(() => {
    if (adminSession) {
      loadTenants();
      loadAdmins();
    }
  }, [adminSession]);

  const loadTenants = async () => {
    setIsFetchingTenants(true);
    const res = await getTenantsList();
    if (res.success) {
      setTenants(res.data);
    }
    setIsFetchingTenants(false);
  };

  const loadAdmins = async () => {
    setIsLoadingAdmins(true);
    const res = await fetchSuperAdmins();
    if (res.success) {
      setAdminsList(res.admins || []);
    }
    setIsLoadingAdmins(false);
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setIsCreatingAdmin(true);
    setAddAdminError(null);
    setAddAdminSuccess(null);

    const res = await createSuperAdmin(newAdminForm);
    if (res.success) {
      setAddAdminSuccess('Administrator created successfully!');
      setTimeout(() => {
        setIsAddAdminModalOpen(false);
        setNewAdminForm({ name: '', email: '', password: '', role: 'superadmin' });
        setAddAdminSuccess(null);
        loadAdmins();
      }, 700);
    } else {
      setAddAdminError(res.message || 'Failed to create administrator account.');
    }
    setIsCreatingAdmin(false);
  };

  const handleDeleteAdmin = async (id, email) => {
    if (email === adminSession?.email) {
      alert('You cannot delete your own active administrator account.');
      return;
    }
    if (email === 'admin@finroute.com') {
      alert('The root system administrator (admin@finroute.com) cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove administrator: ${email}?`)) {
      return;
    }
    const res = await deleteSuperAdmin(id, email);
    if (res.success) {
      loadAdmins();
    } else {
      alert('Error removing administrator: ' + (res.message || 'Unknown error'));
    }
  };

  const toggleAdminPassword = (id) => {
    setShowAdminPassMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const validateAdminLoginForm = () => {
    const errors = {};
    const trimmedEmail = adminEmail.trim().toLowerCase();
    const trimmedPassword = adminPassword.trim();

    if (!trimmedEmail) {
      errors.email = 'Administrator email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid administrator email address (e.g. admin@finroute.com).';
    }

    if (!trimmedPassword) {
      errors.password = 'Master password is required.';
    } else if (trimmedPassword.length < 4) {
      errors.password = 'Password must be at least 4 characters long.';
    }

    setAdminFieldErrors(errors);
    return { isValid: Object.keys(errors).length === 0, trimmedEmail, trimmedPassword };
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);

    const { isValid, trimmedEmail, trimmedPassword } = validateAdminLoginForm();
    if (!isValid) return;

    setIsLoading(true);
    const res = await authenticateSuperAdmin(trimmedEmail, trimmedPassword);
    if (res.success) {
      setAdminSession(res.admin);
      sessionStorage.setItem('FINROUTE_ADMIN_SESSION', JSON.stringify(res.admin));
      setAdminFieldErrors({});
    } else {
      setLoginError(res.message || 'Invalid administrator credentials. Access denied.');
    }
    setIsLoading(false);
  };

  const handleAdminLogout = async () => {
    await logoutSuperAdmin();
    sessionStorage.removeItem('FINROUTE_ADMIN_SESSION');
    setAdminSession(null);
    setViewingTenant(null);
    setEditingTenant(null);
    if (onBackToApp) {
      onBackToApp();
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);

    const res = await createTenantWithDb({
      email: newEmail,
      clientName: newClientName,
      businessName: newBusinessName,
      password: newPassword,
      tenantDbUrl: newDbUrl,
      tenantAnonKey: newAnonKey
    });

    if (res.success) {
      setIsAddTenantModalOpen(false);
      setNewEmail('');
      setNewClientName('');
      setNewPassword('');
      setNewDbUrl('');
      setNewAnonKey('');
      loadTenants();
    } else {
      setCreateError(res.message || 'Failed to create tenant.');
    }
    setIsCreating(false);
  };

  const handleToggleStatus = async (tenantId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await updateTenantStatus(tenantId, nextStatus);
    loadTenants();
  };

  // Open Tenant View Modal
  const handleOpenViewTenant = async (tenant) => {
    setViewingTenant(tenant);
    setViewTab('details');
    setShowAnonKey(false);
    setShowDetailPassword(false);
    setIsEditingDb(false);
    setEditDbMsg(null);

    const dbConfig = Array.isArray(tenant.master_db_configs) ? tenant.master_db_configs[0] : tenant.master_db_configs;
    const creds = Array.isArray(tenant.master_credentials) ? tenant.master_credentials[0] : tenant.master_credentials;
    const url = dbConfig?.tenant_supabase_url || '';
    const key = dbConfig?.tenant_anon_key || '';

    setEditDbUrl(url);
    setEditAnonKey(key);

    // Fetch real-time live stats from tenant DB
    if (url && key) {
      setIsLoadingStats(true);
      const stats = await fetchTenantStats(url, key);
      setTenantStats(stats);
      setIsLoadingStats(false);

      // Fetch logs with tenant user login metadata
      setIsLoadingLogs(true);
      const logRes = await fetchTenantAuditLogs(url, key, {
        email: tenant.email,
        clientName: tenant.client_name,
        businessName: tenant.business_name,
        lastLogin: creds?.last_login || null,
        registeredAt: tenant.created_at
      });
      setTenantLogs(logRes.logs || []);
      setIsLoadingLogs(false);
    } else {
      setTenantStats(null);
      setTenantLogs([]);
    }
  };

  // Refresh live logs on-demand
  const handleRefreshLogs = async () => {
    if (!viewingTenant) return;
    const dbConfig = Array.isArray(viewingTenant.master_db_configs) ? viewingTenant.master_db_configs[0] : viewingTenant.master_db_configs;
    const creds = Array.isArray(viewingTenant.master_credentials) ? viewingTenant.master_credentials[0] : viewingTenant.master_credentials;
    const url = dbConfig?.tenant_supabase_url || editDbUrl;
    const key = dbConfig?.tenant_anon_key || editAnonKey;
    if (!url || !key) return;

    setIsLoadingLogs(true);
    const logRes = await fetchTenantAuditLogs(url, key, {
      email: viewingTenant.email,
      clientName: viewingTenant.client_name,
      businessName: viewingTenant.business_name,
      lastLogin: creds?.last_login || null,
      registeredAt: viewingTenant.created_at
    });
    setTenantLogs(logRes.logs || []);
    setIsLoadingLogs(false);
  };

  // Open Edit Tenant Modal
  const handleOpenEditTenant = (tenant) => {
    const dbConfig = Array.isArray(tenant.master_db_configs) ? tenant.master_db_configs[0] : tenant.master_db_configs;
    const creds = Array.isArray(tenant.master_credentials) ? tenant.master_credentials[0] : tenant.master_credentials;

    setEditingTenant(tenant);
    setEditForm({
      tenantId: tenant.id,
      clientName: tenant.client_name || '',
      businessName: tenant.business_name || 'FinRoute Collect',
      email: tenant.email || '',
      phone: tenant.phone || '',
      status: tenant.status || 'active',
      password: creds?.password_hash || '',
      tenantDbUrl: dbConfig?.tenant_supabase_url || '',
      tenantAnonKey: dbConfig?.tenant_anon_key || ''
    });
    setEditError(null);
    setEditSuccessMsg(null);
    setShowEditPassword(false);
  };

  // Save Tenant Full Edits
  const handleSaveEditTenant = async (e) => {
    e.preventDefault();
    setIsSavingEdit(true);
    setEditError(null);
    setEditSuccessMsg(null);

    const res = await updateTenantFullDetails(editForm);
    if (res.success) {
      setEditSuccessMsg('Tenant details and credentials updated successfully!');
      setTimeout(() => {
        setEditingTenant(null);
        loadTenants();
        // If also viewing this tenant, update the viewing object
        if (viewingTenant && viewingTenant.id === editForm.tenantId) {
          setViewingTenant(prev => ({
            ...prev,
            client_name: editForm.clientName,
            business_name: editForm.businessName,
            email: editForm.email,
            phone: editForm.phone,
            status: editForm.status,
            master_credentials: [{ password_hash: editForm.password }],
            master_db_configs: [{ tenant_supabase_url: editForm.tenantDbUrl, tenant_anon_key: editForm.tenantAnonKey }]
          }));
        }
      }, 700);
    } else {
      setEditError(res.message || 'Failed to update tenant details.');
    }
    setIsSavingEdit(false);
  };

  // Save updated DB config inside details modal
  const handleSaveDbConfig = async () => {
    if (!viewingTenant) return;
    setIsSavingDb(true);
    setEditDbMsg(null);

    const res = await updateTenantDbConfig(viewingTenant.id, editDbUrl, editAnonKey);
    if (res.success) {
      setEditDbMsg({ type: 'success', text: 'Database configuration updated successfully!' });
      setIsEditingDb(false);
      loadTenants();
      // Refresh stats
      const stats = await fetchTenantStats(editDbUrl, editAnonKey);
      setTenantStats(stats);
    } else {
      setEditDbMsg({ type: 'error', text: res.message || 'Failed to update database config.' });
    }
    setIsSavingDb(false);
  };

  // Copy helper
  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const toggleTablePassword = (id) => {
    setShowPasswordMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered tenants list
  const filteredTenants = tenants.filter(t => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q ||
      t.client_name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.business_name?.toLowerCase().includes(q);

    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchQuery && matchStatus;
  });

  // Filtered logs
  const filteredLogs = tenantLogs.filter(log => {
    if (!logsSearch) return true;
    const q = logsSearch.toLowerCase();
    const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : '';
    return (
      (log.action || '').toLowerCase().includes(q) ||
      (log.entity_id || '').toLowerCase().includes(q) ||
      (log.entity_type || '').toLowerCase().includes(q) ||
      detailsStr.includes(q)
    );
  });

  // Calculate high-level metrics
  const activeTenantsCount = tenants.filter(t => t.status === 'active').length;
  const connectedDbsCount = tenants.filter(t => {
    const db = Array.isArray(t.master_db_configs) ? t.master_db_configs[0] : t.master_db_configs;
    return !!db?.tenant_supabase_url;
  }).length;

  // If not authenticated as Super Admin, show login screen (matching FinRoute light theme)
  if (!adminSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <button
          onClick={onBackToApp}
          className="absolute top-6 left-6 text-slate-600 hover:text-slate-900 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to FinRoute
        </button>

        <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-2xl p-8 shadow-xl">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3 flex items-center justify-center">
              <img
                src="/finroute_logo.png"
                alt="FinRoute Logo"
                className="h-10 sm:h-11 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">FinRoute Super-Admin</h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Master Database Registry & Tenant Operations
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4 text-xs" noValidate>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    if (adminFieldErrors.email) setAdminFieldErrors(prev => ({ ...prev, email: null }));
                    if (loginError) setLoginError(null);
                  }}
                  placeholder="admin@finroute.com"
                  autoComplete="email"
                  className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 transition-all ${
                    adminFieldErrors.email
                      ? 'border-red-400 bg-red-50/20 focus:ring-2 focus:ring-red-400/20 focus:border-red-500'
                      : 'border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
              </div>
              {adminFieldErrors.email && (
                <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {adminFieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Master Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    if (adminFieldErrors.password) setAdminFieldErrors(prev => ({ ...prev, password: null }));
                    if (loginError) setLoginError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`w-full px-3 py-2 pr-9 bg-white border rounded-lg text-slate-900 transition-all ${
                    adminFieldErrors.password
                      ? 'border-red-400 bg-red-50/20 focus:ring-2 focus:ring-red-400/20 focus:border-red-500'
                      : 'border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(prev => !prev)}
                  tabIndex={-1}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title={showAdminPassword ? 'Hide password' : 'Show password'}
                >
                  {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {adminFieldErrors.password && (
                <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {adminFieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Lock className="w-4 h-4" />
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In as Super-Admin'}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            <span>Master Auth Registry • Strictly Authorized Access</span>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Super Admin Dashboard (FinRoute Clean Light Theme)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between shadow-xs sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a
            href="https://fin-route.site/"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:opacity-90 transition-opacity shrink-0"
          >
            <img
              src="/finroute_logo.png"
              alt="FinRoute Logo"
              className="h-8 w-auto object-contain"
            />
          </a>
          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight">FinRoute Super-Admin</h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Registry
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Multi-Tenant Isolated Database Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Master DB Online</span>
          </div>

          {/* Admin Identity Badge */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100/80 border border-slate-200/80">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
              {adminSession?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="text-left hidden lg:block leading-tight">
              <div className="text-[11px] font-bold text-slate-900 truncate max-w-[140px]">{adminSession?.email}</div>
              <div className="text-[9.5px] font-medium text-slate-500">Super Administrator</div>
            </div>
          </div>

          <button
            onClick={onBackToApp}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Return to FinRoute"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to App</span>
          </button>

          <button
            onClick={handleAdminLogout}
            className="px-3.5 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Log Out Super-Admin"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Tabs: Tenants Directory vs Admin Configuration */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveAdminTab('tenants')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeAdminTab === 'tenants'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Tenants Directory</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeAdminTab === 'tenants' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {tenants.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveAdminTab('admins');
                loadAdmins();
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                activeAdminTab === 'admins'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Configuration</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeAdminTab === 'admins' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {adminsList.length}
              </span>
            </button>
          </div>

          {activeAdminTab === 'admins' && (
            <button
              onClick={() => setIsAddAdminModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add Administrator</span>
            </button>
          )}
        </div>

        {activeAdminTab === 'tenants' ? (
          <>
            {/* KPI Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tenants</p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">{tenants.length}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Registered businesses</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Ledgers</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{activeTenantsCount}</h3>
              <p className="text-[11px] text-emerald-600/80 mt-1 font-medium">Operating routes</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Private DBs Hooked</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-0.5">{connectedDbsCount}</h3>
              <p className="text-[11px] text-indigo-600/80 mt-1 font-medium">100% data isolated</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registry Core</p>
              <h3 className="text-sm font-bold text-slate-800 mt-1 truncate max-w-[140px]" title={masterUrl}>
                ubhwoics...
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Master DB router</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold">
              <Server className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Filters & Add Tenant Button */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tenant by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({tenants.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  statusFilter === 'active' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Active ({activeTenantsCount})
              </button>
              <button
                onClick={() => setStatusFilter('suspended')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  statusFilter === 'suspended' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Suspended ({tenants.length - activeTenantsCount})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTenants}
              disabled={isFetchingTenants}
              className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Refresh Tenants"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingTenants ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setIsAddTenantModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Tenant DB
            </button>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Client / Business</th>
                  <th className="px-4 py-3">Authorized Email</th>
                  <th className="px-4 py-3">Password & Access</th>
                  <th className="px-4 py-3">Dedicated Supabase DB</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Last Login</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                      No tenants found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map(t => {
                    const dbConfig = Array.isArray(t.master_db_configs) ? t.master_db_configs[0] : t.master_db_configs;
                    const creds = Array.isArray(t.master_credentials) ? t.master_credentials[0] : t.master_credentials;
                    const isActive = t.status === 'active';
                    const hasDb = Boolean(dbConfig?.tenant_supabase_url);
                    const password = creds?.password_hash || '';
                    const isPasswordRevealed = Boolean(showPasswordMap[t.id]);

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          <div className="text-sm font-bold text-slate-900">{t.client_name}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{t.business_name || 'FinRoute Collect'}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 font-medium">
                          <div>{t.email}</div>
                          {t.phone && <div className="text-[11px] text-slate-400">{t.phone}</div>}
                        </td>
                        {/* Password Column with Reveal & Copy */}
                        <td className="px-4 py-3.5 font-mono">
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-md max-w-fit">
                            <span className="text-xs font-bold text-slate-800">
                              {isPasswordRevealed ? password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleTablePassword(t.id)}
                              className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ml-1"
                              title={isPasswordRevealed ? 'Hide Password' : 'Show Password'}
                            >
                              {isPasswordRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            {password && (
                              <button
                                type="button"
                                onClick={() => handleCopy(password)}
                                className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Copy Password"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {hasDb ? (
                            <div className="flex items-center gap-1.5 max-w-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              <span className="font-mono text-[11px] text-slate-700 truncate" title={dbConfig.tenant_supabase_url}>
                                {dbConfig.tenant_supabase_url}
                              </span>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              No DB Assigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-slate-500 text-[11px]">
                          {creds?.last_login ? new Date(creds.last_login).toLocaleDateString('en-GB') : 'Never'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Action Button */}
                            <button
                              onClick={() => handleOpenViewTenant(t)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="View Basic Details & Logs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            {/* Edit Action Button */}
                            <button
                              onClick={() => handleOpenEditTenant(t)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                              title="Edit Tenant Profile & Credentials"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {/* Toggle Status Button */}
                            <button
                              onClick={() => handleToggleStatus(t.id, t.status)}
                              className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                                isActive
                                  ? 'border-slate-200 text-slate-500 hover:text-amber-700 hover:bg-amber-50 hover:border-amber-200'
                                  : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                              title={isActive ? 'Suspend Access' : 'Activate Access'}
                            >
                              {isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    ) : (
      /* Admin Configuration Section */
      <div className="space-y-6">
        {/* Admin Metrics Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Administrators</p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">{adminsList.length}</h3>
              <p className="text-[11px] text-slate-400 mt-1">Authorized console accounts</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Super Administrators</p>
              <h3 className="text-2xl font-black text-indigo-600 mt-0.5">
                {adminsList.filter(a => a.role === 'superadmin').length}
              </h3>
              <p className="text-[11px] text-indigo-600/80 mt-1 font-medium">Full master authority</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <Key className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Admin Identity</p>
              <h3 className="text-sm font-bold text-slate-800 mt-1 truncate max-w-[200px]" title={adminSession?.email}>
                {adminSession?.email}
              </h3>
              <p className="text-[11px] text-emerald-600 mt-1 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Session
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Admin Toolbar */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search administrator by name, email..."
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAdmins}
              disabled={isLoadingAdmins}
              className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Refresh Administrators"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdmins ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={() => setIsAddAdminModalOpen(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Administrator</span>
            </button>
          </div>
        </div>

        {/* Administrators Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10.5px]">
                  <th className="px-4 py-3 w-12 text-center">#</th>
                  <th className="px-4 py-3">Administrator Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Security & Auth Engine</th>
                  <th className="px-4 py-3">Created Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {isLoadingAdmins ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                      <span>Loading administrators...</span>
                    </td>
                  </tr>
                ) : adminsList.filter(a => {
                  if (!adminSearchQuery) return true;
                  const q = adminSearchQuery.toLowerCase().trim();
                  return (
                    (a.name || '').toLowerCase().includes(q) ||
                    (a.email || '').toLowerCase().includes(q) ||
                    (a.role || '').toLowerCase().includes(q)
                  );
                }).length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-slate-400">
                      <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-semibold text-slate-600">No administrators found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Click "+ Add Administrator" to create an authorized team account.</p>
                    </td>
                  </tr>
                ) : (
                  adminsList.filter(a => {
                    if (!adminSearchQuery) return true;
                    const q = adminSearchQuery.toLowerCase().trim();
                    return (
                      (a.name || '').toLowerCase().includes(q) ||
                      (a.email || '').toLowerCase().includes(q) ||
                      (a.role || '').toLowerCase().includes(q)
                    );
                  }).map((admin, idx) => {
                    const isCurrent = admin.email === adminSession?.email;
                    const isRoot = admin.email === 'admin@finroute.com';
                    const showPass = showAdminPassMap[admin.id];
                    return (
                      <tr key={admin.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                              {admin.name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{admin.name}</span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-800 font-semibold">{admin.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            admin.role === 'superadmin'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            <Shield className="w-3 h-3" />
                            <span>{admin.role === 'superadmin' ? 'Super Administrator' : 'Operations Admin'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>Supabase Auth (BCrypt/Argon2)</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {admin.created_at ? new Date(admin.created_at).toLocaleDateString('en-GB') : 'System Seed'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isRoot ? (
                            <span className="text-[10px] text-slate-400 italic">Root Admin</span>
                          ) : isCurrent ? (
                            <span className="text-[10px] text-slate-400 italic">Active Session</span>
                          ) : (
                            <button
                              onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs transition-colors cursor-pointer"
                              title={`Remove administrator ${admin.email}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}
  </main>

      {/* Delegated Modals (View, Edit, Add Tenant, Add Admin) */}
      <SuperAdminModals
        // 1. View Tenant
        viewingTenant={viewingTenant}
        setViewingTenant={setViewingTenant}
        viewTab={viewTab}
        setViewTab={setViewTab}
        showAnonKey={showAnonKey}
        setShowAnonKey={setShowAnonKey}
        showDetailPassword={showDetailPassword}
        setShowDetailPassword={setShowDetailPassword}
        isEditingDb={isEditingDb}
        setIsEditingDb={setIsEditingDb}
        editDbUrl={editDbUrl}
        setEditDbUrl={setEditDbUrl}
        editAnonKey={editAnonKey}
        setEditAnonKey={setEditAnonKey}
        isSavingDb={isSavingDb}
        editDbMsg={editDbMsg}
        handleSaveDbConfig={handleSaveDbConfig}
        copiedKey={copiedKey}
        handleCopy={handleCopy}
        tenantStats={tenantStats}
        isLoadingStats={isLoadingStats}
        tenantLogs={tenantLogs}
        isLoadingLogs={isLoadingLogs}
        handleRefreshLogs={handleRefreshLogs}
        filteredLogs={filteredLogs}
        logsSearch={logsSearch}
        setLogsSearch={setLogsSearch}
        handleOpenEditTenant={handleOpenEditTenant}

        // 2. Edit Tenant
        editingTenant={editingTenant}
        setEditingTenant={setEditingTenant}
        editForm={editForm}
        setEditForm={setEditForm}
        showEditPassword={showEditPassword}
        setShowEditPassword={setShowEditPassword}
        editError={editError}
        editSuccessMsg={editSuccessMsg}
        isSavingEdit={isSavingEdit}
        handleSaveEditTenant={handleSaveEditTenant}

        // 3. Add Tenant
        isAddTenantModalOpen={isAddTenantModalOpen}
        setIsAddTenantModalOpen={setIsAddTenantModalOpen}
        newClientName={newClientName}
        setNewClientName={setNewClientName}
        newBusinessName={newBusinessName}
        setNewBusinessName={setNewBusinessName}
        newEmail={newEmail}
        setNewEmail={setNewEmail}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        newDbUrl={newDbUrl}
        setNewDbUrl={setNewDbUrl}
        newAnonKey={newAnonKey}
        setNewAnonKey={setNewAnonKey}
        createError={createError}
        isCreating={isCreating}
        handleCreateTenant={handleCreateTenant}

        // 4. Add Admin
        isAddAdminModalOpen={isAddAdminModalOpen}
        setIsAddAdminModalOpen={setIsAddAdminModalOpen}
        newAdminForm={newAdminForm}
        setNewAdminForm={setNewAdminForm}
        showNewAdminPassword={showNewAdminPassword}
        setShowNewAdminPassword={setShowNewAdminPassword}
        addAdminError={addAdminError}
        addAdminSuccess={addAdminSuccess}
        isCreatingAdmin={isCreatingAdmin}
        handleCreateAdmin={handleCreateAdmin}
      />
    </div>
  );
}
