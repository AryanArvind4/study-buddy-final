import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCourseNames, useCurrentUser } from '../hooks';
import { fmtDay, fmtTime, fmtUntil } from '../utils';
import { AppShell, Alert, Avatar, Icon, Loading, OverlapRing, overlapLabel, profileStrength } from './ui';

// Same labels as the backend's STUDY_TIMES, in day order.
const TIME_SLOTS = [
  'Early Morning (6-9 AM)', 'Morning (9-12 PM)', 'Afternoon (12-3 PM)', 'Late Afternoon (3-6 PM)',
  'Evening (6-9 PM)', 'Night (9-12 AM)', 'Weekend Morning', 'Weekend Evening',
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function sharedSummary(m) {
  const parts = [];
  if (m.shared_courses.length) parts.push(`${m.shared_courses.length} course${m.shared_courses.length > 1 ? 's' : ''}`);
  if (m.shared_times.length) parts.push(`${m.shared_times.length} time${m.shared_times.length > 1 ? 's' : ''}`);
  if (m.shared_spots.length) parts.push(`${m.shared_spots.length} place${m.shared_spots.length > 1 ? 's' : ''}`);
  return parts.length ? `Shares ${parts.join(', ')}` : 'Similar study habits';
}

function Dashboard() {
  const { user, error: userError } = useCurrentUser();
  const [total, setTotal] = useState(null);
  const [matchState, setMatchState] = useState({ loading: true, matches: [], error: '' });
  const [activity, setActivity] = useState(null);

  const sharedCodes = useMemo(() => matchState.matches.flatMap(m => m.shared_courses), [matchState.matches]);
  const [courseNames] = useCourseNames([...(user?.course_ids || []), ...sharedCodes]);
  const name = code => courseNames[code] || code;

  useEffect(() => {
    if (!user) return;
    api('/stats').then(d => setTotal(d.total_students)).catch(() => setTotal(null));
    api('/activity').then(setActivity).catch(() => {});
    api('/get_matches')
      .then(d => setMatchState({ loading: false, matches: d.matches || [], error: '' }))
      .catch(err => setMatchState({ loading: false, matches: [], error: err.message }));
  }, [user]);

  if (userError) return <AppShell><div className="page"><Alert>{userError}</Alert></div></AppShell>;
  if (!user) return <AppShell><Loading label="Loading your dashboard…" /></AppShell>;

  const firstName = user.name?.split(' ')[0] || 'there';
  const strength = profileStrength(user);
  const top = matchState.matches[0];
  const others = total == null ? '–' : Math.max(0, total - 1);

  return (
    <AppShell user={user} matchCount={matchState.matches.length}>
      <div className="page">
        <section className="welcome reveal">
          <div className="grid-bg" />
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <h1>{greeting()}, {firstName}</h1>
            <p>
              {matchState.loading ? 'Looking for classmates who share your courses…'
                : top ? <>Your best match right now is <span className="strong" style={{ color: 'var(--text)' }}>{top.name}</span>. {sharedSummary(top)}.</>
                : 'No matches yet. Adding more courses and times gives you more chances to match.'}
            </p>
            <div className="actions">
              <Link to="/matches" className="btn btn-primary"><Icon name="users" size={16} />View matches</Link>
              <Link to="/edit-profile" className="btn btn-secondary"><Icon name="edit" size={15} />Edit profile</Link>
            </div>
          </div>
          <div className="ring-wrap" style={{ textAlign: 'center' }}>
            <OverlapRing similarity={strength} size={112} stroke={9}>
              <span>
                <span style={{ display: 'block', fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em' }}>{strength}%</span>
                <span className="subtle xs">profile</span>
              </span>
            </OverlapRing>
            <div className="subtle xs" style={{ marginTop: 8 }}>{strength === 100 ? 'Looking great' : 'Room to improve'}</div>
          </div>
        </section>

        <div className="kpis reveal reveal-1">
          <Link to={activity?.next_session ? `/sessions/${activity.next_session.id}` : '/sessions'} className="card kpi card-interactive" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="kpi-top">Next session<span className="kpi-icon"><Icon name="calendar" size={15} /></span></div>
            {activity?.next_session ? (
              <>
                <div className="strong truncate" style={{ marginTop: 10, fontSize: 15 }}>{activity.next_session.title}</div>
                <div className="kpi-sub">{fmtDay(activity.next_session.start_at)} · {fmtTime(activity.next_session.start_at)} · {fmtUntil(activity.next_session.start_at)}</div>
              </>
            ) : (
              <>
                <div className="kpi-value">–</div>
                <div className="kpi-sub">Plan one from a chat</div>
              </>
            )}
          </Link>
          <Link to="/inbox" className="card kpi card-interactive" style={{ color: 'inherit', textDecoration: 'none' }}>
            <div className="kpi-top">Requests<span className="kpi-icon"><Icon name="inbox" size={15} /></span></div>
            <div className="kpi-value">{activity ? activity.incoming_requests : '–'}</div>
            <div className="kpi-sub">{activity?.incoming_requests ? 'waiting for your reply' : 'no new requests'}</div>
          </Link>
          {activity?.needs_checkin ? (
            <Link to="/sessions" className="card kpi card-interactive" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="kpi-top">Check-ins<span className="kpi-icon"><Icon name="check" size={15} /></span></div>
              <div className="kpi-value">{activity.needs_checkin}</div>
              <div className="kpi-sub">sessions to note how it went</div>
            </Link>
          ) : (
            <Link to="/inbox" className="card kpi card-interactive" style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="kpi-top">Unread chats<span className="kpi-icon"><Icon name="message" size={15} /></span></div>
              <div className="kpi-value">{activity ? activity.unread_threads : '–'}</div>
              <div className="kpi-sub">{others === '–' ? '' : `${others} other students on StudyBuddy`}</div>
            </Link>
          )}
        </div>

        <div className="dash-grid reveal reveal-2">
          <div className="dash-col">
            <section className="card" aria-labelledby="tm-h">
              <div className="card-head">
                <h2 id="tm-h">Top matches</h2>
                <Link to="/matches" className="btn btn-ghost btn-sm">View all <Icon name="arrowRight" size={14} /></Link>
              </div>
              {matchState.loading ? (
                <div className="card-body stack">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="row">
                      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                      <div className="grow">
                        <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
                        <div className="skeleton" style={{ height: 12, width: '70%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : matchState.error ? (
                <div className="card-body"><Alert>{matchState.error}</Alert></div>
              ) : matchState.matches.length === 0 ? (
                <div className="empty" style={{ padding: '36px 20px' }}>
                  <div className="empty-icon"><Icon name="users" size={20} /></div>
                  <h2>No matches yet</h2>
                  <p>Nobody else has added your courses so far. Invite classmates or add more courses.</p>
                </div>
              ) : (
                <ul className="list">
                  {matchState.matches.map(m => {
                    const label = overlapLabel(m.similarity);
                    return (
                      <li key={m.student_id}>
                        <Link to="/matches" className="list-item">
                          <Avatar name={m.name} size="lg" />
                          <div className="grow">
                            <div className="row-sm">
                              <span className="title truncate">{m.name}</span>
                              <span className={`badge badge-${label.tone}`}>{label.short}</span>
                            </div>
                            <div className="meta truncate">{m.department}</div>
                            {m.shared_courses.length > 0 && (
                              <div className="chips" style={{ marginTop: 8 }}>
                                {m.shared_courses.slice(0, 2).map(c => (
                                  <span key={c} className="chip chip-accent" style={{ height: 24, fontSize: 12 }}>
                                    <span className="chip-text">{name(c)}</span>
                                  </span>
                                ))}
                                {m.shared_courses.length > 2 && <span className="subtle xs" style={{ alignSelf: 'center' }}>+{m.shared_courses.length - 2}</span>}
                              </div>
                            )}
                          </div>
                          <OverlapRing similarity={m.similarity} size={40} stroke={4} />
                          <Icon name="chevronRight" size={16} className="subtle" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card" aria-labelledby="c-h">
              <div className="card-head">
                <h2 id="c-h">Your courses</h2>
                <Link to="/edit-profile" className="btn btn-ghost btn-sm"><Icon name="edit" size={14} />Edit</Link>
              </div>
              {user.course_ids?.length ? (
                <ul className="list">
                  {user.course_ids.map(code => (
                    <li key={code} className="list-item" style={{ padding: '12px 20px' }}>
                      <span className="grow">
                        <span className="title" style={{ display: 'block' }}>{name(code)}</span>
                      </span>
                      {name(code) !== code && <span className="code-tag">{code}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="card-body"><span className="none">No courses yet. Add some to start matching.</span></div>
              )}
            </section>
          </div>

          <div className="dash-col">
            <section className="card" aria-labelledby="w-h">
              <div className="card-head">
                <h2 id="w-h">When you study</h2>
                <Icon name="calendar" size={16} className="subtle" />
              </div>
              <div className="card-body slots">
                {TIME_SLOTS.map(slot => {
                  const on = user.study_times?.includes(slot);
                  return (
                    <div key={slot} className={`slot${on ? ' on' : ''}`}>
                      <span className="slot-name">{slot.replace(/ \(.*\)/, '')}</span>
                      <span className="slot-bar" aria-label={on ? 'Available' : 'Not selected'} />
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card" aria-labelledby="p-h">
              <div className="card-head">
                <h2 id="p-h">Where you study</h2>
                <Icon name="pin" size={16} className="subtle" />
              </div>
              <div className="card-body">
                {user.study_spots?.length ? (
                  <div className="spot-list">
                    {user.study_spots.map(s => <div key={s} className="spot"><Icon name="pin" size={14} /><span className="truncate">{s}</span></div>)}
                  </div>
                ) : <span className="none">No places selected.</span>}
              </div>
            </section>

            <section className="card card-pad">
              <div className="row-sm" style={{ marginBottom: 6 }}>
                <Icon name="sparkles" size={16} style={{ color: 'var(--accent-text)' }} />
                <span className="strong small">How matching works</span>
              </div>
              <p className="muted small">
                We compare your courses, study times and places with every other student. Shared courses count the most,
                then times, then places. Your best matches appear on the Matches page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default Dashboard;
