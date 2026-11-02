import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useCurrentUser } from '../hooks';
import { downloadIcs, fmtDay, fmtRange, fmtTime, fmtUntil, refreshActivity, SESSION_STATE } from '../utils';
import SessionModal from './SessionModal';
import {
  Alert, AppShell, Avatar, ConfirmModal, EmptyState, Icon, Loading, PageHead, Segmented, Spinner, useToast,
} from './ui';

export function DateBlock({ iso, muted }) {
  const d = new Date(iso);
  return (
    <span className={`date-block${muted ? ' muted' : ''}`} aria-hidden="true">
      <span className="mon">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
      <span className="day">{d.getDate()}</span>
    </span>
  );
}

export function StateBadge({ session }) {
  if (['awaiting', 'confirmed'].includes(session.state) && session.my_rsvp === 'pending') {
    return <span className="badge badge-good badge-dot">Reply needed</span>;
  }
  if (session.state === 'ended' && session.my_rsvp === 'going' && !session.my_checkin) {
    return <span className="badge badge-good badge-dot">Check in</span>;
  }
  if (session.my_rsvp === 'declined' && ['awaiting', 'confirmed'].includes(session.state)) {
    return <span className="badge badge-neutral">You declined</span>;
  }
  const s = SESSION_STATE[session.state];
  return <span className={`badge badge-${s.tone}`}>{s.label}</span>;
}

export function SessionRow({ s }) {
  const muted = ['ended', 'cancelled'].includes(s.state);
  return (
    <Link to={`/sessions/${s.id}`} className="session-row">
      <DateBlock iso={s.start_at} muted={muted} />
      <div className="grow">
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <span className="s-title" style={{ textDecoration: s.state === 'cancelled' ? 'line-through' : 'none' }}>{s.title}</span>
          <StateBadge session={s} />
        </div>
        <div className="s-meta">
          <span><Icon name="clock" size={13} />{fmtTime(s.start_at)} – {fmtTime(s.end_at)}</span>
          {s.location && <span><Icon name="pin" size={13} />{s.location}</span>}
          {s.link && <span><Icon name="link" size={13} />Online</span>}
          {!muted && <span>{fmtUntil(s.start_at)}</span>}
        </div>
        <div className="row-sm" style={{ marginTop: 10 }}>
          <span className="avatars">{s.participants.slice(0, 5).map(p => <Avatar key={p.id} name={p.name} size="sm" />)}</span>
          <span className="subtle xs">
            {s.participants.filter(p => p.rsvp === 'going').length} of {s.participants.length} going
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ----------------------------------------------------------------- list */

export function Sessions() {
  const { user, error: userError } = useCurrentUser();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    if (!user) return;
    api('/sessions').then(d => setSessions(d.sessions)).catch(err => setError(err.message));
  }, [user]);

  if (userError) return <AppShell><div className="page"><Alert>{userError}</Alert></div></AppShell>;
  if (!user) return <AppShell><Loading /></AppShell>;

  const list = sessions || [];
  const upcoming = list.filter(s => ['awaiting', 'confirmed', 'in_progress'].includes(s.state));
  const checkin = list.filter(s => s.state === 'ended' && s.my_rsvp === 'going' && !s.my_checkin);
  const past = list.filter(s => ['ended', 'cancelled'].includes(s.state)).reverse();
  const shown = tab === 'upcoming' ? upcoming : tab === 'checkin' ? checkin : past;

  return (
    <AppShell user={user}>
      <div className="page" style={{ maxWidth: 880 }}>
        <PageHead title="Sessions" description="Study sessions you've planned with partners and groups." />
        <div style={{ marginBottom: 16 }}>
          <Segmented label="Session filter" value={tab} onChange={setTab} options={[
            { value: 'upcoming', label: 'Upcoming', count: upcoming.filter(s => s.my_rsvp === 'pending').length },
            { value: 'checkin', label: 'To check in', count: checkin.length },
            { value: 'past', label: 'Past' },
          ]} />
        </div>
        {error && <Alert>{error}</Alert>}
        {!sessions && !error && (
          <div className="card">
            {[0, 1].map(i => (
              <div key={i} className="session-row">
                <div className="skeleton" style={{ width: 56, height: 58, borderRadius: 12 }} />
                <div className="grow"><div className="skeleton" style={{ height: 16, width: '50%', marginBottom: 10 }} /><div className="skeleton" style={{ height: 12, width: '70%' }} /></div>
              </div>
            ))}
          </div>
        )}
        {sessions && shown.length === 0 && (
          <EmptyState icon="calendar"
            title={tab === 'upcoming' ? 'No upcoming sessions' : tab === 'checkin' ? "You're all caught up" : 'No past sessions yet'}
            action={tab === 'upcoming' && <Link to="/inbox" className="btn btn-primary">Open inbox</Link>}>
            {tab === 'upcoming'
              ? 'Open a conversation with a study partner or group and choose “Plan session”.'
              : tab === 'checkin' ? 'Sessions you attend will show up here afterwards so you can note how it went.'
              : 'Finished and cancelled sessions will appear here.'}
          </EmptyState>
        )}
        {sessions && shown.length > 0 && (
          <div className="card">{shown.map(s => <SessionRow key={s.id} s={s} />)}</div>
        )}
      </div>
    </AppShell>
  );
}

/* --------------------------------------------------------------- detail */

function CheckinCard({ session, onSaved }) {
  const toast = useToast();
  const [attended, setAttended] = useState(session.my_checkin ? session.my_checkin.attended : null);
  const [note, setNote] = useState(session.my_checkin?.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (attended === null) return setError('Did the session happen?');
    setBusy(true);
    setError('');
    try {
      const d = await api(`/sessions/${session.id}/checkin`, { method: 'POST', body: { attended, note } });
      toast('Check-in saved');
      refreshActivity();
      onSaved(d.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad" aria-labelledby="ci-h">
      <h2 id="ci-h" style={{ fontSize: 15, marginBottom: 4 }}>How did it go?</h2>
      <p className="muted small" style={{ marginBottom: 14 }}>A quick note helps you plan the next one. Only you can see it.</p>
      <div className="choice-row" role="radiogroup" aria-label="Did the session happen?">
        <button type="button" role="radio" aria-checked={attended === true} className={`choice${attended === true ? ' on' : ''}`} onClick={() => setAttended(true)}>
          <Icon name="check" size={16} />We studied
        </button>
        <button type="button" role="radio" aria-checked={attended === false} className={`choice${attended === false ? ' on' : ''}`} onClick={() => setAttended(false)}>
          <Icon name="x" size={16} />It didn't happen
        </button>
      </div>
      <label className="label" htmlFor="ci-note" style={{ marginTop: 14 }}>What did you get done? <span className="subtle">(optional)</span></label>
      <textarea id="ci-note" className="textarea" maxLength={500} placeholder="e.g. Finished chapter 5, still stuck on recursion"
        value={note} onChange={e => setNote(e.target.value)} />
      {error && <div style={{ marginTop: 10 }}><Alert>{error}</Alert></div>}
      <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={save} disabled={busy}>
        {busy && <Spinner />}{session.my_checkin ? 'Update check-in' : 'Save check-in'}
      </button>
    </section>
  );
}

export function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, error: userError } = useCurrentUser();
  const [s, setS] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // 'edit' | 'rebook' | 'cancel'
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(() => new Set());

  const load = useCallback(() => {
    api(`/sessions/${id}`).then(d => setS(d.session)).catch(err => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Ticking the agenda is a personal checklist kept in this browser only.
  useEffect(() => {
    try {
      setDone(new Set(JSON.parse(localStorage.getItem(`sb-agenda-${id}`) || '[]')));
    } catch {
      setDone(new Set());
    }
  }, [id]);
  function toggleItem(i) {
    const next = new Set(done);
    if (next.has(i)) next.delete(i); else next.add(i);
    setDone(next);
    try {
      localStorage.setItem(`sb-agenda-${id}`, JSON.stringify([...next]));
    } catch {
      // Storage blocked: the tick still shows for this visit.
    }
  }

  async function rsvp(response) {
    setBusy(true);
    try {
      const d = await api(`/sessions/${id}/rsvp`, { method: 'POST', body: { response } });
      setS(d.session);
      toast(response === 'going' ? "You're going" : "We've let them know you can't make it");
      refreshActivity();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      const d = await api(`/sessions/${id}/cancel`, { method: 'POST' });
      setS(d.session);
      toast('Session cancelled');
      refreshActivity();
      setModal(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (userError || error) {
    return (
      <AppShell user={user}><div className="page">
        <Alert>{userError || error}</Alert>
        <Link to="/sessions" className="btn btn-secondary" style={{ marginTop: 16 }}>Back to sessions</Link>
      </div></AppShell>
    );
  }
  if (!user || !s) return <AppShell user={user}><Loading label="Loading session…" /></AppShell>;

  const open = ['awaiting', 'confirmed'].includes(s.state);
  const canManage = s.thread_type === 'connection' || s.is_creator;
  const threadLink = `/inbox/${s.thread_type}/${s.thread_id}`;

  return (
    <AppShell user={user}>
      <div className="page" style={{ maxWidth: 1000 }}>
        <Link to="/sessions" className="btn btn-ghost btn-sm" style={{ marginLeft: -10, marginBottom: 12 }}>
          <Icon name="arrowLeft" size={14} />All sessions
        </Link>

        <section className="card card-pad-lg" style={{ marginBottom: 16 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <DateBlock iso={s.start_at} muted={!open && s.state !== 'in_progress'} />
            <div className="grow">
              <div className="row-sm wrap" style={{ marginBottom: 4 }}>
                <StateBadge session={s} />
                {open && <span className="subtle small">{fmtUntil(s.start_at)}</span>}
              </div>
              <h1 style={{ fontSize: 24, letterSpacing: '-0.025em', textDecoration: s.state === 'cancelled' ? 'line-through' : 'none' }}>{s.title}</h1>
              <p className="muted small" style={{ marginTop: 4 }}>{fmtRange(s.start_at, s.end_at)}</p>
            </div>
          </div>

          {open && s.my_rsvp === 'pending' && (
            <div className="alert alert-info" style={{ marginTop: 20, alignItems: 'center' }}>
              <Icon name="calendar" size={16} />
              <div className="grow">Can you make it?</div>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => rsvp('going')}>I'm going</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => rsvp('declined')}>Can't make it</button>
            </div>
          )}

          <div className="row-sm wrap" style={{ marginTop: 20 }}>
            {open && s.my_rsvp === 'going' && (
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => rsvp('declined')}>Can't make it any more</button>
            )}
            {open && s.my_rsvp === 'declined' && (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => rsvp('going')}>I can make it after all</button>
            )}
            {s.state !== 'cancelled' && (
              <button type="button" className="btn btn-secondary" onClick={() => downloadIcs(s)}>
                <Icon name="download" size={15} />Add to calendar
              </button>
            )}
            <Link to={threadLink} className="btn btn-secondary"><Icon name="message" size={15} />Open chat</Link>
            {open && canManage && (
              <button type="button" className="btn btn-secondary" onClick={() => setModal('edit')}><Icon name="edit" size={14} />Change</button>
            )}
            {['ended', 'cancelled'].includes(s.state) && (
              <button type="button" className="btn btn-primary" onClick={() => setModal('rebook')}>
                <Icon name="calendar" size={15} />Book again
              </button>
            )}
            {open && canManage && (
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger-text)' }} onClick={() => setModal('cancel')}>Cancel session</button>
            )}
          </div>
        </section>

        <div className="detail-grid">
          <div className="dash-col">
            {(s.state === 'ended' || s.state === 'in_progress') && s.my_rsvp !== 'declined' && (
              <CheckinCard session={s} onSaved={setS} />
            )}
            <section className="card card-pad" aria-labelledby="ag-h">
              <h2 id="ag-h" style={{ fontSize: 15, marginBottom: 12 }}>Agenda</h2>
              {s.agenda.length ? (
                <ul className="agenda">
                  {s.agenda.map((item, i) => (
                    <li key={i} className={done.has(i) ? 'done' : ''}>
                      <input type="checkbox" id={`ag-${i}`} checked={done.has(i)} onChange={() => toggleItem(i)} />
                      <label htmlFor={`ag-${i}`} style={{ cursor: 'pointer' }}><span>{item}</span></label>
                    </li>
                  ))}
                </ul>
              ) : <span className="none">No agenda yet. {open && canManage ? 'Add one with “Change”.' : ''}</span>}
            </section>
          </div>

          <div className="dash-col">
            <section className="card card-pad">
              <div className="info-row"><Icon name="clock" size={16} /><div>{fmtDay(s.start_at)}<div className="subtle small">{fmtTime(s.start_at)} – {fmtTime(s.end_at)} · {s.duration_min} min</div></div></div>
              {s.location && <div className="info-row"><Icon name="pin" size={16} /><div>{s.location}</div></div>}
              {s.link && (
                <div className="info-row"><Icon name="link" size={16} />
                  <a href={s.link} target="_blank" rel="noopener noreferrer" className="truncate" style={{ display: 'block' }}>{s.link}</a>
                </div>
              )}
            </section>
            <section className="card card-pad" aria-labelledby="pp-h">
              <h2 id="pp-h" style={{ fontSize: 15, marginBottom: 8 }}>{s.state === 'ended' ? 'Who was invited' : "Who's coming"}</h2>
              {s.participants.map(p => (
                <div key={p.id} className="person-row">
                  <Avatar name={p.name} />
                  <div className="grow">
                    <div className="small strong truncate">{p.name}{p.id === user._id ? ' (you)' : ''}</div>
                    <div className="subtle xs truncate">{p.id === s.creator_id ? 'Planned this session' : p.department}</div>
                  </div>
                  <span className={`badge ${p.rsvp === 'going' ? 'badge-strong' : p.rsvp === 'declined' ? 'badge-danger' : 'badge-neutral'}`}>
                    {p.rsvp === 'going' ? 'Going' : p.rsvp === 'declined' ? "Can't" : 'No reply'}
                  </span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>

      {modal === 'edit' && <SessionModal mode="edit" session={s} onClose={() => setModal(null)} onSaved={setS} />}
      {modal === 'rebook' && (
        <SessionModal mode="rebook" session={s} thread={{ type: s.thread_type, id: s.thread_id, title: 'your partner' }}
          onClose={() => setModal(null)} onSaved={ns => navigate(`/sessions/${ns.id}`)} />
      )}
      {modal === 'cancel' && (
        <ConfirmModal title="Cancel this session?" confirmLabel="Cancel session" danger busy={busy}
          onConfirm={cancel} onClose={() => setModal(null)}>
          Everyone invited will see that it's cancelled, and a note is posted in your chat.
        </ConfirmModal>
      )}
    </AppShell>
  );
}
