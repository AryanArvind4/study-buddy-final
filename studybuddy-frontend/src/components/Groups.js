import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useCourseNames, useCurrentUser } from '../hooks';
import { fmtRelative, refreshActivity } from '../utils';
import { Alert, AppShell, Avatar, EmptyState, Icon, Loading, Modal, PageHead, Spinner, useToast } from './ui';

function CreateGroupModal({ user, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [names] = useCourseNames(user.course_ids);
  const [form, setForm] = useState({ name: '', course: '', description: '', max_members: 6 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function create(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Give your group a name.');
    setBusy(true);
    setError('');
    try {
      const d = await api('/groups', { method: 'POST', body: { ...form, max_members: Number(form.max_members) } });
      toast('Group created. Share the invite code with classmates.');
      refreshActivity();
      navigate(`/inbox/group/${d.group.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Create a course group" description="Small groups work best. Members join with an invite code you share."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="group-form" className="btn btn-primary" disabled={busy}>{busy && <Spinner />}Create group</button>
        </>
      )}>
      <form id="group-form" onSubmit={create} noValidate className="grid-form">
        <div className="full">
          <label className="label" htmlFor="g-name">Group name</label>
          <input id="g-name" className="input" maxLength={60} placeholder="e.g. Data Structures midterm crew"
            value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="g-course">Course</label>
          <select id="g-course" className="select" value={form.course} onChange={e => {
            set('course', e.target.value);
            if (!form.name && e.target.value) set('name', `${names[e.target.value] || e.target.value} study group`);
          }}>
            <option value="">No specific course</option>
            {(user.course_ids || []).map(c => <option key={c} value={c}>{names[c] || c}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="g-size">Maximum members</label>
          <select id="g-size" className="select" value={form.max_members} onChange={e => set('max_members', e.target.value)}>
            {[2, 3, 4, 5, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} people</option>)}
          </select>
        </div>
        <div className="full">
          <label className="label" htmlFor="g-desc">What's the plan? <span className="subtle">(optional)</span></label>
          <textarea id="g-desc" className="textarea" maxLength={300} placeholder="e.g. Weekly problem sets before the midterm, Thursdays at the library"
            value={form.description} onChange={e => set('description', e.target.value)} />
          <div className="counter">{form.description.length}/300</div>
        </div>
        {error && <div className="full"><Alert>{error}</Alert></div>}
      </form>
    </Modal>
  );
}

function JoinCard({ initialCode = '', autoPreview = false }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [code, setCode] = useState(initialCode);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lookUp = useCallback(async c => {
    setError('');
    setPreview(null);
    if (!c.trim()) return;
    setBusy(true);
    try {
      const d = await api(`/groups/preview?code=${encodeURIComponent(c.trim())}`);
      setPreview(d.group);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (autoPreview && initialCode) lookUp(initialCode);
  }, [autoPreview, initialCode, lookUp]);

  async function join() {
    setBusy(true);
    try {
      const d = await api('/groups/join', { method: 'POST', body: { code: code.trim() } });
      toast(`You joined ${d.group.name}`);
      refreshActivity();
      navigate(`/inbox/group/${d.group.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad" aria-labelledby="join-h">
      <h2 id="join-h" style={{ fontSize: 15 }}>Join with an invite code</h2>
      <p className="muted small" style={{ margin: '4px 0 14px' }}>Got a code or link from a classmate? Enter the code here.</p>
      <form className="row-sm" onSubmit={e => { e.preventDefault(); lookUp(code); }}>
        <input className="input mono" aria-label="Invite code" placeholder="e.g. Xk3pQ9aB" maxLength={20}
          value={code} onChange={e => { setCode(e.target.value); setPreview(null); }} />
        <button type="submit" className="btn btn-secondary" disabled={busy || !code.trim()}>{busy && !preview ? <Spinner /> : 'Find'}</button>
      </form>
      {error && <div style={{ marginTop: 12 }}><Alert>{error}</Alert></div>}
      {preview && (
        <div className="request-card" style={{ margin: '14px 0 0' }}>
          <div className="row">
            <span className="group-avatar"><Icon name="users" size={19} /></span>
            <div className="grow">
              <div className="strong">{preview.name}</div>
              <div className="subtle xs">{preview.member_count}/{preview.max_members} members{preview.course ? ` · ${preview.course}` : ''}</div>
            </div>
          </div>
          {preview.description && <div className="note">{preview.description}</div>}
          {preview.is_member ? (
            <Link to={`/inbox/group/${preview.id}`} className="btn btn-secondary btn-block" style={{ marginTop: 12 }}>You're a member · Open chat</Link>
          ) : preview.member_count >= preview.max_members ? (
            <div className="subtle small" style={{ marginTop: 12 }}>This group is full.</div>
          ) : (
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={join} disabled={busy}>
              {busy && <Spinner />}Join group
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export function Groups() {
  const { code } = useParams();
  const { user, error: userError } = useCurrentUser();
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    api('/groups').then(d => setGroups(d.groups)).catch(err => setError(err.message));
  }, [user]);

  if (userError) return <AppShell><div className="page"><Alert>{userError}</Alert></div></AppShell>;
  if (!user) return <AppShell><Loading /></AppShell>;

  return (
    <AppShell user={user}>
      <div className="page">
        <PageHead title="Groups" description="Small study groups for your courses, with a shared chat and sessions."
          actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={14} />New group</button>} />

        <div className="detail-grid">
          <div>
            {error && <Alert>{error}</Alert>}
            {!groups && !error && <div className="card card-pad"><div className="skeleton" style={{ height: 60 }} /></div>}
            {groups && groups.length === 0 && (
              <EmptyState icon="users" title="No groups yet"
                action={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={14} />Create a group</button>}>
                Start a group for one of your courses and invite classmates with a code, or join one with a code you were given.
              </EmptyState>
            )}
            {groups && groups.length > 0 && (
              <div className="group-grid">
                {groups.map(g => (
                  <Link key={g.id} to={`/inbox/group/${g.id}`} className="card card-pad card-interactive" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div className="row" style={{ marginBottom: 12 }}>
                      <span className="group-avatar"><Icon name="users" size={19} /></span>
                      <div className="grow">
                        <div className="strong truncate">{g.name}</div>
                        <div className="subtle xs">{g.member_count}/{g.max_members} members{g.is_owner ? ' · You own this' : ''}</div>
                      </div>
                      {g.unread > 0 && <span className="nav-badge">{g.unread}</span>}
                    </div>
                    {g.description && <p className="muted small" style={{ marginBottom: 12 }}>{g.description}</p>}
                    <div className="between">
                      <span className="avatars">{g.members.slice(0, 5).map(m => <Avatar key={m.id} name={m.name} size="sm" />)}</span>
                      <span className="subtle xs">Active {fmtRelative(g.last_message_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <JoinCard initialCode={code || ''} autoPreview={!!code} />
        </div>
      </div>
      {creating && <CreateGroupModal user={user} onClose={() => setCreating(false)} />}
    </AppShell>
  );
}
