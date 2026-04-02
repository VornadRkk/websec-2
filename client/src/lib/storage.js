function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function readStoredValue(key) {
  try {
    const storage = getStorage();
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function writeStoredValue(key, value) {
  try {
    const storage = getStorage();

    if (!storage) {
      return false;
    }

    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readStoredJson(key, fallback) {
  try {
    const rawValue = readStoredValue(key);

    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value) {
  return writeStoredValue(key, JSON.stringify(value));
}
