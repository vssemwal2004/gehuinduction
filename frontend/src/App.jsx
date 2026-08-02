import { useEffect, useState } from 'react';
import { Activity, Database, LayoutDashboard, LogOut, QrCode, Settings, UserRound, Users } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { api } from './lib/api';
import LoginPage from './pages/LoginPage';
import StudentLoginPage from './pages/StudentLoginPage';
import GroupsPage from './pages/GroupsPage';
import StudentsPage from './pages/StudentsPage';
import StudentQrDataPage from './pages/StudentQrDataPage';
import CoordinatorsPage from './pages/CoordinatorsPage';
import ScannerPage from './pages/ScannerPage';
import OperationsPage from './pages/OperationsPage';
import SettingsPage from './pages/SettingsPage';

const fullAccessNavItems = [
  ['Dashboard', LayoutDashboard],
  ['Students', Users],
  ['Student QR Data', Database],
  ['Coordinators', UserRound],
  ['Groups & WhatsApp', QrCode],
  ['Activity Logs', Activity],
  ['Settings', Settings],
];

const limitedNavItems = fullAccessNavItems.filter(([label]) => ['Dashboard', 'Students'].includes(label));
const SUPER_ADMIN_EMAIL = 'akhilnegi.cc@geu.ac.in';

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Loading…</div>;
}

function Stat({ label, value, tone = 'default' }) {
  const color = tone === 'green' ? 'text-emerald-600' : tone === 'amber' ? 'text-amber-600' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div></div>;
}

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activePage, setActivePage] = useState('Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const hasFullAccess = user.isSuperAdmin === true || user.email?.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
  const navItems = hasFullAccess ? fullAccessNavItems : limitedNavItems;

  useEffect(() => {
    api('/dashboard/admin').then(setDashboard).catch((requestError) => setError(requestError.message));
  }, []);

  const counts = dashboard?.counts || {};
  return <div className="min-h-screen min-w-0">
    <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-slate-200 bg-white lg:block">
      <div className="border-b border-slate-200 px-5 py-5"><div className="text-sm font-bold text-blue-700">GEU Induction Connect</div><div className="mt-1 text-xs text-slate-500">Programme 2026</div></div>
      <nav className="space-y-1 p-3" aria-label="Admin navigation">{navItems.map(([label, Icon]) => <button key={label} onClick={() => setActivePage(label)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium ${activePage === label ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={17}/>{label}</button>)}</nav>
      <div className="absolute inset-x-3 bottom-3 border-t border-slate-200 pt-3"><button onClick={logout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><LogOut size={17}/>Sign out</button></div>
    </aside>
    <main className="min-w-0 lg:pl-60">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 sm:py-4 lg:px-8"><div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0 flex-1 lg:hidden"><div className="truncate text-sm font-bold text-blue-700">GEU Induction Connect</div><select value={activePage} onChange={(e) => setActivePage(e.target.value)} className="mt-1 h-9 w-full max-w-[220px] rounded-md border border-slate-300 px-2 text-xs">{navItems.map(([label]) => <option key={label}>{label}</option>)}</select></div><div className="hidden lg:block"><div className="text-sm font-semibold text-slate-900">{activePage}</div><p className="mt-1 text-xs text-slate-500">GEU Induction Programme 2026</p></div><div className="min-w-0 max-w-[42%] text-right sm:max-w-xs"><div className="truncate text-sm font-semibold">{user.name}</div><div className="hidden truncate text-xs text-slate-500 sm:block">{user.email}</div></div></div></header>
      {activePage === 'Groups & WhatsApp' ? <div className="p-4 sm:p-6 xl:p-8"><GroupsPage/></div> : activePage === 'Students' ? <div className="p-4 sm:p-6 xl:p-8"><StudentsPage/></div> : activePage === 'Student QR Data' ? <div className="p-4 sm:p-6 xl:p-8"><StudentQrDataPage/></div> : activePage === 'Coordinators' ? <div className="p-4 sm:p-6 xl:p-8"><CoordinatorsPage/></div> : activePage === 'Activity Logs' ? <div className="p-4 sm:p-6 xl:p-8"><OperationsPage/></div> : activePage === 'Settings' ? <div className="p-4 sm:p-6 xl:p-8"><SettingsPage/></div> : <div className="space-y-5 p-4 sm:p-6 xl:p-8">
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Total students" value={counts.totalStudents ?? '—'}/>
          <Stat label="Registered students" value={counts.registeredStudents ?? '—'} tone="green"/>
          <Stat label="Pending registration" value={counts.pendingStudents ?? '—'} tone="amber"/>
          <Stat label="Total groups" value={counts.totalGroups ?? '—'}/>
          <Stat label="Group coordinators" value={counts.groupCoordinators ?? '—'}/>
          <Stat label="Scan coordinators" value={counts.scanCoordinators ?? '—'}/>
          <Stat label="Scans today" value={counts.scansToday ?? '—'}/>
          <Stat label="Failed emails" value={counts.failedEmails ?? '—'} tone="red"/>
        </section>
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Registration overview</h2><span className="text-sm font-semibold text-blue-700">{dashboard?.registrationPercent ?? 0}%</span></div><p className="mt-2 text-xs text-slate-500">Current QR registration completion.</p><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${dashboard?.registrationPercent ?? 0}%` }}/></div></div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold">Email delivery</h2><div className="mt-4 grid grid-cols-3 gap-3"><div><div className="text-xs text-slate-500">Sent</div><div className="mt-1 text-lg font-semibold text-emerald-600">{counts.sentEmails ?? '—'}</div></div><div><div className="text-xs text-slate-500">Failed</div><div className="mt-1 text-lg font-semibold text-red-600">{counts.failedEmails ?? '—'}</div></div><div><div className="text-xs text-slate-500">Scans today</div><div className="mt-1 text-lg font-semibold">{counts.scansToday ?? '—'}</div></div></div></div>
        </section>
      </div>}
    </main>
  </div>;
}

export default function App() {
  const { user, loading } = useAuth();
  const isStaffRoute = window.location.pathname.replace(/\/+$/, '') === '/link/new/every/admin';
  if (loading) return <LoadingScreen />;
  if (!isStaffRoute) return <StudentLoginPage />;
  if (!user) return <LoginPage />;
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'scan_coordinator') return <ScannerPage />;
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-sm text-slate-600">Your coordinator workspace will be enabled in the coordinator phase.</main>;
}
