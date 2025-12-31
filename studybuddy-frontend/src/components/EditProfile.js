import React, { useState, useEffect } from 'react';

// API Base URL - use environment variable or default to production
const API_BASE = process.env.REACT_APP_API_URL || 'https://study-buddy-final.onrender.com';

function EditProfile() {
  const [form, setForm] = useState({
    selectedCourses: [],
    study_spots: [],
    study_times: [],
  });
  const [originalData, setOriginalData] = useState(null);
  const [user, setUser] = useState(null);
  const [studySpots, setStudySpots] = useState([]);
  const [studyTimes, setStudyTimes] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [courseNames, setCourseNames] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch current user data
        const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include' });
        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }
        const userData = await meRes.json();
        setUser(userData);
        
        // Set form with current values
        const currentData = {
          selectedCourses: userData.course_ids || [],
          study_spots: userData.study_spots || [],
          study_times: userData.study_times || [],
        };
        setForm(currentData);
        setOriginalData(currentData);

        // Fetch options for study spots and times
        const optionsRes = await fetch(`${API_BASE}/get_options`);
        const optionsData = await optionsRes.json();
        setStudySpots(optionsData.study_spots || []);
        setStudyTimes(optionsData.study_times || []);

        // Fetch course names for display
        if (userData.course_ids && userData.course_ids.length > 0) {
          const courseNamesRes = await fetch(`${API_BASE}/get_course_names`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ course_codes: userData.course_ids })
          });
          if (courseNamesRes.ok) {
            const courseData = await courseNamesRes.json();
            setCourseNames(courseData.courses || {});
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load profile data');
        setLoading(false);
      }
    }

    fetchData();
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
    setError('');
    setSuccess('');
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
      // Add course name to our mapping
      setCourseNames(prev => ({
        ...prev,
        [courseId]: course.display || course.name
      }));
    }
    setCourseSearch('');
    setShowCourseDropdown(false);
    setError('');
    setSuccess('');
  }

  function removeCourse(courseId) {
    setForm(prev => ({
      ...prev,
      selectedCourses: prev.selectedCourses.filter(id => id !== courseId)
    }));
    setError('');
    setSuccess('');
  }

  function handleManualCourseEntry() {
    const courseName = courseSearch.trim();
    if (courseName && !form.selectedCourses.includes(courseName)) {
      setForm(prev => ({ 
        ...prev, 
        selectedCourses: [...prev.selectedCourses, courseName] 
      }));
      // Add the custom course name to our mapping
      setCourseNames(prev => ({
        ...prev,
        [courseName]: courseName
      }));
    }
    setCourseSearch('');
    setShowCourseDropdown(false);
    setError('');
    setSuccess('');
  }

  function hasChanges() {
    if (!originalData) return false;
    return (
      JSON.stringify(form.selectedCourses.sort()) !== JSON.stringify(originalData.selectedCourses.sort()) ||
      JSON.stringify(form.study_spots.sort()) !== JSON.stringify(originalData.study_spots.sort()) ||
      JSON.stringify(form.study_times.sort()) !== JSON.stringify(originalData.study_times.sort())
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!hasChanges()) {
      setError('No changes to save');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE}/update_profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          course_ids: form.selectedCourses,
          study_spots: form.study_spots,
          study_times: form.study_times,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        setSaving(false);
        return;
      }

      setSuccess('Profile updated successfully!');
      setOriginalData({
        selectedCourses: form.selectedCourses,
        study_spots: form.study_spots,
        study_times: form.study_times,
      });
      setSaving(false);

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);

    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Network error. Please try again.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f5f7fa'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-animation"></div>
          <p style={{ color: '#6b7280', marginTop: '1rem' }}>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
      {/* Navigation Bar */}
      <nav style={{
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        padding: '1rem 2rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ color: '#6366f1', fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>StudyBuddy</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#374151', fontWeight: '500' }}>Editing Profile</span>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem 2rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
            Edit Your Profile
          </h2>
          <p style={{ fontSize: '1rem', color: '#6b7280' }}>
            Update your courses, study spots, and preferred times
          </p>
        </div>

        {/* User Info (Read-only) */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#374151', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
            👤 Account Information
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Name</span>
              <p style={{ color: '#1f2937', fontWeight: '500', margin: '0.25rem 0 0 0' }}>{user?.name}</p>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Email</span>
              <p style={{ color: '#1f2937', fontWeight: '500', margin: '0.25rem 0 0 0' }}>{user?.email}</p>
            </div>
            <div>
              <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Department</span>
              <p style={{ color: '#1f2937', fontWeight: '500', margin: '0.25rem 0 0 0' }}>{user?.department}</p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit}>
          {/* Messages */}
          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              border: '1px solid #fecaca'
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              backgroundColor: '#d1fae5',
              color: '#059669',
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1rem',
              border: '1px solid #a7f3d0'
            }}>
              {success}
            </div>
          )}

          {/* Courses Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#374151', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
              📚 My Courses
            </h3>
            
            {/* Course Search */}
            <div className="course-search-container" style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                placeholder="Search and add courses..."
                value={courseSearch}
                onChange={handleCourseSearch}
                onFocus={() => searchResults.length > 0 && setShowCourseDropdown(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && courseSearch.trim() && searchResults.length === 0) {
                    e.preventDefault();
                    handleManualCourseEntry();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
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
              {showCourseDropdown && courseSearch.trim() && searchResults.length === 0 && (
                <div className="course-dropdown">
                  <div 
                    className="course-option course-manual-entry"
                    onClick={handleManualCourseEntry}
                    style={{ 
                      cursor: 'pointer', 
                      backgroundColor: '#f0fdf4', 
                      borderLeft: '3px solid #10b981',
                      padding: '12px'
                    }}
                  >
                    <div style={{ color: '#059669', fontWeight: 'bold', marginBottom: '4px' }}>
                      ✚ Add "{courseSearch}"
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#6b7280' }}>
                      Course not found? Add it manually
                    </div>
                  </div>
                </div>
              )}
              <small style={{ color: '#6b7280', fontSize: '0.85em', display: 'block', marginTop: '8px' }}>
                💡 Can't find your course? Just type the name and press Enter or click "Add"
              </small>
            </div>

            {/* Selected Courses */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {form.selectedCourses.length > 0 ? (
                form.selectedCourses.map((courseId) => (
                  <div key={courseId} style={{
                    backgroundColor: '#f3f4f6',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: '600' }}>{courseId}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{courseNames[courseId] || ''}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCourse(courseId)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '0',
                        lineHeight: '1'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No courses selected. Search above to add courses.</p>
              )}
            </div>
          </div>

          {/* Study Spots Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#374151', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
              📍 Preferred Study Spots
            </h3>
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

          {/* Study Times Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#374151', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
              🕐 Preferred Study Times
            </h3>
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

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => window.location.href = '/dashboard'}
              style={{
                backgroundColor: 'white',
                color: '#374151',
                border: '2px solid #e5e7eb',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !hasChanges()}
              style={{
                background: hasChanges() ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : '#d1d5db',
                color: 'white',
                border: 'none',
                padding: '0.75rem 2rem',
                borderRadius: '0.5rem',
                cursor: hasChanges() && !saving ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.3s ease'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default EditProfile;

