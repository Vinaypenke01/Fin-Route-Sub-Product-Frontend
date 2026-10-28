import React from 'react';
import { formatINR } from '../utils/formatters';
import { t } from '../utils/translations';

export default function KpiDeck({ totalCapitalDisbursed, totalDisbursed, totalCollected, totalBalance, netCash, language = 'en' }) {
  const isNetCashNegative = netCash < 0;
  // Total Capital Disbursed represents the sum of Original Amount across all customers
  const capitalDisbursedValue = Number(totalCapitalDisbursed) || 0;
  const payableValue = Number(totalDisbursed) || 0;

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 px-4 sm:px-6 pt-4 pb-2">
      {/* 1. Original Amount (Sanctioned Capital) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs hover:-translate-y-0.5 transition-transform">
        <div className="flex items-center justify-between mb-1">
          <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {t('kpis.originalAmount', language)}
          </span>
          <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1 rounded">Capital</span>
        </div>
        <span className="text-lg sm:text-2xl font-bold text-blue-600 tracking-tight">
          {formatINR(capitalDisbursedValue)}
        </span>
      </div>

      {/* 2. Total Payable (Cycle Repayment Obligation) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs hover:-translate-y-0.5 transition-transform">
        <div className="flex items-center justify-between mb-1">
          <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {t('kpis.totalPayable', language)}
          </span>
          <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1 rounded">Cycle</span>
        </div>
        <span className="text-lg sm:text-2xl font-bold text-indigo-600 tracking-tight">
          {formatINR(payableValue)}
        </span>
      </div>

      {/* 3. Total Collections Received */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs hover:-translate-y-0.5 transition-transform">
        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          {t('kpis.totalCollected', language)}
        </span>
        <span className="text-lg sm:text-2xl font-bold text-emerald-600 tracking-tight">
          {formatINR(totalCollected)}
        </span>
      </div>

      {/* 4. Outstanding Balance */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs hover:-translate-y-0.5 transition-transform">
        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          {t('kpis.balanceDue', language)}
        </span>
        <span className="text-lg sm:text-2xl font-bold text-red-600 tracking-tight">
          {formatINR(totalBalance)}
        </span>
      </div>

      {/* 5. Today's Net Cash in Hand */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs hover:-translate-y-0.5 transition-transform col-span-2 sm:col-span-1">
        <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          {t('kpis.netCash', language)}
        </span>
        <span className={`text-lg sm:text-2xl font-bold tracking-tight ${isNetCashNegative ? 'text-red-600' : 'text-sky-600'}`}>
          {formatINR(netCash)}
        </span>
      </div>
    </section>
  );
}
