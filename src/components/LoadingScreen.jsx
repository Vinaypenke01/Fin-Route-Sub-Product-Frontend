import React from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function LoadingScreen({ message = 'Initializing secure session...' }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 select-none">
      <div className="flex flex-col items-center max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-300">
        {/* Animated Brand Badge */}
        <div className="relative mb-5 flex items-center justify-center">
          <img
            src="/finroute_logo.png"
            alt="FinRoute Logo"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Title & Status */}
        <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
          FinRoute Collect
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-1">
          A FinRoute Product • Sunday Collections & Ledger
        </p>

        {/* Progress pill */}
        <div className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-semibold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
          <span>{message}</span>
        </div>

        {/* Security badge */}
        <div className="mt-8 flex items-center gap-1.5 text-[11px] text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>End-to-end encrypted storage & sync</span>
        </div>
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="flex-1 mx-3 sm:mx-6 mb-6 bg-white border border-[#CBD5E1] rounded-xl p-8 flex flex-col items-center justify-center min-h-[360px] shadow-sm">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
      <span className="text-xs font-semibold text-slate-600">Loading collection matrix...</span>
    </div>
  );
}
