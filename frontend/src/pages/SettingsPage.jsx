import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, KeyRound, Mail, RotateCcw, Save, Send, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const defaultTemplate = {
  useDefault: true,
  subject: 'GEU Induction Programme 2026 — {{groupName}}',
  html: '<p>Hello {{studentName}},</p><p>Your induction registration is confirmed.</p><p><strong>Group:</strong> {{groupName}}<br><strong>Coordinator:</strong> {{coordinatorName}}<br><strong>Contact:</strong> {{coordinatorMobile}}</p><p><a href="{{whatsappLink}}">Join your WhatsApp group</a></p>',
  variables: [],
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [template, setTemplate] = useState(defaultTemplate);
  const [preview, setPreview] = useState(null);
  const [testEmail, setTestEmail] = useState(user.email || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const templatePayload = useMemo(() => ({
    useDefault: template.useDefault,
    subject: template.subject,
    html: template.html,
  }), [template]);

  useEffect(() => {
    api('/email-template')
      .then(({ setting }) => {
        setTemplate({ ...defaultTemplate, ...setting });
        return api('/email-template/preview', { method: 'POST', body: JSON.stringify(setting) });
      })
      .then(({ preview: rendered }) => setPreview(rendered))
      .catch((requestError) => setError(requestError.message));
  }, []);

  async function changePassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (form.newPassword !== form.confirmPassword) return setError('New passwords do not match');
    setSavingPassword(true);
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
      setSavingPassword(false);
    }
  }

  async function renderPreview(nextTemplate = templatePayload) {
    setError('');
    const data = await api('/email-template/preview', { method: 'POST', body: JSON.stringify(nextTemplate) });
    setPreview(data.preview);
  }

  async function saveTemplate(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSavingTemplate(true);
    try {
      const data = await api('/email-template', { method: 'PUT', body: JSON.stringify(templatePayload) });
      setTemplate({ ...defaultTemplate, ...data.setting });
      await renderPreview(data.setting);
      setMessage('Email template saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function sendTestMail() {
    setError('');
    setMessage('');
    setSendingTest(true);
    try {
      await api('/email-template/test', { method: 'POST', body: JSON.stringify({ ...templatePayload, to: testEmail }) });
      setMessage('Test email sent.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSendingTest(false);
    }
  }

  function insertVariable(variable) {
    const token = `{{${variable}}}`;
    setTemplate((current) => ({ ...current, html: `${current.html || ''}${token}` }));
  }

  return <div className="space-y-5">
    <div><h1 className="text-xl font-semibold">Settings</h1><p className="mt-1 text-xs text-slate-500">Account security and email delivery configuration.</p></div>
    {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
    {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold">Administrator profile</h2><p className="mt-1 text-xs text-slate-500">Current authenticated account.</p></div><dl className="divide-y divide-slate-100 px-5">{[['Name', user.name], ['Email', user.email], ['Role', 'System administrator']].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-3 py-3 text-sm"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="font-medium text-slate-800">{value}</dd></div>)}</dl></section>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold">Platform status</h2><p className="mt-1 text-xs text-slate-500">Sensitive values are never displayed.</p></div><div className="space-y-3 p-5">{[[ShieldCheck, 'Secure authentication', 'HttpOnly cookie and role access enabled'], [Mail, 'Email queue', 'SMTP delivery and automatic retry enabled'], [CheckCircle2, 'QR protection', 'Encrypted opaque QR tokens enabled']].map(([Icon, title, detail]) => <div key={title} className="flex gap-3 rounded-md border border-slate-200 p-3"><Icon size={18} className="mt-0.5 text-emerald-600"/><div><div className="text-sm font-semibold">{title}</div><div className="mt-0.5 text-xs text-slate-500">{detail}</div></div></div>)}</div></section>
    </div>

    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <form onSubmit={saveTemplate}>
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3"><Mail size={18} className="mt-0.5 text-blue-600"/><div><h2 className="text-sm font-semibold">Scan email template</h2><p className="mt-1 text-xs text-slate-500">Sent after a student's first QR scan.</p></div></div>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
            <span>Default template</span>
            <button type="button" onClick={() => setTemplate((current) => ({ ...current, useDefault: !current.useDefault }))} className={`relative h-6 w-11 rounded-full transition ${template.useDefault ? 'bg-blue-600' : 'bg-slate-300'}`} aria-pressed={template.useDefault} aria-label="Toggle default email template">
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${template.useDefault ? 'left-6' : 'left-1'}`}/>
            </button>
          </label>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
          <div className="space-y-4">
            <label className="block"><span className="text-xs font-medium text-slate-700">Subject</span><input disabled={template.useDefault} value={template.subject} onChange={(e) => setTemplate({ ...template, subject: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"/></label>
            <label className="block"><span className="text-xs font-medium text-slate-700">HTML template</span><textarea disabled={template.useDefault} value={template.html} onChange={(e) => setTemplate({ ...template, html: e.target.value })} rows={13} className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-3 py-2 font-mono text-xs leading-5 disabled:bg-slate-50 disabled:text-slate-500"/></label>
            <div className="flex flex-wrap gap-2">{template.variables.map((variable) => <button disabled={template.useDefault} type="button" key={variable} onClick={() => insertVariable(variable)} className="h-8 rounded-md border border-slate-300 px-2.5 font-mono text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">{`{{${variable}}}`}</button>)}</div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm" placeholder="test@example.com"/><button type="button" onClick={sendTestMail} disabled={sendingTest || !testEmail} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Send size={15}/>{sendingTest ? 'Sending…' : 'Send test'}</button></div>
          </div>

          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-xs font-semibold text-slate-700">{preview?.subject || 'Preview'}</div></div><button type="button" onClick={() => renderPreview()} className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Eye size={14}/>Preview</button></div>
            <iframe title="Email preview" srcDoc={preview?.html || ''} className="h-[390px] w-full rounded-md border border-slate-200 bg-white"/>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={() => setTemplate((current) => ({ ...defaultTemplate, variables: current.variables }))} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw size={15}/>Reset draft</button>
          <button disabled={savingTemplate} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><Save size={15}/>{savingTemplate ? 'Saving…' : 'Save template'}</button>
        </div>
      </form>
    </section>

    <form onSubmit={changePassword} className="max-w-2xl rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4"><KeyRound size={18} className="mt-0.5 text-blue-600"/><div><h2 className="text-sm font-semibold">Change password</h2><p className="mt-1 text-xs text-slate-500">At least 12 characters with uppercase, lowercase, number and symbol.</p></div></div><div className="grid gap-4 p-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-xs font-medium">Current password</span><input required type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label><label><span className="text-xs font-medium">New password</span><input required type="password" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label><label><span className="text-xs font-medium">Confirm new password</span><input required type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="mt-1.5 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"/></label></div><div className="flex justify-end border-t border-slate-200 px-5 py-4"><button disabled={savingPassword} className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{savingPassword ? 'Updating…' : 'Update password'}</button></div></form>
  </div>;
}
