import { readStoredJson, readStoredValue, writeStoredJson, writeStoredValue } from './storage.js';

export const favoritesStorageKey = 'train-arrival:favorites';
export const themeStorageKey = 'train-arrival:theme';

export function readFavorites() {
  const parsed = readStoredJson(favoritesStorageKey, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveFavorites(favorites) {
  writeStoredJson(favoritesStorageKey, favorites);
}

export function readTheme() {
  const savedTheme = readStoredValue(themeStorageKey);

  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme) {
  writeStoredValue(themeStorageKey, theme);
}

export function toFavoriteStation(station) {
  return {
    code: station.code,
    title: station.title,
    popularTitle: station.popularTitle,
    shortTitle: station.shortTitle,
    latitude: station.latitude,
    longitude: station.longitude,
    settlementTitle: station.settlementTitle,
    regionTitle: station.regionTitle,
  };
}
