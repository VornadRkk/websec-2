import { formatDateTime, formatDuration } from '../lib/formatters.js';
import { StationSearchBox } from './StationSearchBox.jsx';

export function RoutePlanner({
  fromQuery,
  toQuery,
  onFromQueryChange,
  onToQueryChange,
  fromSuggestions,
  toSuggestions,
  fromLoading,
  toLoading,
  fromError,
  toError,
  onSelectFrom,
  onSelectTo,
  fromStation,
  toStation,
  onSwap,
  date,
  onDateChange,
  transfers,
  onTransfersChange,
  onSearch,
  results,
  loading,
  error,
}) {
  const routeReady = Boolean(fromStation && toStation);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Маршрут</p>
          <h2 className="panel__title">Между двумя станциями</h2>
          <p className="panel__subtitle">Выберите точки отправления и прибытия, затем запустите поиск.</p>
        </div>
      </div>

      <div className="route-form">
        <div className="route-form__grid">
          <StationSearchBox
            label="Откуда"
            value={fromQuery}
            onChange={onFromQueryChange}
            loading={fromLoading}
            error={fromError}
            suggestions={fromSuggestions}
            onSelect={onSelectFrom}
            selectedStation={fromStation}
          />

          <button type="button" className="ghost-button route-form__swap" onClick={onSwap}>
            Поменять
          </button>

          <StationSearchBox
            label="Куда"
            value={toQuery}
            onChange={onToQueryChange}
            loading={toLoading}
            error={toError}
            suggestions={toSuggestions}
            onSelect={onSelectTo}
            selectedStation={toStation}
          />
        </div>

        <div className="route-form__controls">
          <label className="field-label field-label--compact">
            <span>Дата</span>
            <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={transfers}
              onChange={(event) => onTransfersChange(event.target.checked)}
            />
            <span>Искать с пересадками</span>
          </label>

          <button type="button" className="primary-button" onClick={onSearch} disabled={!routeReady || loading}>
            {loading ? 'Ищу...' : 'Найти'}
          </button>
        </div>

        <div className="route-selection-status">
          <span className={fromStation ? 'status-chip status-chip--ready' : 'status-chip'}>
            {fromStation ? `Откуда: ${fromStation.title}` : 'Откуда: не выбрано'}
          </span>
          <span className={toStation ? 'status-chip status-chip--ready' : 'status-chip'}>
            {toStation ? `Куда: ${toStation.title}` : 'Куда: не выбрано'}
          </span>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {!error && !loading && results.length === 0 && (
        <p className="panel__empty">
          {routeReady
            ? 'Станции выбраны. Нажмите кнопку поиска, чтобы получить маршруты.'
            : 'Подберите две станции из подсказок и нажмите кнопку поиска маршрута.'}
        </p>
      )}

      {results.length > 0 && (
        <div className="route-results">
          {results.map((route) => (
            <article key={route.uid} className="route-card">
              <div className="route-card__top">
                <div>
                  <p className="route-card__number">{route.number || 'Без номера'}</p>
                  <h3>{route.title}</h3>
                </div>
                <span className="route-card__badge">{route.transportLabel}</span>
              </div>

              <div className="route-card__timeline">
                <div>
                  <strong>{formatDateTime(route.departure)}</strong>
                  <span>{route.fromTitle || 'станция отправления'}</span>
                </div>
                <div className="route-card__duration">{formatDuration(route.duration)}</div>
                <div>
                  <strong>{formatDateTime(route.arrival)}</strong>
                  <span>{route.toTitle || 'станция прибытия'}</span>
                </div>
              </div>

              <div className="route-card__meta">
                <span>Перевозчик: {route.carrier}</span>
                <span>Отпр. путь: {route.departurePlatform || '—'}</span>
                <span>Приб. путь: {route.arrivalPlatform || '—'}</span>
                <span>{route.hasTransfers ? 'Есть пересадки' : 'Без пересадок'}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
