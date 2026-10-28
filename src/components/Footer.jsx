import React from 'react';
import { ExternalLink, ShieldCheck, Heart } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-white border-t border-slate-200 text-slate-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-100">
          {/* Brand Info */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <a
              href="https://fin-route.site/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block hover:opacity-90 transition-opacity"
              title="FinRoute Official Website"
            >
              <img
                src="/finroute_logo.png"
                alt="FinRoute Logo"
                className="h-7 w-auto object-contain"
              />
            </a>
            <div className="h-5 w-[1px] bg-slate-200 hidden sm:block" />
            <div>
              <p className="font-bold text-slate-800 text-sm">FinRoute Collect</p>
              <p className="text-[11px] text-slate-500">
                A FinRoute Microfinance Product • Sunday Collections & Ledger System
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">
            <a
              href="https://fin-route.site/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 inline-flex items-center gap-1 transition-colors"
            >
              <span>Main Website</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <a
              href="https://fin-route.site/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              Privacy Policy
            </a>

            <a
              href="https://fin-route.site/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              Terms of Service
            </a>

            <a
              href="https://fin-route.site/platform-policies"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 transition-colors"
            >
              Platform Policies
            </a>

            <a
              href="https://fin-route.site/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-600 inline-flex items-center gap-1 transition-colors"
            >
              <span>Contact Us</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </nav>
        </div>

        {/* Bottom Attribution Bar */}
        <div className="pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-slate-600">
          <p>
            © {currentYear} <a href="https://fin-route.site/" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-700 hover:text-blue-600">FinRoute</a>. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Encrypted Microfinance Platform</span>
            </span>
            <span className="text-slate-400">•</span>
            <span>Mani Official Ledger Edition</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
