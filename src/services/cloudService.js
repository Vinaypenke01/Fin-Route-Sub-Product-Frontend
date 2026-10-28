// Cloud synchronization service connecting React app to Google Apps Script backend

export async function callCloudApi(action, payload = {}, auth = null, url = '') {
  if (!url) {
    throw new Error('Google Sheet URL is not configured.');
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        payload,
        authEmail: auth?.email || '',
        authPassword: auth?.password || ''
      })
    });
    const data = await res.json();
    if (data?.status === 'unauthorized') {
      throw new Error(data.message || 'Access denied: Invalid credentials.');
    }
    if (data?.status === 'error') {
      throw new Error(data.message || `Action "${action}" failed on Google Sheet.`);
    }
    if (data?.result && data.result.success === false) {
      throw new Error(data.result.message || `Action "${action}" failed: Record not found or rejected by Google Sheet.`);
    }
    return data;
  } catch (err) {
    console.warn(`Cloud API call failed for action "${action}":`, err);
    throw err;
  }
}

/**
 * Central Tenant Resolver (MasterAuth Gateway)
 * Verifies credentials against Master Registry and dynamically resolves tenant's private Google Sheet URL.
 */
export async function resolveTenantFromMaster(email, password, consent = true, customMasterUrl = '') {
  const masterUrl = (customMasterUrl || import.meta.env.VITE_MASTER_AUTH_URL || '').trim();
  if (!masterUrl) {
    throw new Error('Master Auth Gateway URL (VITE_MASTER_AUTH_URL) is not configured.');
  }

  try {
    const res = await fetch(masterUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'resolveTenant',
        email: String(email || '').trim().toLowerCase(),
        password: String(password || '').trim(),
        consent: Boolean(consent)
      })
    });
    return await res.json();
  } catch (err) {
    console.warn('Master Auth request failed:', err);
    throw err;
  }
}

export async function loginToCloud(email, password, url) {
  if (!url) {
    return { status: 'offline', message: 'No Google Sheet URL configured' };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'login',
        authEmail: email,
        authPassword: password,
        payload: { email, password }
      })
    });
    return await res.json();
  } catch (err) {
    console.warn('Login request failed:', err);
    throw err;
  }
}

export async function pullAllFromCloud(auth, url) {
  if (!url || !auth) return null;

  const authQuery = `?t=${Date.now()}&email=${encodeURIComponent(auth.email)}&password=${encodeURIComponent(auth.password)}`;
  const res = await fetch(url + authQuery);
  return await res.json();
}

export async function pushAllToCloud(appState, auth, url) {
  return await callCloudApi('syncAll', {
    customers: appState.customers || [],
    weeks: appState.weeks || [],
    weeklyReconciliation: appState.weeklyReconciliation || {}
  }, auth, url);
}

export async function syncPaymentToCloud(custId, weekId, amount, name = '', auth, url) {
  return await callCloudApi('updatePayment', { custId, weekId, amount, name }, auth, url);
}

export async function syncCustomerFieldToCloud(custId, field, value, name = '', auth, url) {
  return await callCloudApi('updateCustomerField', { custId, field, value, name }, auth, url);
}

export async function syncReconToCloud(weekId, prevCash, expenses, amountGiven, weeks, weeklyReconciliation, auth, url, salaries = 0) {
  const weekIndex = weeks.findIndex(w => w.id === weekId);
  const weekObj = weeks[weekIndex];
  return await callCloudApi('updateReconciliation', {
    weekId,
    weekIndex,
    label: weekObj?.label || weekId,
    prevCash,
    expenses,
    amountGiven,
    salaries,
    weeks,
    weeklyReconciliation
  }, auth, url);
}

export async function syncWeeksToCloud(weeks, auth, url) {
  return await callCloudApi('updateWeeks', { weeks }, auth, url);
}

export async function deleteCustomerFromCloud(custId, name, auth, url, extra = {}) {
  return await callCloudApi('deleteCustomer', { custId, name, ...extra }, auth, url);
}

export async function deleteArchivedRecordFromCloud(archiveId, name, auth, url) {
  return await callCloudApi('deleteArchivedRecord', { archiveId, name }, auth, url);
}

export async function addCustomerToCloud(customerPayload, auth, url) {
  return await callCloudApi('addCustomer', customerPayload, auth, url);
}

export async function syncRowOrderToCloud(orderedIds, auth, url) {
  return await callCloudApi('syncRowOrder', { orderedIds }, auth, url);
}

export async function archiveAndRenewCustomerInCloud(payload, auth, url) {
  return await callCloudApi('archiveAndRenewCustomer', payload, auth, url);
}

export async function archiveLoansInCloud(archivedList, auth, url) {
  return await callCloudApi('archiveLoans', { archived: archivedList }, auth, url);
}

export async function addWeekToCloud(weekPayload, auth, url) {
  return await callCloudApi('addWeek', weekPayload, auth, url);
}

export async function deleteWeekFromCloud(auth, url) {
  return await callCloudApi('deleteWeek', {}, auth, url);
}


