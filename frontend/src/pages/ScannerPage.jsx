import { useEffect, useRef, useState } from 'react';
import {
  Camera, CheckCircle2, ImageUp, LoaderCircle, LogOut, Mail,
  RefreshCw, ScanLine, SwitchCamera, X,
} from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const cameraConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

export default function ScannerPage() {
  const { user, logout } = useAuth();
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const readerRef = useRef(new BrowserQRCodeReader(undefined, {
    delayBetweenScanAttempts: 120,
    delayBetweenScanSuccess: 750,
  }));
  const busyRef = useRef(false);
  const [cameraState, setCameraState] = useState('off');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [readingImage, setReadingImage] = useState(false);

  const cameraOn = cameraState === 'on';

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    stream?.getTracks?.().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('off');
  }

  async function submitPayload(payload) {
    if (busyRef.current) return;
    busyRef.current = true;
    setError('');
    try {
      const response = await api('/scans', { method: 'POST', body: JSON.stringify({ payload }) });
      setResult(response);
      stopCamera();
      navigator.vibrate?.(80);
    } catch (requestError) {
      setError(requestError.message || 'This QR code could not be verified.');
      setTimeout(() => { busyRef.current = false; }, 1200);
    }
  }

  async function startCamera() {
    if (cameraState === 'starting') return;
    setError('');
    setCameraState('starting');
    busyRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('off');
      setError('Camera access is unavailable. Open this page over HTTPS or use “Choose QR image”.');
      return;
    }

    try {
      const controls = await readerRef.current.decodeFromConstraints(
        cameraConstraints,
        videoRef.current,
        (scanResult, scanError, activeControls) => {
          if (!scanResult || busyRef.current) return;
          activeControls.stop();
          submitPayload(scanResult.getText());
        },
      );
      if (busyRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setCameraState('on');
    } catch (cameraError) {
      stopCamera();
      const denied = cameraError?.name === 'NotAllowedError' || cameraError?.name === 'PermissionDeniedError';
      setError(denied
        ? 'Camera permission is blocked. Allow camera access in your browser settings, then try again.'
        : 'Could not open the rear camera. Try “Choose QR image” instead.');
    }
  }

  useEffect(() => () => {
    controlsRef.current?.stop();
    const stream = videoRef.current?.srcObject;
    stream?.getTracks?.().forEach((track) => track.stop());
  }, []);

  async function scanImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    stopCamera();
    setReadingImage(true);
    setError('');
    busyRef.current = false;
    const imageUrl = URL.createObjectURL(file);
    try {
      const scanResult = await readerRef.current.decodeFromImageUrl(imageUrl);
      await submitPayload(scanResult.getText());
    } catch {
      setError('No QR code was found. Use a clear, well-lit image with the full QR visible.');
      busyRef.current = false;
    } finally {
      URL.revokeObjectURL(imageUrl);
      setReadingImage(false);
    }
  }

  function reset() {
    setResult(null);
    setError('');
    busyRef.current = false;
    startCamera();
  }

  async function sendAgain() {
    setSending(true);
    setError('');
    try {
      await api(`/scans/${result.student.id}/send-again`, { method: 'POST' });
      setResult({ ...result, mailQueued: true, resent: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return <main className="min-h-[100dvh] bg-slate-50">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-blue-700">GEU Induction Connect</div>
          <div className="text-xs text-slate-500">QR Scanner · Programme 2026</div>
        </div>
        <button onClick={logout} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.98]">
          <LogOut size={17}/>Sign out
        </button>
      </div>
    </header>

    <div className="safe-bottom mx-auto max-w-lg space-y-4 p-4 sm:pt-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Scan student QR</h1>
        <p className="mt-1 text-sm leading-5 text-slate-600">Signed in as {user.name}. Point the rear camera at an official student QR code.</p>
      </div>

      <div aria-live="polite">
        {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-700">{error}</div> : null}
      </div>

      {!result ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="QR scanner">
        <div className="relative aspect-[4/5] max-h-[66dvh] min-h-[320px] overflow-hidden bg-slate-950 sm:aspect-[4/3]">
          <video ref={videoRef} playsInline muted aria-label="Rear camera preview" className={`h-full w-full object-cover transition-opacity duration-300 ${cameraOn ? 'opacity-100' : 'opacity-40'}`}/>

          {!cameraOn ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white">
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/20"><Camera size={40}/></div>
            <div>
              <p className="font-semibold">{cameraState === 'starting' ? 'Opening camera…' : 'Ready to scan'}</p>
              <p className="mt-1 text-sm text-slate-300">Camera access is used only while scanning.</p>
            </div>
            <button onClick={startCamera} disabled={cameraState === 'starting'} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 text-base font-semibold shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 active:scale-[.98] disabled:opacity-70">
              {cameraState === 'starting' ? <LoaderCircle className="animate-spin" size={20}/> : <Camera size={20}/>}
              {cameraState === 'starting' ? 'Opening…' : 'Open rear camera'}
            </button>
          </div> : <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(transparent_0,transparent_37%,rgba(2,6,23,.62)_38%)]"/>
            <div className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-white shadow-[0_0_0_1px_rgba(37,99,235,.8)]">
              <span className="absolute -left-0.5 -top-0.5 h-10 w-10 rounded-tl-3xl border-l-4 border-t-4 border-blue-400"/>
              <span className="absolute -right-0.5 -top-0.5 h-10 w-10 rounded-tr-3xl border-r-4 border-t-4 border-blue-400"/>
              <span className="absolute -bottom-0.5 -left-0.5 h-10 w-10 rounded-bl-3xl border-b-4 border-l-4 border-blue-400"/>
              <span className="absolute -bottom-0.5 -right-0.5 h-10 w-10 rounded-br-3xl border-b-4 border-r-4 border-blue-400"/>
              <span className="absolute left-3 right-3 top-1/2 h-0.5 animate-pulse bg-blue-400 shadow-[0_0_10px_2px_rgba(96,165,250,.65)]"/>
            </div>
            <div className="absolute bottom-5 left-4 right-4 flex items-center justify-center gap-2 rounded-full bg-slate-950/70 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur-sm">
              <ScanLine size={17}/>Hold steady and fit the QR in the frame
            </div>
          </>}
        </div>

        <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2">
          <button onClick={cameraOn ? stopCamera : startCamera} disabled={cameraState === 'starting'} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[.99] disabled:opacity-60">
            {cameraOn ? <X size={18}/> : <SwitchCamera size={18}/>}
            {cameraOn ? 'Stop camera' : 'Start camera'}
          </button>
          <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[.99] ${readingImage ? 'pointer-events-none opacity-60' : ''}`}>
            {readingImage ? <LoaderCircle className="animate-spin" size={18}/> : <ImageUp size={18}/>}
            {readingImage ? 'Reading image…' : 'Choose QR image'}
            <input type="file" accept="image/*" className="sr-only" onChange={scanImage} disabled={readingImage}/>
          </label>
        </div>
        <p className="px-4 pb-4 text-center text-xs leading-4 text-slate-500">Camera not working? Choose a QR photo or take one with your phone.</p>
      </section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-200 p-4">
          <div className="rounded-full bg-emerald-50 p-2.5 text-emerald-700"><CheckCircle2 size={24}/></div>
          <div>
            <h2 className="text-base font-semibold">{result.firstScan ? 'Registration completed' : 'Student already registered'}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">{result.firstScan ? 'Student details email has been queued automatically.' : 'No duplicate email was sent automatically.'}</p>
          </div>
        </div>
        <dl className="divide-y divide-slate-100 px-4">{[['Student', result.student.name], ['Student ID', result.student.studentId], ['Email', result.student.email], ['Group', result.student.group ? `${result.student.group.code} — ${result.student.group.name}` : 'Not assigned'], ['Group coordinator', result.student.coordinator?.name || 'Not assigned'], ['Contact', result.student.coordinator?.mobile || 'Not available'], ['Total scans', result.student.scanCount]].map(([label, value]) => <div key={label} className="grid grid-cols-[125px_1fr] gap-3 py-3 text-sm"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="break-words font-medium text-slate-800">{value}</dd></div>)}</dl>
        <div className="space-y-2 border-t border-slate-200 p-4">{!result.firstScan && !result.resent ? <button disabled={sending} onClick={sendAgain} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[.99] disabled:opacity-50"><Mail size={17}/>{sending ? 'Queueing…' : 'Send details email again'}</button> : null}{result.resent ? <div className="rounded-lg bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700">Email queued successfully</div> : null}<button onClick={reset} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 text-sm font-semibold transition hover:bg-slate-50 active:scale-[.99]"><RefreshCw size={17}/>Scan next student</button></div>
      </section>}
    </div>
  </main>;
}
