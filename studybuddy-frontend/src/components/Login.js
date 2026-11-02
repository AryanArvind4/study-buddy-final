import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, isValidNthuEmail } from '../api';
import OTPVerification from './OTPVerification';
import { AuthLayout, FieldError, Icon, Alert, Spinner } from './ui';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [loginError, setLoginError] = useState('');

  async function sendCode(e) {
    e.preventDefault();
    setError('');
    setFieldError('');
    if (!isValidNthuEmail(email)) {
      setFieldError('Use your NTHU email address (ending in .nthu.edu.tw).');
      return;
    }
    setLoading(true);
    try {
      await api('/send_otp', { method: 'POST', body: { email: email.trim() } });
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function completeLogin() {
    setLoginError('');
    setLoading(true);
    try {
      await api('/login', { method: 'POST', body: { email: email.trim() } });
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err.message);
      setLoading(false);
    }
  }

  if (step === 'otp') {
    return (
      <OTPVerification
        email={email.trim()}
        purpose="login"
        busy={loading}
        error={loginError}
        onVerified={completeLogin}
        onBack={() => {
          setStep('email');
          setLoginError('');
        }}
      />
    );
  }

  return (
    <AuthLayout topRight={<Link to="/register" className="btn btn-ghost btn-sm">Sign up</Link>}>
      <h1>Welcome back</h1>
      <p className="lead">Log in with your NTHU email. We'll send you a one-time code.</p>
      <form onSubmit={sendCode} noValidate>
        <div className="stack">
          <Alert>{error}</Alert>
          <div>
            <label className="label" htmlFor="email">School email</label>
            <div className="input-icon">
              <Icon name="mail" size={16} />
              <input id="email" className="input" type="email" autoComplete="email" autoFocus
                placeholder="you@gapp.nthu.edu.tw" value={email}
                onChange={e => { setEmail(e.target.value); setFieldError(''); }}
                aria-invalid={!!fieldError} aria-describedby="email-err" />
            </div>
            <FieldError id="email-err">{fieldError}</FieldError>
          </div>
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
            {loading ? <><Spinner /> Sending code…</> : <>Continue with email <Icon name="arrowRight" size={16} /></>}
          </button>
        </div>
      </form>
      <p className="subtle small" style={{ marginTop: 24, textAlign: 'center' }}>
        New to StudyBuddy? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
