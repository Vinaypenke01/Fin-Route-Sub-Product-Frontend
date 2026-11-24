import React from 'react';
import { reportError } from '../services/errorReporter';

/**
 * Catches rendering crashes so the user sees a recovery screen instead of a
 * blank page. `variant="section"` renders a compact box inside the page so the
 * header and other parts keep working.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI crash caught by ErrorBoundary:', error, info?.componentStack);
    reportError('crash', error, info?.componentStack || '');
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = String(error?.message || error || 'Unknown error').slice(0, 300);

    if (this.props.variant === 'section') {
      return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-6" role="alert">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900">
            <h2 className="text-sm font-extrabold">This part of the screen couldn&apos;t be shown.</h2>
            <p className="text-xs mt-1">Your saved data is safe. Try again, or reload the page.</p>
            <p className="text-[11px] mt-2 font-mono text-amber-800/80 break-words">{message}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={this.handleRetry} className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold cursor-pointer hover:bg-amber-100">
                Try again
              </button>
              <button onClick={() => window.location.reload()} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold cursor-pointer hover:bg-amber-700">
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" role="alert">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-8 text-center">
          <img src="/finroute_logo.png" alt="FinRoute" className="h-10 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-lg font-extrabold text-slate-900">Something went wrong</h1>
          <p className="text-sm text-slate-600 mt-2">
            Your saved data is safe. Reload the page to continue. If this keeps happening, contact support.
          </p>
          <p className="text-[11px] mt-3 font-mono text-slate-400 break-words">{message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm cursor-pointer"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
