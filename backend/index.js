import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertLiveApi,
  fetchCopyright,
  fetchRoutes,
  fetchStationSchedule,
  getUsageSnapshot,
} from './lib/yandex-rasp-client.js';
import {
  getNearbyStations,
  getStationByCode,
  getStationIndexStatus,
  searchStations,
} from './lib/station-index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../client/dist');
const app = express();
const port = Number(process.env.API_PORT || process.env.PORT || 8787);
const serviceTimeZone = process.env.APP_TIME_ZONE || 'Europe/Samara';
const allowedOrigins = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]);

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function currentDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: serviceTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function shouldFilterPastEntries(date) {
  return date === currentDate();
}

function isUpcomingTimestamp(value, nowMs) {
  if (!value) {
    return true;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp >= nowMs : true;
}

function normalizeScheduleEntry(entry) {
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

function normalizeRouteEntry(entry) {
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

app.use(express.json());
app.use((request, response, next) => {
  const origin = request.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  }

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
});

app.get('/api/meta', async (_request, response) => {
  try {
    assertLiveApi();

    const usage = await getUsageSnapshot();
    const index = await getStationIndexStatus();
    const copyright = await fetchCopyright().catch(() => ({
      text: 'Данные предоставлены сервисом Яндекс Расписания',
      url: 'https://rasp.yandex.ru/',
      logo: '',
    }));

    response.json({
      usage,
      stationIndex: {
        source: index.source,
        count: index.stations.length,
        updatedAt: index.updatedAt,
      },
      copyright,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.get('/api/stations/search', async (request, response) => {
  try {
    assertLiveApi();

    const q = String(request.query.q || '').trim();
    const stations = await searchStations(q);

    response.json({ stations });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.get('/api/stations/near', async (request, response) => {
  const lat = Number(request.query.lat);
  const lng = Number(request.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    response.status(400).json({ message: 'Нужно передать корректные координаты lat и lng.' });
    return;
  }

  try {
    assertLiveApi();

    const stations = await getNearbyStations(lat, lng);
    response.json({ stations });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.get('/api/stations/:code/schedule', async (request, response) => {
  const stationCode = request.params.code;
  const date = isIsoDate(request.query.date) ? String(request.query.date) : currentDate();

  try {
    assertLiveApi();

    const station = await getStationByCode(stationCode);
    const payload = await fetchStationSchedule({ stationCode, date });
    const nowMs = Date.now();
    const filterPast = shouldFilterPastEntries(date);
    const departure = (payload.departure.schedule || [])
      .map(normalizeScheduleEntry)
      .filter((entry) => !filterPast || isUpcomingTimestamp(entry.departure, nowMs));
    const arrival = (payload.arrival.schedule || [])
      .map(normalizeScheduleEntry)
      .filter((entry) => !filterPast || isUpcomingTimestamp(entry.arrival, nowMs));

    response.json({
      station,
      date,
      departure,
      arrival,
      directions: payload.departure.directions || payload.arrival.directions || [],
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

app.get('/api/routes/search', async (request, response) => {
  const from = String(request.query.from || '').trim();
  const to = String(request.query.to || '').trim();
  const transfers = String(request.query.transfers || 'false') === 'true';
  const date = isIsoDate(request.query.date) ? String(request.query.date) : currentDate();

  if (!from || !to) {
    response.status(400).json({ message: 'Для поиска маршрута нужны обе станции: from и to.' });
    return;
  }

  try {
    assertLiveApi();

    const payload = await fetchRoutes({ from, to, date, transfers });
    const nowMs = Date.now();
    const filterPast = shouldFilterPastEntries(date);
    const segments = (payload.segments || [])
      .map(normalizeRouteEntry)
      .filter((entry) => !filterPast || isUpcomingTimestamp(entry.departure, nowMs));

    response.json({
      date,
      segments,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get('*', (request, response, next) => {
    if (request.path.startsWith('/api')) {
      next();
      return;
    }

    response.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`Train app backend is running on http://127.0.0.1:${port}`);
});
