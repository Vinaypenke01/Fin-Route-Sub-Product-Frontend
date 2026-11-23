import React from 'react';
import {
  AddCustomerModal,
  AddVillageModal,
  CustomerRenewModal,
  AddWeekModal,
  ArchiveModal,
  ConfirmModal,
  DeleteCustomerModal
} from './Modals';
import { getCustomerVillageName } from '../utils/customerNormalization';

export default function AppModals({
  // Add Customer
  isAddCustomerOpen,
  setIsAddCustomerOpen,
  villageContext,
  setVillageContext,
  handleAddCustomer,
  weeks,

  // Add Village
  isAddVillageOpen,
  setIsAddVillageOpen,

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

  // Confirm Dialog
  confirmDialog,
  setConfirmDialog,

  // Delete Customer
  isDeleteCustomerOpen,
  setIsDeleteCustomerOpen,
  deleteTargetCustomer,
  setDeleteTargetCustomer,
  customers,
  handleConfirmDeleteCustomer
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

      <AddVillageModal
        isOpen={isAddVillageOpen}
        onClose={() => setIsAddVillageOpen(false)}
        onAddVillage={handleAddCustomer}
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
    </>
  );
}
