import { useEffect, useMemo, useState } from 'react';
import { Download, Mail, MoreVertical, Pencil, Plus, Search, Upload, UserCheck, UserX, X } from 'lucide-react';
import { api, downloadApiFile } from '../lib/api';

const emptyForm = { name: '', email: '', mobile: '' };

function CoordinatorForm({ initialValue, onClose, onSaved }) {
  const [form, setForm] = useState(initialValue || emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api(initialValue?._id ? `/coordinators/${initialValue._id}` : '/coordinators', {
        method: initialValue?._id ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      onSaved(!initialValue?._id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
    <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-semibold">{initialValue ? 'Edit scan coordinator' : 'Add scan coordinator'}</h2><p className="mt-1 text-xs text-slate-500">This account can sign in and scan student QR codes.</p></div><button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-slate-100" aria-label="Close"><X size={17}/></button></div>
    <div className="grid gap-4 p-5 sm:grid-cols-2">{error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:col-span-2">{error}</div> : null}
      <label className="sm:col-span-2"><span className="text-xs font-medium">Full name</span><input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label>
      <label><span className="text-xs font-medium">Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label>
      <label><span className="text-xs font-medium">Mobile number</span><input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label>
      <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 sm:col-span-2">This account receives QR scanner access.</div>
    </div>
    <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-300 px-3 text-sm">Cancel</button><button disabled={saving} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save coordinator'}</button></div>
  </form></div>;
}

function BulkCoordinatorModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  async function send(path) {
    if (!file) return setError('Select an Excel or CSV file');
    setWorking(true); setError('');
    const body = new FormData(); body.append('file', file);
    try {
      const result = await api(path, { method: 'POST', body });
      if (path.endsWith('preview')) setPreview(result); else onImported(result.imported);
    } catch (requestError) { setError(requestError.message); } finally { setWorking(false); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-xl">
    <div className="flex items-start justify-between border-b px-5 py-4"><div><h2 className="text-base font-semibold">Bulk import coordinators</h2><p className="mt-1 text-xs text-slate-500">Preview all rows before accounts and credential jobs are created.</p></div><button onClick={onClose} className="p-2"><X size={17}/></button></div>
    <div className="space-y-4 overflow-auto p-5">{error ? <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</div> : null}<div className="flex flex-wrap gap-2"><button onClick={() => downloadApiFile('/coordinators/import/template', 'geu-coordinator-import-template.xlsx')} className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm"><Download size={14}/>Download template</button><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm"><Upload size={14}/>{file?.name || 'Choose file'}<input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0]); setPreview(null); }}/></label><button disabled={!file || working} onClick={() => send('/coordinators/import/preview')} className="h-9 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50">Preview</button></div>
      {preview ? <><div className="grid grid-cols-3 gap-3 text-sm"><div className="rounded-md border p-3">Total <b className="float-right">{preview.total}</b></div><div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">Valid <b className="float-right">{preview.validCount}</b></div><div className="rounded-md border border-red-200 bg-red-50 p-3">Errors <b className="float-right">{preview.errorCount}</b></div></div><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[560px] text-left text-xs"><thead className="bg-slate-50"><tr><th className="p-2">Row</th><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Mobile</th><th className="p-2">Result</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.row} className="border-t"><td className="p-2">{row.row}</td><td className="p-2">{row.name}</td><td className="p-2">{row.email}</td><td className="p-2">{row.mobile}</td><td className={`p-2 ${row.valid ? 'text-emerald-700' : 'text-red-700'}`}>{row.valid ? 'Ready' : row.errors.join('; ')}</td></tr>)}</tbody></table></div></> : null}
    </div><div className="flex justify-end gap-2 border-t px-5 py-4"><button onClick={onClose} className="h-9 rounded-md border px-3 text-sm">Cancel</button><button disabled={!preview || preview.errorCount || working} onClick={() => send('/coordinators/import/commit')} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">Import {preview?.validCount || 0}</button></div>
  </div></div>;
}

export default function CoordinatorsPage() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(null);
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      setItems((await api(`/coordinators?${params}`)).coordinators);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { const timer = setTimeout(load, 200); return () => clearTimeout(timer); }, [search, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    inactive: items.filter((item) => !item.isActive).length,
  }), [items]);
  const activeMenuCoordinator = useMemo(() => items.find((item) => item._id === menu?.coordinatorId), [items, menu]);

  function openCoordinatorMenu(item, event) {
    if (menu?.coordinatorId === item._id) {
      setMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = item.isActive ? 132 : 92;
    setMenu({
      coordinatorId: item._id,
      left: Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)),
      top: Math.max(8, Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 6)),
    });
  }

  async function setActive(item) {
    const next = !item.isActive;
    if (!window.confirm(`${next ? 'Reactivate' : 'Deactivate'} ${item.name}?`)) return;
    try {
      await api(`/coordinators/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) });
      setMenu(null); load();
    } catch (requestError) { setError(requestError.message); }
  }
  async function resend(item) {
    if (!window.confirm(`Generate a new temporary password and queue credentials for ${item.email}? Their previous password will stop working.`)) return;
    try {
      await api(`/coordinators/${item._id}/resend-credentials`, { method: 'POST' });
      setNotice('New credentials queued for delivery.'); setMenu(null);
    } catch (requestError) { setError(requestError.message); }
  }

  return <div className="scan-coordinators-page space-y-4">
    <div className="flex items-end justify-between gap-3"><div><h1 className="text-xl font-semibold">Scan Coordinators</h1><p className="mt-1 text-xs text-slate-500">Manage accounts that can verify students by scanning QR codes.</p></div><div className="flex gap-2"><button onClick={() => setBulkOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold"><Upload size={15}/>Bulk import</button><button onClick={() => setForm(emptyForm)} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white"><Plus size={16}/>Add scan coordinator</button></div></div>
    <div className="grid gap-3 sm:grid-cols-3">{[['Scan coordinators', counts.total], ['Active access', counts.active], ['Inactive access', counts.inactive]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>)}</div>
    {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}{error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_210px_160px]"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" placeholder="Search name, email or mobile"/></label><select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 rounded-md border border-slate-300 px-3 text-sm"><option value="">All coordinator types</option><option value="group_coordinator">Group coordinator</option><option value="scan_coordinator">Scan coordinator</option></select><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-slate-300 px-3 text-sm"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3">Coordinator</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Groups</th><th className="px-4 py-3">Last login</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="7" className="p-10 text-center text-sm text-slate-500">Loading coordinators…</td></tr> : items.length ? items.map((item) => <tr key={item._id} className="text-sm"><td className="px-4 py-3"><div className="font-semibold">{item.name}</div><div className="text-xs text-slate-500">{item.email}</div></td><td className="px-4 py-3 text-slate-600">{item.role === 'group_coordinator' ? 'Group coordinator' : 'Scan coordinator'}</td><td className="px-4 py-3 text-slate-600">{item.mobile}</td><td className="px-4 py-3">{item.role === 'group_coordinator' ? item.assignedGroups : '—'}</td><td className="px-4 py-3 text-xs text-slate-500">{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never'}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></td><td className="relative px-4 py-3 text-right"><button onClick={() => setMenu(menu === item._id ? null : item._id)} className="rounded-md p-2 hover:bg-slate-100"><MoreVertical size={16}/></button>{menu === item._id ? <div className="absolute right-8 top-10 z-20 w-52 rounded-md border border-slate-200 bg-white p-1 text-left shadow-lg"><button onClick={() => { setForm(item); setMenu(null); }} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"><Pencil size={14}/>Edit coordinator</button>{item.isActive ? <button onClick={() => resend(item)} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"><Mail size={14}/>Resend credentials</button> : null}<button onClick={() => setActive(item)} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50">{item.isActive ? <UserX size={14}/> : <UserCheck size={14}/>} {item.isActive ? 'Deactivate' : 'Reactivate'}</button></div> : null}</td></tr>) : <tr><td colSpan="7" className="p-10 text-center text-sm text-slate-500">No coordinators found.</td></tr>}</tbody></table></div>
    </div>
    {menu && activeMenuCoordinator ? <><button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close coordinator actions" onClick={() => setMenu(null)}/><div className="fixed z-50 w-52 rounded-md border border-slate-200 bg-white p-1 text-left text-sm shadow-lg" style={{ left: menu.left, top: menu.top }}><button onClick={() => { setForm(activeMenuCoordinator); setMenu(null); }} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"><Pencil size={14}/>Edit coordinator</button>{activeMenuCoordinator.isActive ? <button onClick={() => resend(activeMenuCoordinator)} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"><Mail size={14}/>Resend credentials</button> : null}<button onClick={() => setActive(activeMenuCoordinator)} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50">{activeMenuCoordinator.isActive ? <UserX size={14}/> : <UserCheck size={14}/>} {activeMenuCoordinator.isActive ? 'Deactivate' : 'Reactivate'}</button></div></> : null}
    {form ? <CoordinatorForm initialValue={form._id ? form : null} onClose={() => setForm(null)} onSaved={(created) => { setForm(null); setNotice(created ? 'Coordinator created and credential email queued.' : 'Coordinator updated.'); load(); }}/>: null}
    {bulkOpen ? <BulkCoordinatorModal onClose={() => setBulkOpen(false)} onImported={(count) => { setBulkOpen(false); setNotice(`${count} coordinators imported and credential emails queued.`); load(); }}/>: null}
  </div>;
}
