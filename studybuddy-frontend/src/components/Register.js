import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, isValidNthuEmail } from '../api';
import OTPVerification from './OTPVerification';
import CourseSelector from './CourseSelector';
import { AuthLayout, Alert, FieldError, Icon, PillGroup, Spinner } from './ui';

const EMPTY = {
  name: '',
  email: '',
  college: '',
  department: '',
  course_ids: [],
  study_spots: [],
  study_times: [],
};

const STEPS = [
  { title: 'Create your account', lead: 'Start with the basics. We\'ll confirm your school email at the end.', fields: ['name', 'email', 'college', 'department'] },
  { title: 'What are you taking?', lead: 'Add this semester\'s courses. Shared courses matter most for matching.', fields: ['course_ids'] },
  { title: 'How do you like to study?', lead: 'Pick the places and times that work for you. You can change these later.', fields: ['study_spots', 'study_times'] },
];

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Enter your name.';
  if (!isValidNthuEmail(form.email)) errors.email = 'Use your NTHU email address (ending in .nthu.edu.tw).';
  if (!form.college) errors.college = 'Choose your college.';
  if (!form.department) errors.department = 'Choose your department.';
  if (form.course_ids.length === 0) errors.course_ids = 'Add at least one course.';
  if (form.study_spots.length === 0) errors.study_spots = 'Pick at least one place.';
  if (form.study_times.length === 0) errors.study_times = 'Pick at least one time.';
  return errors;
}

function Register() {
  const [form, setForm] = useState(EMPTY);
  const [courseNames, setCourseNames] = useState({});
  const [options, setOptions] = useState({ college_departments: {}, colleges: [], study_spots: [], study_times: [] });
  const [optionsError, setOptionsError] = useState('');
  const [errors, setErrors] = useState({});
  const [touchedStep, setTouchedStep] = useState(-1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0); // 0..2 form steps, 'otp', 'done'

  useEffect(() => {
    api('/get_options')
      .then(setOptions)
      .catch(() => setOptionsError('Could not load colleges and study options. Refresh the page to try again.'));
  }, []);

  function stepErrors(f, s) {
    const all = validate(f);
    return Object.fromEntries(Object.entries(all).filter(([k]) => STEPS[s].fields.includes(k)));
  }

  function update(field, value) {
    const next = { ...form, [field]: value };
    if (field === 'college') next.department = '';
    setForm(next);
    if (touchedStep === step) setErrors(stepErrors(next, step));
  }

  async function next(e) {
    e.preventDefault();
    setError('');
    const found = stepErrors(form, step);
    setTouchedStep(step);
    setErrors(found);
    if (Object.keys(found).length) {
      const firstId = Object.keys(found)[0] === 'course_ids' ? 'courses' : Object.keys(found)[0];
      document.getElementById(firstId)?.focus();
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setErrors({});
      window.scrollTo({ top: 0 });
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
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep(0);
    } finally {
      setLoading(false);
    }
  }

  if (step === 'otp') {
    return (
      <OTPVerification email={form.email.trim()} purpose="registration" busy={loading}
        onVerified={createAccount} onBack={() => setStep(STEPS.length - 1)} />
    );
  }

  if (step === 'done') {
    return (
      <AuthLayout>
        <div style={{ textAlign: 'center' }}>
          <div className="empty-icon" style={{ background: 'var(--success-soft)', borderColor: 'var(--success-border)', color: 'var(--success-text)' }}>
            <Icon name="check" size={24} strokeWidth={2.2} />
          </div>
          <h1>Welcome aboard, {form.name.split(' ')[0]}</h1>
          <p className="lead">Your profile is ready. Log in to see the classmates who share your courses.</p>
          <Link to="/login" className="btn btn-primary btn-lg btn-block">Log in to StudyBuddy <Icon name="arrowRight" size={16} /></Link>
        </div>
      </AuthLayout>
    );
  }

  const departments = options.college_departments[form.college] || [];
  const meta = STEPS[step];

  return (
    <AuthLayout wide topRight={<Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>}>
      <div className="steps-bar" aria-hidden="true">
        {STEPS.map((_, i) => <span key={i} className={i < step ? 'done' : i === step ? 'current' : ''} />)}
      </div>
      <div className="step-meta">Step {step + 1} of {STEPS.length}</div>
      <h1>{meta.title}</h1>
      <p className="lead">{meta.lead}</p>

      <form onSubmit={next} noValidate>
        <div className="stack">
          <Alert>{optionsError}</Alert>
          <Alert>{error}</Alert>

          {step === 0 && (
            <>
              <div>
                <label className="label" htmlFor="name">Full name</label>
                <input id="name" className="input" autoComplete="name" autoFocus placeholder="e.g. Lin Mei-Hua" value={form.name}
                  onChange={e => update('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby="name-err" />
                <FieldError id="name-err">{errors.name}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="email">School email</label>
                <div className="input-icon">
                  <Icon name="mail" size={16} />
                  <input id="email" className="input" type="email" autoComplete="email" placeholder="you@gapp.nthu.edu.tw"
                    value={form.email} onChange={e => update('email', e.target.value)}
                    aria-invalid={!!errors.email} aria-describedby="email-err" />
                </div>
                <FieldError id="email-err">{errors.email}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="college">College</label>
                <select id="college" className="select" value={form.college} onChange={e => update('college', e.target.value)}
                  aria-invalid={!!errors.college} aria-describedby="college-err">
                  <option value="">Select your college</option>
                  {options.colleges.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <FieldError id="college-err">{errors.college}</FieldError>
              </div>
              <div>
                <label className="label" htmlFor="department">Department</label>
                <select id="department" className="select" value={form.department} disabled={!form.college}
                  onChange={e => update('department', e.target.value)}
                  aria-invalid={!!errors.department} aria-describedby="department-err">
                  <option value="">{form.college ? 'Select your department' : 'Select a college first'}</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <FieldError id="department-err">{errors.department}</FieldError>
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <label className="label" htmlFor="courses">Courses this semester</label>
              <CourseSelector value={form.course_ids} onChange={v => update('course_ids', v)}
                names={courseNames} onNamesChange={setCourseNames} />
              <FieldError>{errors.course_ids}</FieldError>
            </div>
          )}

          {step === 2 && (
            <>
              <div>
                <div className="label">Favourite study spots</div>
                <PillGroup legend="Study spots" name="study_spots" options={options.study_spots}
                  selected={form.study_spots} onChange={v => update('study_spots', v)} />
                <FieldError>{errors.study_spots}</FieldError>
              </div>
              <div style={{ marginTop: 24 }}>
                <div className="label">When you're usually free</div>
                <PillGroup legend="Study times" name="study_times" options={options.study_times}
                  selected={form.study_times} onChange={v => update('study_times', v)} />
                <FieldError>{errors.study_times}</FieldError>
              </div>
              <p className="hint">Classmates see your name, department, courses and these preferences. Your email is only shown to students you're matched with.</p>
            </>
          )}

          <div className="row" style={{ marginTop: 28 }}>
            {step > 0 && (
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => { setStep(step - 1); setErrors({}); }}>
                <Icon name="arrowLeft" size={16} /> Back
              </button>
            )}
            <button className="btn btn-primary btn-lg grow" type="submit" disabled={loading}>
              {loading ? <><Spinner /> Sending code…</>
                : step < STEPS.length - 1 ? <>Continue <Icon name="arrowRight" size={16} /></>
                : <>Verify my email <Icon name="arrowRight" size={16} /></>}
            </button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}

export default Register;
