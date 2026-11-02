// Date helpers. The API speaks UTC ISO strings; the UI shows the viewer's local time.

export function fmtDay(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtRange(startIso, endIso) {
  return `${fmtDay(startIso)} · ${fmtTime(startIso)} – ${fmtTime(endIso)}`;
}

export function fmtRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400 && new Date().getDate() === d.getDate()) return fmtTime(iso);
  if (diff < 7 * 86400) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function fmtUntil(iso) {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

export function sameDay(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Date -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Value from <input type="datetime-local"> -> UTC ISO string (with timezone). */
export function localInputToIso(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function nextHour(daysAhead = 1) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  d.setMinutes(0, 0, 0);
  d.setHours(Math.min(Math.max(d.getHours() + 1, 9), 20));
  return d;
}

// ---------- Calendar export (.ics) ----------

function icsDate(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(text = '') {
  return String(text).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function downloadIcs(session) {
  const description = [
    session.agenda?.length ? `Agenda:\n${session.agenda.map(a => `- ${a}`).join('\n')}` : '',
    session.link ? `Link: ${session.link}` : '',
    'Planned on StudyBuddy',
  ].filter(Boolean).join('\n\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StudyBuddy//NTHU//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${session.id}-${icsDate(session.updated_at || session.start_at)}@studybuddynthu.org`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(session.start_at)}`,
    `DTEND:${icsDate(session.end_at)}`,
    `SUMMARY:${icsEscape(session.title)}`,
    session.location ? `LOCATION:${icsEscape(session.location)}` : null,
    session.link ? `URL:${icsEscape(session.link)}` : null,
    `DESCRIPTION:${icsEscape(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(session.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.title.replace(/[^\w\- ]+/g, '').trim() || 'study-session'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const SESSION_STATE = {
  awaiting: { label: 'Waiting for reply', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'strong' },
  in_progress: { label: 'Happening now', tone: 'good' },
  ended: { label: 'Ended', tone: 'some' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

/** Ask the app shell to refresh nav badges after an action. */
export function refreshActivity() {
  window.dispatchEvent(new Event('sb-activity'));
}
