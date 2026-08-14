// Owns all department + HOD state for the Admin Panel and wires the presentational
// pieces together. Both lists are live (useDepartments / useHods subscribe to
// postgres_changes), so a change made here reaches every other role immediately.
import React, { useMemo, useState } from 'react';
import AdminAlerts, { useAdminMessages } from './AdminAlerts';
import AdminConfirmDialogs from './AdminConfirmDialogs';
import AdminOverviewPrompt from './AdminOverviewPrompt';
import AdminStats from './AdminStats';
import DepartmentList from './DepartmentList';
import HodDirectory from './HodDirectory';
import UnassignedDepartments from './UnassignedDepartments';
import {
  ADMIN_OVERVIEW_HINTS, ADMIN_OVERVIEW_TITLES, type AdminOverviewView,
} from './adminOverviewView';
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

// One id shared by every panel variant so the stat tiles' aria-controls always
// points at whatever is currently rendered below them.
const PANEL_ID = 'admin-overview-panel';

export default function DepartmentsManager(): React.ReactElement {
  const { departments, error: deptError, reload: reloadDepartments } = useDepartments();
  const { hods, error: hodError, reload: reloadHods } = useHods();
  const msg = useAdminMessages();

  // Nothing below the tiles renders until a count is clicked; clicking the
  // active tile again collapses the panel.
  const [view, setView] = useState<AdminOverviewView | null>(null);
  const [createKey, setCreateKey] = useState(0);
  const [createBusy, setCreateBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Department | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [hodSlot, setHodSlot] = useState<HodFormSlot | null>(null);
  const [hodBusy, setHodBusy] = useState(false);
  const [pendingAddHod, setPendingAddHod] = useState<{ departmentId: string; input: HodInput } | null>(null);
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

  // Count only HODs actually attached to a listed department, so the tiles agree
  // with what the cards below show (a stray hod row with a dangling department_id
  // would otherwise inflate the total without appearing anywhere).
  const assignedHodCount = departments.reduce((n, d) => n + (hodsByDept.get(d.id)?.length ?? 0), 0);
  const unassignedDepartments = departments.filter((d) => (hodsByDept.get(d.id) ?? []).length === 0);

  const selectView = (next: AdminOverviewView) =>
    setView((current) => (current === next ? null : next));

  // "Assign HOD" from the gap list opens the form ON the card. It used to also
  // flip to the Departments view, which replaced the filtered gap list with
  // every department in the org — the opposite of what the admin asked for by
  // clicking "Awaiting an HOD". The view stays put now.
  const startAssignFromGap = (departmentId: string) => {
    setEditingId(null);
    setHodSlot({ kind: 'add', departmentId });
  };

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
      msg.showSuccess(`Department "${target.name}" deleted successfully.`);
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

    if (hodSlot.kind === 'edit') {
      setHodBusy(true);
      try {
        await updateHod(hodSlot.hod.id, input);
        msg.showSuccess(`${input.fullName} updated.`);
        setHodSlot(null);
        await reloadHods();
      } catch (err) {
        msg.showError(message(err, 'Failed to save head of department.'));
      } finally {
        setHodBusy(false);
      }
    } else {
      setPendingAddHod({ departmentId: hodSlot.departmentId, input });
    }
  };

  const handleConfirmAddHod = async () => {
    if (!pendingAddHod) return;
    const { departmentId, input } = pendingAddHod;
    msg.clear();
    setHodBusy(true);
    try {
      const { created } = await addHod(departmentId, input);
      setPendingAddHod(null);
      setHodSlot(null);
      msg.showSuccess(created
        ? `Invitation sent to ${input.email} — they will set their own password.`
        : `${input.fullName} is now a head of department.`);
      await reloadHods();
    } catch (err) {
      setPendingAddHod(null);
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
        hodCount={assignedHodCount}
        unassignedCount={unassignedDepartments.length}
        active={view}
        onSelect={selectView}
        panelId={PANEL_ID}
      />

      {/* A load failure is surfaced, never silently rendered as an empty list. */}
      <AdminAlerts success={msg.success} error={msg.error || deptError || hodError || ''} />

      {view && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="revamp-section-head mb-0.5">
              <span className="revamp-section-rule" aria-hidden="true" />
              <span className="flex items-baseline gap-2">
                <h2 className="section-title">{ADMIN_OVERVIEW_TITLES[view]}</h2>
                <span className="text-xs text-navy-500 dark:text-navy-400">{ADMIN_OVERVIEW_HINTS[view]}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setView(null)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-surface-300 text-navy-500 hover:border-brand-400 hover:text-brand-600 transition-all"
          >
            Hide
          </button>
        </div>
      )}

      {view === null && <AdminOverviewPrompt id={PANEL_ID} />}

      {view === 'departments' && (
        <DepartmentList
          id={PANEL_ID}
          departments={departments}
          hodsByDept={hodsByDept}
          createKey={createKey}
          createBusy={createBusy}
          editingId={editingId}
          editBusy={editBusy}
          hodBusy={hodBusy}
          hodSlot={hodSlot}
          onCreate={handleCreate}
          onStartEdit={(id) => { setHodSlot(null); setEditingId(id); }}
          onCancelEdit={() => setEditingId(null)}
          onSubmitEdit={handleUpdate}
          onRequestDelete={(d) => setPendingDelete(d)}
          onOpenAddHod={(departmentId) => { setEditingId(null); setHodSlot({ kind: 'add', departmentId }); }}
          onOpenEditHod={(departmentId, hod) => { setEditingId(null); setHodSlot({ kind: 'edit', departmentId, hod }); }}
          onCancelHod={() => setHodSlot(null)}
          onSubmitHod={handleHodSubmit}
          onRequestRemoveHod={(hod) => setPendingRemoveHod(hod)}
        />
      )}

      {view === 'hods' && (
        <HodDirectory id={PANEL_ID} departments={departments} hodsByDept={hodsByDept} />
      )}

      {view === 'unassigned' && (
        <UnassignedDepartments
          id={PANEL_ID}
          departments={unassignedDepartments}
          hodSlot={hodSlot}
          hodBusy={hodBusy}
          onAssign={(d) => startAssignFromGap(d.id)}
          onCancelHod={() => setHodSlot(null)}
          onSubmitHod={handleHodSubmit}
        />
      )}

      <AdminConfirmDialogs
        departments={departments}
        pendingDelete={pendingDelete}
        deleteBusy={deleteBusy}
        onConfirmDelete={handleDelete}
        onCancelDelete={() => setPendingDelete(null)}
        pendingAddHod={pendingAddHod}
        hodBusy={hodBusy}
        onConfirmAddHod={handleConfirmAddHod}
        onCancelAddHod={() => setPendingAddHod(null)}
        pendingRemoveHod={pendingRemoveHod}
        removeBusy={removeBusy}
        onConfirmRemoveHod={handleRemoveHod}
        onCancelRemoveHod={() => setPendingRemoveHod(null)}
      />
    </div>
  );
}
