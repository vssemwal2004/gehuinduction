import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LogOut, Mail, RefreshCw, Upload, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import jsQR from 'jsqr';

export default function ScannerPage() {
  const { user, logout } = useAuth();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submitPayload(payload) {
    if (busyRef.current) return;
    busyRef.current = true;
    setError('');
    try {
      setResult(await api('/scans', { method: 'POST', body: JSON.stringify({ payload }) }));
      stopCamera();
    } catch (requestError) {
      setError(requestError.message);
      setTimeout(() => { busyRef.current = false; }, 1500);
    }
  }

  async function startCamera() {
    setError('');
    if (!('BarcodeDetector' in window)) return setError('Live QR detection is not supported by this browser. Use “Scan from image” below.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraOn(true);
    } catch {
      setError('Camera permission was denied or no camera is available.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => {
    if (!cameraOn || !('BarcodeDetector' in window)) return undefined;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const timer = setInterval(async () => {
      if (!videoRef.current || busyRef.current || videoRef.current.readyState < 2) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes[0]?.rawValue) submitPayload(codes[0].rawValue);
      } catch { /* wait for next frame */ }
    }, 350);
    return () => clearInterval(timer);
  }, [cameraOn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopCamera(), []);

  async function scanImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      let rawValue;
      if ('BarcodeDetector' in window) {
        const codes = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(bitmap);
        rawValue = codes[0]?.rawValue;
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        rawValue = jsQR(image.data, image.width, image.height)?.data;
      }
      bitmap.close();
      if (!rawValue) throw new Error('No QR code found in this image');
      await submitPayload(rawValue);
    } catch (scanError) {
      setError(scanError.message || 'Could not read this QR image');
      busyRef.current = false;
    }
    event.target.value = '';
  }

  function reset() {
    setResult(null);
    setError('');
    busyRef.current = false;
    startCamera();
  }

  async function sendAgain() {
    setSending(true); setError('');
    try {
      await api(`/scans/${result.student.id}/send-again`, { method: 'POST' });
      setResult({ ...result, mailQueued: true, resent: true });
    } catch (requestError) { setError(requestError.message); } finally { setSending(false); }
  }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white px-4 py-3"><div className="mx-auto flex max-w-lg items-center justify-between"><div><div className="text-sm font-bold text-blue-700">GEU Induction Connect</div><div className="text-[11px] text-slate-500">QR Scanner · Programme 2026</div></div><button onClick={logout} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium"><LogOut size={14}/>Sign out</button></div></header>
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div><h1 className="text-lg font-semibold">Scan student QR</h1><p className="mt-1 text-xs text-slate-500">Signed in as {user.name}. Only official encrypted QR codes are accepted.</p></div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {!result ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="relative aspect-[3/4] max-h-[62vh] bg-slate-950"><video ref={videoRef} playsInline muted className="h-full w-full object-cover"/>{!cameraOn ? <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"><Camera size={38}/><button onClick={startCamera} className="rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold">Open rear camera</button></div> : <><div className="absolute inset-[16%] rounded-2xl border-2 border-white/90"/><div className="absolute bottom-5 left-0 right-0 text-center text-xs font-medium text-white">Place the QR inside the frame</div></>}</div>
        <div className="flex gap-2 p-3"><button onClick={cameraOn ? stopCamera : startCamera} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-medium">{cameraOn ? <X size={15}/> : <Camera size={15}/>} {cameraOn ? 'Stop camera' : 'Start camera'}</button><label className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-medium"><Upload size={15}/>Scan from image<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={scanImage}/></label></div>
      </section> : <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-200 p-4"><div className="rounded-full bg-emerald-50 p-2 text-emerald-700"><CheckCircle2 size={22}/></div><div><h2 className="text-base font-semibold">{result.firstScan ? 'Registration completed' : 'Student already registered'}</h2><p className="mt-1 text-xs text-slate-500">{result.firstScan ? 'Student details email has been queued automatically.' : 'No duplicate email was sent automatically.'}</p></div></div>
        <dl className="divide-y divide-slate-100 px-4">{[['Student', result.student.name], ['Student ID', result.student.studentId], ['Email', result.student.email], ['Group', result.student.group ? `${result.student.group.code} — ${result.student.group.name}` : 'Not assigned'], ['Group coordinator', result.student.coordinator?.name || 'Not assigned'], ['Contact', result.student.coordinator?.mobile || 'Not available'], ['Total scans', result.student.scanCount]].map(([label, value]) => <div key={label} className="grid grid-cols-[125px_1fr] gap-3 py-3 text-sm"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="break-words font-medium text-slate-800">{value}</dd></div>)}</dl>
        <div className="space-y-2 border-t border-slate-200 p-4">{!result.firstScan && !result.resent ? <button disabled={sending} onClick={sendAgain} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"><Mail size={16}/>{sending ? 'Queueing…' : 'Send details email again'}</button> : null}{result.resent ? <div className="rounded-md bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700">Email queued successfully</div> : null}<button onClick={reset} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-semibold"><RefreshCw size={16}/>Scan next student</button></div>
      </section>}
    </div>
  </main>;
}
