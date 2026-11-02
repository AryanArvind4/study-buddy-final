import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useCurrentUser } from '../hooks';
import { dayLabel, fmtRelative, fmtTime, fmtUntil, fmtDay, refreshActivity, sameDay } from '../utils';
import SessionModal from './SessionModal';
import {
  Alert, AppShell, Avatar, ConfirmModal, Icon, Loading, Menu, Modal, Spinner, useToast,
} from './ui';

/* ---------------------------------------------------------------- list */

function RequestCard({ req, onDone }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const first = req.other.name.split(' ')[0];

  async function act(action) {
    setBusy(action);
    try {
      await api(`/connections/${req.id}/${action}`, { method: 'POST' });
      refreshActivity();
      if (action === 'accept') {
        toast(`You're connected with ${first}`);
        navigate(`/inbox/connection/${req.id}`);
      } else {
        toast(action === 'decline' ? 'Request declined' : 'Request cancelled');
      }
      onDone();
    } catch (err) {
      toast(err.message, 'error');
      setBusy('');
    }
  }

  const daysLeft = req.expires_at ? Math.max(0, Math.ceil((new Date(req.expires_at) - Date.now()) / 86400000)) : null;

  return (
    <div className="request-card">
      <div className="row">
        <Avatar name={req.other.name} size="lg" />
        <div className="grow">
          <div className="strong truncate">{req.other.name}</div>
          <div className="subtle xs truncate">{req.other.department}</div>
        </div>
      </div>
      {req.note && <div className="note">“{req.note}”</div>}
      {req.direction === 'incoming' ? (
        <div className="row-sm" style={{ marginTop: req.note ? 0 : 12 }}>
          <button type="button" className="btn btn-primary btn-sm grow" disabled={!!busy} onClick={() => act('accept')}>
            {busy === 'accept' ? <Spinner /> : <Icon name="check" size={14} />}Accept
          </button>
          <button type="button" className="btn btn-secondary btn-sm grow" disabled={!!busy} onClick={() => act('decline')}>
            Decline
          </button>
        </div>
      ) : (
        <div className="between" style={{ marginTop: req.note ? 0 : 10 }}>
          <span className="subtle xs">Waiting · expires in {daysLeft} day{daysLeft === 1 ? '' : 's'}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act('cancel')}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function ThreadItem({ t, active }) {
  const other = t.type === 'connection' ? t.members[0] : null;
  return (
    <Link to={`/inbox/${t.type}/${t.id}`} className={`thread-item${active ? ' active' : ''}${t.unread ? ' unread' : ''}`}
      aria-current={active ? 'page' : undefined}>
      {other ? <Avatar name={other.name} size="lg" /> : <span className="group-avatar"><Icon name="users" size={19} /></span>}
      <div className="grow">
        <div className="between">
          <span className="t-title truncate">{t.title}</span>
          <span className="t-time">{fmtRelative(t.last_message_at)}</span>
        </div>
        <div className="row-sm">
          <span className="t-preview truncate grow">
            {t.last_message || (t.type === 'group' ? `${t.members.length} members` : 'Say hi 👋')}
          </span>
          {t.unread > 0 && <span className="unread-dot" aria-label={`${t.unread} unread`} />}
        </div>
      </div>
    </Link>
  );
}

/* --------------------------------------------------------------- thread */

function ReportModal({ person, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit() {
    if (!reason) return setError('Choose a reason.');
    setBusy(true);
    try {
      await api('/reports', { method: 'POST', body: { user_id: person.id, reason, details } });
      if (alsoBlock) await api('/blocks', { method: 'POST', body: { user_id: person.id } });
      toast('Thanks. Our team will review this report.');
      refreshActivity();
      onClose();
      if (alsoBlock) navigate('/inbox');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Report ${person.name}`} description="Reports are private. The student isn't told who reported them."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={submit} disabled={busy}>{busy && <Spinner />}Send report</button>
        </>
      )}>
      <div className="stack">
        <div>
          <label className="label" htmlFor="r-reason">Reason</label>
          <select id="r-reason" className="select" value={reason} onChange={e => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            <option value="harassment">Harassment or bullying</option>
            <option value="inappropriate">Inappropriate messages</option>
            <option value="spam">Spam or advertising</option>
            <option value="fake">Fake profile or not a student</option>
            <option value="other">Something else</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="r-details">What happened? <span className="subtle">(optional)</span></label>
          <textarea id="r-details" className="textarea" maxLength={1000} value={details} onChange={e => setDetails(e.target.value)} />
        </div>
        <label className="row-sm small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={alsoBlock} onChange={e => setAlsoBlock(e.target.checked)} />
          Also block {person.name.split(' ')[0]} (they won't be able to contact you)
        </label>
        <Alert>{error}</Alert>
      </div>
    </Modal>
  );
}

function GroupInfoModal({ thread, me, onClose, onChanged }) {
  const toast = useToast();
  const [code, setCode] = useState(thread.invite_code);
  const link = `${window.location.origin}/join/${code}`;

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied');
    } catch {
      toast('Could not copy. Select and copy it manually.', 'error');
    }
  }
  async function resetCode() {
    try {
      const d = await api(`/groups/${thread.id}/invite/reset`, { method: 'POST' });
      setCode(d.invite_code);
      toast('New invite code created. The old one no longer works.');
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  async function remove(member) {
    try {
      await api(`/groups/${thread.id}/remove`, { method: 'POST', body: { user_id: member.id } });
      toast(`${member.name} removed`);
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <Modal title={thread.title} description={thread.description || (thread.course ? `Course: ${thread.course}` : 'Course group')} onClose={onClose}>
      <div className="stack">
        <div>
          <div className="label">Invite classmates</div>
          <div className="code-box">
            <span className="code">{code}</span>
            <div className="row-sm">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(link)}><Icon name="link" size={14} />Copy link</button>
              {thread.is_owner && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={resetCode} title="Make a new code">New code</button>
              )}
            </div>
          </div>
          <span className="hint">Anyone with the code can join while there's room ({thread.members.length}/{thread.max_members}).</span>
        </div>
        <div>
          <div className="label">Members</div>
          {thread.members.map(m => (
            <div key={m.id} className="person-row">
              <Avatar name={m.name} />
              <div className="grow">
                <div className="small strong truncate">{m.name}{m.id === me ? ' (you)' : ''}</div>
                <div className="subtle xs truncate">{m.department}</div>
              </div>
              {m.id === thread.owner_id && <span className="badge badge-neutral">Owner</span>}
              {thread.is_owner && m.id !== me && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(m)}>Remove</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function Thread({ type, id, me }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [thread, setThread] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [modal, setModal] = useState(null); // 'plan' | 'report' | 'block' | 'remove' | 'leave' | 'info'
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const stickToBottom = useRef(true);
  const lastAt = useRef(null);

  const loadThread = useCallback(() => {
    api(`/threads/${type}/${id}`).then(d => setThread(d.thread)).catch(err => setError(err.message));
    api('/sessions').then(d => setSessions(d.sessions.filter(s => s.thread_id === id))).catch(() => {});
  }, [type, id]);

  useEffect(() => {
    setThread(null);
    setMsgs([]);
    setError('');
    lastAt.current = null;
    stickToBottom.current = true;
    loadThread();
    let cancelled = false;
    const poll = async () => {
      try {
        const q = lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : '';
        const d = await api(`/threads/${type}/${id}/messages${q}`);
        if (cancelled || !d.messages.length) return;
        setMsgs(prev => {
          const seen = new Set(prev.map(m => m.id));
          return [...prev, ...d.messages.filter(m => !seen.has(m.id))];
        });
        lastAt.current = d.messages[d.messages.length - 1].created_at;
        refreshActivity();
      } catch (err) {
        if (!cancelled && !lastAt.current) setError(err.message);
      }
    };
    poll();
    const timer = setInterval(() => document.visibilityState === 'visible' && poll(), 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [type, id, loadThread]);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  function onScroll() {
    const el = bodyRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const d = await api(`/threads/${type}/${id}/messages`, { method: 'POST', body: { body } });
      stickToBottom.current = true;
      setMsgs(prev => (prev.some(m => m.id === d.message.id) ? prev : [...prev, d.message]));
      lastAt.current = d.message.created_at;
      setText('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  async function runAction(kind) {
    setBusy(true);
    try {
      if (kind === 'block') await api('/blocks', { method: 'POST', body: { user_id: thread.members[0].id } });
      if (kind === 'remove') await api(`/connections/${thread.connection_id}/remove`, { method: 'POST' });
      if (kind === 'leave') await api(`/groups/${id}/leave`, { method: 'POST' });
      toast(kind === 'block' ? 'Blocked' : kind === 'remove' ? 'Connection removed' : 'You left the group');
      refreshActivity();
      navigate('/inbox');
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
      setModal(null);
    }
  }

  if (error) {
    return (
      <div className="chat"><div className="chat-empty"><div>
        <Alert>{error}</Alert>
        <Link to="/inbox" className="btn btn-secondary" style={{ marginTop: 16 }}>Back to inbox</Link>
      </div></div></div>
    );
  }
  if (!thread) return <div className="chat"><Loading label="Opening conversation…" /></div>;

  const other = type === 'connection' ? thread.members[0] : null;
  const upcoming = sessions.filter(s => ['awaiting', 'confirmed', 'in_progress'].includes(s.state));
  const next = upcoming[0];
  const people = Object.fromEntries(thread.members.map(m => [m.id, m]));

  const menuItems = type === 'connection' ? [
    { label: 'Plan a session', icon: 'calendar', onClick: () => setModal('plan') },
    { label: 'Remove connection', icon: 'x', onClick: () => setModal('remove') },
    { label: `Block ${other.name.split(' ')[0]}`, icon: 'ban', danger: true, onClick: () => setModal('block') },
    { label: 'Report', icon: 'flag', danger: true, onClick: () => setModal('report') },
  ] : [
    { label: 'Members and invite', icon: 'users', onClick: () => setModal('info') },
    { label: 'Plan a session', icon: 'calendar', onClick: () => setModal('plan') },
    { label: 'Leave group', icon: 'logout', danger: true, onClick: () => setModal('leave') },
  ];

  return (
    <div className="chat">
      <div className="chat-head">
        <Link to="/inbox" className="btn btn-ghost btn-icon btn-sm show-mobile" aria-label="Back to inbox"><Icon name="arrowLeft" /></Link>
        {other ? <Avatar name={other.name} /> : <span className="group-avatar sm"><Icon name="users" size={16} /></span>}
        <button type="button" className="who" onClick={() => type === 'group' && setModal('info')}
          style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: type === 'group' ? 'pointer' : 'default' }}>
          <div className="name truncate">{thread.title}</div>
          <div className="sub truncate">
            {other ? other.department : `${thread.members.length} members${thread.course ? ` · ${thread.course}` : ''}`}
          </div>
        </button>
        <button type="button" className="btn btn-secondary btn-sm hide-mobile" onClick={() => setModal('plan')}>
          <Icon name="calendar" size={14} />Plan session
        </button>
        <Menu items={menuItems} />
      </div>

      {next && (
        <Link to={`/sessions/${next.id}`} className="chat-banner">
          <Icon name="calendar" size={16} style={{ color: 'var(--accent-text)' }} />
          <span className="grow truncate">
            <span className="strong">{next.title}</span> · {fmtDay(next.start_at)} {fmtTime(next.start_at)} ({fmtUntil(next.start_at)})
          </span>
          <span className={`badge ${next.my_rsvp === 'pending' ? 'badge-good' : next.state === 'confirmed' ? 'badge-strong' : 'badge-neutral'}`}>
            {next.my_rsvp === 'pending' ? 'Reply needed' : next.state === 'confirmed' ? 'Confirmed' : 'Waiting'}
          </span>
        </Link>
      )}

      <div className="chat-body" ref={bodyRef} onScroll={onScroll} aria-live="polite">
        {msgs.length === 0 && (
          <div className="chat-empty"><div>
            <div className="empty-icon"><Icon name="message" size={20} /></div>
            <div className="strong">No messages yet</div>
            <p className="small" style={{ marginTop: 4 }}>Say hi and suggest a time to study.</p>
          </div></div>
        )}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const newDay = !prev || !sameDay(prev.created_at, m.created_at);
          const showSender = type === 'group' && !m.mine && m.kind === 'text' && (newDay || prev?.sender_id !== m.sender_id || prev?.kind !== 'text');
          return (
            <React.Fragment key={m.id}>
              {newDay && <div className="day-sep">{dayLabel(m.created_at)}</div>}
              {m.kind === 'system' ? (
                <div className="sys-msg">{m.body}</div>
              ) : (
                <div className={`msg${m.mine ? ' mine' : ''}`}>
                  {showSender && <div className="sender">{people[m.sender_id]?.name || 'Former member'}</div>}
                  <div className="bubble">{m.body}</div>
                  <div className="meta">{fmtTime(m.created_at)}</div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <form className="composer" onSubmit={send}>
        <textarea
          rows={1}
          value={text}
          maxLength={2000}
          placeholder={`Message ${thread.title}`}
          aria-label="Message"
          onChange={e => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="btn btn-primary btn-icon" style={{ height: 42, width: 42 }} disabled={!text.trim() || sending} aria-label="Send">
          {sending ? <Spinner /> : <Icon name="send" size={16} />}
        </button>
      </form>

      {modal === 'plan' && (
        <SessionModal thread={{ type, id, title: thread.title, course: thread.course }} onClose={() => setModal(null)}
          onSaved={() => loadThread()} />
      )}
      {modal === 'report' && <ReportModal person={other} onClose={() => setModal(null)} />}
      {modal === 'info' && (
        <GroupInfoModal thread={thread} me={me} onClose={() => setModal(null)} onChanged={() => { loadThread(); }} />
      )}
      {modal === 'block' && (
        <ConfirmModal title={`Block ${other.name}?`} confirmLabel="Block" danger busy={busy}
          onConfirm={() => runAction('block')} onClose={() => setModal(null)}>
          They won't be able to message you, send requests or see you in matches, and your upcoming sessions together
          will be cancelled. They won't be told. You can unblock them later from your profile.
        </ConfirmModal>
      )}
      {modal === 'remove' && (
        <ConfirmModal title={`Remove ${other.name}?`} confirmLabel="Remove connection" danger busy={busy}
          onConfirm={() => runAction('remove')} onClose={() => setModal(null)}>
          This ends your chat and cancels upcoming sessions together. You can send a new request later.
        </ConfirmModal>
      )}
      {modal === 'leave' && (
        <ConfirmModal title={`Leave ${thread.title}?`} confirmLabel="Leave group" danger busy={busy}
          onConfirm={() => runAction('leave')} onClose={() => setModal(null)}>
          You'll lose access to the group chat and its sessions. You can rejoin with an invite code if there's room.
        </ConfirmModal>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- page */

function Inbox() {
  const { type, id } = useParams();
  const { user, error: userError } = useCurrentUser();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api('/connections'), api('/threads')])
      .then(([c, t]) => setData({ incoming: c.incoming, outgoing: c.outgoing, threads: t.threads }))
      .catch(err => setError(err.message));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 15000);
    window.addEventListener('sb-activity', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('sb-activity', load);
    };
  }, [user, load]);

  if (userError) return <AppShell><div className="page"><Alert>{userError}</Alert></div></AppShell>;
  if (!user) return <AppShell><Loading label="Loading your inbox…" /></AppShell>;

  const hasThread = type && id;

  return (
    <AppShell user={user} bare>
      <div className={`inbox${hasThread ? ' has-thread' : ''}`}>
        <section className="inbox-list" aria-label="Conversations">
          <div className="inbox-list-head between">
            <h1>Inbox</h1>
            <Link to="/groups" className="btn btn-ghost btn-sm"><Icon name="users" size={14} />Groups</Link>
          </div>
          <div className="inbox-scroll">
            {error && <div style={{ padding: 16 }}><Alert>{error}</Alert></div>}
            {!data && !error && (
              <div style={{ padding: 16 }} className="stack">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="row">
                    <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                    <div className="grow"><div className="skeleton" style={{ height: 12, width: '50%', marginBottom: 8 }} /><div className="skeleton" style={{ height: 10, width: '80%' }} /></div>
                  </div>
                ))}
              </div>
            )}
            {data && (
              <>
                {data.incoming.length > 0 && (
                  <>
                    <div className="inbox-section-label">Requests · {data.incoming.length}</div>
                    {data.incoming.map(r => <RequestCard key={r.id} req={r} onDone={load} />)}
                  </>
                )}
                <div className="inbox-section-label">Conversations</div>
                {data.threads.length === 0 ? (
                  <div style={{ padding: '8px 16px 16px' }} className="subtle small">
                    No conversations yet. Send a request from <Link to="/matches">Matches</Link> or create a <Link to="/groups">group</Link>.
                  </div>
                ) : data.threads.map(t => (
                  <ThreadItem key={`${t.type}-${t.id}`} t={t} active={t.type === type && t.id === id} />
                ))}
                {data.outgoing.length > 0 && (
                  <>
                    <div className="inbox-section-label">Sent requests</div>
                    {data.outgoing.map(r => <RequestCard key={r.id} req={r} onDone={load} />)}
                  </>
                )}
              </>
            )}
          </div>
        </section>

        <section className="chat-pane" aria-label="Conversation" style={{ minWidth: 0, minHeight: 0 }}>
          {hasThread ? (
            <Thread key={`${type}-${id}`} type={type} id={id} me={user._id} />
          ) : (
            <div className="chat">
              <div className="chat-empty"><div>
                <div className="empty-icon"><Icon name="inbox" size={22} /></div>
                <div className="strong">Your conversations</div>
                <p className="small" style={{ marginTop: 4, maxWidth: 300 }}>
                  Choose a conversation, or accept a request to start chatting with a study partner.
                </p>
              </div></div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default Inbox;
