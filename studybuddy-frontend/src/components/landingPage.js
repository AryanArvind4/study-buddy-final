import React, { useEffect } from 'react';
import { gsap } from 'gsap';
 // Adjust path as needed

function LandingPage() {
  useEffect(() => {
    // GSAP animations moved from vanilla JS to React useEffect
    gsap.set('.hero-content > *', { opacity: 0, y: 50 });
    gsap.set('.floating-card', { opacity: 0, scale: 0 });
    gsap.set('.feature-card', { opacity: 0, y: 30 });

    const heroTl = gsap.timeline();
    heroTl.to('.logo-container', {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: 'back.out(1.7)'
    })
    .to('.hero-text', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power2.out'
    }, '-=0.3')
    .to('.cta-buttons', {
      opacity: 1,
      y: 0,
      duration: 0.6,
      ease: 'power2.out'
    }, '-=0.2');

    gsap.to('.floating-card', {
      opacity: 0.7,
      scale: 1,
      duration: 1,
      stagger: 0.2,
      ease: 'back.out(1.7)',
      delay: 0.5
    });

    const floatAnimData = [
      { selector: '.card-1', y: -20, rotation: 5, duration: 3 },
      { selector: '.card-2', y: -15, rotation: -3, duration: 2.5 },
      { selector: '.card-3', y: -25, rotation: 7, duration: 3.5 },
      { selector: '.card-4', y: -18, rotation: -5, duration: 2.8 },
    ];

    floatAnimData.forEach(({selector, y, rotation, duration}) => {
      gsap.to(selector, {
        y,
        rotation,
        duration,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    });

    gsap.to('.feature-card', {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.2,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.features',
        start: 'top 80%'
      }
    });

  }, []);

  return (
    <div className="container">
      <header className="hero">
        <div className="hero-content">
          <div className="logo-container">
            <h1 className="logo">StudyBuddy</h1>
            <p className="tagline">Connect. Study. Succeed.</p>
          </div>

          <div className="hero-text">
            <h2 className="hero-title">Find Your Perfect Study Partner at NTHU</h2>
            <p className="hero-description">
              Connect with fellow students who share your courses, study preferences,
              and schedules. Make studying more effective and enjoyable!
            </p>
          </div>

          <div className="cta-buttons">
            <button className="btn btn-primary" onClick={() => window.location.href = "/register"}>
              Get Started
            </button>
            <button className="btn btn-secondary" onClick={() => window.location.href = "/login"}>
              Already have an account?
            </button>
          </div>
        </div>

        <div className="floating-elements">
          <div className="floating-card card-1">📚</div>
          <div className="floating-card card-2">🎓</div>
          <div className="floating-card card-3">🤝</div>
          <div className="floating-card card-4">💡</div>
        </div>
      </header>

      <section className="features">
        <h3 className="section-title">Why Choose StudyBuddy?</h3>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h4>Smart Matching</h4>
            <p>AI-powered algorithm matches you with students based on courses, study spots, and schedules</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📅</div>
            <h4>Flexible Scheduling</h4>
            <p>Find partners who match your preferred study times and locations</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏫</div>
            <h4>NTHU Community</h4>
            <p>Connect exclusively with National Tsinghua University students</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
