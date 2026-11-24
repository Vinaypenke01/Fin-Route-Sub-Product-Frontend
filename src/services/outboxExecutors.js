// How each kind of outbox change is written to the tenant database.
// Every executor must be safe to run more than once (upserts / idempotent
// deletes), because a request can succeed on the server while its reply is lost.
import {
  updateTenantPayment,
  updateTenantCustomerField,
  updateTenantReconciliation,
  addTenantCustomer,
  deleteTenantCustomer,
  archiveAndRenewTenantCustomer,
  archiveLoansInTenantDb,
  addTenantWeek,
  deleteTenantWeek,
  updateTenantRowOrder,
  updateTenantWeeks,
  deleteTenantArchiveRecord,
} from './tenantDatabaseService';

export const OUTBOX_EXECUTORS = {
  payment: (c, p) => updateTenantPayment(c, p.customerId, p.weekId, p.amount),
  customerField: (c, p) => updateTenantCustomerField(c, p.customerId, p.field, p.value, Boolean(p.isVillageDivider)),
  recon: (c, p) => updateTenantReconciliation(c, p.weekId, p.values || {}),
  addCustomer: (c, p) => addTenantCustomer(c, p.customer),
  deleteCustomer: (c, p) => deleteTenantCustomer(c, p.customerId, p.archiveRecord || undefined),
  renewCustomer: (c, p) => archiveAndRenewTenantCustomer(c, p),
  archiveLoans: (c, p) => archiveLoansInTenantDb(c, p.loans || []),
  addWeek: (c, p) => addTenantWeek(c, p.week),
  deleteWeek: (c, p) => deleteTenantWeek(c, p.weekId),
  rowOrder: (c, p) => updateTenantRowOrder(c, p.orderedIds || []),
  weekDates: (c, p) => updateTenantWeeks(c, p.weeks || []),
  deleteArchived: (c, p) => deleteTenantArchiveRecord(c, p.archiveId),
};
