import { createClient } from '@supabase/supabase-js';

// Cache client instances per URL to avoid re-instantiation overhead
const clientCache = new Map();

function tenantStorageKey(url) {
  try {
    return `finroute-tenant-auth-${new URL(url).host}`;
  } catch {
    return `finroute-tenant-auth-${url}`;
  }
}

function pickStorage(remember) {
  try {
    return remember ? window.localStorage : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * Tenant DB client. When the operator signed in through the tenant-login Edge
 * Function, this client carries their tenant Auth session (kept in local or
 * session storage to match "remember me") and refreshes it automatically.
 */
export function getTenantClient(url, anonKey, { remember = false } = {}) {
  if (!url || !anonKey) return null;
  const key = `${url}::${anonKey}::${remember ? 'local' : 'session'}`;
  if (!clientCache.has(key)) {
    const client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: tenantStorageKey(url),
        storage: pickStorage(remember),
      },
      db: { schema: 'public' }
    });
    clientCache.set(key, client);
  }
  return clientCache.get(key);
}

/**
 * PULL ALL DATA: Fetches complete isolated ledger for the tenant
 */
export async function fetchTenantLedgerData(client) {
  if (!client) throw new Error('Tenant database client is not initialized.');

  // Parallel fetch of all relational tables
  const [
    { data: villages, error: vErr },
    { data: customers, error: cErr },
    { data: weeks, error: wErr },
    { data: payments, error: pErr },
    { data: recon, error: rErr },
    { data: archive, error: aErr },
    { data: settings }
  ] = await Promise.all([
    client.from('villages').select('*').order('display_order', { ascending: true }),
    client.from('customers').select('*').order('row_order', { ascending: true }),
    client.from('weeks').select('*').order('col_index', { ascending: true }),
    client.from('payments').select('*'),
    client.from('weekly_reconciliation').select('*'),
    client.from('loan_archive').select('*').order('date_archived', { ascending: false }),
    client.from('tenant_settings').select('*').limit(1).maybeSingle()
  ]);

  if (cErr) throw cErr;
  if (wErr) throw wErr;

  // Build payment dictionary per customer
  const paymentMap = new Map();
  (payments || []).forEach(p => {
    if (!paymentMap.has(p.customer_id)) {
      paymentMap.set(p.customer_id, {});
    }
    paymentMap.get(p.customer_id)[p.week_id] = Number(p.amount) || 0;
  });

  // Map customers with payments and automatic hierarchical village resolution
  let currentVilName = '';
  let currentVilId = null;
  const villageMap = new Map((villages || []).map(v => [v.name?.toLowerCase()?.trim(), v.id]));

  const formattedCustomers = (customers || []).map((c, idx) => {
    const isDivider = Boolean(c.is_village_divider);
    if (isDivider) {
      currentVilName = String(c.village_name || c.name || '')
        .replace('📍 VILLAGE:', '')
        .replace('VILLAGE:', '')
        .trim();
      currentVilId = c.village_id || villageMap.get(currentVilName.toLowerCase()) || `VIL-${idx + 1}`;
    }

    const resolvedVillageName = isDivider ? currentVilName : (c.village_name || currentVilName || '');
    const resolvedVillageId = isDivider
      ? currentVilId
      : (c.village_id || (resolvedVillageName ? villageMap.get(resolvedVillageName.toLowerCase()) : null) || currentVilId || null);

    return {
      id: c.id,
      _rowId: `row-${c.id}-${idx}`,
      name: c.name,
      phone: c.phone || '',
      disbursed: Number(c.disbursed) || 0,
      originalAmount: Number(c.original_amount !== null ? c.original_amount : c.disbursed) || 0,
      disbursedDate: c.disbursed_date ? String(c.disbursed_date).split('-').reverse().join('/') : '',
      startWeekId: c.start_week_id || null,
      isVillageDivider: isDivider,
      villageName: resolvedVillageName,
      villageId: resolvedVillageId,
      renewedAtWeek: c.renewed_at_week || null,
      pastCyclePayments: c.past_cycle_payments || null,
      isArchived: Boolean(c.is_archived),
      payments: paymentMap.get(c.id) || {}
    };
  });

  // Map weeks
  const formattedWeeks = (weeks || []).map(w => ({
    id: w.id,
    colIndex: w.col_index,
    label: w.label,
    date: w.week_date ? String(w.week_date).split('-').reverse().join('/') : ''
  }));

  // Map weekly reconciliation
  const formattedRecon = {};
  (recon || []).forEach(r => {
    formattedRecon[r.week_id] = {
      prevCash: r.prev_cash !== null ? Number(r.prev_cash) : null,
      expenses: Number(r.expenses) || 0,
      amountGiven: Number(r.amount_given) || 0,
      salaries: Number(r.salaries) || 0,
      notes: r.notes || ''
    };
  });

  // Map archive
  const formattedArchive = (archive || []).map(a => ({
    id: a.id,
    originalId: a.original_customer_id || a.id,
    name: a.name,
    phone: a.phone || '',
    villageName: a.village_name || '',
    disbursed: Number(a.disbursed) || 0,
    originalAmount: Number(a.original_amount) || 0,
    totalRepaid: Number(a.total_repaid) || 0,
    finalBalance: Number(a.final_balance) || 0,
    status: a.status,
    reason: a.reason || '',
    dateArchived: a.date_archived ? String(a.date_archived).split('-').reverse().join('/') : '',
    payments: a.payments_snapshot || {}
  }));

  return {
    customers: formattedCustomers,
    weeks: formattedWeeks,
    weeklyReconciliation: formattedRecon,
    archive: formattedArchive,
    villages: villages || [],
    settings: settings || null
  };
}

/**
 * UPDATE PAYMENT: Upsert single payment cell with ACID concurrency
 */
export async function updateTenantPayment(client, customerId, weekId, amount) {
  if (!client) throw new Error('Tenant DB client not ready.');
  const { data, error } = await client
    .from('payments')
    .upsert({
      customer_id: customerId,
      week_id: weekId,
      amount: Number(amount) || 0,
      updated_at: new Date().toISOString()
    }, { onConflict: 'customer_id,week_id' })
    .select();

  if (error) throw error;
  return { success: true, data };
}

/**
 * UPDATE CUSTOMER FIELD: Fast inline update
 */
export async function updateTenantCustomerField(client, customerId, field, value, isVillageDivider = false) {
  if (!client) throw new Error('Tenant DB client not ready.');
  const updatePayload = {};

  if (field === 'disbursed' || field === 'originalAmount') {
    const col = field === 'originalAmount' ? 'original_amount' : 'disbursed';
    updatePayload[col] = Number(value) || 0;
  } else if (field === 'disbursedDate') {
    // Parse DD/MM/YYYY to YYYY-MM-DD
    const parts = String(value).split(/[-/]/);
    if (parts.length === 3) {
      updatePayload['disbursed_date'] = parts[0].length === 4 ? `${parts[0]}-${parts[1]}-${parts[2]}` : `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  } else if (field === 'name') {
    const clean = String(value || '').trim();
    updatePayload['name'] = clean;
    if (isVillageDivider) {
      updatePayload['village_name'] = clean;
    }
  } else if (field === 'phone') {
    updatePayload['phone'] = String(value || '').trim();
  } else if (field === 'villageName') {
    const clean = String(value || '').trim();
    updatePayload['village_name'] = clean;
    if (isVillageDivider) {
      updatePayload['name'] = clean;
    }
  } else if (field === 'villageId' || field === 'village_id') {
    updatePayload['village_id'] = value || null;
  } else if (field === 'id') {
    updatePayload['id'] = String(value || '').trim();
  }

  updatePayload['updated_at'] = new Date().toISOString();

  const { error } = await client
    .from('customers')
    .update(updatePayload)
    .eq('id', customerId);

  if (error) {
    console.error(`Failed to update customer ${customerId} [${field}]:`, error);
    throw error;
  }
  return { success: true };
}

// Aliases for seamless naming compatibility
export const syncPaymentToTenantDb = updateTenantPayment;
export const syncCustomerFieldToTenantDb = updateTenantCustomerField;
export const syncReconToTenantDb = updateTenantReconciliation;

/**
 * ADD CUSTOMER OR VILLAGE DIVIDER
 */
export async function addTenantCustomer(client, customer) {
  if (!client) throw new Error('Tenant DB client not ready.');
  
  let formattedDate = null;
  if (customer.disbursedDate) {
    const parts = String(customer.disbursedDate).split(/[-/]/);
    if (parts.length === 3) {
      formattedDate = parts[0].length === 4 ? `${parts[0]}-${parts[1]}-${parts[2]}` : `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  let villageId = customer.villageId || customer.village_id || null;
  const cleanVillageName = String(customer.villageName || customer.village_name || '')
    .replace('📍 VILLAGE:', '')
    .replace('VILLAGE:', '')
    .trim();

  // If cleanVillageName exists, ensure village is registered in villages table to satisfy foreign key
  if (cleanVillageName) {
    try {
      const { data: vRow } = await client
        .from('villages')
        .select('id')
        .ilike('name', cleanVillageName)
        .limit(1)
        .maybeSingle();

      if (vRow?.id) {
        villageId = vRow.id;
      } else {
        const newVilId = villageId || `VIL-${Date.now()}`;
        await client.from('villages').upsert([{ id: newVilId, name: cleanVillageName }], { onConflict: 'id' });
        villageId = newVilId;
      }
    } catch (e) {
      console.warn('Auto-resolve village_id notice:', e);
    }
  }

  const { data, error } = await client
    .from('customers')
    .insert([{
      id: customer.id,
      name: customer.name,
      phone: customer.phone || '',
      disbursed: Number(customer.disbursed) || 0,
      original_amount: Number(customer.originalAmount) || 0,
      disbursed_date: formattedDate,
      start_week_id: customer.startWeekId || null,
      is_village_divider: Boolean(customer.isVillageDivider),
      village_name: cleanVillageName,
      village_id: villageId,
      row_order: customer.rowOrder || 9999
    }])
    .select()
    .single();

  if (error) throw error;
  return { success: true, customer: data };
}

/**
 * DELETE CUSTOMER: Safely moves to loan_archive and deletes from active customers
 */
export async function deleteTenantCustomer(client, customerId, archiveRecord) {
  if (!client) throw new Error('Tenant DB client not ready.');

  // 1. Save to loan_archive
  if (archiveRecord) {
    const { error: aErr } = await client
      .from('loan_archive')
      .insert([{
        id: archiveRecord.id,
        original_customer_id: archiveRecord.originalId || customerId,
        name: archiveRecord.name,
        phone: archiveRecord.phone || '',
        village_name: archiveRecord.villageName || '',
        village_id: archiveRecord.villageId || null,
        disbursed: Number(archiveRecord.disbursed) || 0,
        original_amount: Number(archiveRecord.originalAmount) || 0,
        total_repaid: Number(archiveRecord.totalRepaid) || 0,
        final_balance: Number(archiveRecord.finalBalance) || 0,
        status: 'Deleted',
        reason: archiveRecord.reason || 'Customer deleted by user',
        date_archived: new Date().toISOString().split('T')[0],
        payments_snapshot: archiveRecord.payments || {}
      }]);
    if (aErr) console.warn('Archive insert error on delete:', aErr);
  }

  // 2. Delete customer (cascade deletes payments)
  const { error: dErr } = await client
    .from('customers')
    .delete()
    .eq('id', customerId);

  if (dErr) throw dErr;
  return { success: true };
}

/**
 * ARCHIVE & RENEW CUSTOMER LOAN
 */
export async function archiveAndRenewTenantCustomer(client, { customerId, newAmount, newDate, renewedAtWeek, pastCyclePayments, archiveRecord }) {
  if (!client) throw new Error('Tenant DB client not ready.');

  // 1. Insert into loan_archive
  if (archiveRecord) {
    await client.from('loan_archive').insert([{
      id: archiveRecord.id,
      original_customer_id: customerId,
      name: archiveRecord.name,
      phone: archiveRecord.phone || '',
      village_name: archiveRecord.villageName || '',
      village_id: archiveRecord.villageId || null,
      disbursed: Number(archiveRecord.disbursed) || 0,
      original_amount: Number(archiveRecord.originalAmount) || 0,
      total_repaid: Number(archiveRecord.totalRepaid) || 0,
      final_balance: Number(archiveRecord.finalBalance) || 0,
      status: 'Loan Renewed',
      reason: 'Loan Renewed',
      date_archived: new Date().toISOString().split('T')[0],
      payments_snapshot: archiveRecord.payments || {}
    }]);
  }

  // 2. Reset active payments for this customer
  await client.from('payments').delete().eq('customer_id', customerId);

  // 3. Update customer with new loan details
  let formattedDate = null;
  if (newDate) {
    const parts = String(newDate).split(/[-/]/);
    if (parts.length === 3) {
      formattedDate = parts[0].length === 4 ? `${parts[0]}-${parts[1]}-${parts[2]}` : `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  const { error } = await client
    .from('customers')
    .update({
      disbursed: Number(newAmount) || 0,
      original_amount: Number(newAmount) || 0,
      disbursed_date: formattedDate,
      renewed_at_week: renewedAtWeek,
      past_cycle_payments: pastCyclePayments || {},
      updated_at: new Date().toISOString()
    })
    .eq('id', customerId);

  if (error) throw error;
  return { success: true };
}

// Convenient alias for App.jsx
export const archiveAndRenewCustomerInTenantDb = (client, customerId, params = {}) =>
  archiveAndRenewTenantCustomer(client, { customerId, ...params });

/**
 * BATCH ARCHIVE LOANS
 */
export async function archiveLoansInTenantDb(client, loansToArchive = []) {
  if (!client || !loansToArchive.length) return;
  const rows = loansToArchive.map(a => ({
    id: a.id,
    original_customer_id: a.originalId || a.id,
    name: a.name,
    phone: a.phone || '',
    village_name: a.villageName || '',
    village_id: a.villageId || a.village_id || null,
    disbursed: Number(a.disbursed) || 0,
    original_amount: Number(a.originalAmount || a.disbursed) || 0,
    total_repaid: Number(a.totalPaid) || 0,
    final_balance: Number(a.balance) || 0,
    status: a.status || 'Archived',
    reason: a.reason || 'Batch Archived',
    date_archived: new Date().toISOString().split('T')[0],
    payments_snapshot: a.payments || {}
  }));
  await client.from('loan_archive').upsert(rows, { onConflict: 'id' });
}

/**
 * UPDATE WEEKLY RECONCILIATION
 */
export async function updateTenantReconciliation(client, weekId, { prevCash, expenses, amountGiven, salaries, notes }) {
  if (!client) throw new Error('Tenant DB client not ready.');
  const { error } = await client
    .from('weekly_reconciliation')
    .upsert({
      week_id: weekId,
      prev_cash: prevCash !== undefined && prevCash !== null ? Number(prevCash) : null,
      expenses: Number(expenses) || 0,
      amount_given: Number(amountGiven) || 0,
      salaries: Number(salaries) || 0,
      notes: notes || '',
      updated_at: new Date().toISOString()
    }, { onConflict: 'week_id' });

  if (error) throw error;
  return { success: true };
}

/**
 * ADD WEEK COLUMN
 */
export async function addTenantWeek(client, { id, label, date, colIndex }) {
  if (!client) throw new Error('Tenant DB client not ready.');
  
  let formattedDate = new Date().toISOString().split('T')[0];
  if (date) {
    const parts = String(date).split(/[-/]/);
    if (parts.length === 3) {
      formattedDate = parts[0].length === 4 ? `${parts[0]}-${parts[1]}-${parts[2]}` : `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  const { error } = await client
    .from('weeks')
    .insert([{
      id: id,
      col_index: colIndex || 1,
      label: label,
      week_date: formattedDate
    }]);

  if (error) throw error;
  return { success: true };
}

/**
 * DELETE LATEST WEEK
 */
export async function deleteTenantWeek(client, weekId) {
  if (!client) throw new Error('Tenant DB client not ready.');
  const { error } = await client.from('weeks').delete().eq('id', weekId);
  if (error) throw error;
  return { success: true };
}

/**
 * SYNC ROW ORDER
 */
export async function updateTenantRowOrder(client, orderedIds = []) {
  if (!client || !orderedIds.length) return;
  const updates = orderedIds.map((id, index) => (
    client.from('customers').update({ row_order: index + 1 }).eq('id', id)
  ));
  await Promise.allSettled(updates);
}
