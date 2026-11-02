import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { AuthLayout, Alert, Icon, Spinner } from './ui';

const RESEND_SECONDS = 60; // matches the backend's resend cooldown
const CODE_LIFETIME = 600;

function OTPVerification({ email, onVerified, onBack, purpose = 'registration', busy = false, error: outerError = '' }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = Math.floor((now - sentAt) / 1000);
  const resendIn = Math.max(0, RESEND_SECONDS - elapsed);
  const expiresIn = Math.max(0, CODE_LIFETIME - elapsed);
  const working = loading || busy;

  async function verify(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (otp.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      await api('/verify_otp', { method: 'POST', body: { email, otp } });
      onVerified();
    } catch (err) {
      setError(err.message);
      setOtp('');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await api('/send_otp', { method: 'POST', body: { email } });
      setSentAt(Date.now());
      setNow(Date.now());
      setOtp('');
      setNotice('We sent a new code. Older codes no longer work.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const mm = Math.floor(expiresIn / 60);
  const ss = String(expiresIn % 60).padStart(2, '0');

  return (
    <AuthLayout>
      <div className="card">
        <div className="icon-circle"><Icon name="mail" size={22} /></div>
        <h1>Check your email</h1>
        <p className="lead">
          We sent a 6-digit code to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
          {purpose === 'registration' ? ' Enter it to create your account.' : ' Enter it to log in.'}
        </p>

        <form onSubmit={verify} noValidate>
          <div className="stack">
            <Alert>{outerError || error}</Alert>
            <Alert type="success">{notice}</Alert>
            <div className="field">
              <label className="label" htmlFor="otp">Verification code</label>
              <input
                id="otp"
                ref={inputRef}
                className="input input-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                aria-describedby="otp-hint"
              />
              <span id="otp-hint" className="hint">
                {expiresIn > 0 ? `Code expires in ${mm}:${ss}. You have 5 tries.` : 'This code has expired. Request a new one.'}
              </span>
            </div>
            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={working || otp.length !== 6}>
              {working ? <><Spinner /> Checking…</> : purpose === 'registration' ? 'Verify and create account' : 'Verify and log in'}
            </button>
          </div>
        </form>

        <div className="row-between" style={{ marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            <Icon name="arrowLeft" size={16} /> Change email
          </button>
          <button type="button" className="btn btn-ghost" onClick={resend} disabled={working || resendIn > 0}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
        </div>
      </div>
      <p className="auth-footer">Can't find it? Check your spam folder.</p>
    </AuthLayout>
  );
}

export default OTPVerification;
