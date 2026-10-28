import React from 'react';
import { formatDecimalINR } from '../utils/formatters';
import { RotateCcw, Trash2 } from 'lucide-react';

export default function ArchiveTable({ archive = [], onRestore, onDeleteArchived }) {
  if (archive.length === 0) {
    return (
      <main className="flex-1 mx-4 sm:mx-6 mb-6 bg-white border border-slate-200 rounded-xl p-12 text-center shadow-xs">
        <div className="text-4xl mb-3">📦</div>
        <h3 className="text-base font-bold text-slate-800">No Loans Archived Yet</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          When you complete a collection cycle or delete a customer, the records and reasons will be safely preserved here.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 mx-4 sm:mx-6 mb-6 bg-white border border-[#CBD5E1] rounded-xl overflow-auto max-h-[calc(100vh-120px)] min-h-[420px] shadow-sm custom-scrollbar">
      <table className="w-full border-collapse text-xs text-[#0F172A]">
        <thead className="bg-[#F1F5F9] font-bold sticky top-0 z-20 border-b-2 border-[#CBD5E1] text-[#0F172A]">
          <tr>
            <th className="px-3 py-2.5 text-center w-[50px] border-r border-[#CBD5E1]">#</th>
            <th className="px-3 py-2.5 text-left border-r border-[#CBD5E1] w-[100px]">Date Archived</th>
            <th className="px-3 py-2.5 text-left border-r border-[#CBD5E1] w-[100px]">Customer ID</th>
            <th className="px-3 py-2.5 text-left border-r border-[#CBD5E1] min-w-[140px]">Customer Name</th>
            <th className="px-3 py-2.5 text-left border-r border-[#CBD5E1] min-w-[120px]">Village Name</th>
            <th className="px-3 py-2.5 text-right border-r border-[#CBD5E1] w-[110px]">Payable Amount (₹)</th>
            <th className="px-3 py-2.5 text-right border-r border-[#CBD5E1] w-[110px]">Total Repaid (₹)</th>
            <th className="px-3 py-2.5 text-right border-r border-[#CBD5E1] w-[110px]">Final Balance (₹)</th>
            <th className="px-3 py-2.5 text-center border-r border-[#CBD5E1] w-[100px]">Status</th>
            <th className="px-3 py-2.5 text-left border-r border-[#CBD5E1] min-w-[160px]">Reason / Notes</th>
            <th className="px-3 py-2.5 text-center w-[150px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {archive.map((item, idx) => {
            const isEven = idx % 2 === 1;
            const isDeleted = item.status === 'Deleted';
            const isActive = item.status === 'Active';
            return (
              <tr
                key={item.id || idx}
                className={`${isEven ? 'bg-[#FAFAFA]' : 'bg-[#FFFFFF]'} hover:bg-[#F1F5F9] transition-colors border-b border-[#E2E8F0]`}
              >
                <td className="px-3 py-2 text-center text-[#475569] font-medium border-r border-[#E2E8F0]">{idx + 1}</td>
                <td className="px-3 py-2 text-[#475569] font-medium border-r border-[#E2E8F0]">{item.dateArchived || '-'}</td>
                <td className="px-3 py-2 text-[#475569] font-mono text-xs border-r border-[#E2E8F0]">{item.originalId || item.id}</td>
                <td className="px-3 py-2 font-telugu text-sm font-semibold text-[#0F172A] border-r border-[#CBD5E1]">{item.name}</td>
                <td className="px-3 py-2 text-[#1E3A8A] font-medium border-r border-[#E2E8F0]">
                  {item.villageName ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-semibold border border-indigo-100">
                      📍 {item.villageName}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">General</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-[#0F172A] border-r border-[#E2E8F0]">{formatDecimalINR(item.disbursed)}</td>
                <td className="px-3 py-2 text-right font-bold text-[#16A34A] border-r border-[#E2E8F0] bg-[rgba(240,253,244,0.4)]">{formatDecimalINR(item.totalRepaid || item.totalPaid)}</td>
                <td className="px-3 py-2 text-right font-bold text-[#DC2626] border-r border-[#E2E8F0] bg-[rgba(254,242,242,0.4)]">{formatDecimalINR(item.finalBalance || item.balance)}</td>
                <td className="px-3 py-2 text-center border-r border-[#E2E8F0]">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                      isDeleted
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : isActive
                          ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                          : 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]'
                    }`}
                  >
                    {item.status || 'Paid Off'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700 border-r border-[#E2E8F0]">
                  {item.reason ? (
                    <span className="text-xs font-medium text-slate-800">{item.reason}</span>
                  ) : (
                    <span className="text-slate-400 italic">{isDeleted ? 'Customer deleted' : 'Loan cycle renewed'}</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onRestore(item.id || item.originalId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      title="Restore customer back to active tracker"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                    {onDeleteArchived && (
                      <button
                        type="button"
                        onClick={() => onDeleteArchived(item.id || item.originalId, item.name)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-red-50 border border-red-200 text-red-600 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title="Permanently remove from archive"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
