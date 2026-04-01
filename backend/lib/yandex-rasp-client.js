import 'dotenv/config';
import { withRequestCache } from './request-cache.js';
import { reserveUsage, readUsage } from './yandex-usage.js';

const API_BASE_URL = 'https://api.rasp.yandex-net.ru/v3.0';
const DEFAULT_LANG = 'ru_RU';
const DEFAULT_LIMIT = Number(process.env.YANDEX_DAILY_BUDGET || 450);
const STATION_LIST_CACHE_MS = resolveStationListCacheMs();

function resolveStationListCacheMs() {
  const cacheMinutes = Number(process.env.YANDEX_STATION_CACHE_MINUTES || 360);
  return Number.isFinite(cacheMinutes) && cacheMinutes > 0 ? cacheMinutes * 60 * 1000 : 1000 * 60 * 60 * 6;
}

function buildUrl(pathname, params) {
  const url = new URL(`${API_BASE_URL}${pathname}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url;
}

export function hasLiveApi() {
  return Boolean(process.env.YANDEX_RASP_API_KEY);
}

export function assertLiveApi() {
  if (!hasLiveApi()) {
    throw new Error('Сервис не настроен: отсутствует YANDEX_RASP_API_KEY.');
  }
}

export async function getUsageSnapshot() {
  const usage = await readUsage();

  return {
    ...usage,
    limit: DEFAULT_LIMIT,
    remaining: Math.max(DEFAULT_LIMIT - usage.count, 0),
  };
}

async function callYandex(pathname, params, { cacheKey, ttlMs }) {
  assertLiveApi();

  return withRequestCache(cacheKey, ttlMs, async () => {
    await reserveUsage(DEFAULT_LIMIT);

    const response = await fetch(buildUrl(pathname, params), {
      headers: {
        Authorization: process.env.YANDEX_RASP_API_KEY,
      },
    });

    if (!response.ok) {
      const rawText = await response.text();
      throw new Error(`Яндекс API вернул ${response.status}: ${rawText.slice(0, 220)}`);
    }

    return response.json();
  });
}

export async function fetchStationsList() {
  return callYandex(
    '/stations_list/',
    { lang: DEFAULT_LANG, format: 'json' },
    { cacheKey: 'stations:list', ttlMs: STATION_LIST_CACHE_MS },
  );
}

export async function fetchNearestStations({ lat, lng, distance = 25, limit = 10 }) {
  return callYandex(
    '/nearest_stations/',
    {
      lang: DEFAULT_LANG,
      format: 'json',
      lat,
      lng,
      distance,
      limit,
      station_types: 'station,platform,stop,train_station',
      transport_types: 'train,suburban',
    },
    {
      cacheKey: `stations:nearest:${lat}:${lng}:${distance}:${limit}`,
      ttlMs: 1000 * 60 * 10,
    },
  );
}

export async function fetchStationSchedule({ stationCode, date }) {
  const [departure, arrival] = await Promise.all([
    callYandex(
      '/schedule/',
      {
        lang: DEFAULT_LANG,
        format: 'json',
        date,
        station: stationCode,
        transport_types: 'suburban',
        event: 'departure',
      },
      {
        cacheKey: `schedule:${stationCode}:${date}:departure`,
        ttlMs: 1000 * 60 * 5,
      },
    ),
    callYandex(
      '/schedule/',
      {
        lang: DEFAULT_LANG,
        format: 'json',
        date,
        station: stationCode,
        transport_types: 'suburban',
        event: 'arrival',
      },
      {
        cacheKey: `schedule:${stationCode}:${date}:arrival`,
        ttlMs: 1000 * 60 * 5,
      },
    ),
  ]);

  return { departure, arrival };
}

export async function fetchRoutes({ from, to, date, transfers = false }) {
  return callYandex(
    '/search/',
    {
      lang: DEFAULT_LANG,
      format: 'json',
      from,
      to,
      date,
      transport_types: 'suburban',
      transfers,
      limit: 24,
    },
    {
      cacheKey: `routes:${from}:${to}:${date}:${transfers}`,
      ttlMs: 1000 * 60 * 5,
    },
  );
}

export async function fetchCopyright() {
  const response = await callYandex(
    '/copyright/',
    { format: 'json' },
    {
      cacheKey: 'meta:copyright',
      ttlMs: 1000 * 60 * 60 * 24 * 7,
    },
  );

  return {
    text: response?.copyright?.text || 'Данные предоставлены сервисом Яндекс Расписания',
    url: response?.copyright?.url || 'https://rasp.yandex.ru/',
    logo: response?.copyright?.logo_hm || response?.copyright?.logo_hd || '',
  };
}
