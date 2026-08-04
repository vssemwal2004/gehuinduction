import { useEffect, useState } from 'react';
import { Activity, Mail, RefreshCw, Search } from 'lucide-react';
import { api } from '../lib/api';

function Badge({ value }) {
  const tone = value === 'sent' || (typeof value === 'number' && value < 400) ? 'bg-emerald-50 text-emerald-700' : value === 'failed' || (typeof value === 'number' && value >= 400) ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{value}</span>;
}

export default function OperationsPage({ initialTab = 'activity', initialStatus = '' }) {
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState({ logs: [], jobs: [], counts: {}, pagination: {} });
  const [filters, setFilters] = useState({ search: '', role: '', action: '', status: initialStatus, type: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(page = 1) {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (tab === 'activity') {
        ['search', 'role', 'action'].forEach((key) => filters[key] && params.set(key, filters[key]));
      } else {
        ['status', 'type'].forEach((key) => filters[key] && params.set(key, filters[key]));
      }
      setData(await api(`/operations/${tab === 'activity' ? 'activity' : 'mail-jobs'}?${params}`));
    } catch (requestError) { setError(requestError.message); } finally { setLoading(false); }
  }
  useEffect(() => { const timer = setTimeout(() => load(1), 200); return () => clearTimeout(timer); }, [tab, filters.search, filters.role, filters.action, filters.status, filters.type]); // eslint-disable-line react-hooks/exhaustive-deps

  async function retry(job) {
    try {
      await api(`/operations/mail-jobs/${job._id}/retry`, { method: 'POST' });
      load(data.pagination.page);
    } catch (requestError) { setError(requestError.message); }
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold">Activity & delivery</h1><p className="mt-1 text-xs text-slate-500">Audit administrator and scanner actions, and monitor queued emails.</p></div><button onClick={() => load(data.pagination.page)} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium"><RefreshCw size={15}/>Refresh</button></div>
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1"><button onClick={() => setTab('activity')} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${tab === 'activity' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}><Activity size={15}/>Activity logs</button><button onClick={() => setTab('mail')} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${tab === 'mail' ? 'bg-blue-50 text-blue-700' : 'text-slate-600'}`}><Mail size={15}/>Mail delivery</button></div>
    {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    {tab === 'mail' ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{['queued', 'processing', 'sent', 'failed'].map((status) => <div key={status} className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs capitalize text-slate-500">{status}</div><div className="mt-1 text-xl font-semibold">{data.counts?.[status] || 0}</div></div>)}</div> : null}
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {tab === 'activity' ? <><div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_200px_150px]"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="h-9 w-full rounded-md border pl-9 pr-3 text-sm" placeholder="Search actor or resource"/></label><select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} className="h-9 rounded-md border px-3 text-sm"><option value="">All roles</option><option value="admin">Admin</option><option value="scan_coordinator">Scan coordinator</option></select><select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="h-9 rounded-md border px-3 text-sm"><option value="">All actions</option>{['POST', 'PUT', 'PATCH', 'DELETE'].map((item) => <option key={item}>{item}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Resource</th><th className="px-4 py-3">Result</th></tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan="5" className="p-10 text-center text-sm">Loading…</td></tr> : data.logs?.length ? data.logs.map((log) => <tr key={log._id} className="text-sm"><td className="px-4 py-3 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</td><td className="px-4 py-3"><div className="font-medium">{log.actorName}</div><div className="text-xs text-slate-500">{log.actorRole?.replace('_', ' ')}</div></td><td className="px-4 py-3 font-mono text-xs">{log.action}</td><td className="px-4 py-3 font-mono text-xs text-slate-600">{log.resource}</td><td className="px-4 py-3"><Badge value={log.statusCode}/></td></tr>) : <tr><td colSpan="5" className="p-10 text-center text-sm text-slate-500">No activity found.</td></tr>}</tbody></table></div></> :
      <><div className="grid gap-3 border-b p-4 sm:grid-cols-2"><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="h-9 rounded-md border px-3 text-sm"><option value="">All statuses</option>{['queued', 'processing', 'sent', 'failed'].map((item) => <option key={item}>{item}</option>)}</select><select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className="h-9 rounded-md border px-3 text-sm"><option value="">All mail types</option><option value="scan_details">Student scan details</option><option value="coordinator_credentials">Coordinator credentials</option></select></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3">Created</th><th className="px-4 py-3">Recipient</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Last error</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y">{loading ? <tr><td colSpan="7" className="p-10 text-center text-sm">Loading…</td></tr> : data.jobs?.length ? data.jobs.map((job) => <tr key={job._id} className="text-sm"><td className="px-4 py-3 text-xs text-slate-500">{new Date(job.createdAt).toLocaleString()}</td><td className="px-4 py-3">{job.to}</td><td className="px-4 py-3 text-xs">{job.type === 'scan_details' ? 'Student details' : 'Credentials'}</td><td className="px-4 py-3"><Badge value={job.status}/></td><td className="px-4 py-3">{job.attempts}</td><td className="max-w-xs truncate px-4 py-3 text-xs text-red-600" title={job.lastError}>{job.lastError || '—'}</td><td className="px-4 py-3">{job.status === 'failed' ? <button onClick={() => retry(job)} className="rounded-md border px-3 py-1.5 text-xs font-semibold">Retry</button> : null}</td></tr>) : <tr><td colSpan="7" className="p-10 text-center text-sm text-slate-500">No mail jobs found.</td></tr>}</tbody></table></div></>}
      <div className="flex items-center justify-between border-t p-3 text-xs text-slate-500"><span>{data.pagination?.total || 0} records</span><div className="flex gap-2"><button disabled={(data.pagination?.page || 1) <= 1} onClick={() => load(data.pagination.page - 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Previous</button><button disabled={(data.pagination?.page || 1) >= (data.pagination?.pages || 1)} onClick={() => load(data.pagination.page + 1)} className="rounded border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
    </div>
  </div>;
}
