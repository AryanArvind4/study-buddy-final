import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { localInputToIso, nextHour, toLocalInput, refreshActivity } from '../utils';
import { Alert, Icon, Modal, Spinner, useToast } from './ui';

const DURATIONS = [30, 45, 60, 90, 120, 180];

/**
 * Plan a new session, change an existing one, or book the next one.
 * mode: 'create' | 'edit' | 'rebook'
 */
function SessionModal({ mode = 'create', thread, session, defaultTitle = '', onClose, onSaved }) {
  const toast = useToast();
  const [spots, setSpots] = useState([]);
  const [form, setForm] = useState(() => {
    if (session) {
      const start = mode === 'rebook'
        ? new Date(new Date(session.start_at).getTime() + 7 * 86400000)
        : new Date(session.start_at);
      return {
        title: session.title,
        when: toLocalInput(start),
        duration_min: session.duration_min,
        location: session.location || '',
        link: session.link || '',
        agenda: session.agenda?.length ? [...session.agenda] : [''],
      };
    }
    return { title: defaultTitle, when: toLocalInput(nextHour(1)), duration_min: 60, location: '', link: '', agenda: [''] };
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/get_options').then(d => setSpots(d.study_spots || [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setAgenda = (i, v) => setForm(f => ({ ...f, agenda: f.agenda.map((a, j) => (j === i ? v : a)) }));

  async function save(e) {
    e.preventDefault();
    setError('');
    const start = localInputToIso(form.when);
    if (!form.title.trim()) return setError('Give the session a title.');
    if (!start) return setError('Choose a date and time.');
    if (!form.location.trim() && !form.link.trim()) return setError('Add a place on campus or a meeting link.');
    const body = {
      title: form.title.trim(),
      start_at: start,
      duration_min: Number(form.duration_min),
      location: form.location.trim(),
      link: form.link.trim(),
      agenda: form.agenda.map(a => a.trim()).filter(Boolean),
    };
    setSaving(true);
    try {
      let data;
      if (mode === 'edit') {
        data = await api(`/sessions/${session.id}`, { method: 'PATCH', body });
        toast('Session updated');
      } else {
        data = await api('/sessions', {
          method: 'POST',
          body: { ...body, thread_type: thread.type, thread_id: thread.id, course: session?.course || thread.course || '' },
        });
        toast(mode === 'rebook' ? 'Next session proposed' : 'Session proposed');
      }
      refreshActivity();
      onSaved?.(data.session);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const titles = {
    create: ['Plan a study session', `Propose a time with ${thread?.title || 'your partner'}. They'll be asked to confirm.`],
    edit: ['Change session', 'Changing the time, length or place asks everyone to confirm again.'],
    rebook: ['Book the next session', 'Same plan, one week later. Adjust anything you like.'],
  };

  return (
    <Modal
      title={titles[mode][0]}
      description={titles[mode][1]}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="session-form" className="btn btn-primary" disabled={saving}>
            {saving ? <><Spinner /> Saving…</> : mode === 'edit' ? 'Save changes' : <><Icon name="send" size={15} />Propose session</>}
          </button>
        </>
      )}
    >
      <form id="session-form" onSubmit={save} noValidate>
        <div className="grid-form">
          <div className="full">
            <label className="label" htmlFor="s-title">Title</label>
            <input id="s-title" className="input" maxLength={80} placeholder="e.g. Data Structures: chapter 5 review"
              value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="s-when">Date and time</label>
            <input id="s-when" className="input" type="datetime-local" value={form.when} onChange={e => set('when', e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="s-dur">Length</label>
            <select id="s-dur" className="select" value={form.duration_min} onChange={e => set('duration_min', e.target.value)}>
              {DURATIONS.map(d => <option key={d} value={d}>{d < 60 ? `${d} min` : `${d / 60} hour${d > 60 ? 's' : ''}`}</option>)}
            </select>
          </div>
          <div className="full">
            <label className="label" htmlFor="s-loc">Place</label>
            <div className="input-icon">
              <Icon name="pin" size={16} />
              <input id="s-loc" className="input" list="s-spots" maxLength={120} placeholder="Library, Louisa Café, a classroom…"
                value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
            <datalist id="s-spots">{spots.map(s => <option key={s} value={s} />)}</datalist>
            <span className="hint">Pick a public place on campus for a first meetup.</span>
          </div>
          <div className="full">
            <label className="label" htmlFor="s-link">Online link <span className="subtle">(optional)</span></label>
            <div className="input-icon">
              <Icon name="link" size={16} />
              <input id="s-link" className="input" maxLength={300} placeholder="https://meet.google.com/…"
                value={form.link} onChange={e => set('link', e.target.value)} />
            </div>
          </div>
          <div className="full">
            <div className="label">Agenda <span className="subtle">(optional)</span></div>
            <div className="stack-sm">
              {form.agenda.map((item, i) => (
                <div key={i} className="row-sm">
                  <input className="input" maxLength={120} aria-label={`Agenda item ${i + 1}`}
                    placeholder={i === 0 ? 'e.g. Go through lecture 5 slides' : 'Another item'}
                    value={item} onChange={e => setAgenda(i, e.target.value)} />
                  {form.agenda.length > 1 && (
                    <button type="button" className="btn btn-ghost btn-icon" aria-label="Remove item"
                      onClick={() => set('agenda', form.agenda.filter((_, j) => j !== i))}>
                      <Icon name="x" size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.agenda.length < 10 && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6, marginLeft: -8 }}
                onClick={() => set('agenda', [...form.agenda, ''])}>
                <Icon name="plus" size={14} />Add item
              </button>
            )}
          </div>
        </div>
        {error && <div style={{ marginTop: 14 }}><Alert>{error}</Alert></div>}
      </form>
    </Modal>
  );
}

export default SessionModal;
