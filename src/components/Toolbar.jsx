import React from 'react';
import { Table, Archive, Search } from 'lucide-react';
import { t } from '../utils/translations';

export default function Toolbar({
  activeTab,
  setActiveTab,
  activeCount,
  archiveCount,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  language = 'en'
}) {
  return (
    <section className="px-4 sm:px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
      {/* Navigation Tabs */}
      <div className="flex items-center bg-slate-200/70 p-1 rounded-xl gap-1 self-start">
        <button
          onClick={() => setActiveTab('tracker')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'tracker'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>{t('nav.tracker', language)}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'tracker' ? 'bg-blue-100 text-blue-700' : 'bg-slate-300 text-slate-700'
          }`}>
            {activeCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('archive')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'archive'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>{t('nav.archive', language)}</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'archive' ? 'bg-amber-100 text-amber-700' : 'bg-slate-300 text-slate-700'
          }`}>
            {archiveCount}
          </span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('toolbar.searchPlaceholder', language)}
            className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
        >
          <option value="all">{t('toolbar.allStatuses', language)}</option>
          <option value="active">{t('toolbar.activeOnly', language)}</option>
          <option value="paidoff">{t('toolbar.paidOffOnly', language)}</option>
        </select>
      </div>
    </section>
  );
}
