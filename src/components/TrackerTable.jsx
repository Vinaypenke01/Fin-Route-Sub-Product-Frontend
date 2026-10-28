import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Phone } from 'lucide-react';
import { formatDecimalINR, formatINR, getCustomerTotalPaid, getCustomerBalance, getCustomerStatus, parseDate, formatDateDMY, toIsoDate } from '../utils/formatters';
import { t } from '../utils/translations';

// Clean editable header cell for Week 1 Date (triggers cascading date updates to all subsequent weeks)
function EditableWeekOneHeader({ date, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [textVal, setTextVal] = useState(date || '');
  const dateInputRef = useRef(null);

  useEffect(() => {
    setTextVal(date || '');
  }, [date]);

  const handleCommit = (newVal) => {
    setIsEditing(false);
    const trimmed = (newVal || '').trim();
    if (trimmed && trimmed !== date) {
      onSave(trimmed);
    }
  };

  const handleNativePickerChange = (e) => {
    const isoVal = e.target.value; // YYYY-MM-DD
    if (!isoVal) return;
    const parsed = parseDate(isoVal);
    if (parsed) {
      const formatted = formatDateDMY(parsed, '/');
      setTextVal(formatted);
      onSave(formatted);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1 w-full">
      {/* Hidden native date picker */}
      <input
        ref={dateInputRef}
        type="date"
        value={toIsoDate(parseDate(date)) || ''}
        onChange={handleNativePickerChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={() => handleCommit(textVal)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit(textVal);
            if (e.key === 'Escape') {
              setTextVal(date || '');
              setIsEditing(false);
            }
          }}
          placeholder="DD/MM/YYYY"
          className="w-[96px] px-1 py-0.5 text-xs text-right font-bold text-blue-700 bg-white border border-blue-500 rounded focus:outline-none shadow-xs"
        />
      ) : (
        <div
          onClick={() => setIsEditing(true)}
          className="group/w1 inline-flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded hover:bg-blue-100/80 transition-colors border border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/70"
          title="Click to edit Week 1 date (e.g. 18/10/2026 or 18-10-2026). All subsequent weeks will automatically shift by +7 days."
        >
          <span className="font-bold text-blue-700 tracking-tight">{date}</span>
          <span className="text-[10px] text-blue-500 group-hover/w1:text-blue-700">✏️</span>
        </div>
      )}

      {/* Quick Calendar Icon to open native date picker */}
      <button
        type="button"
        onClick={() => {
          try {
            dateInputRef.current?.showPicker();
          } catch (err) {
            dateInputRef.current?.focus();
          }
        }}
        className="text-slate-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50 transition-colors"
        title="Open calendar picker"
      >
        📅
      </button>
    </div>
  );
}

// Clean editable currency cell (displays formatted ₹ X,XXX.00, edits raw number on focus)
function EditableCurrencyCell({ initialValue, onSave, className = '', isZeroMuted = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(initialValue ?? 0);
  const inputRef = useRef(null);

  useEffect(() => {
    setVal(initialValue ?? 0);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const num = Number(val) || 0;
    if (num !== (initialValue ?? 0)) {
      onSave(num);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setVal(initialValue ?? 0);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={val === 0 ? '' : val}
        placeholder="0"
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full text-right px-1.5 py-1 text-sm font-semibold text-slate-900 bg-white border-2 border-blue-500 rounded focus:outline-none shadow-xs"
      />
    );
  }

  const numVal = Number(val) || 0;

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`w-full text-right px-2 py-1 text-sm font-semibold text-slate-900 cursor-pointer rounded hover:bg-slate-100/80 transition-colors select-none ${className}`}
      title="Click to edit"
    >
      {formatDecimalINR(numVal)}
    </div>
  );
}

// Clean editable text cell with controlled state, Enter/Escape handling, and reliable onSave
function EditableTextCell({ initialValue, onSave, className = '', placeholder = '' }) {
  const [text, setText] = useState(initialValue || '');

  useEffect(() => {
    setText(initialValue || '');
  }, [initialValue]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed !== (initialValue || '')) {
      onSave(trimmed);
    }
  };

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') {
          setText(initialValue || '');
          e.target.blur();
        }
      }}
      placeholder={placeholder}
      className={`w-full bg-transparent px-1.5 py-1 text-sm font-semibold text-slate-900 rounded border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none transition-all truncate font-telugu ${className}`}
      title={text}
    />
  );
}

// Clean editable date cell with inline text editing, blur commit, and native calendar picker
function EditableDateCell({ initialValue, onSave, placeholder = 'DD-MM-YYYY' }) {
  const [val, setVal] = useState(initialValue || '');
  const pickerRef = useRef(null);

  useEffect(() => {
    setVal(initialValue || '');
  }, [initialValue]);

  const commitValue = (newVal) => {
    const trimmed = (newVal || '').trim();
    if (trimmed !== (initialValue || '').trim()) {
      onSave(trimmed);
    }
  };

  const handleTextChange = (e) => {
    setVal(e.target.value);
  };

  const handleBlur = () => {
    commitValue(val);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setVal(initialValue || '');
    }
  };

  const handlePickerChange = (e) => {
    const isoVal = e.target.value; // YYYY-MM-DD
    if (!isoVal) return;
    const parsed = parseDate(isoVal);
    if (parsed) {
      const formatted = formatDateDMY(parsed, '/');
      setVal(formatted);
      commitValue(formatted);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <input
        ref={pickerRef}
        type="date"
        value={toIsoDate(parseDate(val)) || ''}
        onChange={handlePickerChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        type="text"
        value={val}
        onChange={handleTextChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-[90px] bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-blue-500 rounded px-1.5 py-0.5 text-xs text-[#0F172A] font-medium transition-colors"
        title="Type date (DD-MM-YYYY) and press Enter/click away, or click calendar icon"
      />
      <button
        type="button"
        onClick={() => {
          try {
            pickerRef.current?.showPicker();
          } catch (err) {
            pickerRef.current?.focus();
          }
        }}
        className="p-0.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors text-xs cursor-pointer"
        title="Open calendar picker"
      >
        📅
      </button>
    </div>
  );
}

// Reusable Table Header Rows with frozen columns and week subheadings
function TableHeaderRows({ weeks, onUpdateWeekOneDate, isFloating = false, language = 'en' }) {
  return (
    <thead className="bg-[#F1F5F9] font-bold select-none text-[#0F172A]">
      {/* Header Row 1 */}
      <tr>
        <th
          rowSpan={2}
          className="sticky top-0 left-0 z-30 bg-[#F1F5F9] border-b-2 border-r border-[#CBD5E1] px-3 py-2.5 text-center w-[50px] min-w-[50px] font-bold text-[#0F172A] hidden sm:table-cell"
        >
          #
        </th>

        <th
          rowSpan={2}
          className="sticky top-0 left-0 sm:left-[50px] z-40 bg-[#F1F5F9] border-b-2 border-r-2 border-[#CBD5E1] px-3 py-2.5 text-left w-[175px] sm:w-[220px] min-w-[175px] sm:min-w-[220px] font-bold text-[#0F172A] sticky-shadow"
        >
          {t('table.name', language)}
        </th>

        {/* Customer ID in front of Amount Disbursed */}
        <th
          rowSpan={2}
          className="sticky top-0 z-20 bg-[#F1F5F9] border-b-2 border-r border-[#CBD5E1] px-3 py-2.5 text-left w-[95px] min-w-[95px] font-bold text-[#0F172A]"
        >
          {t('table.id', language)}
        </th>

        <th
          rowSpan={2}
          className="sticky top-0 z-20 bg-[#F1F5F9] border-b-2 border-r border-[#CBD5E1] px-3 py-2.5 text-right w-[125px] min-w-[125px] font-bold text-[#0F172A]"
        >
          {t('kpis.totalPayable', language)} (₹)
        </th>

        {weeks.map(w => (
          <th
            key={w.id}
            className="sticky top-0 z-20 bg-[#F1F5F9] border-b-2 border-r border-[#CBD5E1] px-3 py-2 text-right w-[115px] min-w-[115px] font-bold text-[#0F172A]"
          >
            {w.label}
          </th>
        ))}

        <th
          colSpan={3}
          className="sticky top-0 z-20 bg-[#E2E8F0] border-b-2 border-r border-[#CBD5E1] px-3 py-2 text-center font-bold text-[#0F172A]"
        >
          {language === 'te' ? 'ఖాతా సారాంశం' : 'Account Summary'}
        </th>

        <th rowSpan={2} className="sticky top-0 z-20 bg-[#F1F5F9] border-b-2 border-r border-[#CBD5E1] px-3 py-2 text-left w-[115px] min-w-[115px] font-semibold text-[#0F172A]">
          {t('table.phone', language)}
        </th>
        <th rowSpan={2} className="sticky top-0 z-20 bg-[#F1F5F9] border-b-2 border-r border-[#CBD5E1] px-3 py-2 text-left w-[130px] min-w-[130px] font-semibold text-[#0F172A]">
          {t('table.disbursedDate', language)}
        </th>
        <th rowSpan={2} className="sticky top-0 z-20 bg-[#F1F5F9] border-b-2 border-r border-[#CBD5E1] px-3 py-2 text-right w-[115px] min-w-[115px] font-semibold text-[#0F172A]">
          {t('kpis.originalAmount', language)}
        </th>
        <th rowSpan={2} className="sticky top-0 z-20 bg-[#F1F5F9] border-b-2 border-[#CBD5E1] px-3 py-2 text-center w-[70px] min-w-[70px] font-semibold text-[#0F172A]">
          {t('table.actions', language)}
        </th>
      </tr>

      {/* Sub Header Row 2 */}
      <tr className="bg-[#F8FAFC] text-xs text-[#475569]">
        {weeks.map((w, idx) => {
          if (idx === 0) {
            return (
              <th
                key={`sub-${w.id}`}
                className="sticky top-[38px] z-20 bg-blue-50/80 border-b-2 border-r border-[#CBD5E1] px-2 py-1 text-right w-[115px] min-w-[115px] font-medium text-[#0F172A]"
              >
                <EditableWeekOneHeader
                  date={w.date}
                  onSave={onUpdateWeekOneDate}
                />
              </th>
            );
          }
          return (
            <th
              key={`sub-${w.id}`}
              className="sticky top-[38px] z-20 bg-[#F8FAFC] border-b-2 border-r border-[#CBD5E1] px-3 py-1.5 text-right w-[115px] min-w-[115px] font-medium text-[#475569] select-none"
              title="Auto-calculated (+7 days from previous week)"
            >
              <div className="flex items-center justify-end gap-1">
                <span className="text-slate-600 font-medium">{w.date}</span>
                <span className="text-[9px] text-slate-400 font-normal select-none" title="Auto +7 days">🔒</span>
              </div>
            </th>
          );
        })}
        <th className="sticky top-[38px] z-20 bg-emerald-50/70 text-[#166534] border-b-2 border-r border-[#CBD5E1] px-3 py-1.5 text-right w-[105px] min-w-[105px] font-bold">
          {t('table.paid', language)}
        </th>
        <th className="sticky top-[38px] z-20 bg-red-50/70 text-[#991B1B] border-b-2 border-r border-[#CBD5E1] px-3 py-1.5 text-right w-[105px] min-w-[105px] font-bold">
          {t('table.balance', language)}
        </th>
        <th className="sticky top-[38px] z-20 bg-[#F8FAFC] border-b-2 border-r border-[#CBD5E1] px-3 py-1.5 text-center w-[95px] min-w-[95px] font-semibold text-[#475569]">
          {t('table.status', language)}
        </th>
      </tr>
    </thead>
  );
}

export default function TrackerTable({
  weeks = [],
  customers = [],
  weeklyReconciliation = {},
  reconciliationComputed,
  archive = [],
  onUpdateCustomerField,
  onUpdatePayment,
  onUpdateRecon,
  onDeleteCustomer,
  onOpenRenewCustomer,
  onOpenAddCustomerUnderVillage,
  onMoveRow,
  onUpdateWeekOneDate,
  language = 'en'
}) {
  const mainScrollRef = useRef(null);
  const mainTableRef = useRef(null);
  const floatingHeaderRef = useRef(null);
  const [floatingHeader, setFloatingHeader] = useState({ visible: false, left: 0, width: 0, tableWidth: 0 });

  // Monitor scroll on window and resize to synchronize floating sticky header
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (!mainScrollRef.current) return;
      const rect = mainScrollRef.current.getBoundingClientRect();
      // When table top has scrolled above top of viewport and table bottom is still in view
      const isVisible = rect.top < 0 && rect.bottom > 100;
      const tWidth = mainTableRef.current ? mainTableRef.current.offsetWidth : 0;
      setFloatingHeader({
        visible: isVisible,
        left: Math.max(0, rect.left),
        width: rect.width,
        tableWidth: tWidth
      });

      if (floatingHeaderRef.current && mainScrollRef.current) {
        floatingHeaderRef.current.scrollLeft = mainScrollRef.current.scrollLeft;
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    handleScrollOrResize();

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, []);

  const handleTableScroll = (e) => {
    if (floatingHeaderRef.current) {
      floatingHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleFloatingScroll = (e) => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Compute column totals
  let totalDisbursedSum = 0;
  let totalPaidSum = 0;
  let totalBalanceSum = 0;
  let totalOriginalAmountSum = 0;

  customers.forEach(c => {
    if (c.isVillageDivider) return;
    totalDisbursedSum += Number(c.disbursed) || 0;
    totalPaidSum += getCustomerTotalPaid(c);
    totalBalanceSum += getCustomerBalance(c);
    const orig = (c.originalAmount !== undefined && c.originalAmount !== null && c.originalAmount !== '')
      ? Number(c.originalAmount)
      : (Number(c.disbursed) || 0);
    totalOriginalAmountSum += orig;
  });

  // Running serial count for non-divider customers
  let runningSerial = 0;

  return (
    <div className="flex-1 mx-3 sm:mx-6 mb-6 relative">
      {/* 1. Persistent Floating Sticky Header (Active on mobile & desktop during page scroll) */}
      {floatingHeader.visible && (
        <div
          ref={floatingHeaderRef}
          onScroll={handleFloatingScroll}
          style={{
            position: 'fixed',
            top: 0,
            left: `${floatingHeader.left}px`,
            width: `${floatingHeader.width}px`,
            zIndex: 40
          }}
          className="overflow-x-auto bg-[#F1F5F9] border-x border-b-2 border-[#CBD5E1] shadow-xl rounded-t-xl select-none custom-scrollbar animate-in fade-in duration-150"
        >
          <table
            style={{ width: floatingHeader.tableWidth ? `${floatingHeader.tableWidth}px` : 'max-content' }}
            className="w-max min-w-full border-separate border-spacing-0 text-sm text-[#0F172A]"
          >
            <TableHeaderRows
              weeks={weeks}
              onUpdateWeekOneDate={onUpdateWeekOneDate}
              isFloating={true}
              language={language}
            />
          </table>
        </div>
      )}

      {/* 2. Main Scrollable Table */}
      <main
        ref={mainScrollRef}
        onScroll={handleTableScroll}
        className="w-full bg-white border border-[#CBD5E1] rounded-xl overflow-auto max-h-[calc(100vh-140px)] min-h-[420px] shadow-sm relative custom-scrollbar"
      >
        <table
          ref={mainTableRef}
          className="w-max min-w-full border-separate border-spacing-0 text-sm text-[#0F172A]"
        >
          <TableHeaderRows
            weeks={weeks}
            onUpdateWeekOneDate={onUpdateWeekOneDate}
            isFloating={false}
            language={language}
          />

          {/* Customer Data Rows */}
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td
                  colSpan={weeks.length + 11}
                  className="py-12 px-4 text-center bg-slate-50/60 border-b border-[#CBD5E1]"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500 py-3">
                    <p className="text-sm font-semibold text-slate-700">
                      No customer loan records found in this sheet.
                    </p>
                    <p className="text-xs text-slate-400 font-telugu">
                      ఈ షీట్‌లో ఇంకా కస్టమర్ రికార్డులు లేవు. పైన ఉన్న "Add Customer" లేదా "Add Village Row" బటన్ ద్వారా రికార్డులను జోడించండి.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              customers.map((cust, index) => {
              if (cust.isVillageDivider) {
                return (
                  <tr key={cust._rowId || `divider-${index}`} className="bg-[#EEF2FF] border-t-2 border-b border-[#C7D2FE] font-bold">
                    {/* Village Icon in # column */}
                    <td className="sticky left-0 z-10 bg-[#EEF2FF] border-r border-[#C7D2FE] px-2 py-1.5 text-center text-base hidden sm:table-cell select-none">
                      🏡
                    </td>

                    {/* Village Name with Editable Input in Customer Name Column */}
                    <td className="sticky left-0 sm:left-[50px] z-20 bg-[#EEF2FF] border-r-2 border-[#C7D2FE] px-2 py-1 font-telugu text-sm font-extrabold text-[#3730A3] sticky-shadow">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-indigo-500 tracking-wider uppercase">VILLAGE:</span>
                        <EditableTextCell
                          initialValue={cust.villageName || cust.name || ''}
                          onSave={(trimmed) => onUpdateCustomerField(cust._rowId, 'name', trimmed)}
                          placeholder="Village name (రాంపూర్ / Rampur)..."
                          className="bg-transparent font-bold text-indigo-900 border-b border-transparent hover:border-indigo-300 focus:border-indigo-600 focus:bg-white focus:outline-none px-1 rounded transition-all text-xs w-full font-telugu"
                        />
                      </div>
                    </td>

                    {/* Spanning Section with Add Customer Here, Reorder, and Delete Buttons */}
                    <td colSpan={weeks.length + 9} className="px-3 py-1.5 bg-[#EEF2FF]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-600 hidden md:inline">
                          ━━ Customer Village Section ━━
                        </span>
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => onOpenAddCustomerUnderVillage(cust._rowId, cust.villageName || cust.name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-xs font-semibold shadow-2xs transition-colors"
                            title={`Add new customer directly under ${cust.villageName || cust.name || 'this village'}`}
                          >
                            <span>➕ Add Customer Here</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveRow(cust._rowId, -1)}
                            className="w-6 h-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer select-none"
                            title="Move divider row up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveRow(cust._rowId, 1)}
                            className="w-6 h-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer select-none"
                            title="Move divider row down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCustomer(cust._rowId, cust.villageName || cust.name)}
                            className="p-1 px-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 bg-white text-xs transition-colors"
                            title="Delete village divider"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              }

              runningSerial += 1;
              const currentSerial = runningSerial;
              const totalPaid = getCustomerTotalPaid(cust);
              const balance = getCustomerBalance(cust);
              const status = getCustomerStatus(cust);
              const isEven = index % 2 === 1;

              return (
                <tr
                  key={cust._rowId || `${cust.id}-${index}`}
                  className={`${isEven ? 'bg-[#FAFAFA]' : 'bg-[#FFFFFF]'} hover:bg-[#F1F5F9] transition-colors border-b border-[#E2E8F0]`}
                >
                  {/* 1. S.No */}
                  <td className="sticky left-0 z-10 bg-inherit border-r border-[#E2E8F0] px-2 py-1.5 text-center text-[#475569] font-medium hidden sm:table-cell">
                    {currentSerial}
                  </td>

                  {/* 2. Customer Name (Telugu Font, Pinned Freeze Pane) */}
                  <td className="sticky left-0 sm:left-[50px] z-20 bg-inherit border-r-2 border-[#CBD5E1] px-2 py-1 font-telugu text-sm font-semibold text-[#0F172A] sticky-shadow">
                    <EditableTextCell
                      initialValue={cust.name}
                      onSave={(val) => onUpdateCustomerField(cust._rowId, 'name', val)}
                    />
                  </td>

                  {/* 3. Customer ID (In front of Amount Disbursed) */}
                  <td className="border-r border-[#E2E8F0] px-2 py-1 text-[#475569] font-mono text-xs">
                    <EditableTextCell
                      initialValue={cust.id || ''}
                      onSave={(trimmed) => onUpdateCustomerField(cust._rowId, 'id', trimmed)}
                      placeholder="CUST-..."
                      className="w-[85px] font-mono text-xs font-normal"
                    />
                  </td>

                  {/* 4. Disbursed Amount */}
                  <td className="border-r border-[#E2E8F0] px-1 py-1 text-right font-semibold text-[#0F172A]">
                    <EditableCurrencyCell
                      initialValue={cust.disbursed}
                      onSave={(val) => onUpdateCustomerField(cust._rowId, 'disbursed', val)}
                    />
                  </td>

                  {/* 5. Weekly Payments Matrix */}
                  {weeks.map((w, weekIdx) => {
                    const isBulkArchived = Boolean(cust.isArchived);

                    // Locate any archive history record matching this customer
                    const archivedRecord = archive?.find(a => (
                      (a.originalId && a.originalId === cust.id) ||
                      (a.id && (a.id === cust.id || a.id.includes(cust.id))) ||
                      (a.name && cust.name && a.name.trim().toLowerCase() === cust.name.trim().toLowerCase())
                    ));

                    const renewWeekIdx = cust.renewedAtWeek ? weeks.findIndex(item => item.id === cust.renewedAtWeek) : -1;
                    const isPastRenewCycle = renewWeekIdx > 0 && weekIdx < renewWeekIdx;

                    // Determine historical / past cycle payment value:
                    // Checks cust.pastCyclePayments -> archivedRecord.payments -> cust.payments (if past cycle)
                    let pastPaymentVal = null;
                    if (cust.pastCyclePayments && cust.pastCyclePayments[w.id] !== undefined) {
                      pastPaymentVal = Number(cust.pastCyclePayments[w.id]) || 0;
                    } else if (archivedRecord?.payments && archivedRecord.payments[w.id] !== undefined) {
                      pastPaymentVal = Number(archivedRecord.payments[w.id]) || 0;
                    } else if (isPastRenewCycle && cust.payments && cust.payments[w.id] !== undefined) {
                      pastPaymentVal = Number(cust.payments[w.id]) || 0;
                    }

                    const activePaymentVal = Number(cust.payments?.[w.id]) || 0;

                    // If this is an archived customer or a renewed customer's past week:
                    const isPastArchivedWeek = isPastRenewCycle || (pastPaymentVal !== null) || isBulkArchived;

                    // 1. Is this week before a brand-new customer joined?
                    // NOTE: A customer with loan history (renewed, archived, or with past cycle data) is NEVER blocked as a new joiner!
                    let startWeekIdx = -1;
                    if (!isPastArchivedWeek && !isBulkArchived && !archivedRecord && !cust.renewedAtWeek && !cust.pastCyclePayments) {
                      let targetStartWeekId = cust.startWeekId;
                      // Fallback: match by disbursedDate if startWeekId is not explicitly set (e.g. after refresh from Google Sheet)
                      if (!targetStartWeekId && cust.disbursedDate && Array.isArray(weeks)) {
                        const custDate = parseDate(cust.disbursedDate);
                        if (custDate) {
                          // 1. Try finding exact matching week date
                          const exactW = weeks.find(item => {
                            const itemDate = parseDate(item.date);
                            return itemDate && itemDate.getTime() === custDate.getTime();
                          });
                          if (exactW) {
                            targetStartWeekId = exactW.id;
                          } else {
                            // 2. Find first week whose date is on or after disbursedDate
                            const upcomingW = weeks.find(item => {
                              const itemDate = parseDate(item.date);
                              return itemDate && itemDate.getTime() >= custDate.getTime();
                            });
                            if (upcomingW) targetStartWeekId = upcomingW.id;
                          }
                        } else {
                          const normDisb = String(cust.disbursedDate).replace(/-/g, '/').trim();
                          const matchedW = weeks.find(item => String(item.date || '').replace(/-/g, '/').trim() === normDisb);
                          if (matchedW) targetStartWeekId = matchedW.id;
                        }
                      }
                      if (targetStartWeekId) {
                        startWeekIdx = weeks.findIndex(item => item.id === targetStartWeekId);
                      }
                    }
                    const isBeforeJoining = startWeekIdx > 0 && weekIdx < startWeekIdx;

                    // CASE 1: Previous cycle payment before renewal (e.g. Week 1 & 2 before Week 3 renewal)
                    // Always displays the past amount with strikethrough and warm amber highlight!
                    if (isPastRenewCycle || (pastPaymentVal !== null && !isBulkArchived)) {
                      const displayAmt = pastPaymentVal !== null ? pastPaymentVal : 0;
                      return (
                        <td key={w.id} className="border-r border-[#E2E8F0] px-1 py-1 text-right bg-amber-50/40">
                          <div
                            className="w-full text-right px-1.5 py-1 text-xs font-semibold text-slate-600 bg-amber-50/80 border border-amber-200/80 rounded select-none cursor-not-allowed flex items-center justify-end gap-1"
                            title={`Archived Loan Payment: ₹ ${displayAmt.toLocaleString('en-IN')}${renewWeekIdx > 0 ? ' • Renewed from ' + (weeks[renewWeekIdx]?.label || 'Week 3') : ''}`}
                          >
                            <span className="text-[9px] font-bold not-italic px-1 bg-amber-200/90 text-amber-900 rounded mr-auto select-none">
                              Old
                            </span>
                            <span className="line-through text-slate-600 font-bold">{formatDecimalINR(displayAmt)}</span>
                          </div>
                        </td>
                      );
                    }

                    // CASE 2: Bulk archived customer -> Striked-off past payments with purple/slate color
                    if (isBulkArchived) {
                      const displayAmt = (pastPaymentVal !== null) ? pastPaymentVal : activePaymentVal;
                      return (
                        <td key={w.id} className="border-r border-[#E2E8F0] px-1 py-1 text-right bg-purple-50/30">
                          <div
                            className="w-full text-right px-1.5 py-1 text-xs font-semibold text-slate-600 bg-purple-50/70 border border-purple-200/70 rounded select-none cursor-not-allowed flex items-center justify-end gap-1"
                            title={`Archived Loan Payment: ₹ ${displayAmt.toLocaleString('en-IN')}`}
                          >
                            <span className="text-[9px] font-bold not-italic px-1 bg-purple-100 text-purple-800 rounded mr-auto select-none">
                              Settled
                            </span>
                            <span className="line-through text-slate-600 font-bold">{formatDecimalINR(displayAmt)}</span>
                          </div>
                        </td>
                      );
                    }

                    // CASE 3: Brand new customer joined later (e.g. Week 3) -> Blocked past weeks with lock
                    if (isBeforeJoining) {
                      return (
                        <td key={w.id} className="border-r border-[#E2E8F0] px-1 py-1 text-center bg-slate-100/80">
                          <div
                            className="w-full text-center px-1.5 py-1 text-xs text-slate-400 font-mono bg-slate-100 rounded border border-dashed border-slate-300 select-none cursor-not-allowed flex items-center justify-center gap-1"
                            title={`Customer joined in ${weeks[startWeekIdx]?.label || 'a later week'} • Past week blocked`}
                          >
                            <span className="text-[10px] text-slate-400">🔒</span>
                            <span>—</span>
                          </div>
                        </td>
                      );
                    }

                    // CASE 4: Active Week -> Editable Currency Cell
                    return (
                      <td key={w.id} className="border-r border-[#E2E8F0] px-1 py-1 text-right">
                        <EditableCurrencyCell
                          initialValue={activePaymentVal}
                          onSave={(val) => onUpdatePayment(cust._rowId, w.id, val)}
                          className={activePaymentVal > 0 ? 'text-emerald-700 font-bold bg-emerald-50/50' : 'text-[#0F172A]'}
                        />
                      </td>
                    );
                  })}

                  {/* 6. Summary: Total Paid */}
                  <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-right font-bold text-[#16A34A] bg-[rgba(240,253,244,0.4)]">
                    {formatDecimalINR(totalPaid)}
                  </td>

                  {/* 7. Summary: Balance Due */}
                  <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-right font-bold text-[#DC2626] bg-[rgba(254,242,242,0.4)]">
                    {formatDecimalINR(balance)}
                  </td>

                  {/* 8. Summary: Status */}
                  <td className="border-r border-[#CBD5E1] px-2 py-1.5 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${status === 'Paid Off'
                          ? 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]'
                          : 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                        }`}
                    >
                      {status === 'Paid Off' ? t('status.paidOff', language) : t('status.active', language)}
                    </span>
                  </td>

                  {/* 9. Metadata: Phone (Editable with Quick Call & WhatsApp Reminder Link) */}
                  <td className="border-r border-[#E2E8F0] px-2 py-1 text-[#0F172A]">
                    <div className="flex items-center gap-1">
                      <EditableTextCell
                        initialValue={cust.phone || ''}
                        onSave={(trimmed) => onUpdateCustomerField(cust._rowId, 'phone', trimmed)}
                        placeholder="Phone..."
                        className="w-[100px] text-xs font-normal font-sans"
                      />
                      {cust.phone && cust.phone.length >= 7 && (
                        <a
                          href={`tel:${cust.phone.replace(/[^0-9]/g, '')}`}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded text-xs shrink-0"
                          title={`Call ${cust.phone}`}
                        >
                          📞
                        </a>
                      )}
                      {cust.phone && cust.phone.replace(/[^0-9]/g, '').length >= 10 && (
                        <a
                          href={`https://wa.me/91${cust.phone.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(
                            t('whatsapp.paymentReminder', language, {
                              name: cust.name || 'Customer',
                              amount: formatINR(balance > 0 ? Math.min(balance, 500) : 0),
                              balance: formatINR(balance)
                            })
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded text-xs shrink-0"
                          title={language === 'te' ? `${cust.name} గారికి వాట్సాప్ రిమైండర్ పంపండి` : `Send WhatsApp reminder to ${cust.name}`}
                        >
                          💬
                        </a>
                      )}
                    </div>
                  </td>

                  {/* 10. Disbursed Date (Editable with Calendar Option) */}
                  <td className="border-r border-[#E2E8F0] px-2 py-1 text-[#475569] text-xs">
                    <EditableDateCell
                      initialValue={cust.disbursedDate || ''}
                      onSave={(val) => onUpdateCustomerField(cust._rowId, 'disbursedDate', val)}
                    />
                  </td>

                  {/* 11. Original Amount (Editable) */}
                  <td className="border-r border-[#E2E8F0] px-1 py-1 text-right font-semibold text-[#0F172A]">
                    <EditableCurrencyCell
                      initialValue={(cust.originalAmount !== undefined && cust.originalAmount !== null && cust.originalAmount !== '') ? cust.originalAmount : cust.disbursed}
                      onSave={(val) => onUpdateCustomerField(cust._rowId, 'originalAmount', val)}
                    />
                  </td>

                  {/* 12. Actions: Move Up/Down, Archive & Renew, and Delete */}
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onMoveRow(cust._rowId, -1)}
                        className="w-6 h-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer select-none"
                        title="Move customer up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveRow(cust._rowId, 1)}
                        className="w-6 h-6 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer select-none"
                        title="Move customer down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenRenewCustomer(cust)}
                        className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors text-xs"
                        title={`Archive & Renew ${cust.name}`}
                      >
                        📦
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteCustomer(cust._rowId, cust.name)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title={`Delete ${cust.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
          </tbody>

          {/* Master Footer (Summary Totals & Cash Reconciliation) */}
          <tfoot className="font-bold text-[#0F172A] select-none">
            {/* Row 1: Grand Column Totals */}
            <tr className="bg-[#F8FAFC] border-t-2 border-[#CBD5E1] border-b-2 border-[#CBD5E1]">
              <td className="sticky left-0 z-10 bg-[#F8FAFC] border-r border-[#CBD5E1] px-2 py-2 text-center hidden sm:table-cell">
                Σ
              </td>
              <td className="sticky left-0 sm:left-[50px] z-20 bg-[#F8FAFC] border-r-2 border-[#CBD5E1] px-3 py-2 text-left sticky-shadow font-extrabold text-[#0F172A]">
                TOTALS
              </td>
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-center text-slate-400 font-bold">—</td>
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-right text-blue-700 font-extrabold">
                {formatDecimalINR(totalDisbursedSum)}
              </td>
              {weeks.map(w => {
                const weekSum = reconciliationComputed.computedWeeks.find(cw => cw.weekId === w.id)?.collections || 0;
                return (
                  <td key={`tot-${w.id}`} className="border-r border-[#CBD5E1] px-3 py-2 text-right text-emerald-700 font-extrabold">
                    {formatDecimalINR(weekSum)}
                  </td>
                );
              })}
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-right text-emerald-700 bg-emerald-100/60 font-extrabold">
                {formatDecimalINR(totalPaidSum)}
              </td>
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-right text-red-700 bg-red-100/60 font-extrabold">
                {formatDecimalINR(totalBalanceSum)}
              </td>
              {/* Status (col 7) */}
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-center text-slate-400 font-bold">—</td>
              {/* Mobile (col 8) */}
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-center text-slate-400 font-bold">—</td>
              {/* Issue Date (col 9) */}
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-center text-slate-400 font-bold">—</td>
              {/* Original Amount (col 10) */}
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-right text-blue-700 font-extrabold">
                {formatDecimalINR(totalOriginalAmountSum)}
              </td>
              {/* Actions (col 11) */}
              <td className="px-3 py-2 bg-[#F8FAFC]"></td>
            </tr>

            {/* Row 2: 48px Gap Divider Row */}
            <tr className="h-12 bg-[#F1F5F9] border-t-2 border-[#CBD5E1] border-b-2 border-[#C7D2FE]">
              <td colSpan={weeks.length + 11} className="p-0 bg-[#F1F5F9]"></td>
            </tr>

            {/* Row 3: Reconciliation Header */}
            <tr className="bg-[#EEF2FF] border-b border-[#C7D2FE]">
              <td colSpan={weeks.length + 11} className="px-4 py-2.5 text-[#4338CA] font-extrabold text-xs uppercase tracking-wider">
                💰 WEEKLY CASH SETTLEMENT & RECONCILIATION
              </td>
            </tr>

            {/* Row 4: Settlement Week Headers */}
            <tr className="bg-[#F8FAFC] border-b-2 border-[#CBD5E1] text-xs text-[#0F172A]">
              <td className="sticky left-0 z-10 bg-[#F8FAFC] border-r border-[#CBD5E1] hidden sm:table-cell"></td>
              <td className="sticky left-0 sm:left-[50px] z-20 bg-[#F8FAFC] border-r-2 border-[#CBD5E1] px-3 py-2 text-left sticky-shadow font-bold">
                SETTLEMENT DETAILS
              </td>
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-center text-slate-400">—</td>
              <td className="border-r border-[#CBD5E1] px-3 py-2 text-center text-slate-400">Target</td>
              {weeks.map(w => (
                <td key={`rf-wh-${w.id}`} className="border-r border-[#CBD5E1] px-3 py-2 text-right">
                  <div className="font-bold">{w.label}</div>
                  <div className="text-[11px] text-slate-500 font-normal">{w.date}</div>
                </td>
              ))}
              <td colSpan={7} className="px-3 py-2 bg-[#F8FAFC]"></td>
            </tr>

            {/* Row 5: Previous Cash in Hand */}
            <tr className="border-b border-[#E2E8F0] hover:bg-slate-50">
              <td className="sticky left-0 z-10 bg-white border-r border-[#E2E8F0] hidden sm:table-cell"></td>
              <td className="sticky left-0 sm:left-[50px] z-20 bg-white border-r-2 border-[#CBD5E1] px-3 py-1.5 text-left font-semibold text-[#0F172A] sticky-shadow">
                Previous Cash in Hand
              </td>
              <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-slate-400 text-center">—</td>
              <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-slate-400 text-center">-</td>
              {weeks.map(w => {
                const weekData = reconciliationComputed.computedWeeks.find(cw => cw.weekId === w.id);
                const recon = weeklyReconciliation[w.id] || {};
                const hasCustom = (recon.prevCash !== null && recon.prevCash !== undefined && recon.prevCash !== '');

                return (
                  <td key={`prev-${w.id}`} className="border-r border-[#E2E8F0] px-1 py-1 text-right">
                    <input
                      type="number"
                      defaultValue={hasCustom ? recon.prevCash : ''}
                      placeholder={String(weekData?.prevCash || 0)}
                      onBlur={(e) => {
                        const val = e.target.value.trim() === '' ? null : Number(e.target.value);
                        onUpdateRecon(w.id, val, recon.expenses, recon.amountGiven, recon.salaries);
                      }}
                      className={`w-full text-right px-1.5 py-1 rounded text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ${hasCustom ? 'text-blue-700 bg-blue-50/50 font-bold' : 'text-[#0F172A] bg-transparent'
                        }`}
                    />
                  </td>
                );
              })}
              <td colSpan={7} className="px-3 py-1.5 text-slate-400"></td>
            </tr>

            {/* Row 6: Total Collections Received */}
            <tr className="border-b border-[#E2E8F0] bg-emerald-50/40">
              <td className="sticky left-0 z-10 bg-white border-r border-[#E2E8F0] hidden sm:table-cell"></td>
              <td className="sticky left-0 sm:left-[50px] z-20 bg-white border-r-2 border-[#CBD5E1] px-3 py-2 text-left font-bold text-emerald-800 sticky-shadow">
                + Collections Received
              </td>
              <td className="border-r border-[#E2E8F0] px-3 py-2 text-slate-400 text-center">—</td>
              <td className="border-r border-[#E2E8F0] px-3 py-2 text-slate-400 text-center">-</td>
              {weeks.map(w => {
                const weekData = reconciliationComputed.computedWeeks.find(cw => cw.weekId === w.id);
                return (
                  <td key={`coll-${w.id}`} className="border-r border-[#E2E8F0] px-3 py-2 text-right font-extrabold text-emerald-700 text-sm">
                    {formatDecimalINR(weekData?.collections || 0)}
                  </td>
                );
              })}
              <td colSpan={7} className="px-3 py-2 font-extrabold text-emerald-800 text-sm">
                Total: {formatDecimalINR(reconciliationComputed.grandTotalCollections)}
              </td>
            </tr>

            {/* Row 7: Weekly Expenses */}
            <tr className="border-b border-[#E2E8F0] hover:bg-slate-50">
              <td className="sticky left-0 z-10 bg-white border-r border-[#E2E8F0] hidden sm:table-cell"></td>
              <td className="sticky left-0 sm:left-[50px] z-20 bg-white border-r-2 border-[#CBD5E1] px-3 py-1.5 text-left font-semibold text-[#0F172A] sticky-shadow">
                - Expenses & Adjustments
              </td>
              <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-slate-400 text-center">—</td>
              <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-slate-400 text-center">-</td>
              {weeks.map(w => {
                const recon = weeklyReconciliation[w.id] || {};
                return (
                  <td key={`exp-${w.id}`} className="border-r border-[#E2E8F0] px-1 py-1 text-right">
                    <input
                      type="number"
                      defaultValue={recon.expenses || ''}
                      placeholder="0"
                      onBlur={(e) => {
                        const val = Number(e.target.value) || 0;
                        onUpdateRecon(w.id, recon.prevCash, val, recon.amountGiven, recon.salaries);
                      }}
                      className="w-full text-right px-1.5 py-1 rounded text-sm text-red-600 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent hover:bg-slate-100"
                    />
                  </td>
                );
              })}
              <td colSpan={7} className="px-3 py-1.5 font-bold text-red-700">
                Total: {formatDecimalINR(reconciliationComputed.grandTotalExpenses)}
              </td>
            </tr>

            {/* Row 8: New Loan Amounts Given */}
            <tr className="border-b border-[#E2E8F0] hover:bg-slate-50">
              <td className="sticky left-0 z-10 bg-white border-r border-[#E2E8F0] hidden sm:table-cell"></td>
              <td className="sticky left-0 sm:left-[50px] z-20 bg-white border-r-2 border-[#CBD5E1] px-3 py-1.5 text-left font-semibold text-[#0F172A] sticky-shadow">
                - Loan Amounts Given
              </td>
              <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-slate-400 text-center">—</td>
              <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-slate-400 text-center">-</td>
              {weeks.map(w => {
                const recon = weeklyReconciliation[w.id] || {};
                return (
                  <td key={`giv-${w.id}`} className="border-r border-[#E2E8F0] px-1 py-1 text-right">
                    <input
                      type="number"
                      defaultValue={recon.amountGiven || ''}
                      placeholder="0"
                      onBlur={(e) => {
                        const val = Number(e.target.value) || 0;
                        onUpdateRecon(w.id, recon.prevCash, recon.expenses, val, recon.salaries);
                      }}
                      className="w-full text-right px-1.5 py-1 rounded text-sm text-blue-600 font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent hover:bg-slate-100"
                    />
                  </td>
                );
              })}
              <td colSpan={7} className="px-3 py-1.5 font-bold text-blue-700">
                Total: {formatDecimalINR(reconciliationComputed.grandTotalGiven)}
              </td>
            </tr>

            {/* Row 9: Staff Salaries (Manual entry & deducted) */}
            <tr className="border-b border-[#E2E8F0] hover:bg-slate-50">
              <td className="sticky left-0 z-10 bg-white border-r border-[#E2E8F0] hidden sm:table-cell"></td>
              <td className="sticky left-0 sm:left-[50px] z-20 bg-white border-r-2 border-[#CBD5E1] px-3 py-1.5 text-left font-semibold text-[#0F172A] sticky-shadow">
                - Salaries
              </td>
              <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-slate-400 text-center">—</td>
              <td className="border-r border-[#E2E8F0] px-3 py-1.5 text-slate-400 text-center">-</td>
              {weeks.map(w => {
                const recon = weeklyReconciliation[w.id] || {};
                return (
                  <td key={`sal-${w.id}`} className="border-r border-[#E2E8F0] px-1 py-1 text-right">
                    <input
                      type="number"
                      defaultValue={recon.salaries || ''}
                      placeholder="0"
                      onBlur={(e) => {
                        const val = Number(e.target.value) || 0;
                        onUpdateRecon(w.id, recon.prevCash, recon.expenses, recon.amountGiven, val);
                      }}
                      className="w-full text-right px-1.5 py-1 rounded text-sm text-purple-700 font-bold focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent hover:bg-slate-100"
                      title={`Salaries for ${w.label}`}
                    />
                  </td>
                );
              })}
              <td colSpan={7} className="px-3 py-1.5 font-bold text-purple-700">
                Total: {formatDecimalINR(reconciliationComputed.grandTotalSalaries || 0)}
              </td>
            </tr>

            {/* Row 10: Net Cash in Hand Balance */}
            <tr className="bg-sky-50 border-t-2 border-sky-300 font-bold text-sm">
              <td className="sticky left-0 z-10 bg-sky-50 border-r border-sky-300 hidden sm:table-cell"></td>
              <td className="sticky left-0 sm:left-[50px] z-20 bg-sky-50 border-r-2 border-sky-300 px-3 py-2 text-left text-sky-950 sticky-shadow font-extrabold">
                = Net Cash in Hand
              </td>
              <td className="border-r border-sky-300 px-3 py-2 text-slate-400 text-center">—</td>
              <td className="border-r border-sky-300 px-3 py-2 text-slate-400 text-center">-</td>
              {weeks.map(w => {
                const weekData = reconciliationComputed.computedWeeks.find(cw => cw.weekId === w.id);
                const isNeg = (weekData?.netCash || 0) < 0;
                return (
                  <td
                    key={`net-${w.id}`}
                    className={`border-r border-sky-300 px-3 py-2 text-right ${isNeg ? 'bg-red-100 text-red-700 font-black' : 'text-sky-900 font-extrabold'
                      }`}
                  >
                    {formatDecimalINR(weekData?.netCash || 0)}
                  </td>
                );
              })}
              <td
                colSpan={7}
                className={`px-3 py-2 font-extrabold ${reconciliationComputed.rollingCash < 0 ? 'bg-red-200 text-red-900' : 'bg-sky-200 text-sky-950'
                  }`}
              >
                Today's Net: {formatDecimalINR(reconciliationComputed.rollingCash)}
              </td>
            </tr>
          </tfoot>
        </table>
      </main>
    </div>
  );
}
