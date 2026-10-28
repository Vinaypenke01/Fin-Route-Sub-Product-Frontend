import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  RefreshCw,
  Sparkles,
  Link2,
  Layers,
  Check
} from 'lucide-react';
import { resolveTenantFromMaster, pullAllFromCloud } from '../services/cloudService';
import { migrateSheetDataToTenantDb } from '../services/tenantDatabaseService';
import { initialData } from '../initialData';

export default function ImportSheetModal({
  isOpen,
  onClose,
  auth,
  tenantClient,
  currentSheetUrl = '',
  currentRecordsCount = 0,
  onImportSuccess
}) {
  const [activeTab, setActiveTab] = useState('auto'); // 'auto' | 'custom' | 'starter'
  const [customUrl, setCustomUrl] = useState(currentSheetUrl || '');
  const [cleanOverwrite, setCleanOverwrite] = useState(true);

  // Migration status
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState('idle'); // 'idle' | 'fetching' | 'normalizing' | 'saving' | 'done'
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [summary, setSummary] = useState(null);

  if (!isOpen) return null;

  const handleStartImport = async () => {
    if (!tenantClient) {
      setErrorMessage('Tenant Supabase database client is not connected.');
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setSummary(null);

    try {
      let rawData = null;

      if (activeTab === 'auto') {
        setImportStep('fetching');
        setStatusMessage('Connecting to MasterAuth to locate your linked Google Sheet...');

        const masterRes = await resolveTenantFromMaster(auth?.email, auth?.password);
        const resolvedUrl = masterRes?.sheetUrl || currentSheetUrl;

        if (!resolvedUrl || !resolvedUrl.includes('/exec')) {
          throw new Error(
            masterRes?.message ||
            'Could not find a linked Google Sheet URL for your account. Please use the "Custom URL" tab or "Full Route Starter" tab.'
          );
        }

        setStatusMessage('Pulling all active customer records, village routes, and weekly payments from Google Sheets...');
        const pullRes = await pullAllFromCloud(auth, resolvedUrl);

        if (!pullRes || !pullRes.data) {
          throw new Error('Google Sheet returned no data or timed out. Please check script permissions.');
        }
        rawData = pullRes.data;
      } else if (activeTab === 'custom') {
        if (!customUrl.trim() || !customUrl.includes('/exec')) {
          throw new Error('Please enter a valid Google Script Web App URL ending with /exec.');
        }

        setImportStep('fetching');
        setStatusMessage('Pulling records from custom Google Sheet URL...');
        const pullRes = await pullAllFromCloud(auth, customUrl.trim());

        if (!pullRes || !pullRes.data) {
          throw new Error('Failed to pull data from the specified URL.');
        }
        rawData = pullRes.data;
      } else if (activeTab === 'starter') {
        setImportStep('fetching');
        setStatusMessage('Loading verified full Kovuru route dataset (100+ customers & villages)...');
        rawData = initialData;
      }

      setImportStep('normalizing');
      setStatusMessage('Validating and normalizing Telugu script customer names, amounts & dates...');

      const weeks = Array.isArray(rawData.weeks) && rawData.weeks.length > 0 ? rawData.weeks : [];
      const customers = Array.isArray(rawData.customers) ? rawData.customers : [];
      const recon = rawData.weeklyReconciliation || {};
      const archive = Array.isArray(rawData.archive) ? rawData.archive : [];

      if (customers.length === 0) {
        throw new Error('0 customer records were found in the source sheet.');
      }

      setImportStep('saving');
      setStatusMessage(`Writing ${customers.length} customers and payment history into your private Supabase database...`);

      const res = await migrateSheetDataToTenantDb(tenantClient, {
        weeks,
        customers,
        weeklyReconciliation: recon,
        archive,
        overwrite: cleanOverwrite
      });

      if (!res?.success) {
        throw new Error(res?.message || 'Database migration failed.');
      }

      setImportStep('done');
      setStatusMessage('Import successfully completed!');
      const summaryData = {
        customersCount: customers.length,
        weeksCount: weeks.length,
        archiveCount: archive.length
      };
      setSummary(summaryData);

      if (onImportSuccess) {
        onImportSuccess({ weeks, customers, weeklyReconciliation: recon, archive });
      }
    } catch (err) {
      console.error('Import error:', err);
      setErrorMessage(err.message || 'Import failed. Please try again or use the full starter dataset.');
      setImportStep('idle');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !isImporting) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] overflow-y-auto font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Import from Google Sheets to Supabase</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Migrate legacy spreadsheet records into your dedicated private PostgreSQL database
              </p>
            </div>
          </div>
          {!isImporting && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Target Database Status Pill */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="truncate max-w-[280px] sm:max-w-sm">
              <span className="text-[11px] text-slate-400 block font-medium">Target Supabase Database:</span>
              <span className="font-mono text-[11px] font-bold text-slate-800 truncate block">
                {auth?.tenantDbUrl || 'Dedicated Tenant DB'}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            {currentRecordsCount} Records Currently
          </span>
        </div>

        {/* Source Selection Tabs */}
        <div className="mt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('auto')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                activeTab === 'auto'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'hover:text-slate-900'
              }`}
            >
              Auto Linked Sheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'hover:text-slate-900'
              }`}
            >
              Custom Sheet URL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('starter')}
              className={`py-2 px-2 rounded-lg transition-all text-center cursor-pointer ${
                activeTab === 'starter'
                  ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                  : 'hover:text-slate-900'
              }`}
            >
              Full Route (100+)
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="mt-4 space-y-3 text-xs">
          {activeTab === 'auto' && (
            <div className="p-3.5 bg-blue-50/50 border border-blue-200/60 rounded-xl space-y-1.5">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Auto-Detect via MasterAuth Gateway
              </span>
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                Connects directly to the Google Sheet associated with your registered account (<strong className="text-slate-800">{auth?.email}</strong>), pulls all customer balances, Telugu names, and week columns, then writes them directly to PostgreSQL.
              </p>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Google Apps Script Web App URL (/exec) *
              </label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-[10.5px] text-slate-500">
                Paste the deployment URL of your Google Sheets Web App ending with <code className="text-blue-600">/exec</code>.
              </p>
            </div>
          )}

          {activeTab === 'starter' && (
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1.5">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600" /> Full Sunday Kovuru Dataset (100+ Customers)
              </span>
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                Directly imports the verified complete route dataset for Sunday Kovuru including all village dividers (J.Annavaram, Kovuru, etc.), dual loan amounts (original + current), past payments, and rolling reconciliation. Ideal if Google Sheet is currently locked or rate-limited.
              </p>
            </div>
          )}

          {/* Overwrite Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cleanOverwrite}
                onChange={(e) => setCleanOverwrite(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
              />
              <div>
                <span className="font-bold text-slate-800 text-xs">Clean Overwrite (Recommended)</span>
                <p className="text-[11px] text-slate-500">
                  Cleans out placeholder or test customer rows in Supabase before importing to prevent duplicates.
                </p>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Live Progress Box */}
          {isImporting && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-blue-800 font-bold text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-300 animate-pulse"
                  style={{
                    width:
                      importStep === 'fetching' ? '30%' :
                      importStep === 'normalizing' ? '60%' :
                      importStep === 'saving' ? '85%' : '100%'
                  }}
                />
              </div>
            </div>
          )}

          {/* Success Summary */}
          {importStep === 'done' && summary && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-900">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Migration Completed Successfully!</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 font-semibold text-center text-xs">
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200">
                  <div className="text-base font-extrabold text-emerald-700">{summary.customersCount}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Customers</div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200">
                  <div className="text-base font-extrabold text-emerald-700">{summary.weeksCount}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Weeks</div>
                </div>
                <div className="bg-white/80 p-2 rounded-lg border border-emerald-200">
                  <div className="text-base font-extrabold text-emerald-700">{summary.archiveCount}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Archived</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 text-xs">
          {importStep === 'done' ? (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Done (View Ledger)</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartImport}
                disabled={isImporting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Start Import to Supabase</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
