import React from 'react';
import {
  AddCustomerModal,
  CustomerRenewModal,
  AddWeekModal,
  ArchiveModal,
  CloudSyncModal,
  ConfirmModal,
  DeleteCustomerModal
} from './Modals';
import ImportSheetModal from './ImportSheetModal';
import { getCustomerVillageName } from '../utils/customerNormalization';

export default function AppModals({
  // Add Customer
  isAddCustomerOpen,
  setIsAddCustomerOpen,
  villageContext,
  setVillageContext,
  handleAddCustomer,
  weeks,

  // Renew Customer
  isRenewModalOpen,
  setIsRenewModalOpen,
  renewTargetCustomer,
  handleRenewCustomer,

  // Add Week
  isAddWeekOpen,
  setIsAddWeekOpen,
  handleAddWeek,

  // Archive
  isArchiveOpen,
  setIsArchiveOpen,
  handleArchive,
  activeCount,
  paidOffCount,

  // Cloud Sync
  isCloudSyncOpen,
  setIsCloudSyncOpen,
  sheetUrl,
  handleSaveSheetUrl,
  handleManualPull,
  handleManualPush,
  cloudStatus,
  auth,

  // Confirm Dialog
  confirmDialog,
  setConfirmDialog,

  // Delete Customer
  isDeleteCustomerOpen,
  setIsDeleteCustomerOpen,
  deleteTargetCustomer,
  setDeleteTargetCustomer,
  customers,
  handleConfirmDeleteCustomer,

  // Import Sheet
  isImportSheetOpen,
  setIsImportSheetOpen,
  tenantClient,
  onImportSuccess
}) {
  return (
    <>
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => {
          setIsAddCustomerOpen(false);
          setVillageContext(null);
        }}
        onAddCustomer={handleAddCustomer}
        villageContext={villageContext}
        weeks={weeks}
      />

      <CustomerRenewModal
        isOpen={isRenewModalOpen}
        onClose={() => setIsRenewModalOpen(false)}
        customer={renewTargetCustomer}
        onRenew={handleRenewCustomer}
        weeks={weeks}
      />

      <AddWeekModal
        isOpen={isAddWeekOpen}
        onClose={() => setIsAddWeekOpen(false)}
        onAddWeek={handleAddWeek}
        currentWeeksCount={weeks.length}
        lastWeekDate={weeks[weeks.length - 1]?.date}
      />

      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        onArchive={handleArchive}
        activeCount={activeCount}
        paidOffCount={paidOffCount}
      />

      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        currentUrl={sheetUrl}
        onSaveUrl={handleSaveSheetUrl}
        onPull={handleManualPull}
        onPush={handleManualPush}
        isSyncing={cloudStatus?.isSyncing}
        onOpenImportSheet={auth?.isSupabaseTenant ? () => setIsImportSheetOpen(true) : undefined}
      />

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false })}
      />

      <DeleteCustomerModal
        isOpen={isDeleteCustomerOpen}
        onClose={() => {
          setIsDeleteCustomerOpen(false);
          setDeleteTargetCustomer(null);
        }}
        customer={deleteTargetCustomer}
        villageName={getCustomerVillageName(customers, deleteTargetCustomer?._rowId)}
        onDelete={handleConfirmDeleteCustomer}
      />

      <ImportSheetModal
        isOpen={isImportSheetOpen}
        onClose={() => setIsImportSheetOpen(false)}
        auth={auth}
        tenantClient={tenantClient}
        currentSheetUrl={sheetUrl || auth?.sheetUrl || ''}
        currentRecordsCount={customers.filter(c => !c.isVillageDivider).length}
        onImportSuccess={onImportSuccess}
      />
    </>
  );
}
