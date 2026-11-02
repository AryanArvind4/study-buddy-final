import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Icon, Logo, OverlapRing, ThemeToggle } from './ui';

/* Everything in the mockup is illustrative sample content, not real student data. */
const SAMPLE = [
  { name: 'Example A', dept: 'Computer Science', sim: 82, courses: ['Data Structures', 'Calculus II'], time: 'Evening' },
  { name: 'Example B', dept: 'Electrical Engineering', sim: 61, courses: ['Data Structures'], time: 'Weekend' },
  { name: 'Example C', dept: 'Mathematics', sim: 44, courses: ['Calculus II'], time: 'Morning' },
];

function AppMockup() {
  return (
    <div className="mockup-wrap" aria-hidden="true">
      <div className="mockup">
        <div className="mockup-bar">
          <span className="dot" /><span className="dot" /><span className="dot" />
          <span className="url">studybuddynthu.org/matches</span>
        </div>
        <div className="mockup-body">
          <div className="mockup-side">
            <div className="row-sm" style={{ padding: '2px 8px 14px', fontWeight: 600, fontSize: 13 }}>StudyBuddy</div>
            <div className="ms"><Icon name="home" size={15} />Home</div>
            <div className="ms on"><Icon name="users" size={15} />Matches</div>
            <div className="ms"><Icon name="settings" size={15} />Profile</div>
          </div>
          <div className="mockup-main">
            <div className="between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em' }}>Your matches</div>
                <div className="subtle small">Ranked by shared courses, then times and places</div>
              </div>
              <span className="badge badge-neutral">Fall semester</span>
            </div>
            <div className="mockup-cards">
              {SAMPLE.map(m => (
                <div key={m.name} className="mock-card">
                  <div className="between">
                    <div className="row-sm">
                      <Avatar name={m.name} />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.name}</div>
                        <div className="subtle xs">{m.dept}</div>
                      </div>
                    </div>
                    <OverlapRing similarity={m.sim} size={36} stroke={4} />
                  </div>
                  <div className="chips">
                    {m.courses.map(c => <span key={c} className="chip chip-accent"><Icon name="book" size={12} />{c}</span>)}
                    <span className="chip"><Icon name="clock" size={12} />{m.time}</span>
                  </div>
                  <div className="btn btn-secondary btn-sm btn-block" style={{ pointerEvents: 'none' }}><Icon name="send" size={14} />Connect</div>
                </div>
              ))}
            </div>
            <div className="mock-card" style={{ gridTemplateColumns: 'auto 1fr auto', alignItems: 'center' }}>
              <span className="feat-icon" style={{ margin: 0 }}><Icon name="sparkles" size={16} /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>Why Example A is your top match</div>
                <div className="subtle xs">2 shared courses · you both like the Library · both free on weekday evenings</div>
              </div>
              <Icon name="chevronRight" size={16} className="subtle" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <header className={`mk-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="mk-nav-inner">
          <Logo />
          <nav className="mk-links" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#privacy">Privacy</a>
          </nav>
          <div className="mk-actions">
            <ThemeToggle compact />
            <Link to="/login" className="btn btn-ghost hide-sm">Log in</Link>
            <Link to="/register" className="btn btn-dark">Get started</Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="mk-hero">
          <div className="bg-grid" />
          <div className="bg-glow" />
          <div className="reveal">
            <span className="announce">
              <span className="tag">NTHU</span>
              <span className="tail">Made for 清華 students · verified with your school email</span>
              <span className="tail-short">Made for 清華 students</span>
            </span>
          </div>
          <h1 className="reveal reveal-1">Study better, <span className="gradient-text">together.</span></h1>
          <p className="sub reveal reveal-2">
            StudyBuddy finds classmates who share your courses, your favourite study spots and your free time,
            and shows you exactly why you'd work well together.
          </p>
          <div className="ctas reveal reveal-3">
            <Link to="/register" className="btn btn-primary btn-lg">
              Find your study partner <Icon name="arrowRight" size={16} />
            </Link>
            <a href="#how" className="btn btn-secondary btn-lg">See how it works</a>
          </div>
          <div className="fine reveal reveal-4">
            <span><Icon name="check" size={14} strokeWidth={2.4} />Free for students</span>
            <span><Icon name="check" size={14} strokeWidth={2.4} />No passwords</span>
            <span><Icon name="check" size={14} strokeWidth={2.4} />Set up in 2 minutes</span>
          </div>
          <AppMockup />
        </section>

        <section id="features" className="mk-section">
          <div className="mk-head">
            <div className="eyebrow">Features</div>
            <h2>Everything you need to find the right study partner</h2>
            <p>Built around how NTHU students actually study: same course, a place you both like, a time you're both free.</p>
          </div>

          <div className="bento">
            <article className="card b-wide">
              <div className="feat-icon"><Icon name="book" size={17} /></div>
              <h3>Course-first matching</h3>
              <p>Search the official NTHU course list by code or name. Shared courses count most when we rank your matches.</p>
              <div className="visual" aria-hidden="true">
                <div style={{ width: '100%', display: 'grid', gap: 8 }}>
                  {[['11410CS 235100', 'Data Structures', '資料結構'], ['11410MATH102000', 'Calculus II', '微積分二'], ['11410PHYS101000', 'General Physics I', '普通物理一']].map(([code, en, zh]) => (
                    <div key={code} className="row" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)' }}>
                      <span className="code-tag">{code}</span>
                      <span className="grow truncate" style={{ fontSize: 13.5, fontWeight: 500 }}>{en}</span>
                      <span className="subtle xs">{zh}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="card b-narrow">
              <div className="feat-icon"><Icon name="target" size={17} /></div>
              <h3>Explained, not a black box</h3>
              <p>Every match shows the courses, places and times you share.</p>
              <div className="visual" aria-hidden="true">
                <div className="row" style={{ width: '100%', justifyContent: 'center', gap: 16 }}>
                  <OverlapRing similarity={82} size={72} stroke={6}><span className="xs strong">Strong</span></OverlapRing>
                  <OverlapRing similarity={52} size={56} stroke={5}><span className="xs">Good</span></OverlapRing>
                </div>
              </div>
            </article>

            <article className="card b-third">
              <div className="feat-icon"><Icon name="pin" size={17} /></div>
              <h3>Places you already know</h3>
              <p>Match on campus spots like the Library, Louisa or the Moonlight area.</p>
              <div className="visual" aria-hidden="true">
                <div className="chips">
                  {['Library', 'Louisa Café', 'XCB (小吃部)', 'Moonlight Area'].map(s => <span key={s} className="chip"><Icon name="pin" size={12} />{s}</span>)}
                </div>
              </div>
            </article>

            <article className="card b-third">
              <div className="feat-icon"><Icon name="clock" size={17} /></div>
              <h3>Fits your schedule</h3>
              <p>Tell us when you're usually free and we'll favour people who are too.</p>
              <div className="visual" aria-hidden="true">
                <div className="slots" style={{ width: '100%' }}>
                  {[['Morning', false], ['Afternoon', true], ['Evening', true], ['Weekend', false]].map(([s, on]) => (
                    <div key={s} className={`slot${on ? ' on' : ''}`} style={{ gridTemplateColumns: '80px 1fr' }}>
                      <span className="slot-name">{s}</span><span className="slot-bar" />
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="card b-third" id="privacy">
              <div className="feat-icon"><Icon name="shield" size={17} /></div>
              <h3>Verified and private</h3>
              <p>Only students with an NTHU email can join. Your email is never shown to other students; you chat inside StudyBuddy.</p>
              <div className="visual" aria-hidden="true">
                <div className="row" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-subtle)', width: '100%' }}>
                  <Icon name="lock" size={15} className="subtle" />
                  <span className="mono subtle grow">••••@gapp.nthu.edu.tw</span>
                  <span className="badge badge-strong">Verified</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="how" className="mk-section" style={{ paddingTop: 0 }}>
          <div className="mk-head">
            <div className="eyebrow">How it works</div>
            <h2>From sign-up to study session in three steps</h2>
          </div>
          <div className="how">
            <div className="card">
              <span className="num">01</span>
              <h3>Verify your NTHU email</h3>
              <p>Enter your school email and the 6-digit code we send. No password to remember.</p>
            </div>
            <div className="card">
              <span className="num">02</span>
              <h3>Add courses and habits</h3>
              <p>Pick this semester's courses, where you like to study, and when you're usually free.</p>
            </div>
            <div className="card">
              <span className="num">03</span>
              <h3>Connect, chat and meet up</h3>
              <p>Send a request, chat once they accept, and plan a study session with a time, place and agenda.</p>
            </div>
          </div>
        </section>

        <section className="mk-section" style={{ paddingTop: 0 }}>
          <div className="cta-band">
            <h2>Your next study session starts with one match.</h2>
            <p>Join with your NTHU email. It takes about two minutes.</p>
            <Link to="/register" className="btn btn-lg btn-light">
              Create your profile <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mk-footer">
        <div className="mk-footer-inner">
          <Logo size={22} />
          <span>Made for National Tsing Hua University students.</span>
          <div className="row">
            <Link to="/login" style={{ color: 'var(--text-subtle)' }}>Log in</Link>
            <Link to="/register" style={{ color: 'var(--text-subtle)' }}>Sign up</Link>
          </div>
        </div>
      </footer>
    </>
  );
}

export default LandingPage;
