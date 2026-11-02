import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useCourseNames, useCurrentUser } from '../hooks';
import CourseSelector from './CourseSelector';
import { AppShell, Alert, Avatar, Loading, Spinner, ToggleGroup } from './ui';

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

function EditProfile() {
  const navigate = useNavigate();
  const { user, setUser, error: userError } = useCurrentUser();
  const [courseNames, setCourseNames] = useCourseNames(user?.course_ids);
  const [options, setOptions] = useState({ study_spots: [], study_times: [] });
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/get_options').then(setOptions).catch(() => setError('Could not load study options. Refresh to try again.'));
  }, []);

  useEffect(() => {
    if (user && !form) {
      setForm({
        course_ids: user.course_ids || [],
        study_spots: user.study_spots || [],
        study_times: user.study_times || [],
      });
    }
  }, [user, form]);

  if (userError) return <AppShell><div className="page"><Alert>{userError}</Alert></div></AppShell>;
  if (!user || !form) return <AppShell><Loading label="Loading your profile…" /></AppShell>;

  const changed =
    !sameSet(form.course_ids, user.course_ids || []) ||
    !sameSet(form.study_spots, user.study_spots || []) ||
    !sameSet(form.study_times, user.study_times || []);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
    setSuccess('');
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.course_ids.length === 0) return setError('Keep at least one course so we can match you.');
    if (form.study_spots.length === 0) return setError('Pick at least one place to study.');
    if (form.study_times.length === 0) return setError('Pick at least one time to study.');
    setSaving(true);
    try {
      const data = await api('/update_profile', { method: 'PUT', body: form });
      setUser(data.user);
      setSuccess('Saved. Your matches now use your updated profile.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell user={user}>
      <div className="page" style={{ maxWidth: 760 }}>
        <header className="page-header">
          <h1>Your profile</h1>
          <p>What classmates see, and what we use to find your matches.</p>
        </header>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="row">
            <Avatar name={user.name} large />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{user.name}</div>
              <div className="muted small">{user.department} · {user.college}</div>
              <div className="muted small">{user.email} <span className="none">(private until you reach out)</span></div>
            </div>
          </div>
        </div>

        <form className="card" onSubmit={save} noValidate>
          <section className="form-section" aria-labelledby="c-title">
            <h2 id="c-title">Courses this semester</h2>
            <p className="muted">Shared courses count most when we rank matches.</p>
            <label className="visually-hidden" htmlFor="courses">Search courses</label>
            <CourseSelector
              value={form.course_ids}
              onChange={v => update('course_ids', v)}
              names={courseNames}
              onNamesChange={setCourseNames}
            />
          </section>

          <section className="form-section" aria-labelledby="s-title">
            <h2 id="s-title">Where you like to study</h2>
            <p className="muted">Pick all that apply.</p>
            <ToggleGroup legend="Study spots" name="study_spots" options={options.study_spots}
              selected={form.study_spots} onChange={v => update('study_spots', v)} />
          </section>

          <section className="form-section" aria-labelledby="t-title">
            <h2 id="t-title">When you're usually free</h2>
            <p className="muted">Pick all that apply.</p>
            <ToggleGroup legend="Study times" name="study_times" options={options.study_times}
              selected={form.study_times} onChange={v => update('study_times', v)} />
          </section>

          <div className="stack">
            <Alert>{error}</Alert>
            <Alert type="success">{success}</Alert>
          </div>

          <div className="save-bar">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              {changed ? 'Cancel' : 'Back'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={!changed || saving}>
              {saving ? <><Spinner /> Saving…</> : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export default EditProfile;
