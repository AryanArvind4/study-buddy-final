import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCourseNames, useCurrentUser } from '../hooks';
import { AppShell, Alert, Avatar, Icon, Loading, overlapLabel } from './ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function TopMatch({ state }) {
  if (state.loading) {
    return (
      <div className="card" aria-busy="true">
        <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 48, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 40, width: '50%' }} />
      </div>
    );
  }
  if (state.error) {
    return <div className="card"><Alert>{state.error}</Alert></div>;
  }
  const match = state.matches[0];
  if (!match) {
    return (
      <div className="card">
        <div className="section-label">Your best match</div>
        <h2 className="card-title">No matches yet</h2>
        <p className="muted small" style={{ marginBottom: 16 }}>
          Nobody else has added your courses so far. Adding more courses or study times gives you more chances to match,
          and inviting classmates helps too.
        </p>
        <Link to="/edit-profile" className="btn btn-secondary">Update your profile</Link>
      </div>
    );
  }
  const label = overlapLabel(match.similarity);
  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="section-label" style={{ margin: 0 }}>Your best match</div>
        <span className={`badge badge-${label.tone}`}>{label.text}</span>
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <Avatar name={match.name} large />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-lg)' }}>{match.name}</div>
          <div className="muted small">{match.department}</div>
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 18 }}>
        {[
          match.shared_courses.length && `${match.shared_courses.length} shared course${match.shared_courses.length > 1 ? 's' : ''}`,
          match.shared_spots.length && `${match.shared_spots.length} shared spot${match.shared_spots.length > 1 ? 's' : ''}`,
          match.shared_times.length && `${match.shared_times.length} shared time${match.shared_times.length > 1 ? 's' : ''}`,
        ].filter(Boolean).join(' · ') || 'Similar study habits'}
      </p>
      <Link to="/matches" className="btn btn-primary">
        See all matches <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}

function Dashboard() {
  const { user, error: userError } = useCurrentUser();
  const [courseNames] = useCourseNames(user?.course_ids);
  const [total, setTotal] = useState(null);
  const [matchState, setMatchState] = useState({ loading: true, matches: [], error: '' });

  useEffect(() => {
    if (!user) return;
    api('/stats').then(d => setTotal(d.total_students)).catch(() => setTotal(null));
    api('/get_matches')
      .then(d => setMatchState({ loading: false, matches: d.matches || [], error: '' }))
      .catch(err => setMatchState({ loading: false, matches: [], error: err.message }));
  }, [user]);

  if (userError) return <AppShell><div className="page"><Alert>{userError}</Alert></div></AppShell>;
  if (!user) return <AppShell><Loading label="Loading your profile…" /></AppShell>;

  const firstName = user.name?.split(' ')[0] || 'there';

  return (
    <AppShell user={user}>
      <div className="page">
        <header className="page-header">
          <h1>{greeting()}, {firstName}</h1>
          <p>Here's where your study partner search stands.</p>
        </header>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <TopMatch state={matchState} />

          <div className="card">
            <div className="section-label">At a glance</div>
            <div className="stats-row" style={{ marginTop: 12 }}>
              <div className="stat">
                <span className="stat-value">{user.course_ids?.length || 0}</span>
                <span className="stat-label">Your courses</span>
              </div>
              <div className="stat">
                <span className="stat-value">{matchState.loading ? '–' : matchState.matches.length}</span>
                <span className="stat-label">Top matches</span>
              </div>
              <div className="stat">
                <span className="stat-value">{total ?? '–'}</span>
                <span className="stat-label">Students here</span>
              </div>
            </div>
            <p className="small muted" style={{ marginTop: 16 }}>
              Matches are ranked by shared courses first, then study times and places.
            </p>
          </div>
        </div>

        <div className="grid-2">
          <section className="card" aria-labelledby="courses-h">
            <div className="card-header">
              <h2 id="courses-h" className="card-title">Your courses</h2>
              <Link to="/edit-profile" className="btn btn-ghost" aria-label="Edit courses">
                <Icon name="edit" size={16} /> Edit
              </Link>
            </div>
            {user.course_ids?.length ? (
              <ul className="course-list">
                {user.course_ids.map(code => (
                  <li key={code}>
                    {courseNames[code] && courseNames[code] !== code && <span className="code">{code}</span>}
                    <span className="name">{courseNames[code] || code}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="none">No courses yet. Add some to start matching.</p>
            )}
          </section>

          <section className="card" aria-labelledby="prefs-h">
            <div className="card-header">
              <h2 id="prefs-h" className="card-title">Study preferences</h2>
              <Link to="/edit-profile" className="btn btn-ghost" aria-label="Edit study preferences">
                <Icon name="edit" size={16} /> Edit
              </Link>
            </div>
            <div className="section-label"><Icon name="pin" size={13} /> Places</div>
            <div className="chips" style={{ marginBottom: 18 }}>
              {user.study_spots?.length ? user.study_spots.map(s => <span key={s} className="chip">{s}</span>)
                : <span className="none">None selected</span>}
            </div>
            <div className="section-label"><Icon name="clock" size={13} /> Times</div>
            <div className="chips" style={{ marginBottom: 18 }}>
              {user.study_times?.length ? user.study_times.map(t => <span key={t} className="chip">{t}</span>)
                : <span className="none">None selected</span>}
            </div>
            <div className="section-label"><Icon name="user" size={13} /> Department</div>
            <p className="small">{user.department || 'Not set'}</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export default Dashboard;
