import React, { useState, useEffect } from 'react';

function OTPVerification({ email, onVerified, onBack, purpose = 'registration' }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          setCanResend(true);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5001/verify_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Email verified successfully!');
        setTimeout(() => {
          onVerified();
        }, 1500);
      } else {
        setError(data.error || 'Verification failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('OTP verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5001/send_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('New OTP sent to your email!');
        setTimeLeft(600); // Reset timer
        setCanResend(false);
      } else {
        setError(data.error || 'Failed to resend OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Resend OTP error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f5f7fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        padding: '3rem',
        width: '100%',
        maxWidth: '500px',
        textAlign: 'center'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📧</div>
          <h2 style={{ color: '#1f2937', fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>
            Verify Your Email
          </h2>
          <p style={{ color: '#6b7280', fontSize: '1rem', margin: 0 }}>
            We've sent a 6-digit verification code to
          </p>
          <p style={{ color: '#6366f1', fontWeight: '600', fontSize: '1.1rem', margin: '0.5rem 0 0 0' }}>
            {email}
          </p>
        </div>

        {/* OTP Form */}
        <form onSubmit={handleVerifyOTP} style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="otp" style={{ display: 'block', color: '#374151', fontWeight: '600', marginBottom: '0.5rem' }}>
              Enter Verification Code
            </label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength="6"
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid #e5e7eb',
                borderRadius: '0.5rem',
                fontSize: '1.5rem',
                textAlign: 'center',
                letterSpacing: '0.5rem',
                fontWeight: 'bold',
                color: '#1f2937'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#dc2626',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#166534',
              fontSize: '0.9rem'
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            style={{
              width: '100%',
              backgroundColor: (loading || otp.length !== 6) ? '#d1d5db' : '#6366f1',
              color: 'white',
              border: 'none',
              padding: '1rem 2rem',
              borderRadius: '0.5rem',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer',
              marginBottom: '1rem'
            }}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>

        {/* Timer and Resend */}
        <div style={{ marginBottom: '2rem' }}>
          {timeLeft > 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
              Code expires in <span style={{ color: '#ef4444', fontWeight: '600' }}>{formatTime(timeLeft)}</span>
            </p>
          ) : (
            <p style={{ color: '#ef4444', fontSize: '0.9rem', margin: 0 }}>
              Code has expired
            </p>
          )}
          
          <button
            onClick={handleResendOTP}
            disabled={!canResend || loading}
            style={{
              backgroundColor: 'transparent',
              color: canResend && !loading ? '#6366f1' : '#9ca3af',
              border: 'none',
              padding: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: canResend && !loading ? 'pointer' : 'not-allowed',
              textDecoration: canResend && !loading ? 'underline' : 'none',
              marginTop: '0.5rem'
            }}
          >
            {loading ? 'Sending...' : 'Resend Code'}
          </button>
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          style={{
            backgroundColor: 'transparent',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: '500',
            cursor: 'pointer'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#f9fafb';
            e.target.style.borderColor = '#9ca3af';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.borderColor = '#d1d5db';
          }}
        >
          ← Back to {purpose === 'registration' ? 'Registration' : 'Login'}
        </button>
      </div>
    </div>
  );
}

export default OTPVerification;



