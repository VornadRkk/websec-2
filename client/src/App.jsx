import { useEffect, useState } from 'react';
import { FavoritesPanel } from './components/FavoritesPanel.jsx';
import { MapPicker } from './components/MapPicker.jsx';
import { RoutePlanner } from './components/RoutePlanner.jsx';
import { ScheduleBoard } from './components/ScheduleBoard.jsx';
import { useStationLookup } from './hooks/useStationLookup.js';
import { api } from './lib/api.js';
import { formatDate, formatDistance } from './lib/formatters.js';
import { readFavorites, readTheme, saveFavorites, saveTheme, toFavoriteStation } from './lib/preferences.js';

const today = new Date().toISOString().slice(0, 10);

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isQueryForSelectedStation(query, station) {
  if (!station) {
    return false;
  }

  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return false;
  }

  return [station.title, station.popularTitle, station.shortTitle]
    .filter(Boolean)
    .some((title) => normalizeText(title) === normalizedQuery);
}

export default function App() {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  const [stationQuery, setStationQuery] = useState('');
  const [selectedStation, setSelectedStation] = useState(null);
  const [pickedPoint, setPickedPoint] = useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');

  const [scheduleDate, setScheduleDate] = useState(today);
  const [schedule, setSchedule] = useState({ departure: [], arrival: [] });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleTab, setScheduleTab] = useState('departure');

  const [routeFromQuery, setRouteFromQuery] = useState('');
  const [routeToQuery, setRouteToQuery] = useState('');
  const [routeFromStation, setRouteFromStation] = useState(null);
  const [routeToStation, setRouteToStation] = useState(null);
  const [routeDate, setRouteDate] = useState(today);
  const [allowTransfers, setAllowTransfers] = useState(false);
  const [routeResults, setRouteResults] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const [favorites, setFavorites] = useState(readFavorites);
  const [locating, setLocating] = useState(false);
  const [theme, setTheme] = useState(readTheme);

  const stationSearchEnabled =
    stationQuery.trim().length >= 2 && !isQueryForSelectedStation(stationQuery, selectedStation);

  const stationLookup = useStationLookup(stationQuery, stationSearchEnabled);
  const routeFromLookup = useStationLookup(routeFromQuery, routeFromQuery.trim().length >= 2);
  const routeToLookup = useStationLookup(routeToQuery, routeToQuery.trim().length >= 2);

  useEffect(() => {
    const controller = new AbortController();

    api
      .getMeta({ signal: controller.signal })
      .then((result) => {
        setMeta(result);
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setMetaError(error.message);
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    saveFavorites(favorites);
  }, [favorites]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!selectedStation) {
      setSchedule({ departure: [], arrival: [] });
      setScheduleError('');
      return;
    }

    const controller = new AbortController();
    setScheduleLoading(true);
    setScheduleError('');

    api
      .getSchedule(selectedStation.code, scheduleDate, { signal: controller.signal })
      .then((result) => {
        setSchedule({
          departure: result.departure || [],
          arrival: result.arrival || [],
        });
        setScheduleLoading(false);
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setScheduleLoading(false);
        setScheduleError(error.message);
      });

    return () => {
      controller.abort();
    };
  }, [scheduleDate, selectedStation]);

  function selectStation(station) {
    setSelectedStation(station);
    setStationQuery(station.title);
    setPickedPoint({
      lat: station.latitude,
      lng: station.longitude,
    });
    setNearbyStations([]);
    setScheduleTab('departure');
  }

  function selectRouteFrom(station) {
    setRouteFromStation(station);
    setRouteFromQuery(station.title);
  }

  function selectRouteTo(station) {
    setRouteToStation(station);
    setRouteToQuery(station.title);
  }

  function toggleFavorite(station) {
    setFavorites((currentFavorites) => {
      const exists = currentFavorites.some((favorite) => favorite.code === station.code);

      if (exists) {
        return currentFavorites.filter((favorite) => favorite.code !== station.code);
      }

      return [toFavoriteStation(station), ...currentFavorites].slice(0, 8);
    });
  }

  async function handleMapPick(point) {
    setPickedPoint(point);
    setNearbyLoading(true);
    setNearbyError('');

    try {
      const result = await api.getNearbyStations(point.lat, point.lng);
      setNearbyStations(result.stations || []);
    } catch (error) {
      setNearbyError(error.message);
      setNearbyStations([]);
    } finally {
      setNearbyLoading(false);
    }
  }

  function handleLocateUser() {
    if (!navigator.geolocation) {
      setNearbyError('Геолокация не поддерживается этим браузером.');
      return;
    }

    setLocating(true);
    setNearbyError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        handleMapPick({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setNearbyError('Не удалось получить геолокацию. Проверьте разрешение браузера.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  async function handleRouteSearch() {
    if (!routeFromStation || !routeToStation) {
      setRouteError('Сначала выберите обе станции из списка подсказок.');
      return;
    }

    if (routeFromStation.code === routeToStation.code) {
      setRouteError('Начальная и конечная станции должны отличаться.');
      return;
    }

    setRouteLoading(true);
    setRouteError('');

    try {
      const result = await api.searchRoutes({
        from: routeFromStation.code,
        to: routeToStation.code,
        date: routeDate,
        transfers: allowTransfers,
      });

      setRouteResults(result.segments || []);
    } catch (error) {
      setRouteError(error.message);
      setRouteResults([]);
    } finally {
      setRouteLoading(false);
    }
  }

  function swapRouteStations() {
    const currentFromStation = routeFromStation;
    const currentFromQuery = routeFromQuery;

    setRouteFromStation(routeToStation);
    setRouteFromQuery(routeToQuery);
    setRouteToStation(currentFromStation);
    setRouteToQuery(currentFromQuery);
  }

  function removeFavorite(code) {
    setFavorites((currentFavorites) => currentFavorites.filter((favorite) => favorite.code !== code));
  }

  const isFavorite = selectedStation
    ? favorites.some((favorite) => favorite.code === selectedStation.code)
    : false;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <div className="app-brand__logo">ЖД</div>
          <div>
            <h1>Прибывалка электричек</h1>
          </div>
        </div>

        <div className="app-header__meta">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
            aria-label={`Переключить тему. Сейчас ${theme === 'dark' ? 'темная' : 'светлая'} тема.`}
          >
            <span className="theme-toggle__icon" aria-hidden="true">
              {theme === 'dark' ? '☾' : '☀'}
            </span>
            <span className="theme-toggle__text">
              <span>Тема</span>
              <strong>{theme === 'dark' ? 'Темная' : 'Светлая'}</strong>
            </span>
          </button>

          <div className="header-badge">
            <span>Сегодня</span>
            <strong>{formatDate(today)}</strong>
          </div>
          {selectedStation ? (
            <div className="header-badge header-badge--wide">
              <span>Выбрана станция</span>
              <strong>{selectedStation.title}</strong>
            </div>
          ) : null}
        </div>
      </header>

      {metaError ? <p className="error-banner">{metaError}</p> : null}

      <section className="panel search-panel">
        <div className="panel__header">
          <div>
            <p className="panel__eyebrow">Станция</p>
            <h2 className="panel__title">Поиск по названию</h2>
            <p className="panel__subtitle">
              Начните вводить название станции. Для выбора по карте используйте блок справа.
            </p>
          </div>
        </div>

        <label className="field-label field-label--search">
          <span>Станция</span>
          <input
            value={stationQuery}
            onChange={(event) => {
              setStationQuery(event.target.value);
              setSelectedStation(null);
            }}
            placeholder="Самара, Кинель, Безымянка"
          />
        </label>

        {stationLookup.loading ? <p className="field-hint">Ищу станции...</p> : null}
        {stationLookup.error ? <p className="error-inline">{stationLookup.error}</p> : null}

        {stationSearchEnabled && stationLookup.stations.length > 0 ? (
          <div className="suggestions">
            {stationLookup.stations.map((station) => (
              <button key={station.code} type="button" className="suggestion" onClick={() => selectStation(station)}>
                <strong>{station.title}</strong>
                <span>{station.settlementTitle || station.regionTitle || 'Станция'}</span>
              </button>
            ))}
          </div>
        ) : null}

        {selectedStation ? (
          <article className="station-banner">
            <div>
              <p className="station-banner__label">Текущая станция</p>
              <h3>{selectedStation.title}</h3>
              <p>{selectedStation.settlementTitle || selectedStation.regionTitle || 'Станция'}</p>
            </div>
            <div className="station-banner__meta">
              <span>Код: {selectedStation.code}</span>
              <span>
                Координаты: {selectedStation.latitude.toFixed(4)}, {selectedStation.longitude.toFixed(4)}
              </span>
            </div>
          </article>
        ) : (
          <p className="panel__empty">Выберите станцию, чтобы открыть табло отправлений и прибытий.</p>
        )}
      </section>

      <div className="content-grid">
        <div className="content-main">
          <ScheduleBoard
            station={selectedStation}
            schedule={schedule}
            loading={scheduleLoading}
            error={scheduleError}
            activeTab={scheduleTab}
            onTabChange={setScheduleTab}
            date={scheduleDate}
            onDateChange={setScheduleDate}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />

          <RoutePlanner
            fromQuery={routeFromQuery}
            toQuery={routeToQuery}
            onFromQueryChange={(value) => {
              setRouteFromQuery(value);
              setRouteFromStation(null);
            }}
            onToQueryChange={(value) => {
              setRouteToQuery(value);
              setRouteToStation(null);
            }}
            fromSuggestions={routeFromLookup.stations}
            toSuggestions={routeToLookup.stations}
            fromLoading={routeFromLookup.loading}
            toLoading={routeToLookup.loading}
            fromError={routeFromLookup.error}
            toError={routeToLookup.error}
            onSelectFrom={selectRouteFrom}
            onSelectTo={selectRouteTo}
            fromStation={routeFromStation}
            toStation={routeToStation}
            onSwap={swapRouteStations}
            date={routeDate}
            onDateChange={setRouteDate}
            transfers={allowTransfers}
            onTransfersChange={setAllowTransfers}
            onSearch={handleRouteSearch}
            results={routeResults}
            loading={routeLoading}
            error={routeError}
          />
        </div>

        <aside className="content-side">
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="panel__eyebrow">Карта</p>
                <h2 className="panel__title">Станции рядом</h2>
                <p className="panel__subtitle">Нажмите на карту или определите текущую геопозицию.</p>
              </div>
            </div>

            <div className="map-panel__toolbar">
              <button type="button" className="secondary-button" onClick={handleLocateUser} disabled={locating}>
                {locating ? 'Определяю позицию...' : 'Моя геопозиция'}
              </button>
              <span className="field-hint">Клик по карте покажет ближайшие станции.</span>
            </div>

            <MapPicker
              selectedStation={selectedStation}
              nearbyStations={nearbyStations}
              pickedPoint={pickedPoint}
              onPickCoordinates={handleMapPick}
              onSelectStation={selectStation}
            />

            {nearbyLoading ? <p className="field-hint">Подбираю станции рядом...</p> : null}
            {nearbyError ? <p className="error-inline">{nearbyError}</p> : null}

            {nearbyStations.length > 0 ? (
              <div className="nearby-grid">
                {nearbyStations.map((station) => (
                  <button
                    key={`${station.code}:${station.distance || 0}`}
                    type="button"
                    className="nearby-card"
                    onClick={() => selectStation(station)}
                  >
                    <strong>{station.title}</strong>
                    <span>{station.settlementTitle || station.regionTitle || 'Станция'}</span>
                    <small>{formatDistance(station.distance)}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <FavoritesPanel favorites={favorites} onSelect={selectStation} onRemove={removeFavorite} />
        </aside>
      </div>

      <footer className="app-footer" />
    </div>
  );
}
