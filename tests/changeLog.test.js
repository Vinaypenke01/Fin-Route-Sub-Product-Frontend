import { describe, it, expect } from 'vitest';
import { describeChange, formatChangeValue } from '../src/utils/changeLog';

const lookup = {
  customerName: (id) => ({ 'CUST-1': 'Ravi Kumar' }[id] || null),
  weekLabel: (id) => ({ week_3: 'Week 3' }[id] || null),
};

describe('describeChange', () => {
  it('describes a payment edit with old and new amounts', () => {
    const d = describeChange({
      table_name: 'payments', record_id: 'CUST-1:week_3', action: 'update',
      old_values: { amount: 500 }, new_values: { amount: 50 },
      changed_by_email: 'op@example.com', changed_at: '2026-11-23T10:42:00Z',
    }, lookup);
    expect(d.title).toBe('Payment changed');
    expect(d.subject).toBe('Ravi Kumar · Week 3');
    expect(d.changes).toEqual([{ field: 'amount', label: 'Amount', from: '₹500', to: '₹50' }]);
    expect(d.who).toBe('op@example.com');
    expect(d.when.toISOString()).toBe('2026-11-23T10:42:00.000Z');
  });

  it('describes a new payment and a removed payment', () => {
    const added = describeChange({ table_name: 'payments', record_id: 'CUST-1:week_3', action: 'insert', new_values: { amount: 1200 } }, lookup);
    expect(added.title).toBe('Payment added');
    expect(added.changes[0]).toMatchObject({ from: '–', to: '₹1,200' });
    const removed = describeChange({ table_name: 'payments', record_id: 'CUST-1:week_3', action: 'delete', old_values: { amount: 300 } }, lookup);
    expect(removed.title).toBe('Payment deleted');
    expect(removed.changes[0]).toMatchObject({ from: '₹300', to: '–' });
  });

  it('lists every changed customer field with friendly names', () => {
    const d = describeChange({
      table_name: 'customers', record_id: 'CUST-1', action: 'update',
      old_values: { phone: '9000000000', disbursed: 10000 },
      new_values: { phone: '9111111111', disbursed: 12000 },
    }, lookup);
    expect(d.subject).toBe('Ravi Kumar');
    expect(d.changes.map(c => `${c.label}: ${c.from} → ${c.to}`)).toEqual([
      'Phone: 9000000000 → 9111111111',
      'Payable amount: ₹10,000 → ₹12,000',
    ]);
  });

  it('names cash settlements by week and falls back to ids', () => {
    expect(describeChange({ table_name: 'weekly_reconciliation', record_id: 'week_3', action: 'update', old_values: { expenses: 0 }, new_values: { expenses: 150 } }, lookup).subject).toBe('Week 3');
    expect(describeChange({ table_name: 'payments', record_id: 'CUST-9:week_9', action: 'insert', new_values: { amount: 1 } }).subject).toBe('CUST-9 · week_9');
  });

  it('handles missing data without crashing', () => {
    const d = describeChange({});
    expect(d.title).toBe(' changed');
    expect(d.who).toBe('unknown user');
    expect(d.when).toBeNull();
  });
});

describe('formatChangeValue', () => {
  it('formats money, empties, booleans and objects', () => {
    expect(formatChangeValue('salaries', '2500')).toBe('₹2,500');
    expect(formatChangeValue('notes', '')).toBe('–');
    expect(formatChangeValue('is_archived', true)).toBe('Yes');
    expect(formatChangeValue('past_cycle_payments', { a: 1 })).toBe('(details)');
  });
});
