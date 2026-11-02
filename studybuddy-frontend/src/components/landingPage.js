import React from 'react';
import { Link } from 'react-router-dom';
import { Brand, Icon, Avatar } from './ui';

function LandingPage() {
  return (
    <>
      <header className="landing-nav">
        <Brand />
        <Link to="/login" className="btn btn-ghost">Log in</Link>
      </header>

      <main>
        <section className="hero">
          <div className="fade-up">
            <span className="eyebrow">
              <Icon name="shield" size={15} />
              For NTHU students · verified school email
            </span>
            <h1>Find people in your courses to study with.</h1>
            <p className="lead">
              Add your courses, favourite study spots and free times. StudyBuddy shows you classmates
              who overlap with you, and explains why.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary btn-lg">
                Create your profile
                <Icon name="arrowRight" size={18} />
              </Link>
              <Link to="/login" className="btn btn-secondary btn-lg">I already have an account</Link>
            </div>
          </div>

          {/* Illustrative example of a match card, not real student data */}
          <div className="hero-preview fade-up" aria-hidden="true" style={{ animationDelay: '80ms' }}>
            <div className="preview-card">
              <div className="row-between" style={{ marginBottom: 14 }}>
                <div className="row">
                  <Avatar name="Example Student" large />
                  <div>
                    <div style={{ fontWeight: 600 }}>Example classmate</div>
                    <div className="muted small">Department of Computer Science</div>
                  </div>
                </div>
                <span className="badge badge-strong">Strong overlap</span>
              </div>
              <div className="section-label"><Icon name="book" size={13} /> Shared courses</div>
              <div className="chips" style={{ marginBottom: 12 }}>
                <span className="chip chip-accent">Data Structures</span>
                <span className="chip chip-accent">Calculus II</span>
              </div>
              <div className="section-label"><Icon name="clock" size={13} /> Both free</div>
              <div className="chips">
                <span className="chip">Evening (6-9 PM)</span>
              </div>
            </div>
            <div className="preview-card">
              <div className="row">
                <span className="icon-circle" style={{ margin: 0, width: 40, height: 40 }}>
                  <Icon name="pin" size={18} />
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>You both like the Library</div>
                  <div className="muted small">An easy place to meet for a first session.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="steps" aria-labelledby="how-title">
          <h2 id="how-title">How it works</h2>
          <div className="step-grid">
            <div className="card">
              <div className="step-num">1</div>
              <h3>Verify your NTHU email</h3>
              <p className="muted small">Only students with an nthu.edu.tw address can join, so you know who you're meeting.</p>
            </div>
            <div className="card">
              <div className="step-num">2</div>
              <h3>Add your courses and habits</h3>
              <p className="muted small">Search the NTHU course list, then pick where and when you like to study.</p>
            </div>
            <div className="card">
              <div className="step-num">3</div>
              <h3>Reach out to a match</h3>
              <p className="muted small">See what you share with each classmate and send them an introduction email.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">StudyBuddy · Made for National Tsing Hua University students</footer>
    </>
  );
}

export default LandingPage;
