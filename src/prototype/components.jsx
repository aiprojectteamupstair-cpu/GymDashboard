import { cloneElement, useContext, useEffect, useId, useRef } from 'react';
import { MutationContext } from './mutationContext.js';
import { X, Search, ArrowUpRight, Users, CheckCircle2 } from 'lucide-react';

export function Button({ children, variant = 'secondary', className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function Avatar({ member, large = false }) {
  const letters = member.full_name.split(/\s+/).slice(0, 2).map(s => s[0]).join('');
  return <span className={`avatar avatar-${member.category_id} ${large ? 'avatar-large' : ''}`} aria-hidden="true">{letters}</span>;
}

export function Badge({ children, type = '' }) {
  return <span className={`badge badge-${(type || String(children)).toLowerCase().replaceAll(' ', '-')}`}><span className="badge-dot" />{children}</span>;
}

export function SearchField({ value, onChange, placeholder = 'Search members...', label = 'Search members', autoFocus = false }) {
  return <div className="search-field"><Search size={18} /><input aria-label={label} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />{value && <button aria-label="Clear search" onClick={() => onChange('')}><X size={16} /></button>}</div>;
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}

export function EmptyState({ title = 'No members found', message = 'Try a different name, member code or filter.', action }) {
  return <div className="empty-state"><div className="empty-icon"><Users size={24} /></div><h3>{title}</h3><p>{message}</p>{action}</div>;
}

export function StatCard({ label, value, description, icon: Icon, accent = false, onClick }) {
  const Tag = onClick ? 'button' : 'section';
  return <Tag className={`stat-card ${accent ? 'stat-accent' : ''} ${onClick ? 'stat-link' : ''}`} {...(onClick ? { onClick, type: 'button', 'aria-label': `View ${label.toLowerCase()}` } : {})}><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={20} /></span></div><strong>{value}</strong><div className="stat-bottom"><span>{description}</span>{onClick && <ArrowUpRight size={17} />}</div></Tag>;
}

export function Dialog({ title, subtitle, onClose, children, wide = false }) {
  const mutation = useContext(MutationContext);
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = ref.current;
    const scrollY = window.scrollY;
    const body = document.body;
    const saved = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    const rootOverflow = document.documentElement.style.overflow;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      Object.assign(body.style, saved);
      document.documentElement.style.overflow = rootOverflow;
      window.scrollTo({ top: scrollY, behavior: 'instant' });
    };
  }, []);
  return <dialog ref={ref} className={`app-dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby={titleId} aria-busy={mutation.busy} onCancel={e => { e.preventDefault(); if (!mutation.busy) onClose(); }}>
    <div className="dialog-heading"><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button disabled={mutation.busy} className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21} /></button></div>
    {mutation.error && <p role="alert" className="form-error">{mutation.error}</p>}
    {mutation.busy && <p role="status" className="soft-note">Saving securely… Please keep this dialog open.</p>}
    <fieldset disabled={mutation.busy} style={{ display: 'contents' }}>{children}</fieldset>
  </dialog>;
}

export function Field({ label, children, hint, className = '' }) {
  const generatedId = useId();
  const inputId = children.props.id || generatedId;
  const hintId = `${inputId}-hint`;
  return <div className={`field ${className}`}><label htmlFor={inputId}>{label}</label>{cloneElement(children, { id: inputId, ...(hint ? { 'aria-describedby': hintId } : {}) })}{hint && <small id={hintId}>{hint}</small>}</div>;
}
