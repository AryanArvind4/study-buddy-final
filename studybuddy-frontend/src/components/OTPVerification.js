import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { AuthLayout, Alert, Icon, Spinner } from './ui';

const RESEND_SECONDS = 60; // matches the backend's resend cooldown
const CODE_LIFETIME = 600;
const LENGTH = 6;

function OtpInput({ value, onChange, onComplete, disabled }) {
  const refs = useRef([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] || '');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setAt(index, char) {
    const next = digits.slice();
    next[index] = char;
    const joined = next.join('').slice(0, LENGTH);
    onChange(joined);
    if (joined.length === LENGTH) onComplete?.(joined);
  }

  function handleChange(index, e) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;
    if (raw.length > 1) {
      // Pasted or autofilled several digits at once.
      const filled = (digits.slice(0, index).join('') + raw).slice(0, LENGTH);
      onChange(filled);
      refs.current[Math.min(filled.length, LENGTH - 1)]?.focus();
      if (filled.length === LENGTH) onComplete?.(filled);
      return;
    }
    setAt(index, raw);
    if (index < LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <div className="otp-group" role="group" aria-label="6-digit verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => (refs.current[i] = el)}
          className={`otp-box${d ? ' filled' : ''}`}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={i === 0 ? LENGTH : 1}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
        />
      ))}
    </div>
  );
}

function OTPVerification({ email, onVerified, onBack, purpose = 'registration', busy = false, error: outerError = '' }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = Math.floor((now - sentAt) / 1000);
  const resendIn = Math.max(0, RESEND_SECONDS - elapsed);
  const expiresIn = Math.max(0, CODE_LIFETIME - elapsed);
  const working = loading || busy;

  async function verify(code = otp) {
    setError('');
    setNotice('');
    if (code.length !== LENGTH) {
      setError('Enter all 6 digits from your email.');
      return;
    }
    setLoading(true);
    try {
      await api('/verify_otp', { method: 'POST', body: { email, otp: code } });
      onVerified();
    } catch (err) {
      setError(err.message);
      setOtp('');
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
      setNotice('New code sent. Earlier codes no longer work.');
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
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: -10, marginBottom: 20 }} onClick={onBack}>
        <Icon name="arrowLeft" size={15} /> Use a different email
      </button>
      <div className="empty-icon" style={{ margin: '0 0 20px' }}><Icon name="mail" size={22} /></div>
      <h1>Check your inbox</h1>
      <p className="lead">
        Enter the 6-digit code we sent to <span className="strong" style={{ color: 'var(--text)' }}>{email}</span>.
      </p>

      <form onSubmit={e => { e.preventDefault(); verify(); }} noValidate>
        <div className="stack">
          <OtpInput value={otp} onChange={setOtp} onComplete={code => !working && verify(code)} disabled={working} />
          <div className="between xs subtle">
            <span>{expiresIn > 0 ? `Expires in ${mm}:${ss}` : 'Code expired'}</span>
            <span>5 attempts per code</span>
          </div>
          <Alert>{outerError || error}</Alert>
          <Alert type="success">{notice}</Alert>
          <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={working || otp.length !== LENGTH}>
            {working ? <><Spinner /> Verifying…</> : purpose === 'registration' ? 'Verify and create account' : 'Verify and log in'}
          </button>
        </div>
      </form>

      <p className="subtle small" style={{ marginTop: 24, textAlign: 'center' }}>
        Didn't get it? Check spam, or{' '}
        {resendIn > 0 ? (
          <span>resend in <span className="mono">{resendIn}s</span></span>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '0 4px', height: 'auto', color: 'var(--accent-text)' }}
            onClick={resend} disabled={working}>resend the code</button>
        )}
      </p>
    </AuthLayout>
  );
}

export default OTPVerification;
