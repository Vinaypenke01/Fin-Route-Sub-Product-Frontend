import { getCustomerTotalPaid, getCustomerBalance, getCustomerStatus } from './formatters';

/**
 * Escapes a CSV cell value to handle commas, newlines, and double quotes.
 * Mitigates CSV Formula / DDE Injection by prepending an apostrophe if value starts with =, +, -, @, or tab.
 */
function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exports complete customer tracker records, weekly payment columns, and cash reconciliation into formatted CSV.
 * Uses UTF-8 BOM (\uFEFF) to guarantee full Telugu script compatibility in Microsoft Excel & Google Sheets.
 */
export function exportTrackerToCSV({
  weeks = [],
  customers = [],
  weeklyReconciliation = {},
  reconciliationComputed = {},
  clientName = 'Route'
}) {
  const rows = [];

  // 1. Report Header
  rows.push([escapeCSV(`FinRoute Collect — Route Microfinance Ledger Report`)]);
  rows.push([escapeCSV(`Client / Operator: ${clientName || 'Valued Partner'}`)]);
  rows.push([escapeCSV(`Exported Date: ${new Date().toLocaleString('en-IN')}`)]);
  rows.push([]); // Blank line

  // 2. Table Column Headers
  const headerCols = [
    'S.No',
    'Customer ID',
    'Customer Name (Telugu / English)',
    'Phone',
    'Issue Date',
    'Original Amount (₹)',
    'Payable Amount (₹)',
    'Start Week',
    ...weeks.map(w => `${w.label || w.id}${w.date ? ` (${w.date})` : ''}`),
    'Total Paid (₹)',
    'Balance Due (₹)',
    'Status'
  ];
  rows.push(headerCols.map(escapeCSV));

  // 3. Customer Data Rows & Village Separators
  let customerSerial = 1;
  const weekTotals = {};
  weeks.forEach(w => {
    weekTotals[w.id] = 0;
  });

  let grandTotalOriginal = 0;
  let grandTotalDisbursed = 0;
  let grandTotalPaid = 0;
  let grandTotalBalance = 0;

  customers.forEach(c => {
    if (c.isVillageDivider) {
      // Village Divider Row
      const villageTitle = `📍 VILLAGE: ${c.villageName || c.name || 'Unnamed Village'}`;
      const dividerRow = ['---', '---', villageTitle, '', '', '', '', '', ...weeks.map(() => ''), '', '', '---'];
      rows.push(dividerRow.map(escapeCSV));
      return;
    }

    const totalPaid = getCustomerTotalPaid(c);
    const balance = getCustomerBalance(c);
    const status = getCustomerStatus(c);
    const origAmount = Number(c.originalAmount !== undefined && c.originalAmount !== null ? c.originalAmount : c.disbursed) || 0;
    const currentDisbursed = Number(c.disbursed) || 0;

    grandTotalOriginal += origAmount;
    grandTotalDisbursed += currentDisbursed;
    grandTotalPaid += totalPaid;
    grandTotalBalance += balance;

    const row = [
      customerSerial++,
      c.id,
      c.name || '',
      c.phone || '',
      c.disbursedDate || '',
      origAmount,
      currentDisbursed,
      c.startWeekId || 'Week 1',
      ...weeks.map(w => {
        const val = Number(c.payments?.[w.id]) || 0;
        weekTotals[w.id] = (weekTotals[w.id] || 0) + val;
        return val > 0 ? val : 0;
      }),
      totalPaid,
      balance,
      status === 'paid' ? 'Paid Off' : status === 'renewed' ? 'Renewed' : 'Active'
    ];
    rows.push(row.map(escapeCSV));
  });

  // 4. Ledger Grand Totals Row
  const totalsRow = [
    'GRAND TOTALS',
    '',
    `Total Customers: ${customerSerial - 1}`,
    '',
    '',
    grandTotalOriginal,
    grandTotalDisbursed,
    '',
    ...weeks.map(w => weekTotals[w.id] || 0),
    grandTotalPaid,
    grandTotalBalance,
    ''
  ];
  rows.push(totalsRow.map(escapeCSV));

  // 5. Blank Separators before Financial Reconciliation
  rows.push([]);
  rows.push([]);
  rows.push([escapeCSV('WEEKLY FINANCIAL RECONCILIATION SUMMARY')]);
  rows.push([]);

  // Reconciliation Table Headers
  const reconHeader = [
    'Financial Item',
    'Description',
    ...weeks.map(w => `${w.label || w.id}${w.date ? ` (${w.date})` : ''}`),
    'Grand Total (₹)'
  ];
  rows.push(reconHeader.map(escapeCSV));

  // Recon Row 1: Weekly Collections
  const r1 = [
    'Weekly Collections',
    'Gross customer collections during route',
    ...weeks.map(w => weekTotals[w.id] || 0),
    grandTotalPaid
  ];
  rows.push(r1.map(escapeCSV));

  // Recon Row 2: Cash Brought Forward
  const r2 = [
    'Cash in Hand (Opening)',
    'Opening balance brought forward from prior week',
    ...weeks.map(w => {
      const rec = weeklyReconciliation[w.id] || {};
      return rec.prevCash !== undefined && rec.prevCash !== null ? Number(rec.prevCash) : 0;
    }),
    ''
  ];
  rows.push(r2.map(escapeCSV));

  // Recon Row 3: Bank Transfers
  const r3 = [
    '- Bank Transfers',
    'Amounts transferred to bank account',
    ...weeks.map(w => {
      const rec = weeklyReconciliation[w.id] || {};
      return Number(rec.bankTransfers || rec.bank_transfers || 0);
    }),
    reconciliationComputed?.grandTotalBankTransfers || 0
  ];
  rows.push(r3.map(escapeCSV));

  // Recon Row 4: Operating Expenses
  const r4 = [
    '- Operating Expenses',
    'Fuel, travel, and route operating expenses',
    ...weeks.map(w => {
      const rec = weeklyReconciliation[w.id] || {};
      return Number(rec.expenses || 0);
    }),
    reconciliationComputed?.grandTotalExpenses || 0
  ];
  rows.push(r4.map(escapeCSV));

  // Recon Row 5: Loan Amounts Given
  const r5 = [
    '- Loan Amounts Given',
    'New loan disbursements given out this week',
    ...weeks.map(w => {
      const rec = weeklyReconciliation[w.id] || {};
      return Number(rec.amountGiven || rec.amount_given || 0);
    }),
    reconciliationComputed?.grandTotalGiven || 0
  ];
  rows.push(r5.map(escapeCSV));

  // Recon Row 6: Staff Salaries
  const r6 = [
    '- Staff Salaries',
    'Weekly salaries paid to route officers',
    ...weeks.map(w => {
      const rec = weeklyReconciliation[w.id] || {};
      return Number(rec.salaries || 0);
    }),
    reconciliationComputed?.grandTotalSalaries || 0
  ];
  rows.push(r6.map(escapeCSV));

  // Recon Row 7: Net Cash in Hand
  const r7 = [
    '= Net Cash in Hand (Closing)',
    'Closing cash in hand at end of collection day',
    ...weeks.map(w => {
      const rec = weeklyReconciliation[w.id] || {};
      const col = weekTotals[w.id] || 0;
      const prev = rec.prevCash !== undefined && rec.prevCash !== null ? Number(rec.prevCash) : 0;
      const exp = Number(rec.expenses || 0);
      const given = Number(rec.amountGiven || rec.amount_given || 0);
      const sal = Number(rec.salaries || 0);
      const bank = Number(rec.bankTransfers || rec.bank_transfers || 0);
      return (prev + col) - exp - given - sal - bank;
    }),
    reconciliationComputed?.rollingCash || 0
  ];
  rows.push(r7.map(escapeCSV));

  // 6. Build CSV string with UTF-8 BOM
  const csvString = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');

  // 7. Trigger Browser Download
  const cleanFileName = `FinRoute_Ledger_${String(clientName || 'Route').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { success: true, fileName: cleanFileName };
}
