import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { Icon } from './ui';

/**
 * Search NTHU courses by code or name, or add one by hand.
 * `value` is the list of selected course codes; `names` maps code -> display name.
 */
function CourseSelector({ id = 'courses', value, onChange, names = {}, onNamesChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(-1);
  const requestId = useRef(0);
  const wrapperRef = useRef(null);

  // Debounced search; ignores responses that arrive out of order.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const current = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const data = await api(`/search_courses?q=${encodeURIComponent(q)}`);
        if (current === requestId.current) setResults(data.courses || []);
      } catch {
        if (current === requestId.current) setResults([]);
      } finally {
        if (current === requestId.current) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const trimmed = query.trim();
  const options = results.slice(0, 8).map(c => ({
    code: c.code,
    label: c.name_en || c.name_zh || c.display,
    sub: c.name_en && c.name_zh ? c.name_zh : '',
  }));
  const showManual = trimmed.length >= 2 && !searching && !options.some(o => o.code === trimmed);
  const total = options.length + (showManual ? 1 : 0);

  function add(code, label) {
    if (!value.includes(code)) {
      onChange([...value, code]);
      if (onNamesChange && label) onNamesChange({ ...names, [code]: label });
    }
    setQuery('');
    setOpen(false);
    setActive(-1);
  }

  function remove(code) {
    onChange(value.filter(c => c !== code));
  }

  function choose(index) {
    if (index < options.length) add(options[index].code, options[index].label);
    else if (showManual) add(trimmed, trimmed);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' && total > 0) {
      e.preventDefault();
      setOpen(true);
      setActive(i => (i + 1) % total);
    } else if (e.key === 'ArrowUp' && total > 0) {
      e.preventDefault();
      setActive(i => (i <= 0 ? total - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (!trimmed) return;
      e.preventDefault();
      if (active >= 0) choose(active);
      else if (options.length === 1) choose(0);
      else if (options.length === 0 && showManual) add(trimmed, trimmed);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const listId = `${id}-listbox`;
  const expanded = open && trimmed.length >= 2;

  return (
    <div ref={wrapperRef}>
      <div className="combo">
        <div className="input-icon">
          <Icon name="search" size={16} />
          <input
            id={id}
            className="input"
            type="text"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            placeholder="Search by course code or name, e.g. CS 2351 or Calculus"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
        </div>
        {expanded && (
          <ul className="combo-list" id={listId} role="listbox">
            {searching && options.length === 0 && (
              <li className="combo-status" role="status">Searching…</li>
            )}
            {options.map((o, i) => (
              <li key={o.code} role="option" id={`${id}-opt-${i}`} aria-selected={active === i}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`combo-option${active === i ? ' active' : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => choose(i)}
                >
                  <span className="code">{o.code}</span>
                  <span className="grow">
                    <span className="name truncate">{o.label}</span>
                    {o.sub && <span className="sub truncate">{o.sub}</span>}
                  </span>
                </button>
              </li>
            ))}
            {showManual && (
              <li role="option" id={`${id}-opt-${options.length}`} aria-selected={active === options.length}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`combo-option add${active === options.length ? ' active' : ''}`}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => add(trimmed, trimmed)}
                >
                  <span className="code" style={{ display: 'grid', placeItems: 'center', width: 26, padding: 0, height: 22 }}><Icon name="plus" size={13} /></span>
                  <span className="grow">
                    <span className="name">Add “{trimmed}”</span>
                    <span className="sub">Can't find it? Add the course by name.</span>
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {value.length > 0 ? (
        <ul className="chips" style={{ marginTop: 12 }} aria-label="Selected courses">
          {value.map(code => (
            <li key={code} className="chip chip-accent">
              <Icon name="book" size={13} />
              <span className="chip-text" title={names[code] ? `${code} · ${names[code]}` : code}>
                {names[code] && names[code] !== code ? names[code] : code}
              </span>
              <button
                type="button"
                className="chip-remove"
                onClick={() => remove(code)}
                aria-label={`Remove ${names[code] || code}`}
              >
                <Icon name="x" size={12} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No courses added yet. Search above, or type a name and press Enter.</p>
      )}
    </div>
  );
}

export default CourseSelector;
