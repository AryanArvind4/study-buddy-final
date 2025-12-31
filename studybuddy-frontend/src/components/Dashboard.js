import React, { useState, useEffect } from 'react';

// API Base URL - use environment variable or default to production
const API_BASE = process.env.REACT_APP_API_URL || 'https://study-buddy-final.onrender.com';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ totalStudents: 0, coursesCount: 0, spotsCount: 0 });
  const [loading, setLoading] = useState(true);
  const [courseNames, setCourseNames] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include' });
        if (!meRes.ok) throw new Error('Not authenticated');
        const userData = await meRes.json();
        setUser(userData);

        const studentsRes = await fetch(`${API_BASE}/get_students`, { credentials: 'include' });
        if (!studentsRes.ok) throw new Error('Failed to load students');
        const studentsData = await studentsRes.json();

        // Fetch course names for user's courses
        if (userData.course_ids && userData.course_ids.length > 0) {
          const courseNamesRes = await fetch(`${API_BASE}/get_course_names`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ course_codes: userData.course_ids })
          });
          if (courseNamesRes.ok) {
            const courseData = await courseNamesRes.json();
            setCourseNames(courseData.courses);
          }
        }

        setStats({
          totalStudents: studentsData.count,
          coursesCount: userData.course_ids?.length || 0,
          spotsCount: userData.study_spots?.length || 0,
        });
        setLoading(false);
      } catch (err) {
        console.error(err);
        window.location.href = '/login';
      }
    }

    fetchData();
  }, []);

  if (loading || !user) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>Loading your profile...</div>
    </div>
  );

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
            <span style={{ color: '#374151', fontWeight: '500' }}>Hello, {user.name}!</span>
            <button 
              onClick={() => window.location.href = '/edit-profile'}
              style={{
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Edit Profile
            </button>
            <button 
              onClick={() => {
                fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' })
                  .finally(() => (window.location.href = '/'));
              }}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
        {/* Welcome Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
            Find Your Study Partners
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#6b7280' }}>
            Discover students who share your academic interests
          </p>
        </div>

        {/* Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          
          {/* Quick Match Card */}
          <div style={{
            backgroundColor: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: '1rem',
            padding: '2rem',
            color: 'white',
            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.3)'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
              Quick Match
            </h3>
            <p style={{ marginBottom: '1.5rem', opacity: 0.9 }}>
              Find study partners based on your profile and preferences
            </p>
            <button 
              onClick={() => window.location.href = '/matches'}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={e => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'}
              onMouseOut={e => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
            >
              Find My Matches
            </button>
          </div>

          {/* Stats Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1.5rem', margin: '0 0 1.5rem 0' }}>
              Platform Stats
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>Total Students</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>{stats.totalStudents}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>Your Courses</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#dc2626' }}>{stats.coursesCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>Study Spots</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#7c3aed' }}>{stats.spotsCount}</span>
              </div>
            </div>
          </div>

          {/* Profile Summary Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            gridColumn: 'span 1'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
                Profile Summary
              </h3>
              <button
                onClick={() => window.location.href = '/edit-profile'}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6366f1',
                  border: '2px solid #6366f1',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '0.9rem'
                }}
              >
                ✏️ Edit
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>College:</span>
                <p style={{ color: '#1f2937', fontWeight: '500', margin: '0.25rem 0 0 0' }}>{user.college || 'Not specified'}</p>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Department:</span>
                <p style={{ color: '#1f2937', fontWeight: '500', margin: '0.25rem 0 0 0' }}>{user.department || 'Not specified'}</p>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Email:</span>
                <p style={{ color: '#1f2937', fontWeight: '500', margin: '0.25rem 0 0 0' }}>{user.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Profile Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          
          {/* Courses Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
              📚 My Courses
            </h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {user.course_ids && user.course_ids.length > 0 ? (
                user.course_ids.map((courseCode, index) => (
                  <div key={index} style={{
                    backgroundColor: '#f3f4f6',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    marginBottom: '0.75rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#6366f1',
                      fontWeight: '600',
                      marginBottom: '0.25rem'
                    }}>
                      {courseCode}
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#374151',
                      fontWeight: '500'
                    }}>
                      {courseNames[courseCode] || 'Loading...'}
                    </div>
                  </div>
                ))
              ) : (
                <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No courses selected yet</p>
              )}
            </div>
          </div>

          {/* Study Preferences Card */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
              ⚙️ Study Preferences
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
                📍 Preferred Study Spots
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {user.study_spots && user.study_spots.length > 0 ? (
                  user.study_spots.map((spot, index) => (
                    <span key={index} style={{
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      fontWeight: '500'
                    }}>
                      {spot}
                    </span>
                  ))
                ) : (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No study spots selected</p>
                )}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
                🕐 Preferred Study Times
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {user.study_times && user.study_times.length > 0 ? (
                  user.study_times.map((time, index) => (
                    <span key={index} style={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      fontWeight: '500'
                    }}>
                      {time}
                    </span>
                  ))
                ) : (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No study times selected</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
