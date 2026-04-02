const clientCache = new Map();
const configuredApiOrigin =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '');

function getCached(cacheKey) {
  const cached = clientCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    clientCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function setCached(cacheKey, value, ttlMs) {
  clientCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

function buildRequestCandidates(pathname) {
  const urls = [];

  if (configuredApiOrigin && window.location.origin !== configuredApiOrigin) {
    urls.push(`${configuredApiOrigin}${pathname}`);
  }

  urls.push(pathname);
  return [...new Set(urls)];
}

async function performRequest(url, signal) {
  const response = await fetch(url, { signal });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Не удалось получить данные от сервера.');
  }

  return data;
}

async function request(pathname, { signal, cacheKey, ttlMs = 0 } = {}) {
  if (cacheKey && ttlMs > 0) {
    const cachedValue = getCached(cacheKey);

    if (cachedValue) {
      return cachedValue;
    }
  }

  const candidates = buildRequestCandidates(pathname);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const data = await performRequest(candidate, signal);

      if (cacheKey && ttlMs > 0) {
        setCached(cacheKey, data, ttlMs);
      }

      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }

      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('Не удалось получить данные от сервера.');
}

export const api = {
  getMeta(options = {}) {
    return request('/api/meta', {
      ...options,
      cacheKey: 'meta',
      ttlMs: 1000 * 60,
    });
  },
  searchStations(query, options = {}) {
    return request(`/api/stations/search?q=${encodeURIComponent(query)}`, {
      ...options,
      cacheKey: `stations:search:${query.toLowerCase()}`,
      ttlMs: 1000 * 60 * 10,
    });
  },
  getNearbyStations(lat, lng, options = {}) {
    const roundedLat = lat.toFixed(3);
    const roundedLng = lng.toFixed(3);

    return request(`/api/stations/near?lat=${lat}&lng=${lng}`, {
      ...options,
      cacheKey: `stations:near:${roundedLat}:${roundedLng}`,
      ttlMs: 1000 * 60 * 10,
    });
  },
  getSchedule(stationCode, date, options = {}) {
    return request(`/api/stations/${encodeURIComponent(stationCode)}/schedule?date=${date}`, {
      ...options,
      cacheKey: `schedule:${stationCode}:${date}`,
      ttlMs: 1000 * 60 * 5,
    });
  },
  searchRoutes({ from, to, date, transfers }, options = {}) {
    const params = new URLSearchParams({
      from,
      to,
      date,
      transfers: transfers ? 'true' : 'false',
    });

    return request(`/api/routes/search?${params.toString()}`, options);
  },
};
