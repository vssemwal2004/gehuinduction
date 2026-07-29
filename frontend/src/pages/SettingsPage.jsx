import { useState } from 'react';
import { CheckCircle2, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function changePassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match');
    setSaving(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Password changed successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-5">
    <div><h1 className="text-xl font-semibold">Settings</h1><p className="mt-1 text-xs text-slate-500">Account security and platform configuration status.</p></div>
    {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
    {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold">Administrator profile</h2><p className="mt-1 text-xs text-slate-500">Current authenticated account.</p></div><dl className="divide-y divide-slate-100 px-5">{[['Name', user.name], ['Email', user.email], ['Role', 'System administrator']].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-3 py-3 text-sm"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{value}</dd></div>)}</dl></section>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold">Platform status</h2><p className="mt-1 text-xs text-slate-500">Sensitive values are never displayed.</p></div><div className="space-y-3 p-5">{[[ShieldCheck, 'Secure authentication', 'HttpOnly cookie and role access enabled'], [Mail, 'Email queue', 'SMTP delivery and automatic retry enabled'], [CheckCircle2, 'QR protection', 'Encrypted opaque QR tokens enabled']].map(([Icon, title, detail]) => <div key={title} className="flex gap-3 rounded-md border border-slate-200 p-3"><Icon size={18} className="mt-0.5 text-emerald-600"/><div><div className="text-sm font-semibold">{title}</div><div className="mt-0.5 text-xs text-slate-500">{detail}</div></div></div>)}</div></section>
    </div>
    <form onSubmit={changePassword} className="max-w-2xl rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4"><KeyRound size={18} className="mt-0.5 text-blue-600"/><div><h2 className="text-sm font-semibold">Change password</h2><p className="mt-1 text-xs text-slate-500">At least 12 characters with uppercase, lowercase, number and symbol.</p></div></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-xs font-medium">Current password</span><input required type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label><label><span className="text-xs font-medium">New password</span><input required type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label><label><span className="text-xs font-medium">Confirm new password</span><input required type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label></div><div className="flex justify-end border-t border-slate-200 px-5 py-4"><button disabled={saving} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Updating…' : 'Update password'}</button></div></form>
  </div>;
}
