import { parseDate, formatDateDMY } from './formatters';

const hasRealId = (c) => Boolean(c?.id) && c.id !== 'CUST-';
const normName = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * An "empty ghost" row carries no information of its own: no ID, no phone,
 * no loan amount and no payments. Such rows appear from old imports.
 */
function isEmptyGhost(c) {
  if (!c || c.isVillageDivider || c.is_village_divider) return false;
  const anyPayment = Object.values(c.payments || {}).some(v => Number(v) > 0);
  return !hasRealId(c) && !c.phone && !(Number(c.disbursed) > 0) && !anyPayment;
}

/**
 * Normalizer to guarantee every single customer row has a unique ID, isolated _rowId,
 * and hides phantom duplicates: an empty ghost row whose name matches a real
 * customer (one with an ID and a phone number). Distinct customers who share a
 * name are never hidden, because they carry their own data.
 */
export function normalizeCustomers(list) {
  if (!Array.isArray(list)) return [];

  const realNames = new Set(
    list.filter(c => hasRealId(c) && c.phone && c.name).map(c => normName(c.name))
  );
  const deduplicated = list.filter(c => !(isEmptyGhost(c) && c.name && realNames.has(normName(c.name))));

  const seenIds = new Set();
  let currentVillage = '';
  let currentVillageId = null;

  return deduplicated.map((c, idx) => {
    let cleanId = c.id;
    if (!cleanId || cleanId === 'CUST-' || seenIds.has(cleanId)) {
      cleanId = `CUST-${idx + 1}`;
    }
    seenIds.add(cleanId);

    const isDivider = Boolean(
      c.isVillageDivider ||
      c.is_village_divider ||
      (c.id && String(c.id).startsWith('VILLAGE-')) ||
      (c.name && String(c.name).includes('VILLAGE:'))
    );

    if (isDivider) {
      currentVillage = String(c.villageName || c.village_name || c.name || '')
        .replace('📍 VILLAGE:', '')
        .replace('VILLAGE:', '')
        .trim();
      currentVillageId = c.villageId || c.village_id || (c.id && !String(c.id).startsWith('CUST-') ? c.id : null) || `VIL-${idx + 1}`;
    }

    const resolvedVillageName = isDivider ? currentVillage : (c.villageName || c.village_name || currentVillage || '');
    const resolvedVillageId = isDivider ? currentVillageId : (c.villageId || c.village_id || currentVillageId || null);

    return {
      ...c,
      id: cleanId,
      _rowId: c._rowId || `row-${idx}-${cleanId}-${Math.random().toString(36).slice(2, 7)}`,
      name: c.name || '',
      isVillageDivider: isDivider,
      villageName: resolvedVillageName,
      villageId: resolvedVillageId,
      disbursed: Number(c.disbursed) || 0,
      originalAmount: (c.originalAmount !== undefined && c.originalAmount !== null && c.originalAmount !== '')
        ? Number(c.originalAmount)
        : (Number(c.disbursed) || 0),
      phone: c.phone || '',
      disbursedDate: c.disbursedDate ? (parseDate(c.disbursedDate) ? formatDateDMY(parseDate(c.disbursedDate), '/') : String(c.disbursedDate).replace(/-/g, '/')) : '',
      startWeekId: c.startWeekId || null,
      renewedAtWeek: c.renewedAtWeek || null,
      pastCyclePayments: c.pastCyclePayments || null,
      isArchived: Boolean(c.isArchived || c.is_archived),
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
