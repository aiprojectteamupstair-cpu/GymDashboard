import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CalendarCheck2, CheckCircle2, ChevronRight, Download, Dumbbell, LayoutDashboard, Menu, Plus, RotateCw, Settings2, ShieldCheck, Users, X } from 'lucide-react';
import { Button, Dialog, Field } from './components.jsx';
import { CheckInDialog, MemberForm, MembershipForm } from './forms.jsx';
import { Analytics, CheckInPage, Dashboard, MemberDirectory, MemberProfile, Settings } from './pages.jsx';
import { createPrototypeRepository, STORAGE_KEY } from './repository.js';
import { downloadPrototypeWorkbook } from './export.js';
import { localDate } from './domain.js';
import './prototype.css';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'checkin', label: 'Check-in', icon: CalendarCheck2 },
  { id: 'analytics', label: 'Analytics', icon: Activity },
];

function ExportDialog({ data, onClose, onExport }) {
  const [range, setRange] = useState(false);
  const [start, setStart] = useState(localDate().slice(0, 7) + '-01');
  const [end, setEnd] = useState(localDate());
  return <Dialog title="Export to Excel" subtitle="Organized records, ready to work with." onClose={onClose}><form onSubmit={e => { e.preventDefault(); onExport(range ? { start, end } : {}); }}><div className="dialog-body"><div className="export-preview"><Download size={25} /><div><strong>The Community Fitness</strong><p>Read me · Members · Memberships · Attendance</p></div><span>.xlsx</span></div><p className="export-copy">Exports the full prototype dataset, including archived profiles and membership history. Directory filters are not applied.</p><label className="checkbox-label"><input type="checkbox" checked={range} onChange={e => setRange(e.target.checked)} />Limit to an attendance date range</label>{range && <><div className="form-grid"><Field label="From"><input required type="date" value={start} max={end} onChange={e => setStart(e.target.value)} /></Field><Field label="To"><input required type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} /></Field></div><p className="field-hint">Includes attendees in this period, their profiles and full membership history.</p></>}<div className="inline-notice">Fictional sample data only · {data.members.length} member profiles available</div></div><div className="dialog-footer"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary"><Download size={17} />Download Excel</Button></div></form></Dialog>;
}

export default function PrototypeApp() {
  const [repository] = useState(() => createPrototypeRepository());
  const [data, setData] = useState(() => repository.getSnapshot());
  const [error, setError] = useState(() => repository.getError());
  const [today, setToday] = useState(localDate);
  const [page, setPage] = useState('dashboard');
  const [memberId, setMemberId] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setToday(localDate()), 30000);
    const sync = e => { if (e.key === STORAGE_KEY) { try { setData(repository.reload()); setError(''); } catch (err) { setError(err.message); } } };
    window.addEventListener('storage', sync);
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); };
  }, [repository]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);

  function navigate(next) { setPage(next); setMemberId(null); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function profile(id) { setPage('members'); setMemberId(id); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function commit(method, args, message) { const result = repository[method](...args); setData(repository.getSnapshot()); setError(''); setToast(message); return result; }
  function exportData(scope) {
    try { downloadPrototypeWorkbook(data, scope); setModal(null); setToast('Your sample Excel workbook has been downloaded.'); } catch (err) { setError(`Export failed: ${err.message}`); }
  }
  const member = data.members.find(m => m.id === memberId);
  const modalMember = data.members.find(m => m.id === modal?.id);
  const label = page === 'settings' ? 'Settings' : navigation.find(n => n.id === page)?.label;
  const common = { data, today, onProfile: profile, onRenew: id => setModal({ type: 'membership', id }), onCheckIn: id => setModal({ type: 'checkin', id }) };

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    {mobileNav && <button className="nav-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('dashboard')} aria-label="The Community Fitness dashboard"><span className="brand-symbol"><Dumbbell size={25} strokeWidth={1.8} /></span><span><strong>the community<span>fitness</span></strong><small>BY STRATEGY FIRST</small></span></button>
      <span className="nav-caption">WORKSPACE</span><nav aria-label="Main navigation">{navigation.map(({ id, label: text, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'nav-active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={19} /><span>{text}</span>{id === 'checkin' && <span className="nav-count">{data.attendance.filter(a => a.attendance_date === today && !a.voided_at).length}</span>}</button>)}</nav>
      <div className="sidebar-divider" /><button className={`nav-item ${page === 'settings' ? 'nav-active' : ''}`} onClick={() => navigate('settings')}><Settings2 size={19} /><span>Settings</span></button>
      <div className="sidebar-bottom"><div className="community-note"><span className="mini-dumbbell"><Dumbbell size={21} /></span><strong>More than a gym.<br />A community.</strong><p>A space to show up,<br />grow, and belong.</p><div className="note-decoration" /></div><div className="sidebar-user"><span className="user-avatar">DA</span><span><strong>Demo Admin</strong><small>Prototype workspace</small></span><ShieldCheck size={17} /></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button menu-toggle" aria-label="Open navigation" aria-expanded={mobileNav} onClick={() => setMobileNav(true)}><Menu size={22} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{label}</strong>{member && <><ChevronRight size={14} /><strong className="breadcrumb-name">{member.full_name}</strong></>}</div><div className="topbar-actions"><span className="prototype-chip"><span />UI Prototype</span><Button onClick={() => setModal({ type: 'export' })}><Download size={16} /><span>Export Excel</span></Button><Button variant="primary" onClick={() => setModal({ type: 'member' })}><Plus size={17} /><span>New member</span></Button></div></header>
      <div className="prototype-banner"><span><span className="banner-dot" />Fictional sample data<span className="banner-separator">/</span>Changes stay in this browser</span><button onClick={() => navigate('settings')}>About this prototype<ArrowRight size={13} /></button></div>
      <main id="main-content" className="main-content">
        {error && <div className="error-banner" role="alert"><span>{error}</span><button className="text-button" onClick={() => setModal({ type: 'reset' })}>Reset sample data</button></div>}
        {page === 'dashboard' && <Dashboard {...common} onNavigate={navigate} />}
        {page === 'members' && (member ? <MemberProfile key={member.id} {...common} member={member} onBack={() => setMemberId(null)} onEdit={() => setModal({ type: 'member', id: member.id })} onRenew={() => setModal({ type: 'membership', id: member.id })} onCheckIn={() => setModal({ type: 'checkin', id: member.id })} onArchive={() => setModal({ type: 'archive', id: member.id })} /> : <MemberDirectory {...common} onAdd={() => setModal({ type: 'member' })} />)}
        {page === 'checkin' && <CheckInPage {...common} />}
        {page === 'analytics' && <Analytics {...common} onExport={exportData} />}
        {page === 'settings' && <Settings data={data} onReset={() => setModal({ type: 'reset' })} />}
        <footer className="page-footer"><span>THE COMMUNITY FITNESS <span className="footer-divider">/</span> BY STRATEGY FIRST</span><span>Built around your community.</span></footer>
      </main>
    </div>
    {modal?.type === 'member' && <MemberForm data={data} member={modalMember} today={today} onClose={() => setModal(null)} onSave={(values, id) => { const result = commit('saveMember', [values, id], id ? 'Member information updated.' : 'Member created. You can add their membership next.'); setModal(null); profile(result.member.id); }} />}
    {modal?.type === 'membership' && <MembershipForm data={data} memberId={modal.id} today={today} onClose={() => setModal(null)} onSave={values => { commit('addMembership', [values], 'Membership saved. Previous records are preserved.'); setModal(null); profile(values.member_id); }} />}
    {modal?.type === 'checkin' && modalMember && <CheckInDialog data={data} member={modalMember} today={today} onClose={() => setModal(null)} onConfirm={id => { const result = commit('checkIn', [id, true], `${modalMember.full_name} is checked in.`); if (result.duplicate) setToast('This member is already checked in today.'); setModal(null); }} />}
    {modal?.type === 'export' && <ExportDialog data={data} onClose={() => setModal(null)} onExport={exportData} />}
    {modal?.type === 'archive' && modalMember && <Dialog title={modalMember.archived_at ? 'Restore this member?' : 'Archive this member?'} subtitle={modalMember.full_name} onClose={() => setModal(null)}><div className="dialog-body"><p className="confirm-copy">{modalMember.archived_at ? 'This profile will return to the member directory and check-in search.' : 'This profile will leave the regular directory and check-in search. Memberships and past attendance stay in their history. You can restore the profile later.'}</p><p className="field-hint">Archive / restore is the proposed deletion flow for this prototype.</p></div><div className="dialog-footer"><Button onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" onClick={() => { try { commit('archiveMember', [modalMember.id, !modalMember.archived_at], modalMember.archived_at ? 'Member restored.' : 'Member archived. History has been kept.'); setModal(null); } catch (err) { setError(err.message); setModal(null); } }}>{modalMember.archived_at ? 'Restore member' : 'Archive member'}</Button></div></Dialog>}
    {modal?.type === 'reset' && <Dialog title="Reset sample data?" subtitle="Start again with the fictional member examples." onClose={() => setModal(null)}><div className="dialog-body"><p className="confirm-copy">Your changes in this UI prototype will be replaced with fresh sample data. The original dashboard's saved data is separate and is not affected.</p></div><div className="dialog-footer"><Button onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" onClick={() => { try { setData(repository.reset()); setError(''); setModal(null); navigate('dashboard'); setToast('Sample data reset.'); } catch (err) { setError(err.message); setModal(null); } }}><RotateCw size={17} />Reset sample data</Button></div></Dialog>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={20} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}
