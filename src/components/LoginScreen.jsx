import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { authenticateTenant } from '../services/masterAuthService';

export default function LoginScreen({ onLoginSuccess, onBackToLanding }) {
  const masterSupabaseUrl = (import.meta.env.VITE_MASTER_SUPABASE_URL || '').trim();
  // Never pre-fill email: user must type their own registered email
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Validate fields helper
  const validateForm = () => {
    const errors = {};
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPw = password.trim();

    if (!trimmedEmail) {
      errors.email = 'Authorized email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email format (e.g. name@domain.com).';
    }

    if (!trimmedPw) {
      errors.password = 'Access password is required.';
    } else if (trimmedPw.length < 4) {
      errors.password = 'Password must be at least 4 characters.';
    }

    if (!consentGiven) {
      errors.consent = 'You must accept the Terms & Privacy Policy to sign in.';
    }

    setFieldErrors(errors);
    return { isValid: Object.keys(errors).length === 0, trimmedEmail, trimmedPw };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const { isValid, trimmedEmail, trimmedPw } = validateForm();
    if (!isValid) {
      setErrorMsg('Please complete all required fields correctly before signing in.');
      return;
    }

    if (!masterSupabaseUrl) {
      setErrorMsg('Sign-in service is not configured. Please contact support.');
      return;
    }

    setLoading(true);

    try {
      const res = await authenticateTenant(trimmedEmail, trimmedPw);
      if (res?.success) {
        await onLoginSuccess({
          email: trimmedEmail,
          clientName: res.clientName || 'Valued Partner',
          businessName: res.businessName,
          tenantDbUrl: res.tenantDbUrl,
          tenantAnonKey: res.tenantAnonKey,
          tenantSession: res.tenantSession || null,
          tenantAuthRequired: Boolean(res.tenantAuthRequired),
          deviceSessionManaged: Boolean(res.deviceSessionManaged),
          mustChangePassword: Boolean(res.mustChangePassword),
          expiry: res.expiresAt || null,
          rememberMe
        });
        return;
      }
      setErrorMsg(res?.message || 'Invalid email or password.');
    } catch (err) {
      console.error('Authentication error:', err);
      setErrorMsg('Network error connecting to authentication server. Please check internet access.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 max-w-md w-full p-8 transition-all animate-in fade-in zoom-in-95 duration-200">
        {onBackToLanding && (
          <button
            type="button"
            onClick={onBackToLanding}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        )}

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3 flex items-center justify-center">
            <img
              src="/finroute_logo.png"
              alt="FinRoute Logo"
              className="h-10 sm:h-11 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">FinRoute Collect</h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Sub-Product
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            A FinRoute Product • Secure Microfinance Collection Access
          </p>
        </div>

        {/* Global Error Alert Box */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Login Form with strict required validations */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Authorized Email <span className="text-red-500">*</span>
              </label>
              {fieldErrors.email && (
                <span className="text-[11px] text-red-600 font-medium">Required</span>
              )}
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
              }}
              placeholder="Enter your registered email"
              autoFocus
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 ${
                fieldErrors.email
                  ? 'border-red-400 bg-red-50/20 focus:ring-red-400 focus:border-red-500'
                  : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
              }`}
            />
            {fieldErrors.email && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{fieldErrors.email}</span>
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Access Password <span className="text-red-500">*</span>
              </label>
              {fieldErrors.password && (
                <span className="text-[11px] text-red-600 font-medium">Required</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: '' }));
                }}
                placeholder="Enter password"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 pr-10 ${
                  fieldErrors.password
                    ? 'border-red-400 bg-red-50/20 focus:ring-red-400 focus:border-red-500'
                    : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{fieldErrors.password}</span>
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span>Keep me signed in for 7 days</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgot(v => !v)}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Forgot password?
            </button>
          </div>
          {showForgot && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-[11px] text-slate-700" role="status">
              Ask your FinRoute administrator to reset it. They will give you a new password; you can then change it
              yourself from the <b>Password</b> button after signing in.
            </div>
          )}

          {/* Legal Consent Agreement */}
          <div className={`p-2.5 rounded-lg border text-xs transition-colors ${
            fieldErrors.consent
              ? 'bg-red-50/50 border-red-300'
              : 'bg-blue-50/50 border-blue-100'
          }`}>
            <label className="flex items-start gap-2.5 cursor-pointer select-none text-slate-700">
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => {
                  setConsentGiven(e.target.checked);
                  if (fieldErrors.consent) setFieldErrors(prev => ({ ...prev, consent: '' }));
                }}
                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
              />
              <span className="leading-snug text-[11px] text-slate-600">
                I accept the{' '}
                <a
                  href="https://fin-route.site/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-semibold"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="https://fin-route.site/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-semibold"
                >
                  Privacy Policy
                </a>
                , and provide explicit consent to record this session and process collection ledger data.{' '}
                <span className="text-red-500 font-bold">*</span>
              </span>
            </label>
            {fieldErrors.consent && (
              <p className="mt-1.5 text-[11px] text-red-600 flex items-center gap-1 font-medium pl-6">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{fieldErrors.consent}</span>
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md shadow-blue-500/20 disabled:opacity-60 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to Tracker</span>
              </>
            )}
          </button>
        </form>

        {/* Security Notice & FinRoute Links */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col items-center gap-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 text-slate-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encrypted Session • Private database per business</span>
          </div>
          <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
            <a href="https://fin-route.site/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">FinRoute</a>
            <span>•</span>
            <a href="https://fin-route.site/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">Privacy</a>
            <span>•</span>
            <a href="https://fin-route.site/terms" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">Terms</a>
            <span>•</span>
            <a href="https://fin-route.site/contact" target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">Contact</a>
          </div>
        </div>
      </div>
    </div>
  );
}
