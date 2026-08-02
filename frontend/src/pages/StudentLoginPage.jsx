import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Phone, QrCode } from 'lucide-react';
import { api } from '../lib/api';

const savedStudentKey = 'geu_student_login';

export default function StudentLoginPage() {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [student, setStudent] = useState(null);
  const [testOtp, setTestOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(savedStudentKey);
    if (!saved) return;
    try {
      setStudent(JSON.parse(saved));
      setStep('qr');
    } catch {
      localStorage.removeItem(savedStudentKey);
    }
  }, []);

  async function requestOtp(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setTestOtp('');
    try {
      const data = await api('/student-auth/request-otp', { method: 'POST', body: JSON.stringify({ phone }) });
      setTestOtp(data.otp || '');
      setStep('otp');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await api('/student-auth/verify-otp', { method: 'POST', body: JSON.stringify({ phone, otp }) });
      setStudent(data.student);
      localStorage.setItem(savedStudentKey, JSON.stringify(data.student));
      setStep('qr');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  function signOut() {
    localStorage.removeItem(savedStudentKey);
    setStudent(null);
    setOtp('');
    setTestOtp('');
    setStep('phone');
  }

  if (step === 'qr' && student) {
    return <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-bold text-blue-700">GEU Induction Connect</div><h1 className="mt-5 text-xl font-semibold">Welcome, {student.name}</h1><p className="mt-1 text-xs text-slate-500">{student.email}</p></div>
          <button onClick={signOut} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><QrCode size={17}/>Your QR</div>
          {student.qrLink ? <><div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white"><img src={student.qrLink} alt={`${student.name} QR`} className="mx-auto max-h-[420px] w-full object-contain p-3"/></div><a href={student.qrLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><ExternalLink size={16}/>Open QR link</a></> : <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Your QR link has not been uploaded yet. Please contact the induction admin desk.</div>}
        </div>
      </section>
    </main>;
  }

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
    <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-sm font-bold text-blue-700">GEU Induction Connect</div>
      <h1 className="mt-5 text-xl font-semibold">Student login</h1>
      <p className="mt-1 text-xs text-slate-500">Use your registered phone number to view your QR.</p>
      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
      {step === 'phone' ? <form onSubmit={requestOtp} className="mt-5 space-y-4">
        <label className="block"><span className="text-xs font-medium text-slate-700">Phone number</span><div className="relative mt-1.5"><Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input required value={phone} onChange={(event) => setPhone(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm focus:border-blue-500" placeholder="+91 9999999999"/></div></label>
        <button disabled={submitting} className="h-10 w-full rounded-md bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{submitting ? 'Sending OTP…' : 'Get OTP'}</button>
      </form> : <form onSubmit={verifyOtp} className="mt-5 space-y-4">
        {testOtp ? <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">Testing OTP: <span className="font-semibold">{testOtp}</span></div> : null}
        <label className="block"><span className="text-xs font-medium text-slate-700">OTP</span><div className="relative mt-1.5"><KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input required inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm focus:border-blue-500" placeholder="6 digit OTP"/></div></label>
        <button disabled={submitting || otp.length !== 6} className="h-10 w-full rounded-md bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{submitting ? 'Verifying…' : 'View my QR'}</button>
        <button type="button" onClick={() => setStep('phone')} className="h-9 w-full rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Change phone number</button>
      </form>}
      <a href="/link/new/every/admin" className="mt-5 block text-center text-xs font-medium text-slate-500 hover:text-blue-700">Admin and coordinator login</a>
    </section>
  </main>;
}
