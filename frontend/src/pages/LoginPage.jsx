import { useState } from 'react';
import { LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(form);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><section className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="text-sm font-bold text-blue-700">GEU Induction Connect</div><h1 className="mt-5 text-xl font-semibold">Sign in</h1><p className="mt-1 text-xs text-slate-500">Induction Programme 2026</p>{error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}<form onSubmit={handleSubmit} className="mt-5 space-y-4"><label className="block"><span className="text-xs font-medium text-slate-700">Email</span><div className="relative mt-1.5"><Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm focus:border-blue-500" placeholder="admin@example.com"/></div></label><label className="block"><span className="text-xs font-medium text-slate-700">Password</span><div className="relative mt-1.5"><LockKeyhole className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm focus:border-blue-500"/></div></label><button disabled={submitting} className="h-10 w-full rounded-md bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{submitting ? 'Signing in…' : 'Sign in'}</button></form></section></main>;
}
