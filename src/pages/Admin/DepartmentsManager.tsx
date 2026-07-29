// Owns all department + HOD state for the Admin Panel and wires the presentational
// pieces together. Both lists are live (useDepartments / useHods subscribe to
// postgres_changes), so a change made here reaches every other role immediately.
import React, { useMemo, useState } from 'react';
import AdminAlerts, { useAdminMessages } from './AdminAlerts';
import AdminStats from './AdminStats';
import ConfirmDialog from './ConfirmDialog';
import DepartmentCard from './DepartmentCard';
import DepartmentForm from './DepartmentForm';
import type { HodFormSlot } from './HodList';
import { useDepartments } from '../../lib/useDepartments';
import { useHods } from '../../lib/useHods';
import {
  createDepartment, deleteDepartment, updateDepartment, validateDepartment,
  type DepartmentInput,
} from '../../lib/adminDepartments';
import { addHod, removeHod, updateHod, validateHod, type HodInput } from '../../lib/adminHods';
import type { Department, Profile } from '../../types/index';

const message = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

export default function DepartmentsManager(): React.ReactElement {
  const { departments, reload: reloadDepartments } = useDepartments();
  const { hods, reload: reloadHods } = useHods();
  const msg = useAdminMessages();

  const [createKey, setCreateKey] = useState(0);
  const [createBusy, setCreateBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Department | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [hodSlot, setHodSlot] = useState<HodFormSlot | null>(null);
  const [hodBusy, setHodBusy] = useState(false);
  const [pendingRemoveHod, setPendingRemoveHod] = useState<Profile | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const hodsByDept = useMemo(() => {
    const map = new Map<string, Profile[]>();
    for (const h of hods) {
      if (!h.department_id) continue;
      const list = map.get(h.department_id) ?? [];
      list.push(h);
      map.set(h.department_id, list);
    }
    return map;
  }, [hods]);

  const unassigned = departments.filter((d) => (hodsByDept.get(d.id) ?? []).length === 0).length;

  /* ── departments ───────────────────────────────────── */

  const handleCreate = async (input: DepartmentInput) => {
    msg.clear();
    const invalid = validateDepartment(input, departments);
    if (invalid) { msg.showError(invalid); return; }
    setCreateBusy(true);
    try {
      await createDepartment(input);
      msg.showSuccess(`Department "${input.name}" added.`);
      setCreateKey((k) => k + 1);
      await reloadDepartments();
    } catch (err) {
      msg.showError(message(err, 'Failed to add department.'));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleUpdate = async (id: string, input: DepartmentInput) => {
    msg.clear();
    const invalid = validateDepartment(input, departments, id);
    if (invalid) { msg.showError(invalid); return; }
    setEditBusy(true);
    try {
      await updateDepartment(id, input);
      msg.showSuccess('Department updated.');
      setEditingId(null);
      await reloadDepartments();
    } catch (err) {
      msg.showError(message(err, 'Failed to update department.'));
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    msg.clear();
    setDeleteBusy(true);
    try {
      await deleteDepartment(target.id);
      setPendingDelete(null);
      msg.showSuccess(`Department "${target.name}" deleted.`);
      await Promise.all([reloadDepartments(), reloadHods()]);
    } catch (err) {
      setPendingDelete(null);
      msg.showError(message(err, 'Failed to delete department.'));
    } finally {
      setDeleteBusy(false);
    }
  };

  /* ── heads of department ───────────────────────────── */

  const handleHodSubmit = async (input: HodInput) => {
    if (!hodSlot) return;
    msg.clear();
    const deptHods = hodsByDept.get(hodSlot.departmentId) ?? [];
    const excludeId = hodSlot.kind === 'edit' ? hodSlot.hod.id : undefined;
    const invalid = validateHod(input, deptHods, excludeId);
    if (invalid) { msg.showError(invalid); return; }

    setHodBusy(true);
    try {
      if (hodSlot.kind === 'edit') {
        await updateHod(hodSlot.hod.id, input);
        msg.showSuccess(`${input.fullName} updated.`);
      } else {
        const { created } = await addHod(hodSlot.departmentId, input);
        msg.showSuccess(created
          ? `Invitation sent to ${input.email} — they will set their own password.`
          : `${input.fullName} is now a head of department.`);
      }
      setHodSlot(null);
      await reloadHods();
    } catch (err) {
      msg.showError(message(err, 'Failed to save head of department.'));
    } finally {
      setHodBusy(false);
    }
  };

  const handleRemoveHod = async () => {
    if (!pendingRemoveHod) return;
    const target = pendingRemoveHod;
    msg.clear();
    setRemoveBusy(true);
    try {
      await removeHod(target.id);
      setPendingRemoveHod(null);
      msg.showSuccess(`${target.full_name} is no longer a head of department.`);
      await reloadHods();
    } catch (err) {
      setPendingRemoveHod(null);
      msg.showError(message(err, 'Failed to remove head of department.'));
    } finally {
      setRemoveBusy(false);
    }
  };

  /* ── render ────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      <AdminStats
        departmentCount={departments.length}
        hodCount={hods.length}
        unassignedCount={unassigned}
      />

      <AdminAlerts success={msg.success} error={msg.error} />

      <div className="card-premium p-5 animate-fade-in">
        <p className="section-title mb-3">New Department</p>
        <DepartmentForm key={createKey} mode="create" busy={createBusy} onSubmit={handleCreate} />
      </div>

      <div className="space-y-3">
        {departments.map((d, i) => (
          <DepartmentCard
            key={d.id}
            department={d}
            hods={hodsByDept.get(d.id) ?? []}
            index={i}
            isEditing={editingId === d.id}
            editBusy={editBusy}
            hodBusy={hodBusy}
            hodSlot={hodSlot}
            onStartEdit={() => { setHodSlot(null); setEditingId(d.id); }}
            onCancelEdit={() => setEditingId(null)}
            onSubmitEdit={(input) => handleUpdate(d.id, input)}
            onRequestDelete={() => setPendingDelete(d)}
            onOpenAddHod={() => { setEditingId(null); setHodSlot({ kind: 'add', departmentId: d.id }); }}
            onOpenEditHod={(hod) => { setEditingId(null); setHodSlot({ kind: 'edit', departmentId: d.id, hod }); }}
            onCancelHod={() => setHodSlot(null)}
            onSubmitHod={handleHodSubmit}
            onRequestRemoveHod={(hod) => setPendingRemoveHod(hod)}
          />
        ))}

        {departments.length === 0 && (
          <div className="empty-state card">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/10 border border-brand-500/20 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15" />
              </svg>
            </div>
            <p className="text-sm font-medium text-navy-500">No departments yet</p>
            <p className="text-xs text-navy-300 mt-1">Create your first one using the form above.</p>
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete Department?"
          message={`"${pendingDelete.name}" will be removed. Its members are unlinked and any head of department is demoted to staff. Linked visits or gate passes will block the deletion.`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {pendingRemoveHod && (
        <ConfirmDialog
          title="Remove Head of Department?"
          message={`${pendingRemoveHod.full_name} will be demoted to staff and detached from this department. Their account is not deleted.`}
          confirmLabel="Remove"
          busyLabel="Removing…"
          busy={removeBusy}
          onConfirm={handleRemoveHod}
          onCancel={() => setPendingRemoveHod(null)}
        />
      )}
    </div>
  );
}
