import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileSpreadsheet, LoaderCircle, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { api, downloadApiFile } from '../lib/api';

const emptyForm = { name: '', email: '', phone: '', qrLink: '' };

function QrDataForm({ initialValue, onClose, onSaved }) {
  const [form, setForm] = useState(initialValue || emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const editing = Boolean(initialValue?._id);
      await api(editing ? `/student-qr-data/${initialValue._id}` : '/student-qr-data', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true"><form onSubmit={submit} className="w-full max-w-lg rounded-t-xl border border-slate-200 bg-white shadow-xl sm:rounded-xl">
    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-semibold">{initialValue ? 'Edit QR login data' : 'Add QR login data'}</h2><p className="mt-1 text-xs text-slate-500">This data powers the public student OTP login.</p></div><button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button></div>
    <div className="grid gap-4 p-5 sm:grid-cols-2">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:col-span-2">{error}</div> : null}
      <label className="block sm:col-span-2"><span className="text-xs font-medium text-slate-700">Student name</span><input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="Full name"/></label>
      <label className="block"><span className="text-xs font-medium text-slate-700">Email</span><input required type="email" maxLength={180} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="student@example.com"/></label>
      <label className="block"><span className="text-xs font-medium text-slate-700">Phone number</span><input required maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="+91 9999999999"/></label>
      <label className="block sm:col-span-2"><span className="text-xs font-medium text-slate-700">QR link</span><input required type="url" maxLength={1000} value={form.qrLink} onChange={(event) => setForm({ ...form, qrLink: event.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="https://example.com/student-qr.png"/></label>
    </div>
    <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={saving} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save data'}</button></div>
  </form></div>;
}

function BulkImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  async function previewFile() {
    if (!file) return setError('Select an Excel or CSV file');
    setWorking(true);
    setError('');
    const body = new FormData();
    body.append('file', file);
    try {
      setPreview(await api('/student-qr-data/import/preview', { method: 'POST', body }));
    } catch (requestError) {
      setError(requestError.message);
      setPreview(null);
    } finally {
      setWorking(false);
    }
  }

  async function commit() {
    setWorking(true);
    setError('');
    const body = new FormData();
    body.append('file', file);
    try {
      const result = await api('/student-qr-data/import/commit', { method: 'POST', body });
      onImported(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  const invalidRows = preview?.rows?.filter((row) => !row.valid).slice(0, 8) || [];
  const importLabel = working
    ? 'Importing…'
    : preview?.errorCount > 0
      ? `Fix ${preview.errorCount} error${preview.errorCount === 1 ? '' : 's'} to import`
      : `Import ${preview?.validCount || 0} rows`;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true"><div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
    <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-semibold">Bulk import QR login data</h2><p className="mt-1 text-xs text-slate-500">Upload name, email, phone number and QR link.</p></div><button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button></div>
    <div className="space-y-4 overflow-y-auto p-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold">Use the QR data template</div><p className="mt-1 text-xs text-slate-500">Maximum 5,000 rows. Accepted: .xlsx and .csv</p></div><button onClick={() => downloadApiFile('/student-qr-data/template', 'student-qr-data-template.xlsx').catch((requestError) => setError(requestError.message))} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"><Download size={15}/>Download template</button></div>
      <div className="flex flex-col gap-3 sm:flex-row"><label className="flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"><FileSpreadsheet size={16}/><span className="truncate">{file?.name || 'Choose Excel or CSV file'}</span><input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }}/></label><button disabled={!file || working} onClick={previewFile} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Upload size={15}/>{working ? 'Checking…' : 'Preview file'}</button></div>
      {preview ? <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-md border border-slate-200 p-3"><div className="text-xs text-slate-500">Total rows</div><div className="mt-1 text-lg font-semibold">{preview.total}</div></div><div className="rounded-md border border-emerald-200 bg-emerald-50 p-3"><div className="text-xs text-emerald-700">Valid</div><div className="mt-1 text-lg font-semibold text-emerald-700">{preview.validCount}</div></div><div className="rounded-md border border-red-200 bg-red-50 p-3"><div className="text-xs text-red-700">Errors</div><div className="mt-1 text-lg font-semibold text-red-700">{preview.errorCount}</div></div></div>{invalidRows.length ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Import is blocked until every row is valid. Fix row {invalidRows.map((row) => row.row).join(', ')}{preview.errorCount > invalidRows.length ? ` and ${preview.errorCount - invalidRows.length} more` : ''}.</div> : null}<div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[860px] text-left"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">QR link</th><th className="px-3 py-2">Result</th></tr></thead><tbody className="divide-y divide-slate-100">{preview.rows.slice(0, 500).map((row) => <tr key={row.row} className="text-xs"><td className="px-3 py-2">{row.row}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{row.phone}</td><td className="max-w-[260px] truncate px-3 py-2">{row.qrLink}</td><td className="px-3 py-2">{row.valid ? <span className="font-medium text-emerald-700">Ready</span> : <span className="text-red-700">{row.errors.join('; ')}</span>}</td></tr>)}</tbody></table></div>{preview.rows.length > 500 ? <p className="text-xs text-slate-500">Showing first 500 rows. All {preview.total} rows were validated.</p> : null}</> : null}
    </div>
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4"><button onClick={onClose} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium">Cancel</button><button disabled={!preview || preview.errorCount > 0 || working} onClick={commit} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{importLabel}</button></div>
  </div></div>;
}

export default function StudentQrDataPage() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function load(page = pagination.page) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit });
      if (search) params.set('search', search);
      const data = await api(`/student-qr-data?${params}`);
      setItems(data.items);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => load(1), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const range = useMemo(() => {
    if (!pagination.total) return '0 rows';
    const start = (pagination.page - 1) * pagination.limit + 1;
    return `${start}–${Math.min(start + items.length - 1, pagination.total)} of ${pagination.total}`;
  }, [pagination, items.length]);

  async function remove(item) {
    if (!window.confirm(`Delete QR login data for ${item.name}?`)) return;
    try {
      await api(`/student-qr-data/${item._id}`, { method: 'DELETE' });
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function exportData() {
    setDownloading(true);
    setError('');
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      await downloadApiFile(`/student-qr-data/export.xlsx${query}`, 'student-qr-data.xlsx');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloading(false);
    }
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold">Student QR Data</h1><p className="mt-1 text-xs text-slate-500">Upload the student login data used by the public OTP QR page.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setBulkOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Upload size={15}/>Bulk import data</button><button disabled={downloading} onClick={exportData} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{downloading ? <LoaderCircle className="animate-spin" size={15}/> : <FileSpreadsheet size={15}/>}Export data</button><button onClick={() => { setEditing(null); setFormOpen(true); }} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16}/>Add data</button></div></div>
    {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
    {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4"><label className="relative block max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" placeholder="Search name, email or phone"/></label></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Phone</th><th className="px-4 py-3 font-semibold">QR link</th><th className="px-4 py-3 font-semibold">Uploaded</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="5" className="px-4 py-12 text-center text-sm text-slate-500">Loading QR data…</td></tr> : items.length ? items.map((item) => <tr key={item._id} className="text-sm hover:bg-slate-50/70"><td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.name}</div><div className="mt-0.5 text-xs text-slate-500">{item.email}</div></td><td className="px-4 py-3 text-slate-600">{item.phone}</td><td className="max-w-[340px] px-4 py-3 text-xs"><a href={item.qrLink} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-blue-700 hover:text-blue-800"><span className="truncate">{item.qrLink}</span><ExternalLink size={13}/></a></td><td className="px-4 py-3 text-xs text-slate-600">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</td><td className="px-4 py-3 text-right"><button onClick={() => { setEditing(item); setFormOpen(true); }} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${item.name}`}><Pencil size={16}/></button><button onClick={() => remove(item)} className="rounded-md p-2 text-red-500 hover:bg-red-50" aria-label={`Delete ${item.name}`}><Trash2 size={16}/></button></td></tr>) : <tr><td colSpan="5" className="px-4 py-12 text-center text-sm text-slate-500">No QR data found.</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>{range}</span><div className="flex gap-2"><button disabled={pagination.page <= 1 || loading} onClick={() => load(pagination.page - 1)} className="h-8 rounded-md border border-slate-300 px-3 font-medium text-slate-700 disabled:opacity-40">Previous</button><button disabled={pagination.page >= pagination.pages || loading} onClick={() => load(pagination.page + 1)} className="h-8 rounded-md border border-slate-300 px-3 font-medium text-slate-700 disabled:opacity-40">Next</button></div></div>
    </div>
    {formOpen ? <QrDataForm initialValue={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); setNotice('QR login data saved.'); load(1); }}/> : null}
    {bulkOpen ? <BulkImportModal onClose={() => setBulkOpen(false)} onImported={(result) => { setBulkOpen(false); setNotice(`${result.imported} QR data rows imported successfully.`); load(1); }}/> : null}
  </div>;
}
