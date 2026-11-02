import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, isValidNthuEmail } from '../api';
import OTPVerification from './OTPVerification';
import { AuthLayout, Alert, Spinner } from './ui';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('email'); // 'email' | 'otp'
  const [loginError, setLoginError] = useState('');

  async function sendCode(e) {
    e.preventDefault();
    setError('');
    if (!isValidNthuEmail(email)) {
      setError('Use your NTHU email address (ending in .nthu.edu.tw).');
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
    <AuthLayout>
      <div className="card">
        <h1>Log in</h1>
        <p className="lead">We'll email you a one-time code. No password needed.</p>
        <form onSubmit={sendCode} noValidate>
          <div className="stack">
            <Alert>{error}</Alert>
            <div className="field">
              <label className="label" htmlFor="email">NTHU email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@gapp.nthu.edu.tw"
                value={email}
                onChange={e => setEmail(e.target.value)}
                aria-invalid={!!error}
              />
            </div>
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
              {loading ? <><Spinner /> Sending code…</> : 'Email me a code'}
            </button>
          </div>
        </form>
      </div>
      <p className="auth-footer">
        New to StudyBuddy? <Link to="/register">Create a profile</Link>
      </p>
    </AuthLayout>
  );
}

export default Login;
