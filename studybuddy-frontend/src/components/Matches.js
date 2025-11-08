import React, { useEffect, useState } from 'react';

function Matches() {
  const [matches, setMatches] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const API_BASE = 'http://localhost:5001';

  useEffect(() => {
    async function fetchData() {
      try {
        // First get current user data
        const meRes = await fetch(`${API_BASE}/me`, { credentials: 'include' });
        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }
        const userData = await meRes.json();
        setUser(userData);

        // Then get matches for this user
        const matchesRes = await fetch(`${API_BASE}/get_matches/${userData._id}`, { 
          credentials: 'include' 
        });
        if (!matchesRes.ok) {
          throw new Error('Failed to fetch matches');
        }
        const matchesData = await matchesRes.json();
        setMatches(matchesData.matches || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching matches:', err);
        setError(err.message);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const generateEmailTemplate = (match) => {
    const sharedCourses = match.shared_courses.length > 0 
      ? match.shared_courses.join(', ') 
      : 'various courses';
    const sharedSpots = match.shared_spots.length > 0 
      ? match.shared_spots.join(', ') 
      : 'study locations';
    const sharedTimes = match.shared_times.length > 0 
      ? match.shared_times.join(', ') 
      : 'study times';

    return `Subject: Study Partner Connection from StudyBuddy - ${user?.name}

Hi ${match.name},

I hope this email finds you well! My name is ${user?.name || 'a fellow NTHU student'}, and I found your profile through StudyBuddy, our study partner matching platform.

I noticed we have several things in common:
${match.shared_courses.length > 0 ? `- Shared Courses: ${sharedCourses}` : ''}
${match.shared_spots.length > 0 ? `- Preferred Study Spots: ${sharedSpots}` : ''}
${match.shared_times.length > 0 ? `- Available Study Times: ${sharedTimes}` : ''}

I think we could be great study partners! Would you be interested in meeting up to study together? We could help each other with coursework, prepare for exams, or just have a productive study session.

Let me know what you think! Looking forward to hearing from you.

Best regards,
${user?.name || 'Your Study Partner'}
${user?.email || ''}`;
  };

  const handleConnectClick = (match) => {
    setSelectedMatch(match);
    setShowConnectModal(true);
    setCopySuccess('');
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(type);
      setTimeout(() => setCopySuccess(''), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy. Please select and copy manually.');
    });
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', color: '#6366f1' }}>Finding your study matches...</div>
          </div>
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
            <button 
              onClick={() => window.location.href = '/dashboard'}
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
              ← Dashboard
            </button>
            <span style={{ color: '#374151', fontWeight: '500' }}>Hello, {user?.name}!</span>
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
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
            🎯 Your Study Matches
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#6b7280' }}>
            Find your perfect study partners based on shared courses, preferences, and compatibility
          </p>
        </div>

        {error ? (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '0.5rem',
            padding: '1rem',
            textAlign: 'center',
            color: '#dc2626'
          }}>
            Error: {error}
          </div>
        ) : matches.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1rem',
            padding: '3rem 2rem',
            textAlign: 'center',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <h3 style={{ fontSize: '1.5rem', color: '#374151', marginBottom: '1rem', margin: '0 0 1rem 0' }}>
              No matches found yet
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
              We couldn't find any study partners that match your profile right now. 
              Try updating your courses or study preferences to find more matches!
            </p>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              style={{
                backgroundColor: '#6366f1',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem'
              }}
            >
              Update Profile
            </button>
          </div>
        ) : (
          <>
            {/* Matches Summary */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '1rem',
              padding: '1.5rem 2rem',
              marginBottom: '2rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.1rem', color: '#374151' }}>
                We found <span style={{ color: '#6366f1', fontWeight: 'bold', fontSize: '1.3rem' }}>{matches.length}</span> potential study partner{matches.length !== 1 ? 's' : ''} for you!
              </div>
            </div>

            {/* Matches Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
              {matches.map((match, idx) => (
                <div key={idx} style={{
                  backgroundColor: 'white',
                  borderRadius: '1rem',
                  padding: '2rem',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 15px rgba(0, 0, 0, 0.15)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
                >
                  {/* Match Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#1f2937', margin: '0 0 0.25rem 0' }}>
                        {match.name}
                      </h3>
                      <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
                        {match.department || 'Department not specified'}
                      </p>
                    </div>
                    <div style={{
                      backgroundColor: match.similarity >= 70 ? '#dcfce7' : match.similarity >= 50 ? '#fef3c7' : '#fef2f2',
                      color: match.similarity >= 70 ? '#166534' : match.similarity >= 50 ? '#92400e' : '#dc2626',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      {match.similarity}% match
                    </div>
                  </div>

                  {/* Shared Items */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    {/* Shared Courses */}
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
                        📚 Shared Courses ({match.shared_courses.length})
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '2rem' }}>
                        {match.shared_courses.length > 0 ? (
                          match.shared_courses.slice(0, 3).map((course, i) => (
                            <span key={i} style={{
                              backgroundColor: '#dbeafe',
                              color: '#1e40af',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {course}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            No shared courses
                          </span>
                        )}
                        {match.shared_courses.length > 3 && (
                          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                            +{match.shared_courses.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shared Study Spots */}
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
                        📍 Shared Study Spots ({match.shared_spots.length})
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '2rem' }}>
                        {match.shared_spots.length > 0 ? (
                          match.shared_spots.slice(0, 3).map((spot, i) => (
                            <span key={i} style={{
                              backgroundColor: '#f0fdf4',
                              color: '#166534',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {spot}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            No shared study spots
                          </span>
                        )}
                        {match.shared_spots.length > 3 && (
                          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                            +{match.shared_spots.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Shared Study Times */}
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', margin: '0 0 0.5rem 0' }}>
                        🕐 Shared Study Times ({match.shared_times.length})
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '2rem' }}>
                        {match.shared_times.length > 0 ? (
                          match.shared_times.slice(0, 3).map((time, i) => (
                            <span key={i} style={{
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.375rem',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {time}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            No shared study times
                          </span>
                        )}
                        {match.shared_times.length > 3 && (
                          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                            +{match.shared_times.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Connect Button */}
                  <button 
                    onClick={() => handleConnectClick(match)}
                    style={{
                      backgroundColor: '#6366f1',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '1rem',
                      width: '100%',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseOver={e => e.target.style.backgroundColor = '#5b21b6'}
                    onMouseOut={e => e.target.style.backgroundColor = '#6366f1'}
                  >
                    🤝 Connect with {match.name}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Connect Modal */}
        {showConnectModal && selectedMatch && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
              padding: '2rem'
            }}
            onClick={() => setShowConnectModal(false)}
          >
            <div
              style={{
                backgroundColor: 'white',
                borderRadius: '1rem',
                maxWidth: '700px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                padding: '2rem',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowConnectModal(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.5rem'
                }}
              >
                ✕
              </button>

              {/* Modal Header */}
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.5rem' }}>
                  Connect with {selectedMatch.name}
                </h2>
                <p style={{ color: '#6b7280', fontSize: '1rem' }}>
                  Send them an email to start your study partnership!
                </p>
              </div>

              {/* Email Address Section */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', fontSize: '1rem' }}>
                  📧 Email Address:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={selectedMatch.email}
                    readOnly
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      backgroundColor: '#f9fafb',
                      color: '#1f2937'
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(selectedMatch.email, 'email')}
                    style={{
                      backgroundColor: copySuccess === 'email' ? '#10b981' : '#6366f1',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '1rem',
                      whiteSpace: 'nowrap',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    {copySuccess === 'email' ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Email Template Section */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '0.5rem', fontSize: '1rem' }}>
                  ✉️ Pre-written Email Template:
                </label>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  Copy this template and paste it into your email client. Feel free to personalize it!
                </p>
                <textarea
                  value={generateEmailTemplate(selectedMatch)}
                  readOnly
                  style={{
                    width: '100%',
                    minHeight: '300px',
                    padding: '1rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '0.9rem',
                    backgroundColor: '#f9fafb',
                    color: '#1f2937',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
                <button
                  onClick={() => copyToClipboard(generateEmailTemplate(selectedMatch), 'template')}
                  style={{
                    backgroundColor: copySuccess === 'template' ? '#10b981' : '#6366f1',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '1rem',
                    marginTop: '0.75rem',
                    width: '100%',
                    transition: 'background-color 0.2s ease'
                  }}
                >
                  {copySuccess === 'template' ? '✓ Template Copied!' : 'Copy Email Template'}
                </button>
              </div>

              {/* Instructions */}
              <div style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginTop: '1.5rem'
              }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e40af', margin: '0 0 0.5rem 0' }}>
                  📝 How to Connect:
                </h4>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#1e40af', fontSize: '0.85rem', lineHeight: '1.6' }}>
                  <li>Copy the email address above</li>
                  <li>Copy the email template</li>
                  <li>Open your email client (Gmail, Outlook, etc.)</li>
                  <li>Paste the email address and template</li>
                  <li>Personalize the message if you'd like</li>
                  <li>Send and start your study partnership! 🎉</li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default Matches;
