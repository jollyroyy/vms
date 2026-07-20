import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import type { Department, Profile, Visitor, UserRole } from '../../types/index';

type Tab = 'departments' | 'users' | 'blacklist';
const TAB_LABELS: Record<Tab, string> = { departments: 'Departments', users: 'Users', blacklist: 'Blacklist' };

export default function AdminPanel(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('departments');
  return (
    <div className="space-y-6">
      <div className="page-header !mb-6">
        <h1 className="page-title">Admin Panel</h1>
        <p className="page-subtitle">Manage departments, approvers, users, and security</p>
      </div>
      <div className="tab-group">
        {(['departments', 'users', 'blacklist'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'tab-active' : 'tab-inactive'}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      {tab === 'departments' && <DepartmentsTab />}
      {tab === 'users'       && <UsersTab />}
      {tab === 'blacklist'   && <BlacklistTab />}
    </div>
  );
}

function DepartmentsTab(): React.ReactElement {
  const [depts, setDepts] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Edit state
  const [editingDept, setEditingDept] = useState<{ id: string; name: string; code: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Add approver state
  const [addingApproverFor, setAddingApproverFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: d } = await supabase.from('departments').select('*').order('name');
    setDepts(d ?? []);
    const { data: p } = await supabase.from('profiles').select('*').order('full_name');
    setProfiles(p ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const clearMessages = useCallback(() => { setSuccessMsg(''); setErrorMsg(''); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); clearMessages();
    const code = newCode.toUpperCase();
    const dup = depts.find((d) => d.name.toLowerCase() === newName.toLowerCase() || d.code === code);
    if (dup) { setErrorMsg(`Department "${dup.name}" (${dup.code}) already exists.`); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, code }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to add department');
      setSuccessMsg(`Department "${newName}" (${code}) added.`);
      setNewName(''); setNewCode(''); await load();
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Failed to add department.'); }
    finally { setSaving(false); setTimeout(clearMessages, 4000); }
  };

  const startEdit = (dept: Department) => {
    setEditingDept({ id: dept.id, name: dept.name, code: dept.code });
    setEditName(dept.name);
    setEditCode(dept.code);
  };

  const cancelEdit = () => {
    setEditingDept(null);
    setEditName('');
    setEditCode('');
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); clearMessages();
    if (!editingDept) return;
    const code = editCode.toUpperCase();
    const dup = depts.find((d) => d.id !== editingDept.id && (d.name.toLowerCase() === editName.toLowerCase() || d.code === code));
    if (dup) { setErrorMsg(`Another department "${dup.name}" (${dup.code}) already uses this name or code.`); return; }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/departments/${editingDept.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editName, code }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to update department');
      setSuccessMsg(`Department updated.`);
      cancelEdit(); await load();
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Failed to update department.'); }
    finally { setEditSaving(false); setTimeout(clearMessages, 4000); }
  };

  const confirmDelete = async () => {
    if (!deletingDeptId) return;
    clearMessages(); setDeleteSaving(true);
    try {
      const res = await fetch(`/api/departments/${deletingDeptId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete department');
      setDeletingDeptId(null);
      setSuccessMsg('Department deleted.');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete department.';
      // Check for FK constraint error
      if (msg.includes('foreign key') || msg.includes('violates foreign')) {
        setErrorMsg('Cannot delete: there are visits, gate passes, or users linked to this department. Reassign them first.');
      } else {
        setErrorMsg(msg);
      }
    }
    finally { setDeleteSaving(false); setTimeout(clearMessages, 4000); }
  };

  // Get HODs for a department
  const getHODsForDept = (deptId: string): Profile[] => {
    return profiles.filter((p) => p.department_id === deptId && p.role === 'hod');
  };

  // Get users eligible to be added as approver (not already HOD of this dept)
  const getEligibleUsers = (deptId: string): Profile[] => {
    const existingHodIds = new Set(getHODsForDept(deptId).map((p) => p.id));
    return profiles.filter((p) => !existingHodIds.has(p.id));
  };

  const addApprover = async (deptId: string, profileId: string) => {
    clearMessages();
    try {
      const { error } = await supabase.from('profiles').update({ role: 'hod', department_id: deptId }).eq('id', profileId);
      if (error) throw new Error(error.message);
      setAddingApproverFor(null);
      setSuccessMsg('Approver added.');
      await load();
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Failed to add approver.'); }
    setTimeout(clearMessages, 4000);
  };

  const removeApprover = async (profileId: string, name: string) => {
    clearMessages();
    try {
      const { error } = await supabase.from('profiles').update({ role: 'staff', department_id: null, delegate_id: null }).eq('id', profileId);
      if (error) throw new Error(error.message);
      setSuccessMsg(`Removed ${name} as approver.`);
      await load();
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Failed to remove approver.'); }
    setTimeout(clearMessages, 4000);
  };

  return (
    <div className="space-y-5">
      {successMsg && (<div className="rounded-xl bg-brand-50 border border-brand-200 px-4 py-3 text-sm text-brand-800 flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">✓</span>{successMsg}</div>)}
      {errorMsg && (<div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs font-bold shrink-0">!</span>{errorMsg}</div>)}

      {/* Add department form */}
      <form onSubmit={add} className="card p-5 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-40"><label className="label">Department Name</label><input required placeholder="e.g. Human Resources" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" /></div>
        <div className="w-28"><label className="label">Code</label><input required placeholder="HR" value={newCode} onChange={(e) => setNewCode(e.target.value)} maxLength={10} className="input uppercase" /></div>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding...' : 'Add'}</button>
      </form>

      {/* Department list */}
      <div className="space-y-3">
        {depts.map((d) => {
          const hods = getHODsForDept(d.id);
          const isEditing = editingDept?.id === d.id;
          return (
            <div key={d.id} className="card p-5">
              {isEditing ? (
                <form onSubmit={saveEdit} className="flex gap-3 flex-wrap items-end">
                  <div className="flex-1 min-w-40"><label className="label">Department Name</label><input required value={editName} onChange={(e) => setEditName(e.target.value)} className="input" /></div>
                  <div className="w-28"><label className="label">Code</label><input required value={editCode} onChange={(e) => setEditCode(e.target.value)} maxLength={10} className="input uppercase" /></div>
                  <button type="submit" disabled={editSaving} className="btn-primary">{editSaving ? 'Saving...' : 'Save'}</button>
                  <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-medium text-navy-800">{d.name}</span>
                      <span className="text-xs text-navy-400 font-mono bg-surface-100 px-2 py-1 rounded-md ml-2">{d.code}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(d)} className="text-xs font-medium text-navy-500 hover:text-navy-700 px-3 py-1.5 rounded-lg hover:bg-surface-100 transition-colors" title="Edit department">Edit</button>
                      <button onClick={() => setDeletingDeptId(d.id)} className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete department">Delete</button>
                    </div>
                  </div>

                  {/* Approvers section */}
                  <div className="border-t border-surface-100 pt-3 mt-1">
                    <p className="text-xs font-medium text-navy-400 uppercase tracking-wider mb-2">Approvers</p>
                    {hods.length === 0 && <p className="text-sm text-navy-300 italic mb-2">No approvers assigned</p>}
                    {hods.map((hod) => (
                      <div key={hod.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-surface-50 group">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-brand-100 flex items-center justify-center">
                            <span className="text-brand-600 text-[10px] font-semibold">{hod.full_name?.slice(0, 2).toUpperCase() ?? '??'}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-navy-700">{hod.full_name}</p>
                            <p className="text-xs text-navy-400">{hod.email}</p>
                          </div>
                          {hod.delegate_id && <span className="text-[10px] text-navy-300 bg-surface-100 px-1.5 py-0.5 rounded">has delegate</span>}
                        </div>
                        <button onClick={() => removeApprover(hod.id, hod.full_name ?? '')} className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 rounded hover:bg-red-50">Remove</button>
                      </div>
                    ))}
                    {addingApproverFor === d.id ? (
                      <div className="mt-2 border border-surface-200 rounded-lg p-3 bg-surface-50">
                        <select
                          className="input w-full text-sm mb-2"
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) addApprover(d.id, e.target.value); }}
                        >
                          <option value="" disabled>Select a user...</option>
                          {getEligibleUsers(d.id).map((p) => (
                            <option key={p.id} value={p.id}>{p.full_name} ({p.email}) — {p.role}</option>
                          ))}
                        </select>
                        <button onClick={() => setAddingApproverFor(null)} className="text-xs text-navy-400 hover:text-navy-600">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setAddingApproverFor(d.id)} className="mt-2 text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1.5 rounded-lg hover:bg-brand-50 transition-colors inline-flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Add Approver
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        {depts.length === 0 && <p className="text-sm text-navy-300 text-center py-8">No departments yet. Add one above.</p>}
      </div>

      {/* Delete confirmation modal */}
      {deletingDeptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-navy-900 mb-2">Delete Department?</h3>
            <p className="text-sm text-navy-500 mb-6">This will unlink all users from this department and remove their HOD role. Visits and gate passes linked to this department may prevent deletion.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingDeptId(null)} className="btn-secondary">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteSaving} className="bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 shadow-sm transition-all">{deleteSaving ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTab(): React.ReactElement {
  const [users, setUsers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('*').order('full_name').then(({ data }) => setUsers(data ?? []));
    supabase.from('departments').select('*').order('name').then(({ data }) => setDepartments(data ?? []));
  }, []);
  const ROLES: UserRole[] = ['guard', 'hod', 'staff', 'admin', 'super_admin'];
  const updateRole = async (userId: string, role: UserRole) => {
    await supabase.from('profiles').update({ role }).eq('id', userId);
    setUsers((u) => u.map((p) => p.id === userId ? { ...p, role } : p));
  };
  const updateDepartment = async (userId: string, departmentId: string | null) => {
    await supabase.from('profiles').update({ department_id: departmentId || null }).eq('id', userId);
    setUsers((u) => u.map((p) => p.id === userId ? { ...p, department_id: departmentId || null } : p));
  };
  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d]));
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="card px-5 py-3.5 flex items-center gap-4">
          <div className="h-9 w-9 rounded-full bg-navy-800 flex items-center justify-center shrink-0">
            <span className="text-brand-300 text-[11px] font-semibold">{u.full_name?.slice(0, 2).toUpperCase() ?? '??'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-navy-800 truncate">{u.full_name}</p>
            <p className="text-xs text-navy-400">{u.email}</p>
            <p className="text-xs text-navy-300">{u.department_id ? (deptMap[u.department_id]?.name ?? 'Unknown Department') : 'No department'}</p>
          </div>
          <div className="flex gap-2 items-center">
            <select value={u.department_id ?? ''} onChange={(e) => updateDepartment(u.id, e.target.value || null)} className="input w-40 text-sm py-2">
              <option value="">No department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
            <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value as UserRole)} className="input w-36 text-sm py-2">
              {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

function BlacklistTab(): React.ReactElement {
  const [entries, setEntries] = useState<Visitor[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { const { data } = await supabase.from('visitors').select('*').eq('is_blacklisted', true).order('full_name'); setEntries(data ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await supabase.from('visitors').upsert({ phone, full_name: '(Blacklisted)', is_blacklisted: true, blacklist_reason: reason }, { onConflict: 'phone' });
    setPhone(''); setReason(''); await load(); setSaving(false);
  };
  const remove = async (id: string) => { await supabase.from('visitors').update({ is_blacklisted: false, blacklist_reason: null }).eq('id', id); await load(); };

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="card p-5 flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-40"><label className="label">Phone Number</label><input required type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" /></div>
        <div className="flex-1 min-w-40"><label className="label">Reason</label><input required placeholder="Reason for blacklisting" value={reason} onChange={(e) => setReason(e.target.value)} className="input" /></div>
        <button type="submit" disabled={saving} className="bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 shadow-sm transition-all">{saving ? 'Adding...' : 'Blacklist'}</button>
      </form>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="card border-red-100 bg-red-50/30 px-5 py-3.5 flex items-center justify-between">
            <div><p className="font-medium text-navy-800">{e.full_name}</p><p className="text-xs text-navy-400 mt-0.5">{e.phone} · {e.blacklist_reason}</p></div>
            <button onClick={() => remove(e.id)} className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">Remove</button>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-navy-300 text-center py-8">No blacklist entries</p>}
      </div>
    </div>
  );
}
