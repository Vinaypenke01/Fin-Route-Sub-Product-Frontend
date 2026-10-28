import React from 'react';
import { UserPlus, CalendarPlus, CalendarMinus, Archive, FileDown, LogOut, RefreshCw, Loader2, DownloadCloud, UploadCloud, FileSpreadsheet, Globe } from 'lucide-react';
import { t, AVAILABLE_LANGUAGES } from '../utils/translations';

export default function Header({
  cloudStatus,
  onOpenAddCustomer,
  onOpenAddVillage,
  onOpenAddWeek,
  onOpenDeleteWeek,
  onOpenArchive,
  onOpenCloudSync,
  onPullFromCloud,
  onPushToCloud,
  onDownloadPDF,
  isGeneratingPDF = false,
  onExportCSV,
  onLogout,
  clientName = '',
  isSupabaseTenant = false,
  onOpenImportSheet,
  language = 'en',
  onLanguageChange
}) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3.5 sm:px-6 shadow-xs relative z-30">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* FinRoute Brand Section */}
        <div className="flex items-center gap-3">
          <a
            href="https://fin-route.site/"
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:opacity-90 transition-opacity shrink-0"
            title="Visit FinRoute"
          >
            <img
              src="/finroute_logo.png"
              alt="FinRoute Logo"
              className="h-8 sm:h-9 w-auto object-contain"
            />
          </a>
          <div className="h-7 w-[1px] bg-slate-200 hidden sm:block shrink-0" />
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight tracking-tight">
                FinRoute Collect
              </h1>
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs select-none"
                title={
                  isSupabaseTenant
                    ? cloudStatus?.error
                      ? `Tenant Database Offline: ${cloudStatus.error}`
                      : cloudStatus?.isSyncing
                      ? 'Tenant Database Syncing...'
                      : 'Tenant DB Live & Connected'
                    : 'Local / Offline Mode'
                }
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      cloudStatus?.error
                        ? 'bg-red-400'
                        : cloudStatus?.isSyncing
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      cloudStatus?.error
                        ? 'bg-red-500'
                        : cloudStatus?.isSyncing
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                </span>
                <span>Sub-Product</span>
              </span>
              {clientName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  🏢 {clientName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
              A FinRoute Product • Sunday Collections & Ledger
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar & Language Switcher */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          {/* Language Switcher Pill */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 select-none">
            {AVAILABLE_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => onLanguageChange && onLanguageChange(l.code)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  language === l.code
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title={`Switch language to ${l.label}`}
              >
                <span className="text-xs">{l.flag}</span>
                <span>{l.native}</span>
              </button>
            ))}
          </div>

          <button
            onClick={onOpenAddCustomer}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Register a new customer loan"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('actions.addCustomer', language)}</span>
          </button>

          <button
            onClick={onOpenAddVillage}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-700 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Add an empty village separator row to group customers by village"
          >
            <span>🏡</span>
            <span>{t('actions.addVillage', language)}</span>
          </button>

          <button
            onClick={onOpenAddWeek}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Add a new weekly collection column"
          >
            <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('actions.addWeek', language)}</span>
          </button>

          <button
            onClick={onOpenDeleteWeek}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Remove the latest week column"
          >
            <CalendarMinus className="w-3.5 h-3.5 text-red-500" />
            <span>{t('actions.deleteWeek', language)}</span>
          </button>

          <button
            onClick={onOpenArchive}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 border border-amber-300 text-amber-700 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Archive past loan cycle & renew with new disbursed amount"
          >
            <Archive className="w-3.5 h-3.5 text-amber-600" />
            <span>{t('actions.archiveRenew', language)}</span>
          </button>

          {/* Supabase Tenant: Import from Google Sheet Action */}
          {isSupabaseTenant && (
            <button
              onClick={onOpenImportSheet}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
              title="Import legacy customer and payment data from Google Sheets into your private Supabase database"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('actions.importSheet', language)}</span>
            </button>
          )}

          {/* Download PDF Ledger Report */}
          <button
            onClick={onDownloadPDF}
            disabled={isGeneratingPDF}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            title="Download PDF Ledger Report in Landscape format with cash settlements"
          >
            {isGeneratingPDF ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span>{isGeneratingPDF ? (language === 'te' ? 'PDF తయారవుతోంది...' : 'Generating PDF...') : t('actions.exportPdf', language)}</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={onExportCSV}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Export complete route ledger and financial settlement to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('actions.exportCsv', language)}</span>
          </button>

          <button
            onClick={onLogout}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Sign out of collection tracker"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('nav.logout', language)}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
