// Indian Rupee & Number Formatting Helpers

export function formatINR(val) {
  const num = Math.round(Number(val) || 0);
  if (num < 0) {
    return '- ₹ ' + Math.abs(num).toLocaleString('en-IN');
  }
  return '₹ ' + num.toLocaleString('en-IN');
}

export function formatDecimalINR(val) {
  const num = Number(val) || 0;
  if (num < 0) {
    return '- ₹ ' + Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseINR(str) {
  if (typeof str === 'number') return str;
  return parseFloat(String(str).replace(/[^0-9.-]+/g, '')) || 0;
}

// Business Calculations for a customer
export function getCustomerTotalPaid(cust) {
  if (!cust || cust.isVillageDivider || !cust.payments) return 0;
  return Object.values(cust.payments).reduce((sum, p) => sum + (Number(p) || 0), 0);
}

export function getCustomerBalance(cust) {
  if (!cust || cust.isVillageDivider) return 0;
  const totalPaid = getCustomerTotalPaid(cust);
  const disbursed = Number(cust.disbursed) || 0;
  return Math.max(0, disbursed - totalPaid);
}

export function getCustomerStatus(cust) {
  if (!cust || cust.isVillageDivider) return '';
  if (cust.isArchived) return 'Archived';
  const balance = getCustomerBalance(cust);
  return balance <= 0 ? 'Paid Off' : 'Active';
}

export function getWeekTotal(customers, weekId, archive = []) {
  return (customers || []).reduce((sum, c) => {
    if (c.isVillageDivider) return sum;
    const activeVal = Number(c.payments?.[weekId]) || 0;
    let pastVal = Number(c.pastCyclePayments?.[weekId]) || 0;
    if (!pastVal && archive && archive.length > 0) {
      const arc = archive.find(a => (
        (a.originalId && a.originalId === c.id) ||
        (a.id && (a.id === c.id || a.id.includes(c.id))) ||
        (a.name && c.name && a.name.trim().toLowerCase() === c.name.trim().toLowerCase())
      ));
      if (arc?.payments && arc.payments[weekId] !== undefined) {
        pastVal = Number(arc.payments[weekId]) || 0;
      }
    }
    return sum + activeVal + pastVal;
  }, 0);
}

export function getWeekRecon(weeklyReconciliation, weekId) {
  const recon = weeklyReconciliation || {};
  return recon[weekId] || { prevCash: null, expenses: 0, amountGiven: 0, salaries: 0 };
}

// Complete Weekly Cash Settlement Engine
export function calculateReconciliation(weeks = [], customers = [], weeklyReconciliation = {}, archive = []) {
  let rollingCash = 0;
  const computedWeeks = [];

  let grandTotalCollections = 0;
  let grandTotalExpenses = 0;
  let grandTotalGiven = 0;
  let grandTotalSalaries = 0;

  weeks.forEach((w, idx) => {
    const recon = weeklyReconciliation[w.id] || { prevCash: null, expenses: 0, amountGiven: 0, salaries: 0 };
    const weekCollections = getWeekTotal(customers, w.id, archive);

    const hasCustomPrev = (recon.prevCash !== null && recon.prevCash !== undefined && recon.prevCash !== '');
    const prevCash = hasCustomPrev ? Number(recon.prevCash) : rollingCash;

    const exp = Number(recon.expenses) || 0;
    const giv = Number(recon.amountGiven) || 0;
    const sal = Number(recon.salaries) || 0;

    const netCash = prevCash + weekCollections - exp - giv - sal;
    rollingCash = netCash;

    grandTotalCollections += weekCollections;
    grandTotalExpenses += exp;
    grandTotalGiven += giv;
    grandTotalSalaries += sal;

    computedWeeks.push({
      weekId: w.id,
      label: w.label,
      date: w.date,
      hasCustomPrev,
      prevCash: hasCustomPrev ? Number(recon.prevCash) : prevCash,
      rawPrevCash: recon.prevCash,
      collections: weekCollections,
      expenses: exp,
      amountGiven: giv,
      salaries: sal,
      netCash: netCash
    });
  });

  return {
    computedWeeks,
    grandTotalCollections,
    grandTotalExpenses,
    grandTotalGiven,
    grandTotalSalaries,
    rollingCash
  };
}

// Date Parsing & Cascading Helpers for Weekly Ledger
export function parseDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month) {
      return d;
    }
  }

  // Match YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month) {
      return d;
    }
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateDMY(date, separator = '/') {
  if (!date || isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${separator}${month}${separator}${year}`;
}

export function toIsoDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
}

export function recalculateWeeksFromWeekOne(weeks, newStartDateStr) {
  if (!Array.isArray(weeks) || weeks.length === 0) return weeks;
  const parsed = parseDate(newStartDateStr);
  if (!parsed) return weeks;

  return weeks.map((w, idx) => {
    const d = new Date(parsed.getTime());
    d.setDate(parsed.getDate() + (idx * 7));
    return {
      ...w,
      date: formatDateDMY(d, '/')
    };
  });
}

