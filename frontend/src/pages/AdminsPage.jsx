import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, ShieldCheck, UserCog, X } from 'lucide-react';
import { api } from '../lib/api';

const emptyForm = { name: '', email: '', isSuperAdmin: false };
const permissionOptions = [
  ['admins', 'Admins', 'Create admins and assign feature access.'],
  ['students', 'Students', 'View, import, edit, export and download student QR files.'],
  ['studentQrData', 'Student QR Data', 'Manage student phone and QR login data.'],
  ['coordinators', 'Coordinators', 'Create scanner accounts and send credentials.'],
  ['groups', 'Groups & WhatsApp', 'Create groups and update WhatsApp links.'],
  ['activityLogs', 'Activity Logs', 'View activity logs and retry failed emails.'],
  ['settings', 'Settings', 'Update scan email template and send tests.'],
];

function AdminForm({ initialValue, onClose, onSaved }) {
  const [form, setForm] = useState(initialValue ? { name: initialValue.name, email: initialValue.email, isSuperAdmin: initialValue.isSuperAdmin, permissions: initialValue.permissions || [] } : { ...emptyForm, permissions: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const path = initialValue?._id ? `/admins/${initialValue._id}` : '/admins';
      const method = initialValue?._id ? 'PUT' : 'POST';
      await api(path, { method, body: JSON.stringify({ ...form, permissions: form.isSuperAdmin ? [] : form.permissions }) });
      onSaved(!initialValue?._id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(permission) {
    setForm((current) => {
      const permissions = current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission];
      return { ...current, permissions };
    });
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
    <form onSubmit={submit} className="w-full max-w-lg rounded-t-xl border border-slate-200 bg-white shadow-xl sm:rounded-xl">
      <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
        <div><h2 className="text-base font-semibold">{initialValue?._id ? 'Edit admin' : 'Create admin'}</h2><p className="mt-1 text-xs text-slate-500">Credential email is sent automatically for new admins.</p></div>
        <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button>
      </div>
      <div className="grid gap-4 p-5">
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <label><span className="text-xs font-medium text-slate-700">Name</span><input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label>
        <label><span className="text-xs font-medium text-slate-700">Email</span><input required type="email" maxLength={180} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label>
        <div className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-3">
          <span><span className="block text-sm font-semibold text-slate-800">Full admin access</span><span className="mt-0.5 block text-xs text-slate-500">Can manage admins, coordinators, QR data, groups, logs and settings.</span></span>
          <button type="button" onClick={() => setForm((current) => ({ ...current, isSuperAdmin: !current.isSuperAdmin }))} className={`relative h-6 w-11 shrink-0 rounded-full transition ${form.isSuperAdmin ? 'bg-blue-600' : 'bg-slate-300'}`} aria-pressed={form.isSuperAdmin} aria-label="Toggle full admin access">
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${form.isSuperAdmin ? 'left-6' : 'left-1'}`}/>
          </button>
        </div>
        <div className={`rounded-md border border-slate-200 ${form.isSuperAdmin ? 'opacity-50' : ''}`}>
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">Feature access</div>
          <div className="divide-y divide-slate-100">{permissionOptions.map(([permission, label, detail]) => <div key={permission} className="flex items-center justify-between gap-4 px-3 py-3">
            <span><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="mt-0.5 block text-xs text-slate-500">{detail}</span></span>
            <button disabled={form.isSuperAdmin} type="button" onClick={() => togglePermission(permission)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${form.isSuperAdmin || form.permissions.includes(permission) ? 'bg-blue-600' : 'bg-slate-300'}`} aria-pressed={form.isSuperAdmin || form.permissions.includes(permission)} aria-label={`Toggle ${label} access`}>
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${form.isSuperAdmin || form.permissions.includes(permission) ? 'left-6' : 'left-1'}`}/>
            </button>
          </div>)}</div>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={onClose} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><ShieldCheck size={16}/>{saving ? 'Saving...' : 'Save admin'}</button></div>
    </form>
  </div>;
}

export default function AdminsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (search) query.set('search', search);
      if (status) query.set('status', status);
      const data = await api(`/admins${query.toString() ? `?${query}` : ''}`);
      setItems(data.admins || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [search, status]);

  async function setActive(item, isActive) {
    await api(`/admins/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
    setNotice(`${item.name} ${isActive ? 'activated' : 'deactivated'}.`);
    load();
  }

  async function resend(item) {
    if (!window.confirm(`Generate a new temporary password and email it to ${item.email}? Their previous password will stop working.`)) return;
    await api(`/admins/${item._id}/resend-credentials`, { method: 'POST' });
    setNotice('Temporary password email queued.');
  }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-xl font-semibold">Admins</h1><p className="mt-1 text-xs text-slate-500">Create admin accounts and choose exact feature access.</p></div>
      <button onClick={() => setForm(emptyForm)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16}/>Add admin</button>
    </div>
    {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
    {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_180px]"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" placeholder="Search name or email"/></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border border-slate-300 px-3 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Access</th><th className="px-4 py-3">Features</th><th className="px-4 py-3">Last login</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="6" className="p-10 text-center text-sm text-slate-500">Loading admins...</td></tr> : items.length ? items.map((item) => <tr key={item._id} className="text-sm"><td className="px-4 py-3"><div className="font-semibold">{item.name}</div><div className="text-xs text-slate-500">{item.email}</div></td><td className="px-4 py-3">{item.isSuperAdmin ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700"><ShieldCheck size={13}/>Full access</span> : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"><UserCog size={13}/>Custom</span>}</td><td className="max-w-[280px] px-4 py-3 text-xs text-slate-600">{item.isSuperAdmin ? 'All features' : item.permissions?.length ? permissionOptions.filter(([permission]) => item.permissions.includes(permission)).map(([, label]) => label).join(', ') : 'Dashboard only'}</td><td className="px-4 py-3 text-xs text-slate-500">{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never'}</td><td className="px-4 py-3"><button onClick={() => setActive(item, !item.isActive)} className={`relative h-6 w-11 rounded-full transition ${item.isActive ? 'bg-emerald-600' : 'bg-slate-300'}`} aria-label={`${item.isActive ? 'Deactivate' : 'Activate'} ${item.name}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${item.isActive ? 'left-6' : 'left-1'}`}/></button></td><td className="px-4 py-3 text-right"><button onClick={() => setForm(item)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${item.name}`}><Pencil size={16}/></button><button onClick={() => resend(item)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={`Reset password for ${item.name}`}><KeyRound size={16}/></button></td></tr>) : <tr><td colSpan="6" className="p-10 text-center text-sm text-slate-500">No admins found.</td></tr>}</tbody></table></div>
    </section>
    {form ? <AdminForm initialValue={form._id ? form : null} onClose={() => setForm(null)} onSaved={(created) => { setForm(null); setNotice(created ? 'Admin created and credential email queued.' : 'Admin updated.'); load(); }}/>: null}
  </div>;
}
