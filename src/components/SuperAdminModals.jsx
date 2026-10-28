import React from 'react';
import {
  Building,
  Pencil,
  X,
  FileText,
  Activity,
  Eye,
  EyeOff,
  Copy,
  Database,
  RefreshCw,
  AlertCircle,
  Check,
  Search,
  UserCheck,
  CheckCircle,
  Plus,
  UserPlus
} from 'lucide-react';

export default function SuperAdminModals({
  // 1. View Tenant Modal Props
  viewingTenant,
  setViewingTenant,
  viewTab,
  setViewTab,
  showAnonKey,
  setShowAnonKey,
  showDetailPassword,
  setShowDetailPassword,
  isEditingDb,
  setIsEditingDb,
  editDbUrl,
  setEditDbUrl,
  editAnonKey,
  setEditAnonKey,
  isSavingDb,
  editDbMsg,
  handleSaveDbConfig,
  copiedKey,
  handleCopy,
  tenantStats,
  isLoadingStats,
  tenantLogs,
  isLoadingLogs,
  handleRefreshLogs,
  filteredLogs,
  logsSearch,
  setLogsSearch,
  handleOpenEditTenant,

  // 2. Edit Tenant Modal Props
  editingTenant,
  setEditingTenant,
  editForm,
  setEditForm,
  showEditPassword,
  setShowEditPassword,
  editError,
  editSuccessMsg,
  isSavingEdit,
  handleSaveEditTenant,

  // 3. Add Tenant Modal Props
  isAddTenantModalOpen,
  setIsAddTenantModalOpen,
  newClientName,
  setNewClientName,
  newBusinessName,
  setNewBusinessName,
  newEmail,
  setNewEmail,
  newPassword,
  setNewPassword,
  newDbUrl,
  setNewDbUrl,
  newAnonKey,
  setNewAnonKey,
  createError,
  isCreating,
  handleCreateTenant,

  // 4. Add Admin Modal Props
  isAddAdminModalOpen,
  setIsAddAdminModalOpen,
  newAdminForm,
  setNewAdminForm,
  showNewAdminPassword,
  setShowNewAdminPassword,
  addAdminError,
  addAdminSuccess,
  isCreatingAdmin,
  handleCreateAdmin
}) {
  return (
    <>
      {/* 1. MODAL: View Tenant Details & Live Activity Logs */}
      {viewingTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {viewingTenant.client_name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {viewingTenant.business_name || 'FinRoute Collect'} • {viewingTenant.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const target = viewingTenant;
                    setViewingTenant(null);
                    handleOpenEditTenant(target);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Tenant</span>
                </button>
                <button
                  onClick={() => setViewingTenant(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Tab Switcher */}
            <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center gap-4 text-xs font-bold">
              <button
                onClick={() => setViewTab('details')}
                className={`pb-3 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewTab === 'details'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Basic Details & Password</span>
              </button>
              <button
                onClick={() => setViewTab('logs')}
                className={`pb-3 px-1 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewTab === 'logs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Tenant Activity & Audit Logs ({tenantLogs.length})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {viewTab === 'details' ? (
                <>
                  {/* Basic Details Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                      Tenant Profile & Access Credentials
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium">Client Name:</span>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">{viewingTenant.client_name}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium">Business / Entity:</span>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">{viewingTenant.business_name || 'FinRoute Collect'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium">Authorized Email:</span>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5 font-mono">{viewingTenant.email}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium">Phone Number:</span>
                        <p className="text-xs font-semibold text-slate-800 mt-0.5">{viewingTenant.phone || 'Not configured'}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium">Account Status:</span>
                        <div className="mt-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                              viewingTenant.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {viewingTenant.status === 'active' ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400 font-medium">Registered On:</span>
                        <p className="text-xs font-medium text-slate-700 mt-0.5">
                          {new Date(viewingTenant.created_at).toLocaleString('en-GB')}
                        </p>
                      </div>

                      {/* Display Password in Detail */}
                      {(() => {
                        const creds = Array.isArray(viewingTenant.master_credentials) ? viewingTenant.master_credentials[0] : viewingTenant.master_credentials;
                        const tenantPw = creds?.password_hash || '';

                        return (
                          <div className="sm:col-span-2 bg-white border border-blue-200/80 rounded-xl p-3 shadow-2xs mt-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                                  Tenant Access Password
                                </span>
                                <div className="font-mono text-sm font-extrabold text-slate-900 mt-0.5">
                                  {showDetailPassword ? (tenantPw || 'No password configured') : (tenantPw ? '••••••••••••' : 'No password')}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setShowDetailPassword(!showDetailPassword)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  {showDetailPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  <span>{showDetailPassword ? 'Hide' : 'Reveal'}</span>
                                </button>
                                {tenantPw && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(tenantPw)}
                                    className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors cursor-pointer"
                                    title="Copy Password"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-[10.5px] text-slate-400 mt-1">
                              This password is used by the operator to sign in to their private route ledger.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Real-time DB Health & Statistics */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-blue-600" />
                        <span>Dedicated Database Real-Time Telemetry</span>
                      </h4>
                      {tenantStats?.connected && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Ping: {tenantStats.latencyMs}ms</span>
                        </span>
                      )}
                    </div>

                    {isLoadingStats ? (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>Pinging tenant database instance...</span>
                      </div>
                    ) : tenantStats?.connected ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-blue-50/50 border border-blue-200/60 rounded-xl p-4">
                        <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-2xs">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Customers</p>
                          <p className="text-lg font-black text-slate-900 mt-0.5">{tenantStats.customerCount}</p>
                          <p className="text-[10px] text-slate-500">in dedicated DB</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-2xs">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Total Capital</p>
                          <p className="text-lg font-black text-slate-900 mt-0.5">₹{tenantStats.totalDisbursed.toLocaleString('en-IN')}</p>
                          <p className="text-[10px] text-slate-500">loan principal</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-2xs">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Total Collected</p>
                          <p className="text-lg font-black text-emerald-600 mt-0.5">₹{tenantStats.totalCollected.toLocaleString('en-IN')}</p>
                          <p className="text-[10px] text-emerald-600/80 font-medium">all cycles</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-2xs">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Active Balance</p>
                          <p className="text-lg font-black text-blue-600 mt-0.5">₹{tenantStats.totalBalance.toLocaleString('en-IN')}</p>
                          <p className="text-[10px] text-blue-600/80 font-medium">to collect</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>Could not connect to tenant database: {tenantStats?.message || 'Check database credentials.'}</span>
                      </div>
                    )}
                  </div>

                  {/* Database URL & Anon Key Config with Edit Option */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Database Credentials & Routing
                      </h4>
                      <button
                        onClick={() => setIsEditingDb(!isEditingDb)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        {isEditingDb ? 'Cancel Editing' : 'Edit Credentials'}
                      </button>
                    </div>

                    {editDbMsg && (
                      <div className={`mb-3 p-2.5 rounded-lg text-xs font-medium ${
                        editDbMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {editDbMsg.text}
                      </div>
                    )}

                    {isEditingDb ? (
                      <div className="space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">Dedicated Supabase URL</label>
                          <input
                            type="url"
                            value={editDbUrl}
                            onChange={(e) => setEditDbUrl(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
                            placeholder="https://xyz.supabase.co"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-semibold mb-1">Tenant Publishable / Anon Key</label>
                          <input
                            type="text"
                            value={editAnonKey}
                            onChange={(e) => setEditAnonKey(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
                            placeholder="sb_publishable_..."
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setIsEditingDb(false)}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveDbConfig}
                            disabled={isSavingDb}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isSavingDb ? 'Saving...' : 'Save & Route'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                        <div>
                          <span className="text-[11px] text-slate-400 font-medium">Dedicated Database URL:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs text-blue-700 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg flex-1 truncate">
                              {editDbUrl || 'Not configured'}
                            </span>
                            {editDbUrl && (
                              <button
                                onClick={() => handleCopy(editDbUrl)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                                title="Copy URL"
                              >
                                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 font-medium">Tenant Anon Key:</span>
                            <button
                              onClick={() => setShowAnonKey(!showAnonKey)}
                              className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                            >
                              {showAnonKey ? 'Hide Key' : 'Reveal Key'}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-xs text-slate-800 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg flex-1 truncate">
                              {showAnonKey ? (editAnonKey || 'Not configured') : (editAnonKey ? '••••••••••••••••••••••••••••••••••••••••' : 'Not configured')}
                            </span>
                            {editAnonKey && (
                              <button
                                onClick={() => handleCopy(editAnonKey)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                                title="Copy Key"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Tab 2: Live Activity & Audit Logs */
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-blue-600" />
                        <span>Live Ledger Activity & User Audit Trail</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Tracks operator logins, authentication telemetry, payment postings, and customer ledger changes.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative w-48">
                        <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Filter logs or users..."
                          value={logsSearch}
                          onChange={(e) => setLogsSearch(e.target.value)}
                          className="w-full pl-7 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleRefreshLogs}
                        disabled={isLoadingLogs}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer disabled:opacity-50"
                        title="Refresh Logs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-blue-600' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {isLoadingLogs ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      <span>Fetching tenant activity stream & user login telemetry...</span>
                    </div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400">
                      <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-semibold text-slate-600">No activity logged yet.</p>
                      <p className="text-[11px] mt-1">Actions and login sessions by this tenant will appear here.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                      {filteredLogs.map((log) => {
                        const isLogin = (log.action || '').toUpperCase().includes('LOGIN') || (log.entity_type || '').toLowerCase().includes('auth');
                        const isPayment = (log.action || '').toUpperCase().includes('PAYMENT');
                        const isRenew = (log.action || '').toUpperCase().includes('RENEW') || (log.action || '').toUpperCase().includes('ARCHIVE');

                        return (
                          <div key={log.id} className="p-3.5 bg-white hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                isLogin ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' :
                                isPayment ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                isRenew ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {isLogin ? <UserCheck className="w-4 h-4 text-emerald-600" /> : isPayment ? '₹' : isRenew ? '↻' : '✎'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900">
                                    {isLogin && log.details?.clientName ? `${log.details.clientName} (${log.entity_id})` : (log.entity_id || log.entity_type)}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                    isLogin
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}>
                                    {log.action}
                                  </span>
                                  {isLogin && log.details?.status && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                      {log.details.status}
                                    </span>
                                  )}
                                </div>
                                {log.details && (
                                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                    {isLogin ? (
                                      <>
                                        {log.details.device && (
                                          <span className="text-slate-600">
                                            Device: <strong className="text-slate-800">{log.details.device}</strong>
                                          </span>
                                        )}
                                        {log.details.browser && (
                                          <span className="text-slate-500">
                                            ({log.details.browser})
                                          </span>
                                        )}
                                        {log.details.authMethod && (
                                          <span className="text-slate-400">
                                            via {log.details.authMethod}
                                          </span>
                                        )}
                                        {log.details.businessName && (
                                          <span className="text-slate-400">
                                            • {log.details.businessName}
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        {log.details.amount && <span className="font-bold text-emerald-600 mr-2">{log.details.amount}</span>}
                                        {log.details.week && <span className="mr-2">Week: {log.details.week}</span>}
                                        {log.details.reason && <span>Reason: {log.details.reason}</span>}
                                        {log.details.disbursed && <span>Principal: {log.details.disbursed}</span>}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[11px] text-slate-400 font-mono block">
                                {new Date(log.created_at).toLocaleString('en-GB')}
                              </span>
                              {isLogin && (
                                <span className="text-[10px] text-emerald-600 font-semibold">
                                  Operator Login
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Tenant Database Scoped Operations
              </span>
              <button
                onClick={() => setViewingTenant(null)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL: Edit Tenant Details & Credentials */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Tenant Profile & Credentials</h3>
                  <p className="text-[11px] text-slate-500">Update operator information, password, and database routing</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTenant(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveEditTenant} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Client Name *</label>
                    <input
                      type="text"
                      value={editForm.clientName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, clientName: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Business / Route Title</label>
                    <input
                      type="text"
                      value={editForm.businessName}
                      onChange={(e) => setEditForm(prev => ({ ...prev, businessName: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Authorized Email *</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Password Edit with Show / Hide Toggle */}
                <div className="bg-blue-50/50 border border-blue-200/60 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-blue-900 font-bold">
                      Login Password <span className="text-[11px] font-normal text-slate-500">(Displayed in detail)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      {showEditPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showEditPassword ? 'Hide Password' : 'Show Password'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showEditPassword ? 'text' : 'password'}
                      value={editForm.password}
                      onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                      required
                      placeholder="Enter new or existing password"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <p className="text-[10.5px] text-slate-500">
                    You can view or update the tenant's login password here.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Account Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="active">Active (Full Access)</option>
                    <option value="suspended">Suspended (Access Blocked)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Dedicated Tenant Supabase URL</label>
                  <input
                    type="url"
                    value={editForm.tenantDbUrl}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tenantDbUrl: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
                    placeholder="https://xyz.supabase.co"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tenant Publishable / Anon Key</label>
                  <input
                    type="text"
                    value={editForm.tenantAnonKey}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tenantAnonKey: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-500"
                    placeholder="sb_publishable_..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL: Add New Tenant DB */}
      {isAddTenantModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Provision New Tenant DB</h3>
                  <p className="text-[11px] text-slate-500">Register operator with dedicated Supabase instance</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddTenantModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Client / Operator Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Sunday Kovuru"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Business Title</label>
                <input
                  type="text"
                  placeholder="FinRoute Collect - Sunday Ledger"
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Authorized Email *</label>
                  <input
                    type="email"
                    placeholder="operator@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Password *</label>
                  <input
                    type="text"
                    placeholder="SecretPass@123"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Dedicated Tenant Supabase URL *</label>
                <input
                  type="url"
                  placeholder="https://xyz.supabase.co"
                  value={newDbUrl}
                  onChange={(e) => setNewDbUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tenant Publishable / Anon Key *</label>
                <input
                  type="text"
                  placeholder="sb_publishable_..."
                  value={newAnonKey}
                  onChange={(e) => setNewAnonKey(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddTenantModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreating ? 'Provisioning...' : 'Provision Tenant'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL: Add New System Administrator */}
      {isAddAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Add Administrator</h3>
                  <p className="text-xs text-slate-500">Create access for an authorized team member in Supabase Auth</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddAdminModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4 text-xs">
              {addAdminError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addAdminError}</span>
                </div>
              )}

              {addAdminSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{addAdminSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newAdminForm.name}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Admin Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@finroute.com"
                  value={newAdminForm.email}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Initial Password *</label>
                <div className="relative">
                  <input
                    type={showNewAdminPassword ? 'text' : 'password'}
                    placeholder="Set secure admin password"
                    value={newAdminForm.password}
                    onChange={(e) => setNewAdminForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewAdminPassword(!showNewAdminPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Administrative Role *</label>
                <select
                  value={newAdminForm.role}
                  onChange={(e) => setNewAdminForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="superadmin">Super-Admin (Full Registry & DB Access)</option>
                  <option value="admin">Operations Admin (Tenant Management)</option>
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Super-Admins have full authority to create other administrators and provision tenant databases.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddAdminModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingAdmin}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isCreatingAdmin ? 'Creating...' : 'Create Administrator'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
