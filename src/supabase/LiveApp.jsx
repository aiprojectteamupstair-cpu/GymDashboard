import { useEffect, useRef, useState } from 'react';
import { Activity, CalendarCheck2, LayoutDashboard, LogOut, Moon, RefreshCw, Settings2, ShieldCheck, Sun, Users } from 'lucide-react';
import { backend, backendMode } from '../backend.js';
import { CataloguePage, CheckInPage, Dashboard, MemberDirectory, MemberProfile } from '../prototype/pages.jsx';
import { createWorkspaceSync } from './workspaceSync.js';
import AdminAccounts from './AdminAccounts.jsx';
import LiveDialogs from './LiveDialogs.jsx';
import { createCommandSender } from './commands.js';
import { accountName } from '../roles.js';
import { PAGE_PATHS, memberPath, resolveRoute, isPlainNavigation } from '../routes.js';
import { Analytics } from '../prototype/Analytics.jsx';
import { SummaryDialog } from '../prototype/SummaryDialog.jsx';
import { Button, EmptyState, Field } from '../prototype/components.jsx';
import { downloadPrototypeWorkbook } from '../prototype/export.js';
import { localDate } from '../prototype/domain.js';
import '../prototype/prototype.css';
import './live.css';

export default function LiveApp() {
  const [session, setSession] = useState(null);
  const [workspace, setWorkspace] = useState({ snapshot: null, busy: true, error: '' });
  const [sync] = useState(() => createWorkspaceSync(owner => backend.loadWorkspace(owner), setWorkspace));
  const { snapshot, busy } = workspace;
  const [error, setError] = useState('');
  const [{ page, memberId }, setRoute] = useState(() => resolveRoute(window.location.pathname));
  const [summary, setSummary] = useState(null);
  const [modal, setModal] = useState(null);
  const [mutation, setMutation] = useState({ busy: false, error: '' });
  const [notice, setNotice] = useState('');
  const saving = useRef(false);
  const [sendCommand] = useState(() => createCommandSender(backend));
  const [today, setToday] = useState(localDate);
  const [theme, setTheme] = useState(() => localStorage.getItem('community-fitness:theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('community-fitness:theme', theme); }, [theme]);

  useEffect(() => {
    const canonicalize = () => {
      const route = resolveRoute(window.location.pathname);
      if (route.path !== window.location.pathname) window.history.replaceState(null, '', route.path + window.location.search + window.location.hash);
      return route;
    };
    canonicalize();
    const restore = () => {
      setRoute(canonicalize()); setModal(null); setSummary(null); setError(''); setNotice('');
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  function goTo(path, replace = false) {
    if (window.location.pathname !== path || window.location.search || window.location.hash) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
    }
    setRoute(resolveRoute(path)); setModal(null); setSummary(null); setError(''); setNotice('');
    window.scrollTo(0, 0);
  }
  const navigate = next => goTo(PAGE_PATHS[next]);
  const profile = id => goTo(memberPath(id));
  const followLink = (event, pageId) => {
    if (isPlainNavigation(event)) { event.preventDefault(); navigate(pageId); }
  };

  const refresh = () => { setError(''); return sync.refresh({ force: true }); };
  useEffect(() => {
    let alive = true;
    const { data: { subscription } } = backend.auth.onAuthStateChange((_event, next) => {
      if (!alive) return;
      setSession(next);
      if (sync.identity(next?.user.id || null)) {
        setSummary(null); setModal(null); setError(''); setNotice('');
      }
      // Keep Supabase requests outside its synchronous auth callback.
      setTimeout(() => { if (alive) void sync.refresh(); }, 0);
    });
    return () => { alive = false; sync.invalidate(); subscription.unsubscribe(); };
  }, [sync]);
  useEffect(() => {
    if (!session) return;
    const recheck = () => { if (document.visibilityState === 'hidden') return; setToday(localDate()); void sync.refresh(); };
    const timer = setInterval(recheck, 300000);
    window.addEventListener('focus', recheck);
    return () => { clearInterval(timer); window.removeEventListener('focus', recheck); };
  }, [session, sync]);
  async function logout() {
    sync.identity(null); setSession(null); goTo(PAGE_PATHS.dashboard, true);
    const { error: problem } = await backend.auth.signOut({ scope: 'local' });
    if (problem) setError(problem.message);
  }
  if (!session) return <WorkspaceLogin initialError={error} />;
  if (!snapshot) return <main className="login-shell"><section className="login-card"><h1>{busy ? 'Loading your workspace…' : 'Workspace unavailable'}</h1>{workspace.error && <p role="alert" className="form-error">{workspace.error}</p>}<Button disabled={busy} onClick={refresh}>Retry</Button><Button onClick={logout}>Sign out</Button></section></main>;

  const { data, staff } = snapshot;
  const member = data.members.find(m => m.id === memberId);
  const openModal = value => { setMutation({ busy: false, error: '' }); setModal(value); };
  async function save(command, payload) {
    if (saving.current) return;
    saving.current = true; setMutation({ busy: true, error: '' }); setNotice('');
    const owner = sync.current().owner;
    try {
      const result = await sendCommand(command, payload);
      if (owner !== sync.current().owner) return;
      setModal(null); setNotice(result.duplicate ? 'Already checked in today. No duplicate was created.' : 'Saved. Refreshing the workspace…');
      await sync.refresh({ force: true });
      if (owner === sync.current().owner) setNotice(sync.current().error ? 'Saved, but refresh failed. Do not repeat this save; use Refresh.' : 'Saved and workspace refreshed.');
    } catch (err) { if (owner === sync.current().owner) { setMutation({ busy: false, error: err.message }); setError(err.message); } }
    finally { saving.current = false; setMutation(current => ({ ...current, busy: false })); }
  }
  const common = { data, today, onProfile: profile, onRenew: id => openModal({ type: 'membership', id }), onCheckIn: id => openModal({ type: 'checkin', id }), onEditAttendance: row => openModal({ type: 'attendance-edit', row }), onManageAttendance: ['super_admin', 'admin'].includes(staff.role_code) ? (id, month) => openModal({ type: 'attendance-calendar', id, month }) : undefined };
  async function exportData(scope) {
    const owner = sync.current().owner;
    try {
      const current = await backend.loadWorkspace(owner);
      if (owner !== sync.current().owner) return;
      downloadPrototypeWorkbook(current.data, scope);
    } catch (err) { setError(`Export failed: ${err.message}`); void sync.refresh({ force: true }); }
  }
  return <div className="app-shell live-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar"><a className="brand" href={PAGE_PATHS.dashboard} onClick={event => followLink(event, 'dashboard')}><img src="/community-fitness-logo.png" alt="The Community Fitness by Strategy First" /></a>
      <nav aria-label="Main navigation">{[['dashboard', 'Dashboard', LayoutDashboard], ['members', 'Members', Users], ['checkin', 'Check-in', CalendarCheck2], ['analytics', 'Analytics', Activity], ['catalogue', 'Packages & Discounts', Settings2], ...(staff.role_code === 'super_admin' ? [['accounts', 'Staff accounts', ShieldCheck]] : [])].map(([id, label, Icon]) => <a key={id} href={PAGE_PATHS[id]} className={`nav-item ${page === id ? 'nav-active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={event => followLink(event, id)}><Icon size={19} />{label}</a>)}</nav>
      <div className="sidebar-bottom"><strong>{accountName(staff)}</strong></div>
    </aside>
    <div className="main-shell"><header className="topbar"><strong>{backendMode === 'local' ? 'Local workspace' : 'Gym workspace'}</strong><div className="topbar-actions"><Button disabled={busy} onClick={refresh}><RefreshCw size={17} />{busy ? 'Refreshing…' : 'Refresh'}</Button><Button aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</Button><Button onClick={logout}><LogOut size={17} />Sign out</Button></div></header>
      <main className="main-content" id="main-content">
        {notice && <p role="status" className="soft-note">{notice}</p>}
        {(error || workspace.error) && <p role="alert" className="error-banner">{error || workspace.error}</p>}
        {page === 'dashboard' && <Dashboard {...common} onNavigate={navigate} onDrilldown={setSummary} />}
        {page === 'members' && (memberId ? member ? <MemberProfile key={member.id} {...common} member={member} onBack={() => navigate('members')} onEdit={() => openModal({ type: 'member', id: member.id })} onArchive={() => openModal({ type: 'archive', id: member.id })} /> : <EmptyState title="Member not found" message="This member is unavailable in your workspace." action={<Button onClick={() => navigate('members')}>Back to members</Button>} /> : <MemberDirectory {...common} onAdd={() => openModal({ type: 'member' })} />)}
        {page === 'analytics' && <Analytics data={data} today={today} onExport={exportData} />}
        {page === 'checkin' && <CheckInPage {...common} />}
        {page === 'catalogue' && <CataloguePage data={data} canEdit={staff.role_code === 'super_admin'} onCreate={kind => openModal({ type: 'catalogue', kind })} onEdit={(kind, row) => openModal({ type: 'catalogue', kind, row })} onToggle={(kind, row) => save('catalogue.status', { kind, id: row.id, enabled: !row.enabled, expected_updated_at: row.updated_at })} />}
        {page === 'accounts' && staff.role_code === 'super_admin' && <AdminAccounts />}
        {page === 'accounts' && staff.role_code !== 'super_admin' && <EmptyState title="Access denied" message="Only Admin can manage staff accounts." action={<Button onClick={() => navigate('dashboard')}>Back to dashboard</Button>} />}
        {page === 'not-found' && <EmptyState title="Page not found" message="This page does not exist." action={<Button onClick={() => navigate('dashboard')}>Back to dashboard</Button>} />}
      </main>
    </div>
    {summary && <SummaryDialog {...common} kind={summary} onClose={() => setSummary(null)} />}
    <LiveDialogs modal={modal} data={data} today={today} onClose={() => { if (!saving.current) setModal(null); }} onEditAttendance={common.onEditAttendance} save={save} mutation={mutation} />
  </div>;
}

function WorkspaceLogin({ initialError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  async function run(operation) {
    setBusy(true); setError('');
    try { const { error: problem } = await operation(); if (problem) throw problem; }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card"><div className="login-logo"><img src="/community-fitness-logo.png" alt="The Community Fitness by Strategy First" /></div><h1>Sign in</h1><p>Sign in to your gym workspace.</p>
    <form className="login-form" onSubmit={e => { e.preventDefault(); void run(() => backend.auth.signInWithPassword({ email: email.trim(), password })); }}>
      <Field label="Email"><input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <Field label="Password"><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>
      <Button type="submit" variant="primary" disabled={busy || !password}>{busy ? 'Signing in...' : 'Sign in'}</Button>
    </form>{error && <p className="form-error" role="alert">{error}</p>}
  </section></main>;
}
