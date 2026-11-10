import React, { useState, useMemo } from 'react';
import {
  Activity,
  RefreshCw,
  Zap,
  Trash2,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Database,
  Server,
  Clock,
  ExternalLink,
  ShieldCheck,
  Radio
} from 'lucide-react';

export default function SuperAdminHealthLogs({
  healthLogs = [],
  isLoadingHealthLogs = false,
  loadHealthLogs,
  handleClearHealthLogs,
  handlePingAllDatabases,
  isPingingAll = false,
  pingReport = null,
  tenantsCount = 0
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'online' | 'issue' | 'master'

  // Filter logs based on search and status
  const filteredLogs = useMemo(() => {
    return healthLogs.filter((log) => {
      // 1. Status Filter
      if (statusFilter === 'online') {
        if (log.status !== 'online') return false;
      } else if (statusFilter === 'issue') {
        if (log.status === 'online') return false;
      } else if (statusFilter === 'master') {
        if (log.target_scope !== 'master_db' && log.tenant_name !== 'Master Database') return false;
      }

      // 2. Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (log.tenant_name || '').toLowerCase();
      const email = (log.tenant_email || '').toLowerCase();
      const url = (log.database_url || log.db_url || '').toLowerCase();
      const status = (log.status || '').toLowerCase();
      const msg = (log.error_message || log.message || log.details || '').toLowerCase();

      return (
        name.includes(q) ||
        email.includes(q) ||
        url.includes(q) ||
        status.includes(q) ||
        msg.includes(q)
      );
    });
  }, [healthLogs, statusFilter, searchQuery]);

  // Compute metrics from current logs
  const metrics = useMemo(() => {
    const total = healthLogs.length;
    const onlineCount = healthLogs.filter((l) => l.status === 'online').length;
    const issueCount = healthLogs.filter((l) => l.status !== 'online').length;

    // Latest master ping
    const latestMaster = healthLogs.find(
      (l) => l.target_scope === 'master_db' || l.tenant_name === 'Master Database'
    );

    // Average latency for online logs
    const onlineLogs = healthLogs.filter((l) => l.status === 'online' && typeof l.latency_ms === 'number');
    const avgLatency =
      onlineLogs.length > 0
        ? Math.round(onlineLogs.reduce((acc, cur) => acc + cur.latency_ms, 0) / onlineLogs.length)
        : null;

    return { total, onlineCount, issueCount, latestMaster, avgLatency };
  }, [healthLogs]);

  return (
    <div className="space-y-6">
      {/* 1. KPI Health Deck */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Master DB Status */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Master DB Heartbeat</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-xl font-black text-slate-900">
                {metrics.latestMaster?.status === 'online' ? 'Active & Online' : 'Active'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics.latestMaster?.latency_ms
                ? `Latency: ${metrics.latestMaster.latency_ms}ms · Central Router`
                : 'Central Router (ubhwoicsjmxslggltvaa)'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        {/* Total Heartbeat Logs */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Health Logs</p>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{metrics.total}</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {tenantsCount > 0 ? `Across ${tenantsCount} configured tenants` : 'Historical keep-alive records'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Healthy / Responsive */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Healthy / Online</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-0.5">{metrics.onlineCount}</h3>
            <p className="text-[11px] text-emerald-600/80 mt-1 font-medium">
              {metrics.avgLatency ? `Avg response: ${metrics.avgLatency}ms` : 'Responding within timeout'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Sleeping / Warning / Issues */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sleeping / Degraded</p>
            <h3 className={`text-2xl font-black mt-0.5 ${metrics.issueCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {metrics.issueCount}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics.issueCount > 0 ? 'Woken on ping or unreachable' : 'All monitored instances green'}
            </p>
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${
            metrics.issueCount > 0
              ? 'bg-amber-50 border border-amber-200 text-amber-600'
              : 'bg-slate-50 border border-slate-200 text-slate-400'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Ping Banner Report (when ping all finishes) */}
      {pingReport && (
        <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
          pingReport.success
            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
            : 'bg-amber-50/90 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-lg bg-white/80 shadow-2xs mt-0.5">
              <Zap className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-xs font-bold">{pingReport.message}</h4>
              <p className="text-[11px] opacity-80 mt-0.5">
                Timestamp: {new Date(pingReport.timestamp).toLocaleTimeString()} · Total Pings: {pingReport.pings?.length || 0}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Toolbar & Controls */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Search input */}
        <div className="flex-1 max-w-md relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search logs by tenant, email, Supabase host or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Center: Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Logs ({healthLogs.length})
          </button>
          <button
            onClick={() => setStatusFilter('online')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'online'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Online ({metrics.onlineCount})
          </button>
          <button
            onClick={() => setStatusFilter('issue')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'issue'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Issues ({metrics.issueCount})
          </button>
          <button
            onClick={() => setStatusFilter('master')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'master'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
            }`}
          >
            Master Only
          </button>
        </div>

        {/* Right: Actions (Ping & Wake All, Refresh, Clear) */}
        <div className="flex items-center gap-2">
          {/* Ping & Wake All Button */}
          <button
            onClick={handlePingAllDatabases}
            disabled={isPingingAll}
            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Send keep-alive heartbeats to Master DB and all tenant databases"
          >
            <Zap className={`w-3.5 h-3.5 ${isPingingAll ? 'animate-spin' : ''}`} />
            <span>{isPingingAll ? 'Pinging Databases...' : 'Ping & Wake All DBs'}</span>
          </button>

          {/* Refresh Logs Button */}
          <button
            onClick={loadHealthLogs}
            disabled={isLoadingHealthLogs}
            className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            title="Refresh Health Logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealthLogs ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Clear Logs Button */}
          {healthLogs.length > 0 && (
            <button
              onClick={handleClearHealthLogs}
              className="p-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors cursor-pointer"
              title="Clear all recorded health logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Health Logs Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10.5px]">
                <th className="px-4 py-3 w-12 text-center">#</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Target / Scope</th>
                <th className="px-4 py-3">Database Host</th>
                <th className="px-4 py-3 text-center">Health Status</th>
                <th className="px-4 py-3 text-center">Latency</th>
                <th className="px-4 py-3">Response & Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {isLoadingHealthLogs ? (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <p className="font-semibold text-slate-600">Loading Keep-Alive & Health Logs...</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Connecting to Master Database health records</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-16 text-center text-slate-400">
                    <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">No health logs found</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                      Click <strong className="text-emerald-700">"Ping & Wake All DBs"</strong> above or trigger the GitHub Actions workflow to record heartbeats.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const isMaster = log.target_scope === 'master_db' || log.tenant_name === 'Master Database';
                  const isOnline = log.status === 'online';
                  const isSleeping = log.status === 'sleeping';
                  const isUnconfigured = log.status === 'unconfigured';
                  const isError = !isOnline && !isSleeping && !isUnconfigured;

                  // Parse hostname safely
                  const targetUrl = log.database_url || log.db_url || '';
                  let hostname = '-';
                  if (targetUrl) {
                    try {
                      hostname = new URL(targetUrl).hostname;
                    } catch {
                      hostname = targetUrl;
                    }
                  }

                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* 1. Index */}
                      <td className="px-4 py-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* 2. Timestamp */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {log.created_at
                              ? new Date(log.created_at).toLocaleString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })
                              : 'Just now'}
                          </span>
                        </div>
                      </td>

                      {/* 3. Target Scope / Tenant */}
                      <td className="px-4 py-3.5">
                        {isMaster ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                              M
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>Master Database</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700">
                                  Registry
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono">Central Router</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {(log.tenant_name || 'T').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">
                                {log.tenant_name || 'Tenant Database'}
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono">
                                {log.tenant_email || 'No email associated'}
                              </p>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 4. DB Host */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 text-slate-600 font-mono text-[11px]">
                          <Database className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={targetUrl}>
                            {hostname}
                          </span>
                        </div>
                      </td>

                      {/* 5. Health Status Badge */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Online · 200 OK</span>
                          </span>
                        ) : isSleeping ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Sleeping (Waking)</span>
                          </span>
                        ) : isUnconfigured ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <span>Unconfigured</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3 text-rose-500" />
                            <span>Error · {log.status}</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Latency */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {typeof log.latency_ms === 'number' ? (
                          <span
                            className={`inline-block font-mono text-[11px] px-2 py-0.5 rounded-md font-bold ${
                              log.latency_ms < 300
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : log.latency_ms < 800
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {log.latency_ms} ms
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* 7. Message / Details */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`text-[11px] line-clamp-1 ${
                            isError ? 'text-rose-600 font-medium' : 'text-slate-500'
                          }`}
                          title={log.message || log.details || '-'}
                        >
                          {log.message || log.details || (isOnline ? 'Heartbeat ping successful' : '-')}
                        </span>
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
  );
}
