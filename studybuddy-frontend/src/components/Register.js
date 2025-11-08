import React, { useState, useEffect } from 'react';
import OTPVerification from './OTPVerification';

// API Base URL - use environment variable or default to production
const API_BASE = process.env.REACT_APP_API_URL || 'https://study-buddy-final.onrender.com';

function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    college: '',
    department: '',
    selectedCourses: [],
    study_spots: [],
    study_times: [],
  });
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [allCollegeDepartments, setAllCollegeDepartments] = useState({});
  const [studySpots, setStudySpots] = useState([]);
  const [studyTimes, setStudyTimes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [step, setStep] = useState('form'); // 'form', 'otp', 'success'
  const [pendingRegistration, setPendingRegistration] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/get_options`)
      .then(res => res.json())
      .then(data => {
        setColleges(data.colleges || []);
        setAllCollegeDepartments(data.college_departments || {});
        setStudySpots(data.study_spots || []);
        setStudyTimes(data.study_times || []);
      });
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setForm(prev => ({
        ...prev,
        [name]: checked
          ? [...prev[name], value]
          : prev[name].filter(v => v !== value)
      }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  }

  function handleCollegeChange(e) {
    const selectedCollege = e.target.value;
    setForm(prev => ({ 
      ...prev, 
      college: selectedCollege,
      department: '' // Reset department when college changes
    }));
    // Update available departments
    setDepartments(allCollegeDepartments[selectedCollege] || []);
  }

  function handleCourseSearch(e) {
    const query = e.target.value;
    setCourseSearch(query);
    
    if (query.length >= 2) {
      fetch(`${API_BASE}/search_courses?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(data.courses || []);
          setShowCourseDropdown(true);
        })
        .catch(err => console.error('Course search error:', err));
    } else {
      setSearchResults([]);
      setShowCourseDropdown(false);
    }
  }

  function handleCourseSelect(course) {
    const courseId = course.code;
    if (!form.selectedCourses.includes(courseId)) {
      setForm(prev => ({ 
        ...prev, 
        selectedCourses: [...prev.selectedCourses, courseId] 
      }));
    }
    setCourseSearch('');
    setShowCourseDropdown(false);
  }

  function removeCourse(courseId) {
    setForm(prev => ({
      ...prev,
      selectedCourses: prev.selectedCourses.filter(id => id !== courseId)
    }));
  }


  function validateNTHUEmail(email) {
    return email && email.trim().toLowerCase().endsWith('.nthu.edu.tw');
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    if (!form.name || !form.email || !form.college || !form.department) {
      setError('Please fill all required fields.');
      return;
    }
    
    if (!validateNTHUEmail(form.email)) {
      setError('Please use a valid NTHU email address ending with .nthu.edu.tw');
      return;
    }
    
    setLoading(true);
    
    // First, send OTP to verify email
    fetch(`${API_BASE}/send_otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: form.email })
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
          setError(data.error);
        } else {
          // Store registration data and move to OTP verification
          const registrationData = {
            ...form,
            course_ids: form.selectedCourses
          };
          setPendingRegistration(registrationData);
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
    // After OTP is verified, proceed with registration
    setLoading(true);
    
    fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(pendingRegistration)
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
          setError(data.error);
          setStep('form'); // Go back to form if registration fails
        } else {
          console.log('Registration successful:', data);
          setStep('success');
          // Redirect to login after a delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      })
      .catch(err => {
        setLoading(false);
        setError('Network error during registration. Please try again.');
        setStep('form');
        console.error('Registration error:', err);
      });
  }

  function handleBackToForm() {
    setStep('form');
    setPendingRegistration(null);
    setError('');
  }

  // Show OTP verification screen
  if (step === 'otp') {
    return (
      <OTPVerification
        email={form.email}
        onVerified={handleOTPVerified}
        onBack={handleBackToForm}
        purpose="registration"
      />
    );
  }

  // Show success screen
  if (step === 'success') {
    return (
      <div style={{ backgroundColor: '#f5f7fa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          padding: '3rem',
          textAlign: 'center',
          maxWidth: '500px'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h2 style={{ color: '#166534', fontSize: '1.8rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>
            Registration Successful!
          </h2>
          <p style={{ color: '#6b7280', fontSize: '1.1rem', marginBottom: '2rem' }}>
            Your account has been created successfully. You will be redirected to the login page shortly.
          </p>
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            padding: '1rem',
            color: '#166534'
          }}>
            Welcome to StudyBuddy! 🎓
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <form className="auth-card register-card" onSubmit={handleSubmit}>
        <div className="auth-header">
          <span className="auth-logo">StudyBuddy</span>
          <h1>Register</h1>
        </div>
        {error && <div className="error-message" style={{ display: 'block' }}>{error}</div>}
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label htmlFor="email">NTHU Email Address</label>
          <input 
            id="email" 
            name="email" 
            type="email" 
            value={form.email} 
            onChange={handleChange}
            placeholder="yourname@gapp.nthu.edu.tw"
          />
          <small style={{ color: '#666', fontSize: '0.8em' }}>
            Please use your official NTHU email address
          </small>
        </div>
        <div className="form-group">
          <label htmlFor="college">College</label>
          <select id="college" name="college" value={form.college} onChange={handleCollegeChange}>
            <option value="">Select College</option>
            {colleges.map(college => (
              <option key={college} value={college}>{college}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="department">Department</label>
          <select 
            id="department" 
            name="department" 
            value={form.department} 
            onChange={handleChange}
            disabled={!form.college}
          >
            <option value="">
              {form.college ? "Select Department" : "Select College First"}
            </option>
            {departments.map(dep => (
              <option key={dep} value={dep}>{dep}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="courses">Courses</label>
          <div className="course-search-container">
            <input
              id="courses"
              type="text"
              placeholder="Search for courses..."
              value={courseSearch}
              onChange={handleCourseSearch}
              onFocus={() => showCourseDropdown && setShowCourseDropdown(true)}
            />
            {showCourseDropdown && searchResults.length > 0 && (
              <div className="course-dropdown">
                {searchResults.slice(0, 10).map(course => (
                  <div
                    key={course.code}
                    className="course-option"
                    onClick={() => handleCourseSelect(course)}
                  >
                    <div className="course-code">{course.code}</div>
                    <div className="course-name">{course.display}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="selected-items">
            {form.selectedCourses.map((courseId, i) => (
              <span key={courseId} className="selected-tag">
                {courseId}
                <span className="remove-tag" onClick={() => removeCourse(courseId)}>&times;</span>
              </span>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Study Spots</label>
          <div className="checkbox-grid">
            {studySpots.map(spot => (
              <label key={spot} className="checkbox-item">
                <input
                  type="checkbox"
                  name="study_spots"
                  value={spot}
                  checked={form.study_spots.includes(spot)}
                  onChange={handleChange}
                />
                {spot}
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Study Times</label>
          <div className="checkbox-grid">
            {studyTimes.map(time => (
              <label key={time} className="checkbox-item">
                <input
                  type="checkbox"
                  name="study_times"
                  value={time}
                  checked={form.study_times.includes(time)}
                  onChange={handleChange}
                />
                {time}
              </label>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    </div>
  );
}

export default Register;
