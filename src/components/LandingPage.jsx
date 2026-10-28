import React from 'react';
import {
  Shield,
  Zap,
  Database,
  Lock,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  Smartphone,
  BarChart3,
  Check,
  ExternalLink,
  Layers,
  FileText,
  RefreshCw,
  Sparkles,
  Clock,
  ChevronRight,
  TrendingUp,
  Server,
  Key
} from 'lucide-react';

export default function LandingPage({ onOpenLogin, onOpenAdmin }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 1. Header Bar */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
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
                className="h-8 sm:h-9 w-auto object-contain"
              />
            </a>
            <div className="h-5 w-[1px] bg-slate-200 hidden sm:block shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base text-slate-900 tracking-tight">FinRoute</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Collect 2.0
              </span>
            </div>
          </div>

          {/* Navigation Links & Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>PostgreSQL Master Online</span>
            </div>

            <button
              onClick={onOpenLogin}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-blue-500/20"
            >
              <span>Partner Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-20 overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-6 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Dedicated Isolated Supabase Databases • Sub-50ms ACID Latency</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-tight sm:leading-none">
            High-Performance Weekly <br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 bg-clip-text text-transparent">
              Microfinance & Route Ledger
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-sm sm:text-base lg:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
            Engineered specifically for village-wise microfinance routes. Complete tenant data isolation on private PostgreSQL databases, bilingual Telugu & English customer management, automated rolling cash settlement, and bank-grade PDF reports.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={onOpenLogin}
              className="px-6 py-3 text-sm font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <span>Open Collection Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-3 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              Explore Capabilities
            </button>
          </div>

          {/* Quick Pillars */}
          <div className="mt-10 pt-6 border-t border-slate-200/60 flex flex-wrap justify-center items-center gap-5 sm:gap-8 text-xs text-slate-600 font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% Dedicated Private Databases</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Native Telugu Script & Dual Loan Cycles</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Automated 8-Point Cash Reconciliation</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Zero 20k Spreadsheet Row Caps</span>
            </span>
          </div>
        </div>
      </section>

      {/* 3. Interactive Route Ledger Showcase (Mockup) */}
      <section className="py-12 bg-slate-100/60 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
              Live Product Experience
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              Intuitive, Lightning-Fast Field Ledger UI
            </h2>
          </div>

          {/* Mock Window Container */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden">
            {/* Window Title Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-bold text-slate-700">
                  FinRoute Collect — Route 1 (Sunday Ledger)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> PostgreSQL Live Sync
                </span>
              </div>
            </div>

            {/* KPI Deck Mockup */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-slate-50/50 border-b border-slate-200/80">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Original Amount</span>
                <div className="text-base font-black text-slate-900 mt-0.5">₹8,45,000</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-indigo-600 uppercase">Total Payable</span>
                <div className="text-base font-black text-indigo-700 mt-0.5">₹9,30,000</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Collected</span>
                <div className="text-base font-black text-emerald-700 mt-0.5">₹6,20,000</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Remaining Balance</span>
                <div className="text-base font-black text-amber-700 mt-0.5">₹3,10,000</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-200 bg-blue-50/30 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-blue-700 uppercase">Rolling Net Cash</span>
                <div className="text-base font-black text-blue-900 mt-0.5">₹48,500</div>
              </div>
            </div>

            {/* Ledger Table Mockup */}
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-3 py-2 w-12 text-center">#</th>
                    <th className="px-3 py-2">Customer (Telugu & English)</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2 text-right">Payable</th>
                    <th className="px-3 py-2 text-center">W1 (01/10)</th>
                    <th className="px-3 py-2 text-center">W2 (08/10)</th>
                    <th className="px-3 py-2 text-center">W3 (15/10)</th>
                    <th className="px-3 py-2 text-center">W4 (22/10)</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {/* Village / Route Divider */}
                  <tr className="bg-blue-50/70 border-y border-blue-100 font-bold text-blue-900">
                    <td colSpan="10" className="px-4 py-2">
                      📍 ROUTE 1 (రూట్ 1) — Field Collections
                    </td>
                  </tr>

                  {/* Customer Row 1 */}
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center text-slate-400 font-mono">1</td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">శ్రీను</div>
                      <div className="text-[10px] text-slate-500 font-mono">CUST-1 • Srinu</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">9848022338</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">₹10,000</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                        ₹1,000 ✓
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                        ₹1,000 ✓
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                        ₹1,000 ✓
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 font-mono text-[10px]">
                        -
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-600 font-mono">₹7,000</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    </td>
                  </tr>

                  {/* Customer Row 2 */}
                  <tr className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-center text-slate-400 font-mono">2</td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900">శ్రీను</div>
                      <div className="text-[10px] text-slate-500 font-mono">CUST-2 • Srinu</div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">9988776655</td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900">₹15,000</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                        ₹1,500 ✓
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                        ₹1,500 ✓
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                        ₹1,500 ✓
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                        ₹1,500 ✓
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700 font-mono">₹0</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Paid Off
                      </span>
                    </td>
                  </tr>

                  {/* Cash Settlement Summary Row */}
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-900">
                    <td colSpan="4" className="px-3 py-2 text-right">
                      Weekly Collections Total:
                    </td>
                    <td className="px-3 py-2 text-center text-emerald-700 font-mono">₹2,500</td>
                    <td className="px-3 py-2 text-center text-emerald-700 font-mono">₹2,500</td>
                    <td className="px-3 py-2 text-center text-emerald-700 font-mono">₹2,500</td>
                    <td className="px-3 py-2 text-center text-emerald-700 font-mono">₹1,500</td>
                    <td colSpan="2" className="px-3 py-2 text-right text-blue-700 font-mono">
                      Net: ₹9,000
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Bar */}
            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Auto-saved securely to PostgreSQL
              </span>
              <a
                href="https://wa.me/918978388567?text=Hello!%20I%20am%20interested%20in%20FinRoute%20Collect.%20I%20would%20like%20to%20launch%20the%20live%20system%20for%20our%20collection%20routes."
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Contact via WhatsApp (+91 8978388567) to Launch Live System"
              >
                <span>Launch Live System</span>
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Feature Highlights */}
      <section id="features" className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full uppercase tracking-wider">
              Engineered for Scale
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              Why Route Finance Operators Choose FinRoute
            </h2>
            <p className="mt-3 text-slate-600 text-sm">
              Replace fragile spreadsheets with robust PostgreSQL isolation, real-time concurrency, and audit logs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Dedicated Isolated Databases</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Each operator gets a private, dedicated PostgreSQL Supabase instance. Zero shared rows, isolated tables, and complete data sovereignty.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 hover:border-emerald-300 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Telugu & Bilingual Records</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                First-class UTF-8 Telugu support. Search, filter, and export customer names, village routes, and notes without encoding glitches.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 hover:border-indigo-300 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Automated Cash Settlement</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                8-point financial reconciliation accounts for opening cash, collections, bank transfers, field expenses, and staff salaries.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 hover:border-purple-300 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Cycle 2 Renewals & Archive</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Seamless customer renewal retains complete cycle 1 payment history with strikethrough styling while resetting new cycle balances.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 hover:border-amber-300 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Server className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Zero Concurrency Locks</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                PostgreSQL ACID row-level locking ensures route officers can update payments simultaneously without overwriting data or cell quotas.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 hover:border-rose-300 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Super-Admin Console</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Centralized registry to provision new tenant databases, monitor latency, audit activity logs, and manage tenant credentials.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Bottom Call to Action */}
      <section className="py-14 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-black">
            Ready to Upgrade Your Route Collection Operations?
          </h2>
          <p className="mt-3 text-sm text-blue-100 max-w-2xl mx-auto">
            Experience the speed, reliability, and security of private database microfinance software built specifically for field teams.
          </p>

          <div className="mt-8 flex flex-wrap justify-center items-center gap-4">
            <button
              onClick={onOpenLogin}
              className="px-6 py-3 bg-white text-blue-800 hover:bg-blue-50 font-extrabold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Partner Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="mt-auto border-t border-slate-200 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/finroute_logo.png"
              alt="FinRoute Logo"
              className="h-6 w-auto object-contain opacity-80"
            />
            <span className="font-bold text-slate-700">FinRoute Collect</span>
            <span>• Microfinance & Weekly Route Ledger</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={onOpenLogin}
              className="text-slate-600 hover:text-blue-600 font-semibold cursor-pointer"
            >
              Partner Login
            </button>
            <span>•</span>
            <button
              onClick={onOpenAdmin}
              className="text-slate-400 hover:text-slate-700 font-mono text-[11px] transition-colors cursor-pointer"
              title="FinRoute Administrator Gateway"
            >
              finroute-collector
            </button>
            <span>•</span>
            <span>© {new Date().getFullYear()} FinRoute. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
