import { useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDate, parseDisplayDate } from './domain.js';

export function DateInput({ value = '', onChange, min, max, required, 'aria-label': label, ...props }) {
  const picker = useRef(null);
  const [draft, setDraft] = useState({ value, text: value ? formatDate(value) : '' });
  if (draft.value !== value) setDraft({ value, text: value ? formatDate(value) : '' });
  const update = (text, iso) => {
    setDraft({ text, value: iso });
    onChange({ target: { value: iso } });
  };
  const invalid = draft.text && (!parseDisplayDate(draft.text) || (min && value < min) || (max && value > max));
  return <span className="date-input">
    <input {...props} aria-label={label} type="text" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10}
      required={required} value={draft.text} pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
      ref={node => node?.setCustomValidity(invalid ? `Enter a valid date in DD/MM/YYYY${min ? `, from ${formatDate(min)}` : ''}${max ? `, up to ${formatDate(max)}` : ''}.` : '')}
      onChange={event => {
        let text = event.target.value;
        if (text.length > draft.text.length && /^[0-9/]+$/.test(text) && !text.endsWith('/')) {
          const digits = text.replaceAll('/', '').slice(0, 8);
          text = digits.slice(0, 2) + (digits.length > 2 ? '/' + digits.slice(2, 4) : '') + (digits.length > 4 ? '/' + digits.slice(4) : '');
        }
        update(text, parseDisplayDate(text));
      }} />
    <button type="button" className="date-picker-button" title="Choose date" aria-label={label ? `Choose ${label.toLowerCase()}` : 'Choose date'}
      onClick={() => picker.current?.showPicker?.()}><CalendarDays size={17}/></button>
    <input ref={picker} className="native-date-picker" type="date" tabIndex={-1} aria-hidden="true"
      value={value} min={min} max={max} onChange={event => update(event.target.value ? formatDate(event.target.value) : '', event.target.value)} />
  </span>;
}
