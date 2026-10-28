import { useMemo } from 'react';
import {
  getCustomerTotalPaid,
  getCustomerBalance,
  getCustomerStatus,
  calculateReconciliation
} from '../utils/formatters';

/**
 * Custom hook providing memoized financial calculations, weekly reconciliation totals,
 * and filtered customer records based on search query and status filter.
 */
export function useLedgerCalculations({
  customers,
  weeks,
  weeklyReconciliation,
  archive,
  searchQuery = '',
  statusFilter = 'all'
}) {
  // Financial KPI Aggregations
  const {
    totalCapitalDisbursed,
    totalDisbursed,
    totalCollected,
    totalBalance,
    activeCount,
    paidOffCount
  } = useMemo(() => {
    let capDisb = 0; // Total Capital Disbursed (sum of originalAmount)
    let disb = 0;
    let coll = 0;
    let bal = 0;
    let act = 0;
    let paid = 0;

    (customers || []).forEach(c => {
      if (c.isVillageDivider) return;
      const cPaid = getCustomerTotalPaid(c);
      const cBal = getCustomerBalance(c);
      const orig = (c.originalAmount !== undefined && c.originalAmount !== null && c.originalAmount !== '')
        ? Number(c.originalAmount)
        : (Number(c.disbursed) || 0);

      capDisb += orig;
      disb += Number(c.disbursed) || 0;
      coll += cPaid;
      bal += cBal;
      if (cBal <= 0) paid++;
      else act++;
    });

    return {
      totalCapitalDisbursed: capDisb,
      totalDisbursed: disb,
      totalCollected: coll,
      totalBalance: bal,
      activeCount: act,
      paidOffCount: paid
    };
  }, [customers]);

  // Dynamic Weekly Reconciliation Table Calculations
  const reconciliationComputed = useMemo(() => {
    return calculateReconciliation(weeks, customers, weeklyReconciliation, archive);
  }, [weeks, customers, weeklyReconciliation, archive]);

  // Filtered customer list (handles village dividers and text search)
  const filteredCustomers = useMemo(() => {
    const q = (searchQuery || '').toLowerCase().trim();
    return (customers || []).filter(c => {
      if (c.isVillageDivider) {
        if (!q) return true;
        return (c.villageName || c.name || '').toLowerCase().includes(q);
      }

      // Status filter
      const status = getCustomerStatus(c);
      if (statusFilter === 'active' && (c.isArchived || status !== 'Active')) return false;
      if (statusFilter === 'paidoff' && status !== 'Paid Off' && !c.isArchived) return false;

      // Search query filter
      if (!q) return true;
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const id = (c.id || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || id.includes(q);
    });
  }, [customers, searchQuery, statusFilter]);

  return {
    totalCapitalDisbursed,
    totalDisbursed,
    totalCollected,
    totalBalance,
    activeCount,
    paidOffCount,
    reconciliationComputed,
    filteredCustomers
  };
}
