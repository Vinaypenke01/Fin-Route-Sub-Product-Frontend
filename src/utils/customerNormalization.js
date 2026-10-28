import { parseDate, formatDateDMY } from './formatters';

/**
 * Normalizer to guarantee every single customer row has a unique ID, isolated _rowId,
 * and filters phantom duplicates (e.g. ghost Kola Srinu entries with empty phone/ID).
 */
export function normalizeCustomers(list) {
  if (!Array.isArray(list)) return [];

  // Identify real customers with phone numbers or distinct IDs
  const realKola = list.find(c => (c.name || '').includes('కోలా శ్రీను') && c.id && c.id !== 'CUST-' && c.phone);

  // Filter out any ghost/phantom duplicates of "కోలా శ్రీను" that have empty ID/phone
  const deduplicated = list.filter(c => {
    const isPhantomKola = realKola && (c.name || '').includes('కోలా శ్రీను') && (!c.phone || c.id === 'CUST-') && c !== realKola;
    return !isPhantomKola;
  });

  const seenIds = new Set();
  return deduplicated.map((c, idx) => {
    let cleanId = c.id;
    if (!cleanId || cleanId === 'CUST-' || seenIds.has(cleanId)) {
      cleanId = `CUST-${idx + 1}`;
    }
    seenIds.add(cleanId);

    return {
      ...c,
      id: cleanId,
      _rowId: c._rowId || `row-${idx}-${cleanId}-${Math.random().toString(36).slice(2, 7)}`,
      name: c.name || '',
      disbursed: Number(c.disbursed) || 0,
      originalAmount: (c.originalAmount !== undefined && c.originalAmount !== null && c.originalAmount !== '')
        ? Number(c.originalAmount)
        : (Number(c.disbursed) || 0),
      phone: c.phone || '',
      disbursedDate: c.disbursedDate ? (parseDate(c.disbursedDate) ? formatDateDMY(parseDate(c.disbursedDate), '/') : String(c.disbursedDate).replace(/-/g, '/')) : '',
      startWeekId: c.startWeekId || null,
      renewedAtWeek: c.renewedAtWeek || null,
      pastCyclePayments: c.pastCyclePayments || null,
      isArchived: Boolean(c.isArchived),
      archivedAtWeek: c.archivedAtWeek || null,
      payments: c.payments || {}
    };
  });
}

/**
 * Helper to determine customer village name by scanning preceding village dividers
 */
export function getCustomerVillageName(customerList, rowId) {
  if (!Array.isArray(customerList) || !rowId) return '';
  let currentVillage = '';
  for (let i = 0; i < customerList.length; i++) {
    const item = customerList[i];
    if (item.isVillageDivider || (item.id && String(item.id).startsWith('VILLAGE-')) || (item.name && String(item.name).includes('VILLAGE:'))) {
      currentVillage = String(item.villageName || item.name || '').replace('📍 VILLAGE:', '').replace('VILLAGE:', '').trim();
    }
    if (item._rowId === rowId || item.id === rowId) {
      return item.villageName || currentVillage || '';
    }
  }
  return '';
}
