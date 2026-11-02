import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCourseNames, useCurrentUser } from '../hooks';
import { refreshActivity } from '../utils';
import {
  AppShell, Alert, Avatar, EmptyState, Icon, Modal, OverlapRing, PageHead, Spinner, overlapLabel, useToast,
} from './ui';

function Reason({ icon, title, items, render = x => x, accent }) {
  return (
    <div className="reason">
      <Icon name={icon} size={15} />
      <div>
        <div className="reason-title">{title}</div>
        {items.length ? (
          <div className="chips">
            {items.map(item => (
              <span key={item} className={`chip${accent ? ' chip-accent' : ''}`}><span className="chip-text">{render(item)}</span></span>
            ))}
          </div>
        ) : <span className="none">Nothing in common yet</span>}
      </div>
    </div>
  );
}

function suggestedNote(match, courseName) {
  if (match.shared_courses.length) {
    return `Hi ${match.name.split(' ')[0]}! We're both taking ${courseName(match.shared_courses[0])}. Want to study together sometime?`;
  }
  return `Hi ${match.name.split(' ')[0]}! Looks like we have similar study habits. Want to study together sometime?`;
}

function RequestModal({ match, courseName, onClose, onSent }) {
  const [note, setNote] = useState(() => suggestedNote(match, courseName));
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const first = match.name.split(' ')[0];

  async function send() {
    setStatus('sending');
    setError('');
    try {
      const d = await api('/connections', { method: 'POST', body: { user_id: match.student_id, note: note.trim() } });
      refreshActivity();
      onSent(match.student_id, d.connection);
      onClose();
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  return (
    <Modal
      title={`Connect with ${first}`}
      description={`If ${first} accepts, you can chat and plan sessions on StudyBuddy. Email addresses stay private.`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={send} disabled={status === 'sending'}>
            {status === 'sending' ? <><Spinner /> Sending…</> : <><Icon name="send" size={15} />Send request</>}
          </button>
        </>
      )}
    >
      <div className="stack">
        <div className="row" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-subtle)' }}>
          <Avatar name={match.name} size="lg" />
          <div className="grow">
            <div className="strong truncate">{match.name}</div>
            <div className="subtle small truncate">{match.department}</div>
          </div>
          <OverlapRing similarity={match.similarity} size={40} stroke={4} />
        </div>
        <div>
          <label className="label" htmlFor="req-note">Add a note <span className="subtle">(optional)</span></label>
          <textarea id="req-note" className="textarea" maxLength={300} value={note} onChange={e => setNote(e.target.value)} />
          <div className="counter">{note.length}/300</div>
        </div>
        <Alert>{error}</Alert>
      </div>
    </Modal>
  );
}

function ConnectButton({ match, onRequest, block }) {
  const navigate = useNavigate();
  const c = match.connection;
  const cls = `btn ${block ? 'btn-block ' : ''}`;
  if (c?.status === 'accepted') {
    return (
      <button type="button" className={`${cls}btn-primary`} onClick={() => navigate(`/inbox/connection/${c.connection_id}`)}>
        <Icon name="message" size={15} />Message
      </button>
    );
  }
  if (c?.status === 'pending' && c.direction === 'outgoing') {
    return <button type="button" className={`${cls}btn-secondary`} disabled><Icon name="clock" size={15} />Request sent</button>;
  }
  if (c?.status === 'pending' && c.direction === 'incoming') {
    return (
      <button type="button" className={`${cls}btn-primary`} onClick={() => navigate('/inbox')}>
        <Icon name="inbox" size={15} />Respond to request
      </button>
    );
  }
  return (
    <button type="button" className={`${cls}${block ? 'btn-secondary' : 'btn-primary'}`} onClick={() => onRequest(match)}>
      <Icon name="send" size={15} />Connect
    </button>
  );
}

function MatchCard({ match, courseName, onRequest, featured }) {
  const label = overlapLabel(match.similarity);
  const reasons = (
    <>
      <Reason icon="book" title="Shared courses" items={match.shared_courses} render={courseName} accent />
      <Reason icon="clock" title="Both usually free" items={match.shared_times} />
      <Reason icon="pin" title="Places you both like" items={match.shared_spots} />
    </>
  );

  if (featured) {
    return (
      <article className="card match-feature reveal" aria-labelledby={`m-${match.student_id}`}>
        <div style={{ textAlign: 'center' }}>
          <OverlapRing similarity={match.similarity} size={128} stroke={9}>
            <Avatar name={match.name} size="xl" />
          </OverlapRing>
          <div style={{ marginTop: 12 }}><span className={`badge badge-${label.tone} badge-dot`}>{label.text}</span></div>
        </div>
        <div className="stack">
          <div>
            <div className="eyebrow" style={{ color: 'var(--accent-text)' }}>Best match</div>
            <h2 id={`m-${match.student_id}`} style={{ fontSize: 22, marginTop: 4 }}>{match.name}</h2>
            <p className="muted small">{match.department}</p>
          </div>
          <div className="stack">{reasons}</div>
          <div className="row-sm wrap"><ConnectButton match={match} onRequest={onRequest} /></div>
        </div>
      </article>
    );
  }

  return (
    <article className="card card-interactive match-card reveal reveal-1" aria-labelledby={`m-${match.student_id}`}>
      <div className="mc-top">
        <OverlapRing similarity={match.similarity} size={54} stroke={4}>
          <Avatar name={match.name} size="lg" />
        </OverlapRing>
        <div className="grow">
          <h2 id={`m-${match.student_id}`} className="truncate" style={{ fontSize: 15.5 }}>{match.name}</h2>
          <p className="subtle small truncate">{match.department}</p>
        </div>
        <span className={`badge badge-${label.tone}`}>{label.short}</span>
      </div>
      <div className="mc-body">{reasons}</div>
      <div className="mc-foot"><ConnectButton match={match} onRequest={onRequest} block /></div>
    </article>
  );
}

function Matches() {
  const toast = useToast();
  const { user, error: userError } = useCurrentUser();
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    api('/get_matches')
      .then(d => setMatches(d.matches || []))
      .catch(err => {
        setError(err.message);
        setMatches([]);
      });
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const sharedCodes = useMemo(() => (matches || []).flatMap(m => m.shared_courses), [matches]);
  const [courseNames] = useCourseNames(sharedCodes);
  const courseName = code => courseNames[code] || code;

  function onSent(studentId, connection) {
    setMatches(ms => ms.map(m => (m.student_id === studentId
      ? { ...m, connection: { status: 'pending', direction: 'outgoing', connection_id: connection.id } }
      : m)));
    toast(`Request sent to ${connection.other.name.split(' ')[0]}`);
  }

  let content;
  if (userError || error) {
    content = <Alert>{userError || error}</Alert>;
  } else if (!user || matches === null) {
    content = (
      <div className="card match-feature" aria-busy="true">
        <div className="skeleton" style={{ width: 128, height: 128, borderRadius: '50%' }} />
        <div className="stack">
          <div className="skeleton" style={{ height: 22, width: '40%' }} />
          <div className="skeleton" style={{ height: 14, width: '60%' }} />
          <div className="skeleton" style={{ height: 70 }} />
        </div>
      </div>
    );
  } else if (matches.length === 0) {
    content = (
      <EmptyState icon="users" title="No matches yet"
        action={<Link to="/edit-profile" className="btn btn-primary">Update your profile</Link>}>
        No other students share your courses or study habits yet. Adding more courses or times helps, and so does telling
        your classmates about StudyBuddy.
      </EmptyState>
    );
  } else {
    const [best, ...rest] = matches;
    content = (
      <>
        <MatchCard match={best} courseName={courseName} onRequest={setSelected} featured />
        {rest.length > 0 && (
          <>
            <div className="between" style={{ margin: '28px 0 14px' }}>
              <h2 style={{ fontSize: 15 }}>More good matches</h2>
              <span className="subtle small">{rest.length} more</span>
            </div>
            <div className="match-grid">
              {rest.map(m => <MatchCard key={m.student_id} match={m} courseName={courseName} onRequest={setSelected} />)}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <AppShell user={user} matchCount={matches?.length}>
      <div className="page">
        <PageHead
          title="Matches"
          description="Students who share the most courses, study times and places with you."
          actions={<Link to="/edit-profile" className="btn btn-secondary btn-sm"><Icon name="settings" size={14} />Tune preferences</Link>}
        />
        {content}
      </div>
      {selected && (
        <RequestModal match={selected} courseName={courseName} onClose={() => setSelected(null)} onSent={onSent} />
      )}
    </AppShell>
  );
}

export default Matches;
