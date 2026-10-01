import { useEffect, useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from './client.js';
import { Button, Dialog, Field } from '../prototype/components.jsx';

async function requestAccounts(body) {
  const { data, error } = await supabase.functions.invoke('admin-accounts', { body });
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error || message; } catch { /* network errors have no response */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [remove, setRemove] = useState(null);
  useEffect(() => {
    let alive = true;
    requestAccounts({ action: 'list' }).then(result => { if (alive) setAccounts(result.accounts); })
      .catch(err => { if (alive) { setAccounts([]); setError(err.message); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [revision]);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  function close() { if (!busy) { setOpen(false); setForm({ name: '', email: '', password: '', confirm: '' }); setFormError(''); } }
  async function create(event) {
    event.preventDefault(); setFormError(''); setMessage('');
    if (form.password !== form.confirm) { setFormError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await requestAccounts({ action: 'create', name: form.name, email: form.email, password: form.password });
      setOpen(false); setForm({ name: '', email: '', password: '', confirm: '' });
      setMessage('Admin account created. They can sign in with their email and password.'); setLoading(true); setError(''); setRevision(value => value + 1);
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  async function deleteAccount() {
    setBusy(true); setFormError('');
    try {
      const result = await requestAccounts({ action: 'delete', id: remove.id });
      setRemove(null); setMessage(result.warning || 'Admin account removed. Member and audit history retained.'); setRevision(value => value + 1);
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  }
  return <><div className="page-heading"><h1 className="screen-title"><ShieldCheck aria-hidden="true" />Admin accounts</h1><Button variant="primary" onClick={() => { setFormError(''); setOpen(true); }}><UserPlus size={18} />Create Admin</Button></div>
    {error && <p className="error-banner" role="alert">{error} <Button onClick={() => { setLoading(true); setError(''); setRevision(value => value + 1); }}>Retry</Button></p>}
    {message && <p role="status" className="soft-note">{message}</p>}
    <section className="panel"><div className="table-scroll"><table className="member-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{accounts.map(row => <tr key={row.id}><td>{row.display_name}</td><td>{row.email || 'Not linked'}</td><td>{row.role_code === 'super_admin' ? 'Super Admin' : 'Admin'}</td><td>{row.enabled ? 'Enabled' : 'Disabled'}</td><td>{row.role_code === 'admin' && <Button onClick={() => { setFormError(''); setRemove(row); }}>Delete Admin</Button>}</td></tr>)}</tbody></table></div><p className="soft-note">{loading ? 'Loading accounts…' : 'Only Super Admin can manage Admin accounts. Member and audit history are preserved.'}</p></section>
    {remove && <Dialog title="Delete Admin account?" onClose={() => { if (!busy) setRemove(null); }}><div className="dialog-body"><p>{remove.display_name} · {remove.email}</p><p>This revokes access and removes their sign-in. Member records and audit history remain.</p>{formError && <p role="alert" className="form-error">{formError}</p>}</div><div className="dialog-footer"><Button disabled={busy} onClick={() => setRemove(null)}>Cancel</Button><Button disabled={busy} onClick={deleteAccount}>{busy ? 'Removing…' : 'Confirm deletion'}</Button></div></Dialog>}
    {open && <Dialog title="Create Admin" onClose={close}><form onSubmit={create}><div className="dialog-body form-grid">
      <Field label="Name"><input required maxLength={120} value={form.name} onChange={event => change('name', event.target.value)} /></Field>
      <Field label="Email"><input type="email" required maxLength={254} autoComplete="off" value={form.email} onChange={event => change('email', event.target.value)} /></Field>
      <Field label="Password" hint="6–128 characters. Share securely with the Admin."><input type="password" required minLength={6} maxLength={128} autoComplete="new-password" value={form.password} onChange={event => change('password', event.target.value)} /></Field>
      <Field label="Confirm password"><input type="password" required autoComplete="new-password" value={form.confirm} onChange={event => change('confirm', event.target.value)} /></Field>
      {formError && <p className="form-error span-two" role="alert">{formError}</p>}
    </div><div className="dialog-footer"><Button type="button" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Creating…' : 'Create Admin'}</Button></div></form></Dialog>}
  </>;
}
