import { useState } from 'react';
import { LogIn, ShieldCheck, UserPlus, Trash2 } from 'lucide-react';
import { Button, Dialog, Field, Badge } from './components.jsx';

export function LoginScreen({ auth, onLogin }) {
  const [values, setValues] = useState({ display_name:'', username:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  let setup = false, readError = '';
  try { setup = !auth.isConfigured(); } catch (err) { readError = err.message; }
  const update = (key, value) => setValues(v => ({...v,[key]:value}));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (setup && values.password !== values.confirm) throw new Error('Passwords do not match.');
      onLogin(await (setup ? auth.setup(values) : auth.login(values.username, values.password)));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="login-shell"><section className="login-card"><div className="login-logo"><img src="/community-fitness-logo.png" alt="The Community Fitness by Strategy First" width="10891" height="5284"/></div><h1><ShieldCheck size={25}/>{setup ? 'Set up Admin' : 'Welcome back'}</h1><p className="login-intro">{setup ? 'Create the account that will manage your team.' : 'Sign in to your gym workspace.'}</p>
    <form onSubmit={submit} className="login-form">
      {setup && <Field label="Your name"><input required autoComplete="name" value={values.display_name} onChange={e=>update('display_name',e.target.value)}/></Field>}
      <Field label="Username"><input autoFocus required autoCapitalize="none" autoComplete="username" value={values.username} onChange={e=>update('username',e.target.value)}/></Field>
      <Field label="Password" hint={setup ? 'At least 12 characters. Use a password unique to this local workspace.' : undefined}><input type="password" required minLength={setup ? 12 : undefined} maxLength={128} autoComplete={setup ? 'new-password' : 'current-password'} value={values.password} onChange={e=>update('password',e.target.value)}/></Field>
      {setup && <Field label="Confirm password"><input type="password" required autoComplete="new-password" value={values.confirm} onChange={e=>update('confirm',e.target.value)}/></Field>}
      {(error || readError) && <p className="form-error" role="alert">{error || readError}</p>}
      <Button variant="primary" type="submit" disabled={busy || Boolean(readError)}><LogIn size={18}/>{busy ? 'Please wait…' : setup ? 'Create Admin' : 'Sign in'}</Button>
    </form><p className="local-access-note">Local workspace · Accounts are saved in this browser only. This login is not server-backed security. Do not use it to protect real member data on a shared device.</p>
  </section></main>;
}

export function AccountsPage({ auth }) {
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  let accounts = [], accessError = '';
  try { accounts = auth.listAccounts(); } catch (err) { accessError = err.message; }
  if (accessError) return <p className="form-error" role="alert">{accessError}</p>;
  return <><div className="page-heading"><h1 className="screen-title"><ShieldCheck aria-hidden="true"/>Staff accounts</h1><Button variant="primary" onClick={()=>setModal({type:'create'})}><UserPlus size={18}/>Create Staff</Button></div>
    <section className="panel"><div className="table-scroll"><table className="member-table" key={revision}><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Actions</th></tr></thead><tbody>{accounts.map(a=><tr key={a.id}><td><strong>{a.display_name}</strong></td><td>{a.username}</td><td><Badge>{a.role === 'super_admin' ? 'Admin' : 'Staff'}</Badge></td><td>{a.role === 'admin' ? <Button aria-label={`Delete ${a.username}`} onClick={()=>setModal({type:'delete',account:a})}><Trash2 size={16}/>Delete</Button> : 'Owner account'}</td></tr>)}</tbody></table></div><div className="soft-note">Only Admin can manage accounts and edit saved package or discount details. All other workspace actions are shared.</div></section>
    <p className="scope-note">Local accounts apply to this browser, not other devices. Clearing browser storage removes them. Sessions expire after 8 hours.</p>
    {modal?.type === 'create' && <CreateAdminDialog onClose={()=>setModal(null)} onSave={async values=>{await auth.createAdmin(values); setRevision(v=>v+1); setModal(null);}}/>}
    {modal?.type === 'delete' && <Dialog title="Delete Staff account?" subtitle={modal.account.username} onClose={()=>{setModal(null);setError('');}}><div className="dialog-body"><p className="confirm-copy">{modal.account.display_name} will lose access to this local workspace. Member data and past activity will be kept. This account deletion cannot be undone.</p>{error && <p className="form-error" role="alert">{error}</p>}</div><div className="dialog-footer"><Button onClick={()=>setModal(null)}>Cancel</Button><Button variant="primary" onClick={()=>{try{auth.deleteAdmin(modal.account.id);setRevision(v=>v+1);setModal(null);}catch(err){setError(err.message);}}}>Delete Staff</Button></div></Dialog>}
  </>;
}

function CreateAdminDialog({ onClose, onSave }) {
  const [values, setValues] = useState({display_name:'',username:'',password:'',confirm:''});
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const update = (key,value)=>setValues(v=>({...v,[key]:value}));
  return <Dialog title="Create Staff" subtitle="Staff can manage members, attendance and reports." onClose={()=>{if(!busy)onClose();}}><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{if(values.password!==values.confirm)throw new Error('Passwords do not match.');await onSave(values);}catch(err){setError(err.message);}finally{setBusy(false);}}}><div className="dialog-body form-grid">
    <Field label="Name"><input autoFocus required maxLength={120} value={values.display_name} onChange={e=>update('display_name',e.target.value)}/></Field><Field label="Username" hint="3–60 letters, numbers, dots, underscores or hyphens."><input required minLength={3} maxLength={60} autoCapitalize="none" autoComplete="off" value={values.username} onChange={e=>update('username',e.target.value)}/></Field>
    <Field label="Password" hint="At least 6 characters."><input required type="password" minLength={6} maxLength={128} autoComplete="new-password" value={values.password} onChange={e=>update('password',e.target.value)}/></Field><Field label="Confirm password"><input type="password" required autoComplete="new-password" value={values.confirm} onChange={e=>update('confirm',e.target.value)}/></Field>
    {error && <p className="form-error span-two" role="alert">{error}</p>}</div><div className="dialog-footer"><Button type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create Staff'}</Button></div></form></Dialog>;
}
