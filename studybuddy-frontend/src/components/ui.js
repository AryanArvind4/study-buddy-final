import React, { useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api';

/* ---------- Icons (inline SVG, stroke-based) ---------- */

const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  logout: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><path d="M12 16.2v.3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m14 6 4 4" /></>,
  send: <><path d="M21 3 10 14" /><path d="m21 3-7 18-4-7-7-4z" /></>,
  shield: <><path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z" /><path d="m9 12 2 2 4-4" /></>,
};

export function Icon({ name, size = 18, className, strokeWidth = 1.8 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

/* ---------- Brand ---------- */

export function Brand({ to = '/' }) {
  return (
    <Link to={to} className="brand" aria-label="StudyBuddy home">
      <span className="brand-mark"><Icon name="book" size={16} strokeWidth={2.2} /></span>
      StudyBuddy
    </Link>
  );
}

/* ---------- Avatar ---------- */

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, large }) {
  return <span className={`avatar${large ? ' avatar-lg' : ''}`} aria-hidden="true">{initials(name)}</span>;
}

/* ---------- App shell (signed-in pages) ---------- */

const NAV = [
  { to: '/dashboard', label: 'Home', icon: 'home' },
  { to: '/matches', label: 'Matches', icon: 'users' },
  { to: '/edit-profile', label: 'Profile', icon: 'user' },
];

export function AppShell({ user, children }) {
  const navigate = useNavigate();

  async function logout() {
    try {
      await api('/logout', { method: 'POST' });
    } catch {
      // Even if the request fails, leave the signed-in area.
    }
    navigate('/');
  }

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="topnav">
        <div className="topnav-inner">
          <Brand to="/dashboard" />
          <nav className="nav-links" aria-label="Main">
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} className="nav-link">
                <Icon name={item.icon} size={17} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-user">
            {user && (
              <>
                <Avatar name={user.name} />
                <span className="nav-name small">{user.name}</span>
              </>
            )}
            <button type="button" className="btn btn-ghost btn-icon" onClick={logout} aria-label="Log out" title="Log out">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="app-main">{children}</main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} className="tab">
            <Icon name={item.icon} size={22} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

/* ---------- Feedback ---------- */

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  const icon = type === 'success' ? 'check' : 'alert';
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={16} />
      <div>{children}</div>
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="center-screen" role="status">
      <span className="loading"><span className="spinner" aria-hidden="true" />{label}</span>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" style={{ width: 16, height: 16 }} />;
}

export function EmptyState({ icon = 'search', title, children, action }) {
  return (
    <div className="card empty">
      <div className="icon-circle"><Icon name={icon} size={22} /></div>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ---------- Form pieces ---------- */

export function ToggleGroup({ legend, name, options, selected, onChange, icon }) {
  function toggle(value) {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  }
  return (
    <fieldset className="toggle-group">
      <legend className="visually-hidden">{legend}</legend>
      {options.map(option => (
        <label key={option} className="toggle">
          <input
            type="checkbox"
            name={name}
            value={option}
            checked={selected.includes(option)}
            onChange={() => toggle(option)}
          />
          <span>
            {selected.includes(option) && icon !== false && <Icon name="check" size={14} strokeWidth={2.4} />}
            {option}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/* ---------- Modal ---------- */

export function Modal({ title, description, onClose, children }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && dialogRef.current) {
        // Keep keyboard focus inside the dialog.
        const focusable = dialogRef.current.querySelectorAll(
          'button:not([disabled]), [href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p className="muted small" style={{ marginTop: 4 }}>{description}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Auth layout ---------- */

export function AuthLayout({ wide, children }) {
  return (
    <div className="auth">
      <div className={`auth-top${wide ? ' wide' : ''}`}>
        <Brand />
      </div>
      <main className={`auth-card${wide ? ' wide' : ''} fade-up`}>{children}</main>
    </div>
  );
}

/* ---------- Matching helpers ---------- */

// The similarity score is a ranking signal, not a probability, so show a plain label.
export function overlapLabel(similarity) {
  if (similarity >= 70) return { text: 'Strong overlap', tone: 'strong' };
  if (similarity >= 40) return { text: 'Good overlap', tone: 'good' };
  return { text: 'Some overlap', tone: 'some' };
}
