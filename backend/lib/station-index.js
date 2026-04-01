import { withRequestCache } from './request-cache.js';
import {
  assertLiveApi,
  fetchNearestStations,
  fetchStationsList,
  hasLiveApi,
} from './yandex-rasp-client.js';

const defaultStationCacheMs = 1000 * 60 * 60 * 6;
const stationCacheMs = resolveStationCacheMs();

let stationIndexSnapshot = {
  updatedAt: null,
  source: hasLiveApi() ? 'memory-cache-pending' : 'missing-key',
  stations: [],
};

function resolveStationCacheMs() {
  const cacheMinutes = Number(process.env.YANDEX_STATION_CACHE_MINUTES || 360);
  return Number.isFinite(cacheMinutes) && cacheMinutes > 0 ? cacheMinutes * 60 * 1000 : defaultStationCacheMs;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .trim();
}

function normalizeStation(station, regionTitle, settlementTitle, countryTitle) {
  return {
    code: station.codes?.yandex_code || station.codes?.yandex || station.code,
    title: station.title,
    popularTitle: station.popular_title || station.title,
    shortTitle: station.short_title || station.title,
    stationType: station.station_type || 'station',
    transportType: station.transport_type || 'suburban',
    latitude: Number(station.latitude || station.lat || 0),
    longitude: Number(station.longitude || station.lng || 0),
    countryTitle,
    regionTitle,
    settlementTitle,
    majority: Number(station.majority || 9),
  };
}

function extractStationsTree(payload) {
  const countries = Array.isArray(payload?.countries) ? payload.countries : [];
  const collected = [];
  const seen = new Set();

  for (const country of countries) {
    for (const region of country.regions || []) {
      for (const settlement of region.settlements || []) {
        for (const station of settlement.stations || []) {
          const isRailStation =
            station.transport_type === 'suburban' ||
            (station.transport_type === 'train' && Boolean(station.direction));

          if (!isRailStation) {
            continue;
          }

          const normalized = normalizeStation(
            station,
            region.title || '',
            settlement.title || '',
            country.title || '',
          );

          if (!normalized.code || seen.has(normalized.code)) {
            continue;
          }

          seen.add(normalized.code);
          collected.push(normalized);
        }
      }
    }
  }

  return collected;
}

function scoreStation(station, query) {
  const title = normalizeText(station.title);
  const popularTitle = normalizeText(station.popularTitle);
  const settlement = normalizeText(station.settlementTitle);
  const region = normalizeText(station.regionTitle);

  let score = 0;

  if (popularTitle.startsWith(query)) score += 120;
  if (title.startsWith(query)) score += 100;
  if (settlement.startsWith(query)) score += 60;
  if (popularTitle.includes(query)) score += 42;
  if (title.includes(query)) score += 34;
  if (settlement.includes(query)) score += 18;
  if (region.includes(query)) score += 8;

  score += Math.max(0, 10 - station.majority);

  return score;
}

function normalizeNearestStation(station) {
  return {
    code: station.code || station.codes?.yandex_code || station.codes?.yandex || '',
    title: station.title,
    popularTitle: station.popular_title || station.title,
    shortTitle: station.short_title || station.title,
    stationType: station.station_type || 'station',
    transportType: station.transport_type || 'suburban',
    latitude: Number(station.lat || station.latitude || 0),
    longitude: Number(station.lng || station.longitude || 0),
    countryTitle: '',
    regionTitle: '',
    settlementTitle: '',
    majority: Number(station.majority || 9),
    distance: Number(station.distance || 0),
  };
}

async function buildLiveIndex() {
  assertLiveApi();

  const snapshot = await withRequestCache('stations:index:normalized', stationCacheMs, async () => {
    const payload = await fetchStationsList();
    const stations = extractStationsTree(payload);

    return {
      updatedAt: new Date().toISOString(),
      source: 'memory-cache',
      stations,
    };
  });

  stationIndexSnapshot = snapshot;
  return snapshot;
}

export async function ensureStationIndex() {
  return buildLiveIndex();
}

export async function getStationIndexStatus() {
  if (stationIndexSnapshot.stations.length > 0) {
    return stationIndexSnapshot;
  }

  return {
    updatedAt: null,
    source: hasLiveApi() ? 'memory-cache-pending' : 'missing-key',
    stations: [],
  };
}

export async function searchStations(query, limit = 8) {
  const normalizedQuery = normalizeText(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const { stations } = await ensureStationIndex();

  return stations
    .map((station) => ({
      ...station,
      score: scoreStation(station, normalizedQuery),
    }))
    .filter((station) => station.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ score, ...station }) => station);
}

export async function getStationByCode(code) {
  const { stations } = await ensureStationIndex();
  return stations.find((station) => station.code === code) || null;
}

export async function getNearbyStations(lat, lng, limit = 6) {
  assertLiveApi();

  const liveResponse = await fetchNearestStations({ lat, lng, limit });
  return (liveResponse.stations || []).map(normalizeNearestStation);
}
