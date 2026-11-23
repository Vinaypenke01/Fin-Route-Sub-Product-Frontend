import { describe, it, expect } from 'vitest';
import { normalizeCustomers, getCustomerVillageName } from '../src/utils/customerNormalization';

describe('normalizeCustomers', () => {
  it('returns [] for non-arrays', () => {
    expect(normalizeCustomers(null)).toEqual([]);
    expect(normalizeCustomers({})).toEqual([]);
  });

  it('gives every row a unique id and row id', () => {
    const out = normalizeCustomers([
      { id: 'CUST-1', name: 'A' },
      { id: 'CUST-1', name: 'B' },
      { id: '', name: 'C' },
    ]);
    const ids = out.map(c => c.id);
    expect(new Set(ids).size).toBe(3);
    expect(new Set(out.map(c => c._rowId)).size).toBe(3);
  });

  it('carries the village from the preceding divider', () => {
    const out = normalizeCustomers([
      { id: 'VILLAGE-1', name: '📍 VILLAGE: Rampur', isVillageDivider: true },
      { id: 'CUST-1', name: 'A', disbursed: '500' },
      { id: 'VILLAGE-2', name: 'VILLAGE: Kothapet' },
      { id: 'CUST-2', name: 'B' },
    ]);
    expect(out[0].isVillageDivider).toBe(true);
    expect(out[1].villageName).toBe('Rampur');
    expect(out[2].isVillageDivider).toBe(true);
    expect(out[3].villageName).toBe('Kothapet');
  });

  it('coerces amounts and defaults original amount to disbursed', () => {
    const [c] = normalizeCustomers([{ id: 'CUST-1', name: 'A', disbursed: '1500' }]);
    expect(c.disbursed).toBe(1500);
    expect(c.originalAmount).toBe(1500);
    expect(c.payments).toEqual({});
  });

  it('normalises issue dates to DD/MM/YYYY', () => {
    const [c] = normalizeCustomers([{ id: 'CUST-1', name: 'A', disbursedDate: '2026-10-25' }]);
    expect(c.disbursedDate).toBe('25/10/2026');
  });
});

describe('getCustomerVillageName', () => {
  const list = [
    { _rowId: 'r0', isVillageDivider: true, name: 'VILLAGE: Rampur' },
    { _rowId: 'r1', id: 'C1' },
    { _rowId: 'r2', isVillageDivider: true, name: 'VILLAGE: Kothapet' },
    { _rowId: 'r3', id: 'C3' },
  ];

  it('finds the nearest divider above the row', () => {
    expect(getCustomerVillageName(list, 'r1')).toBe('Rampur');
    expect(getCustomerVillageName(list, 'C3')).toBe('Kothapet');
  });

  it('returns "" for unknown rows', () => {
    expect(getCustomerVillageName(list, 'nope')).toBe('');
    expect(getCustomerVillageName(null, 'r1')).toBe('');
  });
});
