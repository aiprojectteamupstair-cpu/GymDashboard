import { useEffect, useState } from 'react';
import { Activity, CalendarCheck2, LayoutDashboard, LogOut, Moon, RefreshCw, Settings2, ShieldCheck, Sun, Users } from 'lucide-react';
import { supabase } from './client.js';
import { loadLiveData } from './readData.js';
import { CataloguePage, CheckInPage, Dashboard, MemberDirectory, MemberProfile } from '../prototype/pages.jsx';
import { createWorkspaceSync } from './workspaceSync.js';
import AdminAccounts from './AdminAccounts.jsx';
import { Analytics } from '../prototype/Analytics.jsx';
import { SummaryDialog } from '../prototype/SummaryDialog.jsx';
import { Button, Field } from '../prototype/components.jsx';
import { downloadPrototypeWorkbook } from '../prototype/export.js';
import { localDate } from '../prototype/domain.js';
import '../prototype/prototype.css';
import './live.css';

export default function LiveApp() {
  const [session, setSession] = useState(null);
  const [workspace, setWorkspace] = useState({ snapshot: null, busy: true, error: '' });
  const [sync] = useState(() => createWorkspaceSync(owner => loadLiveData(supabase, owner), setWorkspace));
  const { snapshot, busy } = workspace;
  const [error, setError] = useState('');
  const [page, setPage] = useState('dashboard');
  const [memberId, setMemberId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [today, setToday] = useState(localDate);
  const [theme, setTheme] = useState(() => localStorage.getItem('community-fitness:theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('community-fitness:theme', theme); }, [theme]);

  const refresh = () => { setError(''); return sync.refresh({ force: true }); };
  useEffect(() => {
    let alive = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setSession(next);
      if (sync.identity(next?.user.id || null)) {
        setSummary(null); setMemberId(null); setPage('dashboard'); setError('');
      }
      // Keep Supabase requests outside its synchronous auth callback.
      setTimeout(() => { if (alive) void sync.refresh(); }, 0);
    });
    return () => { alive = false; sync.invalidate(); subscription.unsubscribe(); };
  }, [sync]);
  useEffect(() => {
    if (!session) return;
    const recheck = () => { if (document.visibilityState === 'hidden') return; setToday(localDate()); void sync.refresh(); };
    const timer = setInterval(recheck, 60000);
    window.addEventListener('focus', recheck);
    return () => { clearInterval(timer); window.removeEventListener('focus', recheck); };
  }, [session, sync]);
  async function logout() {
    sync.identity(null); setSession(null); setSummary(null); setMemberId(null);
    const { error: problem } = await supabase.auth.signOut({ scope: 'local' });
    if (problem) setError(problem.message);
  }
  if (!session) return <RemoteLogin initialError={error} />;
  if (!snapshot) return <main className="login-shell"><section className="login-card"><h1>{busy ? 'Loading your workspace…' : 'Workspace unavailable'}</h1>{workspace.error && <p role="alert" className="form-error">{workspace.error}</p>}<Button disabled={busy} onClick={refresh}>Retry</Button><Button onClick={logout}>Sign out</Button></section></main>;

  const { data, staff } = snapshot;
  const member = data.members.find(m => m.id === memberId);
  const blocked = () => setError('Live data is read-only. Create, edit and check-in will be enabled after the trusted write APIs are ready.');
  const navigate = next => { setPage(next); setMemberId(null); setError(''); window.scrollTo(0, 0); };
  const profile = id => { setPage('members'); setMemberId(id); setSummary(null); window.scrollTo(0, 0); };
  const common = { data, today, onProfile: profile, onRenew: blocked, onCheckIn: blocked, onEditAttendance: blocked };
  async function exportData(scope) {
    const owner = sync.current().owner;
    try {
      const current = await loadLiveData(supabase, owner);
      if (owner !== sync.current().owner) return;
      downloadPrototypeWorkbook(current.data, scope);
    } catch (err) { setError(`Export failed: ${err.message}`); void sync.refresh({ force: true }); }
  }
  return <div className="app-shell live-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar"><button className="brand" onClick={() => navigate('dashboard')}><img src="/community-fitness-logo.png" alt="The Community Fitness by Strategy First" /></button>
      <nav aria-label="Main navigation">{[['dashboard', 'Dashboard', LayoutDashboard], ['members', 'Members', Users], ['checkin', 'Check-in', CalendarCheck2], ['analytics', 'Analytics', Activity], ['catalogue', 'Packages & Discounts', Settings2], ...(staff.role_code === 'super_admin' ? [['accounts', 'Admin accounts', ShieldCheck]] : [])].map(([id, label, Icon]) => <button key={id} className={`nav-item ${page === id ? 'nav-active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} />{label}</button>)}</nav>
      <div className="sidebar-bottom"><strong>{staff.display_name}</strong><p>{staff.role_code === 'super_admin' ? 'Super Admin' : 'Admin'}</p></div>
    </aside>
    <div className="main-shell"><header className="topbar"><strong>Live workspace</strong><div className="topbar-actions"><Button disabled={busy} onClick={refresh}><RefreshCw size={17} />{busy ? 'Refreshing…' : 'Refresh'}</Button><Button aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</Button><Button onClick={logout}><LogOut size={17} />Sign out</Button></div></header>
      <main className="main-content" id="main-content"><p className="soft-note">Supabase · Member and attendance records are read-only. Super Admin can create Admin accounts.</p>
        {(error || workspace.error) && <p role="alert" className="error-banner">{error || workspace.error}</p>}
        {page === 'dashboard' && <Dashboard {...common} onNavigate={navigate} onDrilldown={setSummary} />}
        {page === 'members' && (member ? <MemberProfile {...common} member={member} onBack={() => setMemberId(null)} onEdit={blocked} onArchive={blocked} /> : <MemberDirectory {...common} onAdd={blocked} />)}
        {page === 'analytics' && <Analytics data={data} today={today} onExport={exportData} />}
        {page === 'checkin' && <CheckInPage {...common} />}
        {page === 'catalogue' && <CataloguePage data={data} canEdit={staff.role_code === 'super_admin'} onCreate={blocked} onEdit={blocked} onToggle={blocked} />}
        {page === 'accounts' && staff.role_code === 'super_admin' && <AdminAccounts />}
      </main>
    </div>
    {summary && <SummaryDialog {...common} kind={summary} onClose={() => setSummary(null)} />}
  </div>;
}

function RemoteLogin({ initialError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError || '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(operation) {
    setBusy(true); setError(''); setMessage('');
    try { const { error: problem } = await operation(); if (problem) throw problem; }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card"><div className="login-logo"><img src="/community-fitness-logo.png" alt="The Community Fitness by Strategy First" /></div><h1>Sign in</h1><p>Use your authorized Supabase staff account.</p>
    <form className="login-form" onSubmit={e => { e.preventDefault(); void run(() => supabase.auth.signInWithPassword({ email: email.trim(), password })); }}>
      <Field label="Email"><input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label="Password"><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
      <Button type="submit" variant="primary" disabled={busy || !password}>Sign in</Button>
      <Button type="button" disabled={busy || !email.includes('@')} onClick={() => run(async () => {
        const result = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } });
        if (!result.error) setMessage('Check your email for the sign-in link. Open it in this browser.');
        return result;
      })}>Email me a sign-in link</Button>
    </form>{error && <p className="form-error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <p className="local-access-note">Supabase Auth · Only enabled staff can read member information. Local browser accounts do not grant access.</p>
  </section></main>;
}
