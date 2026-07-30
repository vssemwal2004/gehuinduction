import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';

const emptyForm = { name: '', code: '', whatsappLink: '', isActive: true };

function GroupForm({ initialValue, onClose, onSaved }) {
  const [form, setForm] = useState(initialValue || emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const editing = Boolean(initialValue?._id);
      const data = await api(editing ? `/groups/${initialValue._id}` : '/groups', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      onSaved(data.group);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="group-form-title">
    <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 id="group-form-title" className="text-base font-semibold">{initialValue ? 'Edit group' : 'Add group'}</h2><p className="mt-1 text-xs text-slate-500">Manage the WhatsApp destination for this group.</p></div><button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button></div>
      <div className="space-y-4 p-5">
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
        <label className="block"><span className="text-xs font-medium text-slate-700">Group name</span><input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="Group 1"/></label>
        <label className="block"><span className="text-xs font-medium text-slate-700">Group code</span><input required maxLength={30} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm uppercase focus:border-blue-500" placeholder="G1"/></label>
        <label className="block"><span className="text-xs font-medium text-slate-700">WhatsApp group link</span><input required type="url" value={form.whatsappLink} onChange={(e) => setForm({ ...form, whatsappLink: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="https://chat.whatsapp.com/..."/><span className="mt-1.5 block text-[11px] text-slate-500">Only secure WhatsApp links are accepted.</span></label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600"/>Active group</label>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={saving} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save group'}</button></div>
    </form>
  </div>;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/groups');
      setGroups(data.groups);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => groups.filter((group) => {
    const matchesSearch = `${group.name} ${group.code}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === 'all' || (status === 'active' ? group.isActive : !group.isActive);
    return matchesSearch && matchesStatus;
  }), [groups, search, status]);

  async function remove(group) {
    if (!window.confirm(`Delete ${group.name}? This is allowed only when no active students use it.`)) return;
    try {
      await api(`/groups/${group._id}`, { method: 'DELETE' });
      setGroups((items) => items.filter((item) => item._id !== group._id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(group) {
    setEditing(group);
    setFormOpen(true);
  }

  return <div className="groups-page space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold">Groups & WhatsApp</h1><p className="mt-1 text-xs text-slate-500">Configure student groups and their official WhatsApp links.</p></div><button onClick={openCreate} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16}/>Add group</button></div>
    {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" placeholder="Search group name or code"/></label><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-slate-300 px-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Group</th><th className="px-4 py-3 font-semibold">WhatsApp link</th><th className="px-4 py-3 font-semibold">Students</th><th className="px-4 py-3 font-semibold">Coordinator</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">Loading groups…</td></tr> : filtered.length ? filtered.map((group) => <tr key={group._id} className="text-sm hover:bg-slate-50/70"><td className="px-4 py-3"><div className="font-semibold text-slate-900">{group.name}</div><div className="mt-0.5 text-xs text-slate-500">{group.code}</div></td><td className="px-4 py-3"><a href={group.whatsappLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline">Open link<ExternalLink size={13}/></a></td><td className="px-4 py-3 text-slate-600">{group.studentCount}</td><td className="px-4 py-3 text-slate-600">{group.coordinatorId?.name || 'Not assigned'}</td><td className="px-4 py-3">{group.isActive ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"><Check size={12}/>Active</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Inactive</span>}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={() => openEdit(group)} className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700" aria-label={`Edit ${group.name}`}><Pencil size={15}/></button><button onClick={() => remove(group)} className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${group.name}`}><Trash2 size={15}/></button></div></td></tr>) : <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">No groups found.</td></tr>}</tbody></table></div>
      <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">{filtered.length} of {groups.length} groups</div>
    </div>
    {formOpen ? <GroupForm initialValue={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }}/> : null}
  </div>;
}
