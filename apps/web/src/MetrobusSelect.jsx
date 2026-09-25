import React, {useEffect, useId, useRef, useState} from 'react';
import {ChevronDown, Check, Search} from 'lucide-react';

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export default function MetrobusSelect({label, value, options, onChange, disabled = false, placeholder = 'Selecciona una parada', icon}) {
  const id = useId();
  const container = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find(option => option.value === value);
  const matches = options.filter(option => normalize(option.label).includes(normalize(query)));
  useEffect(() => {
    if (!open) return;
    const close = event => {if (!container.current?.contains(event.target)) setOpen(false);};
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const choose = option => {
    onChange(option.value); setQuery(''); setOpen(false);
  };
  return <div className="picker metrobus-picker mb-select" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <label htmlFor={id}>{label}</label>
    <div className="input-wrap">
      <span className="metrobus-picker-icon">{icon || <Search size={18}/>}</span>
      <input id={id} role="combobox" autoComplete="off" disabled={disabled} value={open ? query : selected?.label || ''}
        placeholder={placeholder} aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${id}-option-${active}` : undefined}
        onFocus={() => {setQuery(''); setActive(0); setOpen(true);}}
        onClick={() => setOpen(true)}
        onChange={event => {setQuery(event.target.value); setActive(0); setOpen(true);}}
        onKeyDown={event => {
          if (event.key === 'Escape') {setOpen(false); return;}
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
          }
          if (event.key === 'Enter' && open) {event.preventDefault(); if (matches[active]) choose(matches[active]);}
        }}/>
      {selected?.color && !open && <span className="mb-select-dot" style={{background: selected.color}}/>}
      <ChevronDown size={18} className={open ? 'open' : ''} aria-hidden="true"/>
    </div>
    {open && !disabled && <div className="options metrobus-options mb-select-menu" id={`${id}-options`} role="listbox" aria-label={label}>
      {matches.map((option, index) => <button key={option.value} type="button" id={`${id}-option-${index}`}
        role="option" aria-selected={value === option.value} tabIndex={-1} className={active === index ? 'mb-option-active' : ''}
        ref={element => {if (element && active === index) element.scrollIntoView?.({block: 'nearest'});}}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
        <span>{option.color && <i className="mb-select-dot" style={{background: option.color}}/>}{option.label}{option.description && <small>{option.description}</small>}</span>
        {value === option.value && <Check size={16}/>}
      </button>)}
      {!matches.length && <p role="status">No encontramos coincidencias.</p>}
    </div>}
  </div>;
}
