import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api';

/* ==========================================================================
   Icons — 24px stroke icons drawn to a consistent grid
   ========================================================================== */

const ICONS = {
  home: <><path d="M3.5 10.2 12 3.5l8.5 6.7" /><path d="M5.5 8.8V20h13V8.8" /><path d="M10 20v-5.5h4V20" /></>,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6" /><path d="M17.6 14.4A6.2 6.2 0 0 1 21.2 20" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  logout: <><path d="M14.5 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4" /><path d="m9.5 8-4 4 4 4" /><path d="M5.5 12H15" /></>,
  book: <><path d="M4.5 19V5.5A2 2 0 0 1 6.5 3.5h13v14h-13a2 2 0 0 0-2 2z" /><path d="M4.5 19.5a2 2 0 0 0 2 2h13v-4" /></>,
  pin: <><path d="M12 21.5s-7-6-7-11.7a7 7 0 0 1 14 0c0 5.7-7 11.7-7 11.7z" /><circle cx="12" cy="9.8" r="2.6" /></>,
  clock: <><circle cx="12" cy="12" r="8.8" /><path d="M12 7.2V12l3.2 2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  copy: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <><path d="M6.5 6.5l11 11" /><path d="M17.5 6.5l-11 11" /></>,
  search: <><circle cx="11" cy="11" r="6.8" /><path d="m20 20-4.2-4.2" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  arrowUpRight: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  alert: <><circle cx="12" cy="12" r="8.8" /><path d="M12 7.8v4.8" /><path d="M12 16.2h.01" /></>,
  send: <><path d="M21 3 10.5 13.5" /><path d="m21 3-6.5 18-4-7.5L3 9.5z" /></>,
  shield: <><path d="M12 3.2 4.8 6v5.6c0 4.4 3 8 7.2 9.2 4.2-1.2 7.2-4.8 7.2-9.2V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  sparkles: <><path d="M12 3.5 13.6 8.4 18.5 10 13.6 11.6 12 16.5 10.4 11.6 5.5 10 10.4 8.4z" /><path d="M18.5 15.5 19.2 17.3 21 18 19.2 18.7 18.5 20.5 17.8 18.7 16 18 17.8 17.3z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  monitor: <><rect x="3" y="4" width="18" height="12.5" rx="2" /><path d="M8.5 20h7" /><path d="M12 16.5V20" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17" /><path d="M8 3v4M16 3v4" /></>,
  target: <><circle cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></>,
  layers: <><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8z" /><path d="m3.5 12.2 8.5 4.5 8.5-4.5" /><path d="m3.5 16.3 8.5 4.5 8.5-4.5" /></>,
  zap: <path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z" />,
  graduation: <><path d="M2.5 9 12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5" /><path d="M21.5 9v5" /></>,
  edit: <><path d="M4 20h4.2L19.4 8.8a2.1 2.1 0 0 0-3-3L5.2 17v3z" /><path d="m14.5 7.5 3 3" /></>,
};

export function Icon({ name, size = 16, className, strokeWidth = 1.7, style }) {
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}

/* ==========================================================================
   Brand
   ========================================================================== */

export function LogoMark({ size = 28 }) {
  // Unique gradient id per instance: a hidden copy (e.g. the desktop sidebar on mobile) can't own it.
  const gid = `sb-g-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.55" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gid})`} />
      <circle cx="12.5" cy="13" r="4.2" fill="#fff" fillOpacity="0.95" />
      <circle cx="19.5" cy="13" r="4.2" fill="#fff" fillOpacity="0.6" />
      <path d="M8 23.5c1.2-2.6 3.4-4 6-4h4c2.6 0 4.8 1.4 6 4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Logo({ to = '/', size = 28 }) {
  return (
    <Link to={to} className="row-sm logo" aria-label="StudyBuddy home"
      style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em' }}>
      <LogoMark size={size} />
      StudyBuddy
    </Link>
  );
}

/* ==========================================================================
   Avatar — deterministic gradient per name
   ========================================================================== */

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hue(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({ name, size = '' }) {
  const h = hue(name);
  const style = { background: `linear-gradient(135deg, hsl(${h} 70% 60%), hsl(${(h + 40) % 360} 70% 48%))` };
  return <span className={`avatar${size ? ` avatar-${size}` : ''}`} style={style} aria-hidden="true">{initials(name)}</span>;
}

/* ==========================================================================
   Theme
   ========================================================================== */

function readTheme() {
  try {
    const t = localStorage.getItem('sb-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState(readTheme);
  const setTheme = useCallback(next => {
    setThemeState(next);
    try {
      if (next === 'system') localStorage.removeItem('sb-theme');
      else localStorage.setItem('sb-theme', next);
    } catch {
      // Storage may be blocked; the choice still applies for this visit.
    }
    if (next === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', next);
    window.dispatchEvent(new CustomEvent('sb-theme', { detail: next }));
  }, []);
  // Keep every toggle on the page in sync.
  useEffect(() => {
    const sync = e => setThemeState(e.detail);
    window.addEventListener('sb-theme', sync);
    return () => window.removeEventListener('sb-theme', sync);
  }, []);
  return [theme, setTheme];
}

export function ThemeToggle({ compact }) {
  const [theme, setTheme] = useTheme();
  const order = ['system', 'light', 'dark'];
  const next = order[(order.indexOf(theme) + 1) % order.length];
  const icon = theme === 'light' ? 'sun' : theme === 'dark' ? 'moon' : 'monitor';
  const label = `Theme: ${theme}. Switch to ${next}.`;
  return (
    <button type="button" className={`btn btn-ghost ${compact ? 'btn-icon' : 'btn-sm'}`} onClick={() => setTheme(next)}
      aria-label={label} title={label}>
      <Icon name={icon} size={16} />
      {!compact && <span style={{ textTransform: 'capitalize' }}>{theme}</span>}
    </button>
  );
}

/* ==========================================================================
   Toasts
   ========================================================================== */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon"><Icon name={t.type === 'error' ? 'x' : 'check'} size={12} strokeWidth={2.6} /></span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ==========================================================================
   App shell — sidebar on desktop, top bar + tab bar on mobile
   ========================================================================== */

const NAV = [
  { to: '/dashboard', label: 'Home', icon: 'home' },
  { to: '/matches', label: 'Matches', icon: 'users' },
  { to: '/edit-profile', label: 'Profile', icon: 'settings' },
];

/** How complete a profile is, for the sidebar meter. Simple, explainable rules. */
export function profileStrength(user) {
  if (!user) return 0;
  let score = 0;
  score += Math.min((user.course_ids?.length || 0) / 3, 1) * 50;
  score += Math.min((user.study_times?.length || 0) / 2, 1) * 30;
  score += Math.min((user.study_spots?.length || 0) / 2, 1) * 20;
  return Math.round(score);
}

export function AppShell({ user, matchCount, children }) {
  const navigate = useNavigate();
  const strength = profileStrength(user);

  async function logout() {
    try {
      await api('/logout', { method: 'POST' });
    } catch {
      // Leave the signed-in area even if the request fails.
    }
    navigate('/');
  }

  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>

      <aside className="sidebar" aria-label="Sidebar">
        <Logo to="/dashboard" />
        <nav className="side-section" aria-label="Main">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} className="side-link">
              <Icon name={item.icon} size={17} />
              {item.label}
              {item.to === '/matches' && matchCount > 0 && <span className="count">{matchCount}</span>}
            </NavLink>
          ))}
        </nav>

        {user && strength < 100 && (
          <div className="side-callout">
            <div className="between">
              <span className="strong">Profile strength</span>
              <span className="subtle xs">{strength}%</span>
            </div>
            <div className="bar"><span style={{ width: `${strength}%` }} /></div>
            <p className="subtle xs">Add 3+ courses and 2+ times for better matches.</p>
            <Link to="/edit-profile" className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 10 }}>Improve profile</Link>
          </div>
        )}

        <div className="side-user" style={{ marginTop: user && strength < 100 ? 0 : 'auto' }}>
          {user ? <Avatar name={user.name} /> : <span className="avatar skeleton" />}
          <div className="who">
            <div className="name truncate">{user?.name || ' '}</div>
            <div className="email truncate">{user?.email || ' '}</div>
          </div>
          <ThemeToggle compact />
          <button type="button" className="btn btn-ghost btn-icon" onClick={logout} aria-label="Log out" title="Log out">
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Logo to="/dashboard" size={26} />
        <div className="row-sm">
          <ThemeToggle compact />
          <button type="button" className="btn btn-ghost btn-icon" onClick={logout} aria-label="Log out">
            <Icon name="logout" />
          </button>
          {user && <Avatar name={user.name} size="sm" />}
        </div>
      </header>

      <main id="main" className="main">{children}</main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} className="tab">
            <Icon name={item.icon} size={21} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHead({ title, description, actions }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="row-sm">{actions}</div>}
    </header>
  );
}

/* ==========================================================================
   Feedback
   ========================================================================== */

export function Alert({ type = 'error', children }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon name={type === 'success' ? 'check' : 'alert'} size={16} />
      <div>{children}</div>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="center-screen" role="status">
      <span className="row-sm"><Spinner />{label}</span>
    </div>
  );
}

export function EmptyState({ icon = 'search', title, children, action }) {
  return (
    <div className="card empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ==========================================================================
   Overlap ring — the score ranks matches; it isn't a probability, so we show a label
   ========================================================================== */

export function overlapLabel(similarity) {
  if (similarity >= 70) return { text: 'Strong overlap', short: 'Strong', tone: 'strong', color: '#16a34a' };
  if (similarity >= 40) return { text: 'Good overlap', short: 'Good', tone: 'good', color: '#6366f1' };
  return { text: 'Some overlap', short: 'Some', tone: 'some', color: '#a1a1aa' };
}

export function OverlapRing({ similarity = 0, size = 56, stroke = 5, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, similarity))));
    return () => cancelAnimationFrame(t);
  }, [similarity]);
  const label = overlapLabel(similarity);
  const gid = `ring-${useId().replace(/:/g, '')}`;
  return (
    <span className="ring" style={{ width: size, height: size }} title={`${label.text} (score ${similarity})`}>
      <svg width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="60%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="bar" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          stroke={`url(#${gid})`} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} />
      </svg>
      <span className="ring-label">{children}</span>
    </span>
  );
}

/* ==========================================================================
   Form pieces
   ========================================================================== */

export function PillGroup({ legend, name, options, selected, onChange }) {
  function toggle(value) {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  }
  return (
    <fieldset className="pill-group">
      <legend className="visually-hidden">{legend}</legend>
      {options.map(option => (
        <label key={option} className="pill">
          <input type="checkbox" name={name} value={option} checked={selected.includes(option)} onChange={() => toggle(option)} />
          <span>
            <span className="check"><Icon name="check" size={11} strokeWidth={3} /></span>
            {option}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return <span id={id} className="error-text"><Icon name="alert" size={14} />{children}</span>;
}

/* ==========================================================================
   Modal — focus trapped, Esc to close, restores focus
   ========================================================================== */

export function Modal({ title, description, onClose, children, footer }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialogRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab' && dialogRef.current) {
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
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} ref={dialogRef}>
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p className="muted small" style={{ marginTop: 4 }}>{description}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ==========================================================================
   Auth layout — form on the left, brand panel on the right
   ========================================================================== */

export function AuthLayout({ children, wide, topRight }) {
  return (
    <div className="auth">
      <div className="auth-main">
        <div className="auth-top">
          <Logo />
          <div className="row-sm">
            {topRight}
            <ThemeToggle compact />
          </div>
        </div>
        <div className="auth-form-wrap">
          <main className={`auth-form${wide ? ' wide' : ''}`}>{children}</main>
        </div>
        <p className="auth-foot">Only for National Tsing Hua University students.</p>
      </div>

      <aside className="auth-aside" aria-hidden="true">
        <div className="row-sm" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
          <Icon name="graduation" size={16} /> Built for NTHU · 國立清華大學
        </div>
        <div>
          <h2>Study better with people in your courses.</h2>
          <div className="points">
            <div className="point">
              <span className="pi"><Icon name="shield" size={15} /></span>
              <span><b>Verified students only</b>Every account is confirmed with an nthu.edu.tw email.</span>
            </div>
            <div className="point">
              <span className="pi"><Icon name="target" size={15} /></span>
              <span><b>Matches you can understand</b>See the exact courses, places and times you share.</span>
            </div>
            <div className="point">
              <span className="pi"><Icon name="lock" size={15} /></span>
              <span><b>No passwords</b>Log in with a one-time code sent to your school email.</span>
            </div>
          </div>
        </div>
        <div className="glass">
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="row-sm">
              <Avatar name="Example Classmate" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Example classmate</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Computer Science</div>
              </div>
            </div>
            <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', borderColor: 'rgba(34,197,94,0.3)' }}>Strong overlap</span>
          </div>
          <div className="chips">
            <span className="chip"><Icon name="book" size={13} />Data Structures</span>
            <span className="chip"><Icon name="clock" size={13} />Evening</span>
            <span className="chip"><Icon name="pin" size={13} />Library</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
