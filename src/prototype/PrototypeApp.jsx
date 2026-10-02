import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CalendarCheck2, CheckCircle2, ChevronRight, Download, Dumbbell, LayoutDashboard, Menu, Moon, Sun, Plus, RotateCw, Settings2, ShieldCheck, LogOut, Users, X } from 'lucide-react';
import { Button, Dialog, Field } from './components.jsx';
import { CatalogueForm, CheckInDialog, MemberForm, MembershipForm } from './forms.jsx';
import { Analytics } from './Analytics.jsx';
import { AttendanceEditDialog } from './AttendanceEditDialog.jsx';
import { SummaryDialog } from './SummaryDialog.jsx';
import { CheckInPage, Dashboard, MemberDirectory, MemberProfile, CataloguePage } from './pages.jsx';
import { createPrototypeRepository, STORAGE_KEY } from './repository.js';
import { downloadPrototypeWorkbook } from './export.js';
import { localDate } from './domain.js';
import { createLocalAuth, AUTH_KEY } from './localAuth.js';
import { LoginScreen, AccountsPage } from './AccountUI.jsx';
import './prototype.css';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'checkin', label: 'Check-in', icon: CalendarCheck2 },
  { id: 'analytics', label: 'Analytics', icon: Activity },
];

export default function PrototypeApp() {
  const [auth] = useState(() => createLocalAuth(window.localStorage, window.sessionStorage, () => new Date(), true));
  const [user, setUser] = useState(() => { try { return auth.currentUser(); } catch { return null; } });
  const [repository] = useState(() => createPrototypeRepository(window.localStorage, () => new Date(), () => auth.requireUser()));
  const [data, setData] = useState(() => repository.getSnapshot());
  const [error, setError] = useState(() => repository.getError());
  const [today, setToday] = useState(localDate);
  const [page, setPage] = useState('dashboard');
  const [memberId, setMemberId] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { const saved = localStorage.getItem('community-fitness:theme'); if (saved === 'dark' || saved === 'light') return saved; } catch { /* preference storage may be unavailable */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121212' : '#f6f6f6');
    try { localStorage.setItem('community-fitness:theme', theme); } catch { /* visual mode still works without persistence */ }
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => setToday(localDate()), 30000);
    const sync = e => { if (e.key === STORAGE_KEY) { try { setData(repository.reload()); setError(''); } catch (err) { setError(err.message); } } };
    window.addEventListener('storage', sync);
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); };
  }, [repository]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);

  useEffect(() => {
    const syncUser = () => { try { const next = auth.currentUser(); setUser(next); if (!next) { setModal(null); setPage('dashboard'); setMemberId(null); } } catch { setUser(null); setModal(null); } };
    const sync = e => { if (e.key === AUTH_KEY || e.key === null) syncUser(); };
    const timer = setInterval(syncUser, 30000);
    window.addEventListener('storage', sync); window.addEventListener('focus', syncUser);
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener('focus', syncUser); };
  }, [auth]);
  function logout() { auth.logout(); setUser(null); setModal(null); setMemberId(null); setPage('dashboard'); setToast(''); setMobileNav(false); }
  function navigate(next) { setPage(next); setMemberId(null); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function profile(id) { setPage('members'); setMemberId(id); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function commit(method, args, message) { const result = repository[method](...args); setData(repository.getSnapshot()); setError(''); setToast(message); return result; }
  function exportData(scope) {
    try { auth.requireUser(); downloadPrototypeWorkbook(data, scope); setModal(null); setToast('Your Excel workbook has been downloaded.'); } catch (err) { setError(`Export failed: ${err.message}`); }
  }
  const member = data.members.find(m => m.id === memberId);
  const modalMember = data.members.find(m => m.id === modal?.id);
  const label = page === 'accounts' ? 'Admin accounts' : page === 'catalogue' ? 'Packages & Discounts' : navigation.find(n => n.id === page)?.label;
  const common = { data, today, onEditAttendance: row => setModal({type:'attendance-edit',row}), onProfile: profile, onRenew: id => setModal({ type: 'membership', id }), onCheckIn: id => setModal({ type: 'checkin', id }) };

  if (!user) return <LoginScreen auth={auth} onLogin={next=>{setUser(next);setData(repository.reload());setError(repository.getError());}}/>;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {mobileNav && <button className="nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('dashboard')} aria-label="The Community Fitness dashboard"><img src="/community-fitness-logo.png" alt="The Community Fitness by Strategy First" width="10891" height="5284"/></button>
      <span className="nav-caption">WORKSPACE</span><nav aria-label="Main navigation">{navigation.map(({ id, label: text, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'nav-active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} /><span>{text}</span>{id === 'checkin' && <span className="nav-count">{data.attendance.filter(a => a.attendance_date === today && !a.voided_at).length}</span>}</button>)}</nav>
      <div className="sidebar-divider" /><button className={`nav-item ${page === 'catalogue' ? 'nav-active' : ''}`} onClick={() => navigate('catalogue')}><Settings2 size={19} /><span>Packages & Discounts</span></button>
      {user.role === 'super_admin' && <button className={`nav-item ${page === 'accounts' ? 'nav-active' : ''}`} onClick={()=>navigate('accounts')}><ShieldCheck size={19}/><span>Admin accounts</span></button>}
      <div className="sidebar-bottom"><div className="community-note"><span className="mini-dumbbell"><Dumbbell size={21} /></span><strong>More than a gym.<br />A community.</strong><p>A space to show up,<br />grow, and belong.</p><div className="note-decoration" /></div><div className="sidebar-user"><span className="user-avatar">{user.display_name.slice(0,2).toUpperCase()}</span><span><strong>{user.display_name}</strong><small>{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</small></span><ShieldCheck size={17} /></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button menu-toggle" aria-label="Open navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={22} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{label}</strong>{member && <><ChevronRight size={14} /><strong className="breadcrumb-name">{member.full_name}</strong></>}</div><div className="topbar-actions"><Button aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></Button><Button onClick={logout} aria-label="Sign out"><LogOut size={18}/><span>Sign out</span></Button></div></header>
      <main id="main-content" className="main-content">
        {error && <div className="error-banner" role="alert"><span>{error}</span></div>}
        {page === 'dashboard' && <Dashboard {...common} onNavigate={navigate} onDrilldown={kind => setModal({ type: 'summary', kind })} />}
        {page === 'members' && (member ? <MemberProfile key={member.id} {...common} member={member} onBack={() => setMemberId(null)} onEdit={() => setModal({ type: 'member', id: member.id })} onRenew={() => setModal({ type: 'membership', id: member.id })} onCheckIn={() => setModal({ type: 'checkin', id: member.id })} onArchive={() => setModal({ type: 'archive', id: member.id })} /> : <MemberDirectory {...common} onAdd={() => setModal({ type: 'member' })} />)}
        {page === 'checkin' && <CheckInPage {...common} />}
        {page === 'analytics' && <Analytics {...common} onExport={exportData} />}
        {page === 'accounts' && user.role === 'super_admin' && <AccountsPage auth={auth}/>}
        {page === 'catalogue' && <CataloguePage data={data} canEdit={user.role === 'super_admin'} onEdit={(kind,row)=>setModal({type:'catalogue',kind,row})} onCreate={kind => setModal({ type: 'catalogue', kind })} onToggle={(kind, row) => { try { commit('setCatalogueStatus', [kind, row.id, !row.enabled], `${row.label} is now ${row.enabled ? 'inactive' : 'active'}.`); } catch (err) { setError(err.message); } }} />}
        <footer className="page-footer"><span>THE COMMUNITY FITNESS <span className="footer-divider">/</span> BY STRATEGY FIRST</span><span>Built around your community.</span></footer>
      </main>
    </div>
    {modal?.type === 'member' && <MemberForm data={data} member={modalMember} today={today} onClose={() => setModal(null)} onSave={(values, id) => { const result = commit('saveMember', [values, id], id ? 'Member information updated.' : values.category_id === 'guest' ? 'Guest created.' : 'Member created.'); setModal(null); profile(result.member.id); }} />}
    {modal?.type === 'membership' && <MembershipForm data={data} memberId={modal.id} today={today} onClose={() => setModal(null)} onSave={values => { commit('addMembership', [values], 'Membership saved. Previous records are preserved.'); setModal(null); profile(values.member_id); }} />}
    {modal?.type === 'checkin' && modalMember && <CheckInDialog data={data} member={modalMember} today={today} onClose={() => setModal(null)} onEditAttendance={common.onEditAttendance} onConfirm={(id, manualTime) => { const result = commit('checkIn', [id, true, manualTime], `${modalMember.full_name} is checked in.`); if (result.duplicate) setToast('This member is already checked in today.'); setModal(null); }} />}
    {modal?.type === 'catalogue' && <CatalogueForm kind={modal.kind} row={modal.row} onClose={() => setModal(null)} onSave={values => { commit('saveCatalogue', [modal.kind, values, modal.row?.id], 'Catalogue updated.'); setModal(null); }} />}
    {modal?.type === 'summary' && <SummaryDialog {...common} kind={modal.kind} onClose={() => setModal(null)} onProfile={id => { setModal(null); profile(id); }} />}
    {modal?.type === 'attendance-edit' && <AttendanceEditDialog data={data} row={modal.row} onClose={() => setModal(null)} onSave={values => { commit('updateAttendanceTime', [modal.row.id, values], 'Check-in time updated. Previous time kept in history.'); setModal(null); }} />}
    {modal?.type === 'archive' && modalMember && <Dialog title={modalMember.archived_at ? 'Restore this member?' : 'Archive this member?'} subtitle={modalMember.full_name} onClose={() => setModal(null)}><div className="dialog-body"><p className="confirm-copy">{modalMember.archived_at ? 'This profile will return to the member directory and check-in search.' : 'This profile will leave the regular directory and check-in search. Memberships and past attendance stay in their history. You can restore the profile later.'}</p></div><div className="dialog-footer"><Button onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" onClick={() => { try { commit('archiveMember', [modalMember.id, !modalMember.archived_at], modalMember.archived_at ? 'Member restored.' : 'Member archived. History has been kept.'); setModal(null); } catch (err) { setError(err.message); setModal(null); } }}>{modalMember.archived_at ? 'Restore member' : 'Archive member'}</Button></div></Dialog>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={20} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}
