// The three destructive/irreversible confirmations the Admin Panel can raise.
// Split out of DepartmentsManager purely to keep that file a state container —
// at most one of these is ever mounted at a time.
import React from 'react';
import ConfirmDialog from './ConfirmDialog';
import type { HodInput } from '../../lib/adminHods';
import type { Department, Profile } from '../../types/index';

type Props = {
  departments: Department[];
  pendingDelete: Department | null;
  deleteBusy: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  pendingAddHod: { departmentId: string; input: HodInput } | null;
  hodBusy: boolean;
  onConfirmAddHod: () => void;
  onCancelAddHod: () => void;
  pendingRemoveHod: Profile | null;
  removeBusy: boolean;
  onConfirmRemoveHod: () => void;
  onCancelRemoveHod: () => void;
};

export default function AdminConfirmDialogs({
  departments, pendingDelete, deleteBusy, onConfirmDelete, onCancelDelete,
  pendingAddHod, hodBusy, onConfirmAddHod, onCancelAddHod,
  pendingRemoveHod, removeBusy, onConfirmRemoveHod, onCancelRemoveHod,
}: Props): React.ReactElement | null {
  if (pendingDelete) {
    return (
      <ConfirmDialog
        title="Delete Department?"
        message={`Are you sure you want to delete "${pendingDelete.name}"? It will be removed permanently. Its members are unlinked and any head of department is demoted to staff. Linked visits or visitor passes will block the deletion.`}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={deleteBusy}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    );
  }

  if (pendingAddHod) {
    const deptName = departments.find((d) => d.id === pendingAddHod.departmentId)?.name ?? '';
    return (
      <ConfirmDialog
        title="Add Head of Department?"
        message={`Add "${pendingAddHod.input.fullName}" (${pendingAddHod.input.email}) as Head of ${deptName}? An invitation email will be sent so they can set their own password.`}
        confirmLabel="Add HOD"
        busyLabel="Adding…"
        busy={hodBusy}
        danger={false}
        onConfirm={onConfirmAddHod}
        onCancel={onCancelAddHod}
      />
    );
  }

  if (pendingRemoveHod) {
    return (
      <ConfirmDialog
        title="Remove Head of Department?"
        message={`Are you sure you want to remove ${pendingRemoveHod.full_name}? They will be demoted to staff and detached from this department. Their account is not deleted.`}
        confirmLabel="Remove"
        busyLabel="Removing…"
        busy={removeBusy}
        onConfirm={onConfirmRemoveHod}
        onCancel={onCancelRemoveHod}
      />
    );
  }

  return null;
}
