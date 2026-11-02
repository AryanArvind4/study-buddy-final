import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useCourseNames, useCurrentUser } from '../hooks';
import CourseSelector from './CourseSelector';
import { AppShell, Alert, Avatar, Icon, Loading, PageHead, PillGroup, Spinner, ThemeToggle, useToast } from './ui';

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

function Section({ id, title, description, children }) {
  return (
    <section className="settings-section" aria-labelledby={id}>
      <div>
        <h2 id={id}>{title}</h2>
        <p className="desc">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function EditProfile() {
  const toast = useToast();
  const { user, setUser, error: userError } = useCurrentUser();
  const [courseNames, setCourseNames] = useCourseNames(user?.course_ids);
  const [options, setOptions] = useState({ study_spots: [], study_times: [] });
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/get_options').then(setOptions).catch(() => setError('Could not load study options. Refresh to try again.'));
  }, []);

  useEffect(() => {
    if (user && !form) {
      setForm({ course_ids: user.course_ids || [], study_spots: user.study_spots || [], study_times: user.study_times || [] });
    }
  }, [user, form]);

  if (userError) return <AppShell><div className="page"><Alert>{userError}</Alert></div></AppShell>;
  if (!user || !form) return <AppShell user={user}><Loading label="Loading your profile…" /></AppShell>;

  const changed =
    !sameSet(form.course_ids, user.course_ids || []) ||
    !sameSet(form.study_spots, user.study_spots || []) ||
    !sameSet(form.study_times, user.study_times || []);

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  function reset() {
    setForm({ course_ids: user.course_ids || [], study_spots: user.study_spots || [], study_times: user.study_times || [] });
    setError('');
  }

  async function save() {
    setError('');
    if (form.course_ids.length === 0) return setError('Keep at least one course so we can match you.');
    if (form.study_spots.length === 0) return setError('Pick at least one place to study.');
    if (form.study_times.length === 0) return setError('Pick at least one time to study.');
    setSaving(true);
    try {
      const data = await api('/update_profile', { method: 'PUT', body: form });
      setUser(data.user);
      toast('Profile saved. Your matches are updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell user={user}>
      <div className="page" style={{ maxWidth: 960 }}>
        <PageHead title="Profile" description="What classmates see, and what we use to find your matches." />

        <div className="card card-pad" style={{ marginBottom: 32 }}>
          <div className="row wrap">
            <Avatar name={user.name} size="xl" />
            <div className="grow">
              <div className="row-sm wrap">
                <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>{user.name}</span>
                <span className="badge badge-strong"><Icon name="shield" size={12} />Verified NTHU</span>
              </div>
              <div className="muted small">{user.department}</div>
              <div className="subtle small">{user.college}</div>
            </div>
            <div className="small" style={{ textAlign: 'right' }}>
              <div className="mono subtle">{user.email}</div>
              <div className="subtle xs">Shown only to students you're matched with</div>
            </div>
          </div>
        </div>

        {error && <div style={{ marginBottom: 20 }}><Alert>{error}</Alert></div>}

        <Section id="c-title" title="Courses" description="This semester's courses. Shared courses count most when we rank matches.">
          <label className="visually-hidden" htmlFor="courses">Search courses</label>
          <CourseSelector value={form.course_ids} onChange={v => update('course_ids', v)} names={courseNames} onNamesChange={setCourseNames} />
        </Section>

        <Section id="t-title" title="Study times" description="When you're usually free. People free at the same times rank higher.">
          <PillGroup legend="Study times" name="study_times" options={options.study_times}
            selected={form.study_times} onChange={v => update('study_times', v)} />
        </Section>

        <Section id="s-title" title="Study spots" description="Places on and around campus where you like to study.">
          <PillGroup legend="Study spots" name="study_spots" options={options.study_spots}
            selected={form.study_spots} onChange={v => update('study_spots', v)} />
        </Section>

        <Section id="a-title" title="Appearance" description="Choose light or dark, or follow your device.">
          <ThemeToggle />
        </Section>
      </div>

      {changed && (
        <div className="unsaved" role="region" aria-label="Unsaved changes">
          <span className="row-sm"><Icon name="alert" size={15} />Unsaved changes</span>
          <div className="row-sm">
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={saving}>Discard</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? <><Spinner /> Saving…</> : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default EditProfile;
