// Shared API access: one base URL, cookies always included, errors normalised.
export const API_BASE = process.env.REACT_APP_API_URL || 'https://study-buddy-final.onrender.com';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach StudyBuddy. Check your connection and try again.', 0);
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON response; fall through with empty data.
  }
  if (!res.ok) {
    throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  }
  return data;
}

export function isValidNthuEmail(email) {
  return !!email && email.trim().toLowerCase().endsWith('.nthu.edu.tw');
}
