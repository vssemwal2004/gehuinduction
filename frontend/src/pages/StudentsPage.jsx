import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, Eye, FileSpreadsheet, MoreVertical, Pencil, Plus, QrCode, Search, Upload, UserRoundCheck, UserRoundX, X } from 'lucide-react';
import { api, downloadApiFile } from '../lib/api';

const emptyForm = { name: '', studentId: '', email: '', groupIds: [], groupCoordinatorName: '', groupCoordinatorMobile: '' };

function StudentForm({ groups, initialValue, onClose, onSaved }) {
  const [form, setForm] = useState(initialValue || emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const editing = Boolean(initialValue?._id);
      await api(editing ? `/students/${initialValue._id}` : '/students', {
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

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="student-form-title">
    <form onSubmit={submit} className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-slate-200 bg-white shadow-xl sm:max-h-[90vh] sm:rounded-xl">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 id="student-form-title" className="text-base font-semibold">{initialValue ? 'Edit student' : 'Add student'}</h2><p className="mt-1 text-xs text-slate-500">QR mapping is generated securely when a student is added.</p></div><button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:col-span-2">{error}</div> : null}
        <label className="block sm:col-span-2"><span className="text-xs font-medium text-slate-700">Student name</span><input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="Full name"/></label>
        <label className="block"><span className="text-xs font-medium text-slate-700">Student ID</span><input required maxLength={60} value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="GEU2026001"/></label>
        <label className="block"><span className="text-xs font-medium text-slate-700">Email</span><input required type="email" maxLength={180} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="student@example.com"/></label>
        <label className="block sm:col-span-2"><span className="text-xs font-medium text-slate-700">Student group</span><select required value={form.groupIds[0] || ''} onChange={(e) => setForm({ ...form, groupIds: e.target.value ? [e.target.value] : [] })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500"><option value="">Select group</option>{groups.filter((group) => group.isActive).map((group) => <option key={group._id} value={group._id}>{group.code} — {group.name}</option>)}</select><span className="mt-1.5 block text-[11px] text-slate-500">The WhatsApp link comes from this group. Assign the student’s group coordinator below.</span></label>
        <label className="block"><span className="text-xs font-medium text-slate-700">Group coordinator name</span><input required maxLength={120} value={form.groupCoordinatorName || ''} onChange={(e) => setForm({ ...form, groupCoordinatorName: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="Coordinator name"/></label>
        <label className="block"><span className="text-xs font-medium text-slate-700">Group coordinator mobile</span><input required maxLength={30} value={form.groupCoordinatorMobile || ''} onChange={(e) => setForm({ ...form, groupCoordinatorMobile: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-blue-500" placeholder="+91 9999999999"/></label>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={onClose} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button disabled={saving} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save student'}</button></div>
    </form>
  </div>;
}

function StudentDetails({ student, onClose }) {
  const rows = [
    ['Student ID', student.studentId],
    ['Email', student.email],
    ['Group', student.groupIds?.map((group) => group.name).join(', ') || 'Not assigned'],
    ['Group coordinator', student.groupCoordinatorName || student.groupCoordinatorId?.name || 'Not assigned'],
    ['Coordinator mobile', student.groupCoordinatorMobile || student.groupCoordinatorId?.mobile || 'Not available'],
    ['Registration', student.registrationStatus?.replace('_', ' ')],
    ['Scan count', student.scanCount || 0],
    ['Last scanned', student.lastScannedAt ? new Date(student.lastScannedAt).toLocaleString() : 'Never'],
  ];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"><div className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-base font-semibold">{student.name}</h2><p className="mt-1 text-xs text-slate-500">Student record and QR registration status</p></div><button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button></div><dl className="divide-y divide-slate-100 px-5">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[130px_1fr] gap-3 py-3 text-sm"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="break-words text-slate-800">{value}</dd></div>)}</dl></div></div>;
}

function StatusBadge({ student }) {
  if (!student.isActive || student.registrationStatus === 'inactive') return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Inactive</span>;
  if (student.registrationStatus === 'registered') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={12}/>Registered</span>;
  return <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Not registered</span>;
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
      setPreview(await api('/students/import/preview', { method: 'POST', body }));
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
      const result = await api('/students/import/commit', { method: 'POST', body });
      onImported(result.imported);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking(false);
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-import-title"><div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
    <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4"><div><h2 id="bulk-import-title" className="text-base font-semibold">Bulk import students</h2><p className="mt-1 text-xs text-slate-500">Preview every row before anything is saved.</p></div><button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={17}/></button></div>
    <div className="space-y-4 overflow-y-auto p-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold">Use the official template</div><p className="mt-1 text-xs text-slate-500">Maximum 5,000 rows. Accepted: .xlsx and .csv</p></div><button onClick={() => downloadApiFile('/students/import/template', 'geu-student-import-template.xlsx').catch((requestError) => setError(requestError.message))} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"><Download size={15}/>Download template</button></div>
      <div className="flex flex-col gap-3 sm:flex-row"><label className="flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50"><FileSpreadsheet size={16}/><span className="truncate">{file?.name || 'Choose Excel or CSV file'}</span><input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }}/></label><button disabled={!file || working} onClick={previewFile} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Upload size={15}/>{working ? 'Checking…' : 'Preview file'}</button></div>
      {preview ? <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-md border border-slate-200 p-3"><div className="text-xs text-slate-500">Total rows</div><div className="mt-1 text-lg font-semibold">{preview.total}</div></div><div className="rounded-md border border-emerald-200 bg-emerald-50 p-3"><div className="text-xs text-emerald-700">Valid</div><div className="mt-1 text-lg font-semibold text-emerald-700">{preview.validCount}</div></div><div className="rounded-md border border-red-200 bg-red-50 p-3"><div className="text-xs text-red-700">Errors</div><div className="mt-1 text-lg font-semibold text-red-700">{preview.errorCount}</div></div></div><div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[740px] text-left"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Student</th><th className="px-3 py-2">ID</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Group</th><th className="px-3 py-2">Result</th></tr></thead><tbody className="divide-y divide-slate-100">{preview.rows.slice(0, 500).map((row) => <tr key={row.row} className="text-xs"><td className="px-3 py-2">{row.row}</td><td className="px-3 py-2">{row.name}</td><td className="px-3 py-2">{row.studentId}</td><td className="px-3 py-2">{row.email}</td><td className="px-3 py-2">{row.groupCode}</td><td className="px-3 py-2">{row.valid ? <span className="font-medium text-emerald-700">Ready</span> : <span className="text-red-700">{row.errors.join('; ')}</span>}</td></tr>)}</tbody></table></div>{preview.rows.length > 500 ? <p className="text-xs text-slate-500">Showing first 500 rows. All {preview.total} rows were validated.</p> : null}</> : null}
    </div>
    <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4"><button onClick={onClose} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium">Cancel</button><button disabled={!preview || preview.errorCount > 0 || working} onClick={commit} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{working ? 'Importing…' : `Import ${preview?.validCount || 0} students`}</button></div>
  </div></div>;
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [filters, setFilters] = useState({ search: '', status: '', groupId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [notice, setNotice] = useState('');

  async function load(page = pagination.page) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit: pagination.limit });
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      const data = await api(`/students?${params}`);
      setStudents(data.students);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { api('/groups').then((data) => setGroups(data.groups)).catch((requestError) => setError(requestError.message)); }, []);
  useEffect(() => {
    const timeout = setTimeout(() => load(1), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.status, filters.groupId]);

  const range = useMemo(() => {
    if (!pagination.total) return '0 students';
    const start = (pagination.page - 1) * pagination.limit + 1;
    return `${start}–${Math.min(start + students.length - 1, pagination.total)} of ${pagination.total}`;
  }, [pagination, students.length]);
  const activeMenuStudent = useMemo(() => students.find((student) => student._id === openMenu?.studentId), [openMenu, students]);

  function openStudentMenu(student, event) {
    if (openMenu?.studentId === student._id) {
      setOpenMenu(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 192;
    const menuHeight = 176;
    setOpenMenu({
      studentId: student._id,
      left: Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth)),
      top: Math.max(8, Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 6)),
    });
  }

  function edit(student) {
    setEditing({ ...student, groupIds: student.groupIds?.map((group) => group._id) || [] });
    setFormOpen(true);
    setOpenMenu(null);
  }

  async function toggleActive(student) {
    const active = student.isActive && student.registrationStatus !== 'inactive';
    if (active && !window.confirm(`Deactivate ${student.name}? Their QR will stop working.`)) return;
    try {
      await api(active ? `/students/${student._id}` : `/students/${student._id}/reactivate`, { method: active ? 'DELETE' : 'POST' });
      setOpenMenu(null);
      load();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function download(path, fileName) {
    setOpenMenu(null);
    setError('');
    try {
      await downloadApiFile(path, fileName);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function exportPath(path) {
    const params = new URLSearchParams();
    if (filters.groupId) params.set('groupId', filters.groupId);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold">Students</h1><p className="mt-1 text-xs text-slate-500">Manage student records, groups and QR registration status.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => { setBulkOpen(true); setOpenMenu(null); }} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Upload size={15}/>Bulk import students</button><button onClick={() => download(exportPath('/students/export.xlsx'), 'geu-induction-students.xlsx')} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileSpreadsheet size={15}/>{filters.groupId ? 'Export selected group data' : 'Export all student data'}</button><button onClick={() => download(exportPath('/students/qr-package.zip'), 'geu-induction-qr-package.zip')} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><QrCode size={15}/>{filters.groupId ? 'Bulk download group QR' : 'Bulk download all QR'}</button><button onClick={() => { setEditing(null); setFormOpen(true); setOpenMenu(null); }} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16}/>Add student</button></div></div>
    {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
    {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_180px_200px]"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm" placeholder="Search name, student ID or email"/></label><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="h-9 rounded-md border border-slate-300 px-3 text-sm"><option value="">All statuses</option><option value="not_registered">Not registered</option><option value="registered">Registered</option><option value="inactive">Inactive</option></select><select value={filters.groupId} onChange={(e) => setFilters({ ...filters, groupId: e.target.value })} className="h-9 rounded-md border border-slate-300 px-3 text-sm"><option value="">All groups</option>{groups.map((group) => <option key={group._id} value={group._id}>{group.code} — {group.name}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Student ID</th><th className="px-4 py-3 font-semibold">Group</th><th className="px-4 py-3 font-semibold">Coordinator</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Last scan</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-500">Loading students…</td></tr> : students.length ? students.map((student) => <tr key={student._id} className="text-sm hover:bg-slate-50/70"><td className="px-4 py-3"><div className="font-semibold text-slate-900">{student.name}</div><div className="mt-0.5 text-xs text-slate-500">{student.email}</div></td><td className="px-4 py-3 text-slate-600">{student.studentId}</td><td className="px-4 py-3 text-slate-600">{student.groupIds?.map((group) => group.code).join(', ') || '—'}</td><td className="px-4 py-3"><div className="text-slate-700">{student.groupCoordinatorId?.name || 'Not assigned'}</div><div className="text-xs text-slate-500">{student.groupCoordinatorId?.mobile || ''}</div></td><td className="px-4 py-3"><StatusBadge student={student}/></td><td className="px-4 py-3 text-xs text-slate-600">{student.lastScannedAt ? new Date(student.lastScannedAt).toLocaleString() : 'Never'}</td><td className="px-4 py-3 text-right"><button onClick={(event) => openStudentMenu(student, event)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={`Actions for ${student.name}`} aria-expanded={openMenu?.studentId === student._id}><MoreVertical size={16}/></button></td></tr>) : <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-500">No students found.</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500"><span>{range}</span><div className="flex gap-2"><button disabled={pagination.page <= 1 || loading} onClick={() => load(pagination.page - 1)} className="h-8 rounded-md border border-slate-300 px-3 font-medium text-slate-700 disabled:opacity-40">Previous</button><button disabled={pagination.page >= pagination.pages || loading} onClick={() => load(pagination.page + 1)} className="h-8 rounded-md border border-slate-300 px-3 font-medium text-slate-700 disabled:opacity-40">Next</button></div></div>
    </div>
    {openMenu && activeMenuStudent ? <><button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close student actions" onClick={() => setOpenMenu(null)}/><div className="fixed z-50 w-48 rounded-md border border-slate-200 bg-white p-1 text-left text-sm shadow-lg" style={{ left: openMenu.left, top: openMenu.top }}><button onClick={() => { setViewing(activeMenuStudent); setOpenMenu(null); }} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"><Eye size={14}/>View details</button><button onClick={() => edit(activeMenuStudent)} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50"><Pencil size={14}/>Edit student</button><button onClick={() => download(`/students/${activeMenuStudent._id}/qr.png`, `${activeMenuStudent.studentId}-${activeMenuStudent.name}-qr.png`)} disabled={!activeMenuStudent.isActive || activeMenuStudent.registrationStatus === 'inactive'} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"><QrCode size={14}/>Download QR</button><button onClick={() => toggleActive(activeMenuStudent)} className="flex w-full items-center gap-2 rounded px-3 py-2 hover:bg-slate-50">{activeMenuStudent.isActive && activeMenuStudent.registrationStatus !== 'inactive' ? <><UserRoundX size={14}/>Deactivate</> : <><UserRoundCheck size={14}/>Reactivate</>}</button></div></> : null}
    {formOpen ? <StudentForm groups={groups} initialValue={editing} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(1); }}/> : null}
    {bulkOpen ? <BulkImportModal onClose={() => setBulkOpen(false)} onImported={(count) => { setBulkOpen(false); setNotice(`${count} students imported successfully.`); load(1); }}/> : null}
    {viewing ? <StudentDetails student={viewing} onClose={() => setViewing(null)}/> : null}
  </div>;
}
