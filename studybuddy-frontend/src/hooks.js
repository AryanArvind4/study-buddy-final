import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';

/** Loads the signed-in student; sends them to /login if their session has ended. */
export function useCurrentUser() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('/me')
      .then(data => !cancelled && setUser(data))
      .catch(err => {
        if (cancelled) return;
        if (err.status === 401) navigate('/login', { replace: true });
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return { user, setUser, error };
}

/** Looks up display names for a list of course codes. Unknown codes map to themselves. */
export function useCourseNames(codes) {
  const [names, setNames] = useState({});
  const key = [...new Set(codes || [])].sort().join('|');

  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) return undefined;
    let cancelled = false;
    api('/get_course_names', { method: 'POST', body: { course_codes: list } })
      .then(data => !cancelled && setNames(prev => ({ ...prev, ...(data.courses || {}) })))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);

  return [names, setNames];
}
