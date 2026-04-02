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
import { currentDate, isIsoDate, isUpcomingTimestamp, shouldFilterPastEntries } from './lib/date-utils.js';
import { normalizeRouteEntry, normalizeScheduleEntry } from './lib/response-normalizers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../client/dist');
const app = express();
const port = Number(process.env.API_PORT || process.env.PORT || 8787);
const serviceTimeZone = process.env.APP_TIME_ZONE || 'Europe/Samara';
const allowedOrigins = String(process.env.CORS_ALLOW_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function resolveCorsOrigin(origin) {
  if (!origin) {
    return null;
  }

  if (allowedOrigins.includes('*')) {
    return '*';
  }

  return allowedOrigins.includes(origin) ? origin : null;
}

app.use(express.json());
app.use((request, response, next) => {
  const corsOrigin = resolveCorsOrigin(request.headers.origin);

  if (corsOrigin) {
    response.setHeader('Access-Control-Allow-Origin', corsOrigin);

    if (corsOrigin !== '*') {
      response.setHeader('Vary', 'Origin');
    }

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
  const date = isIsoDate(request.query.date) ? String(request.query.date) : currentDate(serviceTimeZone);

  try {
    assertLiveApi();

    const station = await getStationByCode(stationCode);
    const payload = await fetchStationSchedule({ stationCode, date });
    const nowMs = Date.now();
    const filterPast = shouldFilterPastEntries(date, serviceTimeZone);
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
  const date = isIsoDate(request.query.date) ? String(request.query.date) : currentDate(serviceTimeZone);

  if (!from || !to) {
    response.status(400).json({ message: 'Для поиска маршрута нужны обе станции: from и to.' });
    return;
  }

  try {
    assertLiveApi();

    const payload = await fetchRoutes({ from, to, date, transfers });
    const nowMs = Date.now();
    const filterPast = shouldFilterPastEntries(date, serviceTimeZone);
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
