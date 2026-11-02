import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCourseNames, useCurrentUser } from '../hooks';
import { AppShell, Alert, Avatar, EmptyState, Icon, Modal, OverlapRing, PageHead, Spinner, overlapLabel, useToast } from './ui';

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

function emailTemplate(match, user, courseName) {
  const lines = [];
  if (match.shared_courses.length) lines.push(`- We're both taking ${match.shared_courses.map(courseName).join(', ')}`);
  if (match.shared_spots.length) lines.push(`- We both like studying at ${match.shared_spots.join(', ')}`);
  if (match.shared_times.length) lines.push(`- We're both usually free: ${match.shared_times.join(', ')}`);
  return `Subject: Study partner? (via StudyBuddy)

Hi ${match.name},

I'm ${user.name} from ${user.department}. I found you on StudyBuddy and noticed we have a few things in common:
${lines.join('\n') || '- Similar study habits'}

Would you like to study together sometime? Let me know what time works for you.

Thanks,
${user.name}
${user.email}`;
}

function ConnectModal({ match, user, courseName, onClose, onSent }) {
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const first = match.name.split(' ')[0];
  const template = emailTemplate(match, user, courseName);

  async function send() {
    setStatus('sending');
    setError('');
    try {
      await api('/send_partner_email', { method: 'POST', body: { partner_id: match.student_id } });
      setStatus('sent');
      onSent(first);
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setError('Could not copy automatically. Select the text and copy it manually.');
    }
  }

  return (
    <Modal
      title={`Reach out to ${first}`}
      description="We'll email a short introduction. Replies go straight to your inbox."
      onClose={onClose}
      footer={status === 'sent' ? (
        <button type="button" className="btn btn-secondary" onClick={onClose}>Done</button>
      ) : (
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={send} disabled={status === 'sending'}>
            {status === 'sending' ? <><Spinner /> Sending…</> : <><Icon name="send" size={15} />Send introduction</>}
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

        {status === 'sent' ? (
          <Alert type="success">Introduction sent. {first} can reply to you at {user.email}.</Alert>
        ) : (
          <div className="email-preview" aria-label="Email preview">
            <div className="ep-head">
              <div><b>To:</b> {match.name}</div>
              <div><b>Reply-to:</b> {user.email}</div>
              <div><b>Subject:</b> Study Partner Request from {user.name}</div>
            </div>
            <div className="ep-body">
              Hi {first}! <span className="strong" style={{ color: 'var(--text)' }}>{user.name}</span> from {user.department} found
              your profile on StudyBuddy and would like to study together.
              {match.shared_courses.length > 0 && <> You're both taking <span className="strong" style={{ color: 'var(--text)' }}>{match.shared_courses.map(courseName).join(', ')}</span>.</>}
            </div>
          </div>
        )}
        <Alert>{error}</Alert>

        <details className="disclosure">
          <summary><Icon name="chevronRight" size={14} />Prefer to write it yourself?</summary>
          <div className="stack" style={{ marginTop: 14 }}>
            <div>
              <label className="label" htmlFor="match-email">Their email</label>
              <div className="copy-row">
                <input id="match-email" className="input" value={match.email} readOnly />
                <button type="button" className="btn btn-secondary" onClick={() => copy(match.email, 'email')}>
                  <Icon name={copied === 'email' ? 'check' : 'copy'} size={15} />{copied === 'email' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div>
              <div className="between" style={{ marginBottom: 6 }}>
                <label className="label" htmlFor="match-template" style={{ margin: 0 }}>Message template</label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(template, 'template')}>
                  <Icon name={copied === 'template' ? 'check' : 'copy'} size={14} />{copied === 'template' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <textarea id="match-template" className="template" value={template} readOnly />
            </div>
          </div>
        </details>
      </div>
    </Modal>
  );
}

function MatchCard({ match, courseName, onReach, featured }) {
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
          <div className="stack" style={{ gap: 14 }}>{reasons}</div>
          <div className="row-sm wrap">
            <button type="button" className="btn btn-primary" onClick={() => onReach(match)}>
              <Icon name="send" size={15} />Reach out to {match.name.split(' ')[0]}
            </button>
          </div>
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
      <div className="mc-foot">
        <button type="button" className="btn btn-secondary btn-block" onClick={() => onReach(match)}>
          <Icon name="send" size={15} />Reach out
        </button>
      </div>
    </article>
  );
}

function Matches() {
  const toast = useToast();
  const { user, error: userError } = useCurrentUser();
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!user) return;
    api('/get_matches')
      .then(d => setMatches(d.matches || []))
      .catch(err => {
        setError(err.message);
        setMatches([]);
      });
  }, [user]);

  const sharedCodes = useMemo(() => (matches || []).flatMap(m => m.shared_courses), [matches]);
  const [courseNames] = useCourseNames(sharedCodes);
  const courseName = code => courseNames[code] || code;

  let content;
  if (userError || error) {
    content = <Alert>{userError || error}</Alert>;
  } else if (!user || matches === null) {
    content = (
      <div aria-busy="true">
        <div className="card match-feature">
          <div className="skeleton" style={{ width: 128, height: 128, borderRadius: '50%' }} />
          <div className="stack">
            <div className="skeleton" style={{ height: 22, width: '40%' }} />
            <div className="skeleton" style={{ height: 14, width: '60%' }} />
            <div className="skeleton" style={{ height: 70 }} />
          </div>
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
        <MatchCard match={best} courseName={courseName} onReach={setSelected} featured />
        {rest.length > 0 && (
          <>
            <div className="between" style={{ margin: '28px 0 14px' }}>
              <h2 style={{ fontSize: 15 }}>More good matches</h2>
              <span className="subtle small">{rest.length} more</span>
            </div>
            <div className="match-grid">
              {rest.map(m => <MatchCard key={m.student_id} match={m} courseName={courseName} onReach={setSelected} />)}
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
      {selected && user && (
        <ConnectModal match={selected} user={user} courseName={courseName} onClose={() => setSelected(null)}
          onSent={first => toast(`Introduction sent to ${first}`)} />
      )}
    </AppShell>
  );
}

export default Matches;
