export function normalizeScheduleEntry(entry) {
  return {
    uid: entry.thread?.uid || `${entry.thread?.title || 'thread'}:${entry.departure || entry.arrival || ''}`,
    title: entry.thread?.title || 'Без названия',
    number: entry.thread?.number || '',
    direction: entry.direction || entry.thread?.short_title || entry.thread?.title || '',
    carrier: entry.thread?.carrier?.title || 'Перевозчик не указан',
    departure: entry.departure || null,
    arrival: entry.arrival || null,
    platform: entry.platform || entry.departure_platform || entry.arrival_platform || '',
    vehicle: entry.thread?.vehicle || entry.thread?.transport_subtype?.title || 'Пригородный поезд',
    stops: entry.stops || 'без уточнения',
    isExpress: Boolean(entry.thread?.express_type),
    days: entry.days || '',
  };
}

export function normalizeRouteEntry(entry) {
  return {
    uid: entry.thread?.uid || `${entry.thread?.title || 'route'}:${entry.departure || ''}`,
    title: entry.thread?.title || 'Маршрут без названия',
    number: entry.thread?.number || '',
    carrier: entry.thread?.carrier?.title || 'Перевозчик не указан',
    departure: entry.departure || null,
    arrival: entry.arrival || null,
    duration: Number(entry.duration || 0),
    departurePlatform: entry.departure_platform || '',
    arrivalPlatform: entry.arrival_platform || '',
    hasTransfers: Boolean(entry.has_transfers),
    fromTitle: entry.from?.title || '',
    toTitle: entry.to?.title || '',
    transportLabel: entry.thread?.transport_subtype?.title || entry.thread?.vehicle || 'Пригородный поезд',
    days: entry.thread?.schedule || '',
  };
}
