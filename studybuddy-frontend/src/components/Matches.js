import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCourseNames, useCurrentUser } from '../hooks';
import { AppShell, Alert, Avatar, EmptyState, Icon, Modal, Spinner, overlapLabel } from './ui';

function SharedRow({ icon, label, items, render = x => x, accent }) {
  return (
    <div>
      <div className="section-label"><Icon name={icon} size={13} /> {label}</div>
      {items.length ? (
        <div className="chips">
          {items.map(item => (
            <span key={item} className={`chip${accent ? ' chip-accent' : ''}`}>
              <span className="chip-text">{render(item)}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="none">Nothing in common yet</span>
      )}
    </div>
  );
}

function emailTemplate(match, user, courseName) {
  const lines = [];
  if (match.shared_courses.length) lines.push(`- We're both taking: ${match.shared_courses.map(courseName).join(', ')}`);
  if (match.shared_spots.length) lines.push(`- We both like studying at: ${match.shared_spots.join(', ')}`);
  if (match.shared_times.length) lines.push(`- We're both free: ${match.shared_times.join(', ')}`);
  return `Subject: Study partner? (via StudyBuddy)

Hi ${match.name},

I'm ${user.name} from ${user.department}. I found you on StudyBuddy and noticed we have a few things in common:
${lines.join('\n') || '- Similar study habits'}

Would you like to study together sometime? Let me know what time works for you.

Thanks,
${user.name}
${user.email}`;
}

function ConnectModal({ match, user, courseName, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const template = emailTemplate(match, user, courseName);

  async function send() {
    setStatus('sending');
    setError('');
    try {
      await api('/send_partner_email', { method: 'POST', body: { partner_id: match.student_id } });
      setStatus('sent');
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
      title={`Reach out to ${match.name.split(' ')[0]}`}
      description="We'll send a short introduction from StudyBuddy. Replies go straight to your inbox."
      onClose={onClose}
    >
      <div className="stack">
        <Alert>{error}</Alert>
        {status === 'sent' ? (
          <Alert type="success">
            Sent! {match.name.split(' ')[0]} can reply to you at {user.email}.
          </Alert>
        ) : (
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={send} disabled={status === 'sending'}>
            {status === 'sending' ? <><Spinner /> Sending…</> : <><Icon name="send" size={17} /> Send introduction email</>}
          </button>
        )}
      </div>

      <div className="divider">or write it yourself</div>

      <details className="disclosure">
        <summary><Icon name="chevronRight" size={16} /> Copy their email and a message template</summary>
        <div className="stack" style={{ marginTop: 14 }}>
          <div>
            <label className="label" htmlFor="match-email">Email address</label>
            <div className="copy-field">
              <input id="match-email" className="input" value={match.email} readOnly />
              <button type="button" className="btn btn-secondary" onClick={() => copy(match.email, 'email')}>
                <Icon name={copied === 'email' ? 'check' : 'copy'} size={16} />
                {copied === 'email' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="match-template">Message</label>
            <textarea id="match-template" className="template" value={template} readOnly />
            <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 8 }}
              onClick={() => copy(template, 'template')}>
              <Icon name={copied === 'template' ? 'check' : 'copy'} size={16} />
              {copied === 'template' ? 'Copied' : 'Copy message'}
            </button>
          </div>
        </div>
      </details>
    </Modal>
  );
}

function Matches() {
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

  const content = (() => {
    if (userError) return <Alert>{userError}</Alert>;
    if (error) return <Alert>{error}</Alert>;
    if (!user || matches === null) {
      return (
        <div className="match-grid" aria-busy="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="card">
              <div className="row" style={{ marginBottom: 20 }}>
                <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skeleton" style={{ height: 16, width: '60%', marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 12, width: '80%' }} />
                </div>
              </div>
              <div className="skeleton" style={{ height: 72, marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          ))}
        </div>
      );
    }
    if (matches.length === 0) {
      return (
        <EmptyState
          icon="users"
          title="No matches yet"
          action={<Link to="/edit-profile" className="btn btn-primary">Update your profile</Link>}
        >
          No other students share your courses or study habits yet. Try adding more courses or times. Telling
          classmates about StudyBuddy helps too.
        </EmptyState>
      );
    }
    return (
      <div className="match-grid">
        {matches.map(match => {
          const label = overlapLabel(match.similarity);
          return (
            <article key={match.student_id} className="card match-card" aria-labelledby={`m-${match.student_id}`}>
              <div className="who" style={{ alignItems: 'flex-start' }}>
                <Avatar name={match.name} large />
                <div style={{ minWidth: 0 }}>
                  <h2 id={`m-${match.student_id}`}>{match.name}</h2>
                  <p>{match.department || 'Department not set'}</p>
                  <span className={`badge badge-${label.tone}`} style={{ marginTop: 8 }}
                    title={`Similarity score ${match.similarity}`}>
                    {label.text}
                  </span>
                </div>
              </div>
              <div className="shared">
                <SharedRow icon="book" label="Shared courses" items={match.shared_courses} render={courseName} accent />
                <SharedRow icon="pin" label="Places you both like" items={match.shared_spots} />
                <SharedRow icon="clock" label="Times you're both free" items={match.shared_times} />
              </div>
              <button type="button" className="btn btn-primary btn-block" onClick={() => setSelected(match)}>
                <Icon name="mail" size={17} /> Reach out
              </button>
            </article>
          );
        })}
      </div>
    );
  })();

  return (
    <AppShell user={user}>
      <div className="page">
        <header className="page-header">
          <h1>Your matches</h1>
          <p>Students who share the most courses, places and times with you.</p>
        </header>
        {content}
      </div>
      {selected && user && (
        <ConnectModal match={selected} user={user} courseName={courseName} onClose={() => setSelected(null)} />
      )}
    </AppShell>
  );
}

export default Matches;
