import { describe, it, expect } from 'vitest';
import {
  formatINR,
  parseINR,
  getCustomerTotalPaid,
  getCustomerBalance,
  getCustomerStatus,
  getWeekTotal,
  calculateReconciliation,
  parseDate,
  formatDateDMY,
  toIsoDate,
  recalculateWeeksFromWeekOne,
} from '../src/utils/formatters';

const cust = (over = {}) => ({ id: 'C1', name: 'A', disbursed: 1000, payments: {}, ...over });

describe('currency helpers', () => {
  it('formats rupees with Indian grouping and rounds', () => {
    expect(formatINR(123456.6)).toBe('₹ 1,23,457');
    expect(formatINR(-2500)).toBe('- ₹ 2,500');
    expect(formatINR('not a number')).toBe('₹ 0');
  });

  it('parses formatted amounts back to numbers', () => {
    expect(parseINR('₹ 1,23,457')).toBe(123457);
    expect(parseINR(42)).toBe(42);
    expect(parseINR('abc')).toBe(0);
  });
});

describe('customer balance', () => {
  it('sums weekly payments, ignoring blanks and text', () => {
    expect(getCustomerTotalPaid(cust({ payments: { w1: 100, w2: '200', w3: '', w4: 'x' } }))).toBe(300);
  });

  it('balance = disbursed - paid, never below zero', () => {
    expect(getCustomerBalance(cust({ payments: { w1: 400 } }))).toBe(600);
    expect(getCustomerBalance(cust({ payments: { w1: 1500 } }))).toBe(0);
  });

  it('village dividers have no money', () => {
    const divider = { isVillageDivider: true, disbursed: 999, payments: { w1: 5 } };
    expect(getCustomerTotalPaid(divider)).toBe(0);
    expect(getCustomerBalance(divider)).toBe(0);
    expect(getCustomerStatus(divider)).toBe('');
  });

  it('status: Active, Paid Off, Archived', () => {
    expect(getCustomerStatus(cust({ payments: { w1: 100 } }))).toBe('Active');
    expect(getCustomerStatus(cust({ payments: { w1: 1000 } }))).toBe('Paid Off');
    expect(getCustomerStatus(cust({ isArchived: true }))).toBe('Archived');
  });
});

describe('weekly collections', () => {
  it('adds current and past-cycle payments, skips dividers', () => {
    const customers = [
      cust({ id: 'C1', payments: { w1: 100 } }),
      cust({ id: 'C2', payments: { w1: 50 }, pastCyclePayments: { w1: 25 } }),
      { isVillageDivider: true, payments: { w1: 999 } },
    ];
    expect(getWeekTotal(customers, 'w1')).toBe(175);
  });

  it('falls back to the archive for renewed customers', () => {
    const customers = [cust({ id: 'C1', payments: {} })];
    const archive = [{ originalId: 'C1', payments: { w1: 300 } }];
    expect(getWeekTotal(customers, 'w1', archive)).toBe(300);
  });
});

describe('cash reconciliation', () => {
  const weeks = [{ id: 'w1', label: 'Week 1' }, { id: 'w2', label: 'Week 2' }];
  const customers = [cust({ payments: { w1: 500, w2: 300 } })];

  it('rolls net cash forward week to week', () => {
    const recon = {
      w1: { prevCash: 1000, expenses: 50, amountGiven: 200, salaries: 100 },
      w2: { prevCash: null, expenses: 0, amountGiven: 0, salaries: 0 },
    };
    const r = calculateReconciliation(weeks, customers, recon);
    // w1: 1000 + 500 - 50 - 200 - 100 = 1150; w2: 1150 + 300 = 1450
    expect(r.computedWeeks[0].netCash).toBe(1150);
    expect(r.computedWeeks[1].prevCash).toBe(1150);
    expect(r.computedWeeks[1].netCash).toBe(1450);
    expect(r.rollingCash).toBe(1450);
    expect(r.grandTotalCollections).toBe(800);
    expect(r.grandTotalSalaries).toBe(100);
  });

  it('a manually entered opening cash overrides the rolled-over value', () => {
    const recon = { w2: { prevCash: 5000, expenses: 0, amountGiven: 0, salaries: 0 } };
    const r = calculateReconciliation(weeks, customers, recon);
    expect(r.computedWeeks[1].hasCustomPrev).toBe(true);
    expect(r.computedWeeks[1].netCash).toBe(5300);
  });

  it('treats an empty-string opening cash as "not entered"', () => {
    const recon = { w2: { prevCash: '', expenses: 0, amountGiven: 0, salaries: 0 } };
    const r = calculateReconciliation(weeks, customers, recon);
    expect(r.computedWeeks[1].hasCustomPrev).toBe(false);
    expect(r.computedWeeks[1].prevCash).toBe(500);
  });
});

describe('dates', () => {
  it('parses DD/MM/YYYY, DD-MM-YYYY and YYYY-MM-DD', () => {
    for (const s of ['25/10/2026', '25-10-2026', '2026-10-25']) {
      expect(toIsoDate(parseDate(s))).toBe('2026-10-25');
    }
  });

  it('rejects impossible or empty dates', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(parseDate('hello')).toBeNull();
  });

  it('formats as DD/MM/YYYY', () => {
    expect(formatDateDMY(new Date(2026, 0, 5))).toBe('05/01/2026');
    expect(formatDateDMY(new Date(2026, 0, 5), '-')).toBe('05-01-2026');
  });

  it('cascades +7 days from week 1, across month and year ends', () => {
    const weeks = [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }];
    const out = recalculateWeeksFromWeekOne(weeks, '25/12/2026');
    expect(out.map(w => w.date)).toEqual(['25/12/2026', '01/01/2027', '08/01/2027']);
    expect(out[1].id).toBe('w2');
  });

  it('leaves weeks unchanged for an invalid start date', () => {
    const weeks = [{ id: 'w1', date: '01/01/2026' }];
    expect(recalculateWeeksFromWeekOne(weeks, 'bad')).toBe(weeks);
  });
});
