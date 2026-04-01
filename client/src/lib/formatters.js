const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
});

const shortDateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatTime(value) {
  if (!value) {
    return '—';
  }

  return timeFormatter.format(new Date(value));
}

export function formatDate(value) {
  if (!value) {
    return '—';
  }

  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  return shortDateTimeFormatter.format(new Date(value));
}

export function formatDuration(seconds) {
  const totalMinutes = Math.max(Math.round(Number(seconds || 0) / 60), 0);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} мин`;
  }

  return `${hours} ч ${minutes.toString().padStart(2, '0')} мин`;
}

export function formatDistance(kilometers) {
  if (!Number.isFinite(kilometers)) {
    return '';
  }

  if (kilometers < 1) {
    return `${Math.round(kilometers * 1000)} м`;
  }

  return `${kilometers.toFixed(kilometers < 10 ? 1 : 0)} км`;
}

