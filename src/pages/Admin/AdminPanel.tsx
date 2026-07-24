import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { normalizePhone } from '../../lib/blacklist';
import type { Department, Profile, Visitor, UserRole } from '../../types/index';

type Tab = 'departments' | 'users' | 'blacklist';
const TAB_LABELS: Record<Tab, string> = { departments: 'Departments', users: 'Users', blacklist: 'Blacklist' };

export default function AdminPanel(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('departments');
  return (
    <div className="space-y-6">
      <div className="page-header !mb-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center shadow-glow-sm ring-1 ring-white/20">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </div>
          <div>
            <h1 className="page-title">Admin Panel</h1>
            <p className="page-subtitle">Manage departments, approvers, users, and security</p>
          </div>
        </div>
        <Link to="/admin/activity" className="glass-chip text-navy-600 hover:text-brand-600 hover:border-brand-500/30 transition-all mt-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Activity Log
        </Link>
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
  const [settingDelegateFor, setSettingDelegateFor] = useState<string | null>(null);

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
      const { data, error } = await supabase.from('departments').insert({ name: newName, code }).select().single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to add department');
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
      const { data, error } = await supabase.from('departments').update({ name: editName, code }).eq('id', editingDept.id).select().single();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Failed to update department');
      setSuccessMsg(`Department updated.`);
      cancelEdit(); await load();
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Failed to update department.'); }
    finally { setEditSaving(false); setTimeout(clearMessages, 4000); }
  };

  const confirmDelete = async () => {
    if (!deletingDeptId) return;
    clearMessages(); setDeleteSaving(true);
    try {
      const { error: unlinkError } = await supabase.from('profiles').update({ department_id: null, role: 'staff' }).eq('department_id', deletingDeptId);
      if (unlinkError) throw new Error(unlinkError.message);
      const { error: deleteError } = await supabase.from('departments').delete().eq('id', deletingDeptId);
      if (deleteError) throw new Error(deleteError.message);
      setDeletingDeptId(null);
      setSuccessMsg('Department deleted.');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete department.';
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

  const setDelegate = async (hodId: string, delegateProfileId: string) => {
    clearMessages();
    try {
      const { error } = await supabase.from('profiles').update({ delegate_id: delegateProfileId || null }).eq('id', hodId);
      if (error) throw new Error(error.message);
      setSettingDelegateFor(null);
      setSuccessMsg('Delegate assigned.');
      await load();
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Failed to assign delegate.'); }
    setTimeout(clearMessages, 4000);
  };

  return (
    <div className="space-y-5">
      {successMsg && (<div className="alert-success"><svg className="w-4 h-4 text-success-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{successMsg}</div>)}
      {errorMsg && (<div className="alert-error"><svg className="w-4 h-4 text-danger-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>{errorMsg}</div>)}

      {/* Add department form */}
      <form onSubmit={add} className="card-premium p-5 flex gap-3 flex-wrap items-end animate-fade-in">
        <div className="flex-1 min-w-40"><label className="label">Department Name</label><input required placeholder="e.g. Human Resources" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" /></div>
        <div className="w-28"><label className="label">Code</label><input required placeholder="HR" value={newCode} onChange={(e) => setNewCode(e.target.value)} maxLength={10} className="input uppercase" /></div>
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Adding...' : 'Add'}</button>
      </form>

      {/* Department list */}
      <div className="space-y-3">
        {depts.map((d, idx) => {
          const hods = getHODsForDept(d.id);
          const isEditing = editingDept?.id === d.id;
          return (
            <div key={d.id} className={`card card-hover p-5 animate-slide-up stagger-${Math.min(idx + 1, 5)}`}>
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
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-navy-900">{d.name}</span>
                      <span className="glass-chip !px-2 !py-0.5 !text-[11px] font-mono text-navy-500">{d.code}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => startEdit(d)} className="btn-ghost !px-3 !py-1.5 !text-xs" title="Edit department">Edit</button>
                      <button onClick={() => setDeletingDeptId(d.id)} className="text-xs font-medium text-danger-600 hover:text-danger-700 px-3 py-1.5 rounded-xl hover:bg-danger-50 active:scale-[0.97] transition-all" title="Delete department">Delete</button>
                    </div>
                  </div>

                  {/* Approvers section */}
                  <div className="border-t border-surface-200/60 dark:border-white/[0.06] pt-3 mt-1">
                    <p className="section-title mb-2">Approvers</p>
                    {hods.length === 0 && <p className="text-sm text-navy-300 italic mb-2">No approvers assigned</p>}
                    {hods.map((hod) => (
                      <div key={hod.id} className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-surface-100/60 dark:hover:bg-white/[0.03] transition-colors group">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full avatar-gradient flex items-center justify-center">
                            <span className="text-[10px] font-semibold">{hod.full_name?.slice(0, 2).toUpperCase() ?? '??'}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-navy-800">{hod.full_name}</p>
                            <p className="text-xs text-navy-400">{hod.email}</p>
                          </div>
                          {hod.delegate_id && <span className="glass-chip !px-1.5 !py-0.5 !text-[10px] text-navy-400">has delegate</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          {settingDelegateFor === hod.id ? (
                            <select className="input text-xs py-1 px-2 w-44" defaultValue="" onChange={(e) => { if (e.target.value) setDelegate(hod.id, e.target.value); }}>
                              <option value="" disabled>Select delegate...</option>
                              <option value="">None (clear)</option>
                              {profiles.filter((p) => p.id !== hod.id).map((p) => (
                                <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                              ))}
                            </select>
                          ) : (
                            <button onClick={() => setSettingDelegateFor(hod.id)} className="text-xs text-navy-400 hover:text-navy-700 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 rounded-lg hover:bg-surface-100">Delegate</button>
                          )}
                          <button onClick={() => removeApprover(hod.id, hod.full_name ?? '')} className="text-xs text-danger-600/70 hover:text-danger-700 opacity-0 group-hover:opacity-100 transition-all px-2 py-1 rounded-lg hover:bg-danger-50">Remove</button>
                        </div>
                      </div>
                    ))}
                    {addingApproverFor === d.id ? (
                      <div className="mt-2 rounded-xl border border-surface-200/70 dark:border-white/[0.08] p-3 bg-surface-50/60 dark:bg-white/[0.03]">
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
                      <button onClick={() => setAddingApproverFor(d.id)} className="mt-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 bg-gradient-to-r from-brand-500/10 to-accent-500/10 text-brand-600 dark:text-brand-300 border border-brand-500/20 hover:border-brand-500/40 transition-all">
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
        {depts.length === 0 && (
          <div className="empty-state">
            <p className="text-sm text-navy-300">No departments yet. Add one above.</p>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deletingDeptId && (
        <div className="modal-overlay">
          <div className="modal-content p-6">
            <div className="h-11 w-11 rounded-xl bg-danger-50 text-danger-600 border border-danger-500/20 flex items-center justify-center mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-navy-900 font-display mb-2">Delete Department?</h3>
            <p className="text-sm text-navy-500 mb-6">This will unlink all users from this department and remove their HOD role. Visits and gate passes linked to this department may prevent deletion.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingDeptId(null)} className="btn-secondary">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteSaving} className="btn-danger">{deleteSaving ? 'Deleting...' : 'Delete'}</button>
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('staff');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('*').order('full_name').then(({ data }) => setUsers(data ?? []));
    supabase.from('departments').select('*').order('name').then(({ data }) => setDepartments(data ?? []));
  }, []);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault(); setInviteError(''); setInviteSuccess(''); setInviting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: crypto.randomUUID().slice(0, 12),
        options: { data: { full_name: inviteName, role: inviteRole } },
      });
      if (error) { setInviteError(error.message); return; }
      setInviteSuccess(`Invitation sent to ${inviteEmail}. They will receive a confirmation email.`);
      setInviteEmail(''); setInviteName('');
      setTimeout(() => { setInviteSuccess(''); supabase.from('profiles').select('*').order('full_name').then(({ data }) => setUsers(data ?? [])); }, 2000);
    } catch (err) { setInviteError(err instanceof Error ? err.message : 'Failed to send invite.'); }
    finally { setInviting(false); }
  };

  const ROLES: UserRole[] = ['guard', 'hod', 'staff', 'admin'];
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
    <div className="space-y-5">
      {/* Invite user form (C-03) */}
      <form onSubmit={sendInvite} className="card-premium p-5 space-y-4 animate-fade-in">
        <h3 className="section-title !text-navy-700">Invite New User</h3>
        {inviteSuccess && <div className="alert-success"><svg className="w-4 h-4 text-success-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{inviteSuccess}</div>}
        {inviteError && <div className="alert-error">{inviteError}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div><label className="label">Full Name</label><input required value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="input" placeholder="John Doe" /></div>
          <div><label className="label">Email</label><input required type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="input" placeholder="john@company.com" /></div>
          <div><label className="label">Role</label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as UserRole)} className="input">
              {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={inviting} className="btn-primary w-full">{inviting ? 'Sending...' : 'Send Invite'}</button>
          </div>
        </div>
      </form>

      <div className="space-y-2">
      {users.map((u, idx) => (
        <div key={u.id} className={`card card-hover px-5 py-3.5 flex items-center gap-4 animate-slide-up stagger-${Math.min(idx + 1, 5)}`}>
          <div className="avatar-md avatar-gradient">
            <span>{u.full_name?.slice(0, 2).toUpperCase() ?? '??'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-navy-900 truncate">{u.full_name}</p>
              <span className="inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 bg-gradient-to-r from-brand-500/15 to-accent-500/15 text-brand-600 dark:text-brand-300 border border-brand-500/20">{u.role.replace('_', ' ')}</span>
            </div>
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
    </div>
  );
}

function BlacklistTab(): React.ReactElement {
  const [entries, setEntries] = useState<Visitor[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => { const { data } = await supabase.from('visitors').select('*').eq('is_blacklisted', true).order('full_name'); setEntries(data ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    let normalized: string;
    try { normalized = normalizePhone(phone); } catch { setSaving(false); return; }
    try {
      await supabase.from('visitors').upsert({ phone: normalized, full_name: '(Blacklisted)', is_blacklisted: true, blacklist_reason: reason }, { onConflict: 'phone' });
      setPhone(''); setReason(''); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to blacklist.'); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => { await supabase.from('visitors').update({ is_blacklisted: false, blacklist_reason: null }).eq('id', id); await load(); };

  return (
    <div className="space-y-5">
      {error && <div className="alert-error">{error}</div>}
      <form onSubmit={add} className="card-premium p-5 flex gap-3 flex-wrap items-end animate-fade-in border-danger-500/20">
        <div className="flex-1 min-w-40"><label className="label">Phone Number</label><input required type="tel" maxLength={20} placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" /></div>
        <div className="flex-1 min-w-40"><label className="label">Reason</label><input required maxLength={500} placeholder="Reason for blacklisting" value={reason} onChange={(e) => setReason(e.target.value)} className="input" /></div>
        <button type="submit" disabled={saving} className="btn-danger">{saving ? 'Adding...' : 'Blacklist'}</button>
      </form>
      <div className="space-y-2">
        {entries.map((e, idx) => (
          <div key={e.id} className={`card px-5 py-3.5 flex items-center justify-between gap-4 border-danger-500/20 bg-danger-50/40 dark:bg-danger-500/[0.05] animate-slide-up stagger-${Math.min(idx + 1, 5)}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-danger-50 text-danger-600 border border-danger-500/20 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-navy-900 truncate">{e.full_name}</p>
                <p className="text-xs text-navy-400 mt-0.5 truncate">{e.phone} · {e.blacklist_reason}</p>
              </div>
            </div>
            <button onClick={() => remove(e.id)} className="text-xs font-medium text-danger-600 hover:text-danger-700 px-3 py-1.5 rounded-xl hover:bg-danger-100/60 dark:hover:bg-danger-500/10 active:scale-[0.97] transition-all shrink-0">Remove</button>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="empty-state">
            <p className="text-sm text-navy-300">No blacklist entries</p>
          </div>
        )}
      </div>
    </div>
  );
}
