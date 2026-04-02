export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function currentDate(timeZone = 'Europe/Samara') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function shouldFilterPastEntries(date, timeZone) {
  return date === currentDate(timeZone);
}

export function isUpcomingTimestamp(value, nowMs) {
  if (!value) {
    return true;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp >= nowMs : true;
}
