import React, { useState } from 'react';
import OTPVerification from './OTPVerification';

// API Base URL - use environment variable or default to production
const API_BASE = process.env.REACT_APP_API_URL || 'https://study-buddy-final.onrender.com';

function Login() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('email'); // 'email' or 'otp'

  function validateNTHUEmail(email) {
    return email && email.trim().toLowerCase().endsWith('.nthu.edu.tw');
  }

  function handleLogin(e) {
    e.preventDefault();
    setError('');
    
    if (!email) {
      setError('Please enter your NTHU email address.');
      return;
    }
    
    if (!validateNTHUEmail(email)) {
      setError('Please use a valid NTHU email address ending with .nthu.edu.tw');
      return;
    }
    
    setLoading(true);
    
    // First, send OTP to verify it's really the user
    fetch(`${API_BASE}/send_otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
          setError(data.error);
        } else {
          // Move to OTP verification step
          setStep('otp');
        }
      })
      .catch(err => {
        setLoading(false);
        setError('Network error. Please try again.');
        console.error('Send OTP error:', err);
      });
  }

  function handleOTPVerified() {
    // After OTP is verified, complete the login
    setLoading(true);
    
    fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
          setError(data.error);
          setStep('email'); // Go back to email input if login fails
        } else {
          // Successful login, redirect to dashboard
          console.log('Login successful:', data);
          window.location.href = '/dashboard';
        }
      })
      .catch(err => {
        setLoading(false);
        setError('Network error during login. Please try again.');
        setStep('email');
        console.error('Login error:', err);
      });
  }

  function handleBackToEmail() {
    setStep('email');
    setError('');
  }

  // Show OTP verification screen
  if (step === 'otp') {
    return (
      <OTPVerification
        email={email}
        onVerified={handleOTPVerified}
        onBack={handleBackToEmail}
        purpose="login"
      />
    );
  }

  // Show email input screen
  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleLogin}>
        <div className="auth-header">
          <span className="auth-logo">StudyBuddy</span>
          <h1>Login</h1>
        </div>
        {error && <div className="error-message" style={{ display: 'block' }}>{error}</div>}
        <div className="form-group">
          <label htmlFor="email">NTHU Email Address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="yourname@gapp.nthu.edu.tw"
          />
          <small style={{ color: '#666', fontSize: '0.8em' }}>
            Use your official NTHU email address to login
          </small>
        </div>
        <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default Login;
