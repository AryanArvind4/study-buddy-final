import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isValidNthuEmail } from '../api';
import OTPVerification from './OTPVerification';
import CourseSelector from './CourseSelector';
import { AuthLayout, Alert, Icon, Spinner, ToggleGroup } from './ui';

const EMPTY = {
  name: '',
  email: '',
  college: '',
  department: '',
  course_ids: [],
  study_spots: [],
  study_times: [],
};

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter your name.';
  if (!isValidNthuEmail(form.email)) errors.email = 'Use your NTHU email address (ending in .nthu.edu.tw).';
  if (!form.college) errors.college = 'Choose your college.';
  if (!form.department) errors.department = 'Choose your department.';
  if (form.course_ids.length === 0) errors.course_ids = 'Add at least one course you are taking.';
  if (form.study_spots.length === 0) errors.study_spots = 'Pick at least one place.';
  if (form.study_times.length === 0) errors.study_times = 'Pick at least one time.';
  return errors;
}

function FieldError({ id, children }) {
  if (!children) return null;
  return <span id={id} className="hint" style={{ color: 'var(--danger)' }}>{children}</span>;
}

function Register() {
  const [form, setForm] = useState(EMPTY);
  const [courseNames, setCourseNames] = useState({});
  const [options, setOptions] = useState({ college_departments: {}, colleges: [], study_spots: [], study_times: [] });
  const [optionsError, setOptionsError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form'); // 'form' | 'otp' | 'success'

  useEffect(() => {
    api('/get_options')
      .then(setOptions)
      .catch(() => setOptionsError('Could not load colleges and study options. Refresh the page to try again.'));
  }, []);

  function update(field, value) {
    const next = { ...form, [field]: value };
    if (field === 'college') next.department = '';
    setForm(next);
    if (submitted) setErrors(validate(next));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitted(true);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = document.getElementById(Object.keys(found)[0] === 'course_ids' ? 'courses' : Object.keys(found)[0]);
      first?.focus();
      return;
    }
    setLoading(true);
    try {
      await api('/send_otp', { method: 'POST', body: { email: form.email.trim() } });
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function createAccount() {
    setLoading(true);
    try {
      await api('/register', { method: 'POST', body: { ...form, email: form.email.trim() } });
      setStep('success');
    } catch (err) {
      setError(err.message);
      setStep('form');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'otp') {
    return (
      <OTPVerification
        email={form.email.trim()}
        purpose="registration"
        busy={loading}
        onVerified={createAccount}
        onBack={() => setStep('form')}
      />
    );
  }

  if (step === 'success') {
    return (
      <AuthLayout>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="icon-circle success" style={{ margin: '0 auto 16px' }}><Icon name="check" size={24} /></div>
          <h1>You're all set, {form.name.split(' ')[0]}</h1>
          <p className="lead">Your profile is ready. Log in to see classmates who share your courses.</p>
          <Link to="/login" className="btn btn-primary btn-lg btn-block">Log in</Link>
        </div>
      </AuthLayout>
    );
  }

  const departments = options.college_departments[form.college] || [];

  return (
    <AuthLayout wide>
      <div className="card">
        <h1>Create your profile</h1>
        <p className="lead">Takes about two minutes. Classmates see your name, department, courses and study preferences. Your email is only shared when you reach out.</p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="stack" style={{ marginBottom: 24 }}>
            <Alert>{optionsError}</Alert>
            <Alert>{error}</Alert>
          </div>

          <section className="form-section" aria-labelledby="about-title">
            <h2 id="about-title">About you</h2>
            <p className="muted">We'll send a code to your school email to confirm it's you.</p>
            <div className="field">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" className="input" autoComplete="name" value={form.name}
                onChange={e => update('name', e.target.value)}
                aria-invalid={!!errors.name} aria-describedby="name-err" />
              <FieldError id="name-err">{errors.name}</FieldError>
            </div>
            <div className="field">
              <label className="label" htmlFor="email">NTHU email</label>
              <input id="email" className="input" type="email" autoComplete="email" placeholder="you@gapp.nthu.edu.tw"
                value={form.email} onChange={e => update('email', e.target.value)}
                aria-invalid={!!errors.email} aria-describedby="email-err" />
              <FieldError id="email-err">{errors.email}</FieldError>
            </div>
            <div className="grid-2" style={{ marginTop: 18 }}>
              <div>
                <label className="label" htmlFor="college">College</label>
                <select id="college" className="select" value={form.college}
                  onChange={e => update('college', e.target.value)}
                  aria-invalid={!!errors.college} aria-describedby="college-err">
                  <option value="">Choose a college</option>
                  {options.colleges.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <FieldError id="college-err">{errors.college}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="department">Department</label>
                <select id="department" className="select" value={form.department}
                  onChange={e => update('department', e.target.value)} disabled={!form.college}
                  aria-invalid={!!errors.department} aria-describedby="department-err">
                  <option value="">{form.college ? 'Choose a department' : 'Choose a college first'}</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <FieldError id="department-err">{errors.department}</FieldError>
              </div>
            </div>
          </section>

          <section className="form-section" aria-labelledby="courses-title">
            <h2 id="courses-title">Your courses this semester</h2>
            <p className="muted">These matter most for matching.</p>
            <label className="visually-hidden" htmlFor="courses">Search courses</label>
            <CourseSelector
              value={form.course_ids}
              onChange={v => update('course_ids', v)}
              names={courseNames}
              onNamesChange={setCourseNames}
            />
            <FieldError>{errors.course_ids}</FieldError>
          </section>

          <section className="form-section" aria-labelledby="spots-title">
            <h2 id="spots-title">Where do you like to study?</h2>
            <p className="muted">Pick all that apply.</p>
            <ToggleGroup legend="Study spots" name="study_spots" options={options.study_spots}
              selected={form.study_spots} onChange={v => update('study_spots', v)} />
            <FieldError>{errors.study_spots}</FieldError>
          </section>

          <section className="form-section" aria-labelledby="times-title">
            <h2 id="times-title">When are you usually free to study?</h2>
            <p className="muted">Pick all that apply.</p>
            <ToggleGroup legend="Study times" name="study_times" options={options.study_times}
              selected={form.study_times} onChange={v => update('study_times', v)} />
            <FieldError>{errors.study_times}</FieldError>
          </section>

          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
            {loading ? <><Spinner /> Sending code…</> : <>Continue <Icon name="arrowRight" size={18} /></>}
          </button>
        </form>
      </div>
      <p className="auth-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}

export default Register;
