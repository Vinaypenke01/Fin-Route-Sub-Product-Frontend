// Turns rows from the tenant's change_log table into plain-language lines.

const FIELD_LABELS = {
  amount: 'Amount',
  name: 'Name',
  phone: 'Phone',
  disbursed: 'Payable amount',
  original_amount: 'Original amount',
  disbursed_date: 'Issue date',
  village_name: 'Village',
  village_id: 'Village',
  row_order: 'Route position',
  start_week_id: 'Start week',
  renewed_at_week: 'Renewed at week',
  past_cycle_payments: 'Past-cycle payments',
  is_archived: 'Archived',
  prev_cash: 'Opening cash',
  expenses: 'Expenses',
  amount_given: 'New loans given',
  salaries: 'Salaries',
  notes: 'Notes',
  label: 'Label',
  week_date: 'Date',
  col_index: 'Column',
  status: 'Status',
  reason: 'Reason',
  total_repaid: 'Total repaid',
  final_balance: 'Final balance',
  display_order: 'Order',
};

const MONEY_FIELDS = new Set([
  'amount', 'disbursed', 'original_amount', 'prev_cash', 'expenses',
  'amount_given', 'salaries', 'total_repaid', 'final_balance',
]);

const TABLE_LABELS = {
  payments: 'Payment',
  customers: 'Customer',
  weekly_reconciliation: 'Cash settlement',
  weeks: 'Week column',
  loan_archive: 'Loan archive',
  villages: 'Village',
};

export function formatChangeValue(field, value) {
  if (value === null || value === undefined || value === '') return '–';
  if (MONEY_FIELDS.has(field)) {
    const n = Number(value);
    return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : String(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return '(details)';
  return String(value);
}

/**
 * @param row     change_log row
 * @param lookup  { customerName(id), weekLabel(id) } to show names instead of ids
 * @returns { title, subject, changes: [{ field, label, from, to }], who, when }
 */
export function describeChange(row, lookup = {}) {
  const table = row?.table_name || '';
  const action = row?.action || '';
  const thing = TABLE_LABELS[table] || table;
  const customerName = lookup.customerName || (() => null);
  const weekLabel = lookup.weekLabel || (() => null);

  const values = row?.new_values || row?.old_values || {};
  let subject = '';
  if (table === 'payments') {
    const [custId, weekId] = String(row?.record_id || '').split(':');
    subject = `${customerName(custId) || custId || 'Customer'} · ${weekLabel(weekId) || weekId || ''}`.trim();
  } else if (table === 'customers') {
    subject = values.name || customerName(row?.record_id) || row?.record_id || '';
  } else if (table === 'weekly_reconciliation' || table === 'weeks') {
    subject = weekLabel(row?.record_id) || values.label || row?.record_id || '';
  } else {
    subject = values.name || row?.record_id || '';
  }

  const verb = action === 'insert' ? 'added' : action === 'delete' ? 'deleted' : 'changed';
  const title = `${thing} ${verb}`;

  const changes = [];
  if (action === 'update') {
    for (const field of Object.keys(row?.new_values || {})) {
      changes.push({
        field,
        label: FIELD_LABELS[field] || field,
        from: formatChangeValue(field, row?.old_values?.[field]),
        to: formatChangeValue(field, row.new_values[field]),
      });
    }
  } else if (table === 'payments') {
    const amount = (action === 'delete' ? row?.old_values : row?.new_values)?.amount;
    changes.push({
      field: 'amount',
      label: 'Amount',
      from: action === 'delete' ? formatChangeValue('amount', amount) : '–',
      to: action === 'delete' ? '–' : formatChangeValue('amount', amount),
    });
  }

  return {
    title,
    subject,
    changes,
    who: row?.changed_by_email || 'unknown user',
    when: row?.changed_at ? new Date(row.changed_at) : null,
  };
}
