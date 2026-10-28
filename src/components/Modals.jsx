import React, { useState, useEffect, useRef } from 'react';
import { X, CalendarPlus, UserPlus, Archive, UploadCloud, DownloadCloud, AlertTriangle, AlertCircle, HelpCircle, Loader2, Trash2 } from 'lucide-react';
import { formatDecimalINR, parseDate, formatDateDMY, toIsoDate } from '../utils/formatters';

// Accessible modal helper: handles Escape key and locks body scrolling
function useModalAccessibility(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);
}

// 1. ADD CUSTOMER OR VILLAGE DIVIDER MODAL
export function AddCustomerModal({ isOpen, onClose, onAddCustomer, villageContext = null, weeks = [] }) {
  useModalAccessibility(isOpen, onClose);

  const [isDivider, setIsDivider] = useState(false);
  const [name, setName] = useState('');
  const [disbursed, setDisbursed] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  const [startWeekId, setStartWeekId] = useState('');
  const [phone, setPhone] = useState('');
  const [disbursedDate, setDisbursedDate] = useState(new Date().toLocaleDateString('en-GB'));
  const datePickerRef = useRef(null);

  useEffect(() => {
    if (isOpen && weeks.length > 0) {
      setStartWeekId(weeks[weeks.length - 1]?.id || weeks[0]?.id || 'week_1');
    }
  }, [isOpen, weeks]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isDivider) {
      onAddCustomer({
        id: `DIV-${Date.now()}`,
        name: name.trim(),
        villageName: name.trim(),
        isVillageDivider: true
      });
    } else {
      const numDisb = Number(disbursed) || 0;
      const numOrig = originalAmount !== '' ? (Number(originalAmount) || 0) : numDisb;
      const selectedStartWeek = startWeekId || weeks[weeks.length - 1]?.id || weeks[0]?.id || 'week_1';
      onAddCustomer({
        id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
        name: name.trim(),
        disbursed: numDisb,
        originalAmount: numOrig,
        startWeekId: selectedStartWeek,
        phone: phone.trim(),
        disbursedDate: disbursedDate.trim(),
        payments: {}
      }, villageContext?.rowId || null);
    }

    setName('');
    setDisbursed('');
    setOriginalAmount('');
    setPhone('');
    onClose();
  };

  const handleNativeDateChange = (e) => {
    const isoVal = e.target.value;
    if (!isoVal) return;
    const parsed = parseDate(isoVal);
    if (parsed) {
      setDisbursedDate(formatDateDMY(parsed, '/'));
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 transition-all animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {villageContext ? `Add Customer Under: ${villageContext.name}` : 'Add New Customer / Village Divider'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {!villageContext && (
            <div className="flex gap-4 p-2 bg-slate-50 rounded-lg text-xs font-semibold text-slate-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="customerType"
                  checked={!isDivider}
                  onChange={() => setIsDivider(false)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Customer Loan</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="customerType"
                  checked={isDivider}
                  onChange={() => setIsDivider(true)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span>Village Section Divider</span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isDivider ? 'Village / Area Name (తెలుగు / English)' : 'Customer Name (తెలుగు / English)'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isDivider ? 'e.g. పొందూరు (Ponduru)' : 'e.g. రాముడు, లక్ష్మి...'}
              required
              autoFocus
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-telugu"
            />
          </div>

          {!isDivider && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payable Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={disbursed}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDisbursed(val);
                      if (!originalAmount || originalAmount === disbursed) {
                        setOriginalAmount(val);
                      }
                    }}
                    placeholder="e.g. 50000"
                    required
                    min="0"
                    step="100"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Original Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={originalAmount}
                    onChange={(e) => setOriginalAmount(e.target.value)}
                    placeholder="e.g. 50000"
                    min="0"
                    step="100"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    title="Original sanctioned capital amount"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Issue Date
                  </label>
                  <div className="relative flex items-center">
                    <input
                      ref={datePickerRef}
                      type="date"
                      value={toIsoDate(parseDate(disbursedDate)) || ''}
                      onChange={handleNativeDateChange}
                      className="sr-only"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={disbursedDate}
                      onChange={(e) => setDisbursedDate(e.target.value)}
                      placeholder="DD-MM-YYYY"
                      className="w-full px-3 py-2 pr-8 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          datePickerRef.current?.showPicker();
                        } catch {
                          datePickerRef.current?.focus();
                        }
                      }}
                      className="absolute right-2 text-slate-400 hover:text-blue-600 text-xs p-1"
                      title="Pick date from calendar"
                    >
                      📅
                    </button>
                  </div>
                </div>
              </div>

              {weeks.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Joining / Start Week
                  </label>
                  <select
                    value={startWeekId}
                    onChange={(e) => setStartWeekId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
                  >
                    {weeks.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.label} ({w.date})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Selecting a later week will block previous week amount fields with shaded styling.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              {isDivider ? 'Add Village Divider' : 'Register Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 2. ADD WEEK COLUMN MODAL
export function AddWeekModal({ isOpen, onClose, onAddWeek, currentWeeksCount, lastWeekDate }) {
  useModalAccessibility(isOpen, onClose);

  const [label, setLabel] = useState(`Week ${currentWeeksCount + 1}`);
  const [date, setDate] = useState(() => {
    if (lastWeekDate) {
      const parsed = parseDate(lastWeekDate);
      if (parsed) {
        const next = new Date(parsed.getTime());
        next.setDate(parsed.getDate() + 7);
        return formatDateDMY(next, '/');
      }
    }
    return new Date().toLocaleDateString('en-GB');
  });

  const weekDatePickerRef = useRef(null);

  useEffect(() => {
    setLabel(`Week ${currentWeeksCount + 1}`);
    if (lastWeekDate) {
      const parsed = parseDate(lastWeekDate);
      if (parsed) {
        const next = new Date(parsed.getTime());
        next.setDate(parsed.getDate() + 7);
        setDate(formatDateDMY(next, '/'));
      }
    }
  }, [currentWeeksCount, lastWeekDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!label.trim()) return;

    onAddWeek({
      id: `week_${Date.now()}`,
      label: label.trim(),
      date: date.trim()
    });

    onClose();
  };

  const handleNativeWeekDate = (e) => {
    const isoVal = e.target.value;
    if (!isoVal) return;
    const parsed = parseDate(isoVal);
    if (parsed) {
      setDate(formatDateDMY(parsed, '/'));
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Add Collection Week</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Week Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Week 3"
              required
              autoFocus
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Collection Date</label>
            <div className="relative flex items-center">
              <input
                ref={weekDatePickerRef}
                type="date"
                value={toIsoDate(parseDate(date)) || ''}
                onChange={handleNativeWeekDate}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="DD-MM-YYYY"
                required
                className="w-full px-3 py-2 pr-8 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    weekDatePickerRef.current?.showPicker();
                  } catch {
                    weekDatePickerRef.current?.focus();
                  }
                }}
                className="absolute right-2 text-slate-400 hover:text-blue-600 text-xs p-1"
                title="Pick date from calendar"
              >
                📅
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Defaults to 7 days after the previous collection.</p>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              Add Week Column
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 3A. BATCH ARCHIVE MODAL
export function ArchiveModal({ isOpen, onClose, onArchive, activeCount, paidOffCount }) {
  useModalAccessibility(isOpen, onClose);
  const [paidOnly, setPaidOnly] = useState(true);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm">Archive & Renew Loan Cycle</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs text-slate-600">
          <p>
            Archiving stores completed or past loans in the <strong>Loan Archive</strong> tab so your weekly collection table remains clean for the upcoming cycle.
          </p>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-900">
              <input
                type="radio"
                name="archiveOption"
                checked={paidOnly}
                onChange={() => setPaidOnly(true)}
                className="text-amber-600 focus:ring-amber-500"
              />
              <span>Archive Paid Off Only ({paidOffCount} customers)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-900">
              <input
                type="radio"
                name="archiveOption"
                checked={!paidOnly}
                onChange={() => setPaidOnly(false)}
                className="text-amber-600 focus:ring-amber-500"
              />
              <span>Archive All Customers ({activeCount + paidOffCount} customers) & Reset Cycle</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onArchive(paidOnly);
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              Confirm Archive & Renew
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3B. INDIVIDUAL CUSTOMER ARCHIVE & RENEW MODAL
export function CustomerRenewModal({ isOpen, onClose, customer, onRenew, weeks = [] }) {
  useModalAccessibility(isOpen, onClose);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [renewWeekId, setRenewWeekId] = useState('');
  const renewDatePickerRef = useRef(null);

  useEffect(() => {
    if (isOpen && weeks.length > 0) {
      setRenewWeekId(weeks[weeks.length - 1]?.id || weeks[0]?.id || 'week_1');
    }
  }, [isOpen, weeks]);

  if (!isOpen || !customer) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = Number(amount) || 0;
    if (num <= 0) return;
    const selectedWeek = renewWeekId || weeks[weeks.length - 1]?.id || 'week_1';
    onRenew(customer._rowId, num, date, selectedWeek);
    onClose();
  };

  const handleNativeRenewDate = (e) => {
    const isoVal = e.target.value;
    if (!isoVal) return;
    const parsed = parseDate(isoVal);
    if (parsed) {
      setDate(formatDateDMY(parsed, '/'));
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm">Renew Customer Loan Cycle</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
          <div className="font-telugu font-bold text-slate-900 text-sm">{customer.name}</div>
          <div className="text-slate-500 font-mono text-[11px]">{customer.id}</div>
          <div className="flex justify-between pt-1 text-slate-600">
            <span>Previous Payable:</span>
            <span className="font-semibold text-slate-900">{formatDecimalINR(customer.disbursed)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Payable Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50000"
              required
              autoFocus
              min="0"
              step="100"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Issue Date</label>
            <div className="relative flex items-center">
              <input
                ref={renewDatePickerRef}
                type="date"
                value={toIsoDate(parseDate(date)) || ''}
                onChange={handleNativeRenewDate}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="DD-MM-YYYY"
                required
                className="w-full px-3 py-2 pr-8 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  try {
                    renewDatePickerRef.current?.showPicker();
                  } catch {
                    renewDatePickerRef.current?.focus();
                  }
                }}
                className="absolute right-2 text-slate-400 hover:text-blue-600 text-xs p-1"
                title="Pick date from calendar"
              >
                📅
              </button>
            </div>
          </div>

          {weeks.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Renewal Week (Start of New Loan Cycle)
              </label>
              <select
                value={renewWeekId}
                onChange={(e) => setRenewWeekId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-white"
              >
                {weeks.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.label} ({w.date})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Previous cycle payments before this week will be shown striked-off, and new payments will start from this week.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white shadow-xs transition-colors"
            >
              Archive & Set New Loan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 4. CLOUD SYNC & SETTINGS MODAL
export function CloudSyncModal({ isOpen, onClose, currentUrl, onSaveUrl, onPull, onPush, isSyncing, onOpenImportSheet }) {
  useModalAccessibility(isOpen, onClose);
  const [url, setUrl] = useState(currentUrl || '');

  useEffect(() => {
    setUrl(currentUrl || '');
  }, [currentUrl, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Google Sheet Cloud Synchronization</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google Apps Script Web App URL (/exec)
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Data is automatically encrypted and saved directly to your private Google Sheet spreadsheet.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => onSaveUrl(url.trim())}
              disabled={isSyncing}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
            >
              Save URL
            </button>
            <button
              type="button"
              onClick={onPull}
              disabled={isSyncing || !url}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : (
                <DownloadCloud className="w-3.5 h-3.5" />
              )}
              <span>{isSyncing ? 'Pulling...' : 'Pull from Sheet'}</span>
            </button>
            <button
              type="button"
              onClick={onPush}
              disabled={isSyncing || !url}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" />
              )}
              <span>{isSyncing ? 'Pushing...' : 'Push All to Sheet'}</span>
            </button>
          </div>

          {onOpenImportSheet && (
            <div className="pt-3 border-t border-slate-100">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-emerald-900 text-xs block">Dedicated Supabase Database</span>
                  <span className="text-[11px] text-slate-500 block">Migrate and sync all legacy Google Sheet records directly to Supabase</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenImportSheet();
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs shrink-0 cursor-pointer"
                >
                  Import to Supabase
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 5. CUSTOM CONFIRMATION & ALERT DIALOG MODAL
export function ConfirmModal({ isOpen, title, message, type = 'warning', onConfirm, onCancel }) {
  useModalAccessibility(isOpen, onCancel);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-center animate-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-slate-100">
          {type === 'danger' ? (
            <AlertCircle className="w-6 h-6 text-red-600" />
          ) : type === 'warning' ? (
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          ) : (
            <HelpCircle className="w-6 h-6 text-blue-600" />
          )}
        </div>
        <h3 className="font-bold text-slate-900 text-base">{title}</h3>
        <p className="text-xs text-slate-600 mt-1.5 whitespace-pre-line leading-relaxed">{message}</p>

        <div className="flex justify-center gap-2.5 mt-5">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors ${type === 'danger'
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// 5. DELETE CUSTOMER WITH REASON & ARCHIVE CONFIRMATION MODAL
export function DeleteCustomerModal({ isOpen, onClose, customer, onDelete, villageName }) {
  useModalAccessibility(isOpen, onClose);

  const [reason, setReason] = useState('');
  const [selectedQuickReason, setSelectedQuickReason] = useState('');

  const QUICK_REASONS = [
    'Moved to another town / village',
    'Loan settled / closed outside ledger',
    'Customer defaulter / unreachable',
    'Duplicate / added by mistake',
    'Other reason'
  ];

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setSelectedQuickReason('');
    }
  }, [isOpen]);

  if (!isOpen || !customer) return null;

  const handleSelectQuick = (q) => {
    setSelectedQuickReason(q);
    if (q !== 'Other reason') {
      setReason(q);
    } else {
      setReason('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason = reason.trim() || selectedQuickReason || 'Customer deleted by user';
    onDelete(customer._rowId, finalReason);
    onClose();
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Delete Customer</h3>
              <p className="text-[11px] text-slate-500">Record will be saved to Loan Archive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Customer Details Card */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-telugu font-bold text-slate-900 text-base">{customer.name}</div>
              <div className="text-slate-500 font-mono text-[11px]">{customer.id}</div>
            </div>
            {villageName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-semibold border border-indigo-100">
                📍 {villageName}
              </span>
            )}
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-200/60 text-slate-600">
            <span>Payable Amount:</span>
            <span className="font-semibold text-slate-900">{formatDecimalINR(customer.disbursed)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason for Deletion <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_REASONS.map((q) => (
                <button
                  type="button"
                  key={q}
                  onClick={() => handleSelectQuick(q)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer border ${selectedQuickReason === q
                      ? 'bg-red-50 text-red-700 border-red-300 font-semibold shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                >
                  {q}
                </button>
              ))}
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Type reason or notes for archiving this customer..."
              rows={2}
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-normal resize-none"
            />
          </div>

          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2 text-[11px] text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              This customer will be removed from the active tracker and safely preserved in the <strong>Loan History Archive</strong> along with their village name and deletion reason.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete & Save to Archive</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
