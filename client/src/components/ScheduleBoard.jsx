import { formatDate, formatTime } from '../lib/formatters.js';

function renderEmptyState(message) {
  return <p className="panel__empty">{message}</p>;
}

export function ScheduleBoard({
  station,
  schedule,
  loading,
  error,
  activeTab,
  onTabChange,
  date,
  onDateChange,
  isFavorite,
  onToggleFavorite,
}) {
  const departureCount = schedule?.departure?.length || 0;
  const arrivalCount = schedule?.arrival?.length || 0;
  const activeRows = schedule?.[activeTab] || [];

  return (
    <section className="panel">
      <div className="panel__header panel__header--spread">
        <div>
          <p className="panel__eyebrow">Табло</p>
          <h2 className="panel__title">{station ? station.title : 'Табло станции'}</h2>
          <p className="panel__subtitle">
            {station
              ? `${station.settlementTitle || 'Станция'} · ${formatDate(date)}`
              : 'Выберите станцию по названию или на карте.'}
          </p>
        </div>

        <div className="panel__actions">
          <label className="field-label field-label--compact">
            <span>Дата</span>
            <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
          </label>
          {station ? (
            <button type="button" className="secondary-button" onClick={() => onToggleFavorite(station)}>
              {isFavorite ? 'Убрать из избранного' : 'В избранное'}
            </button>
          ) : null}
        </div>
      </div>

      {!station ? renderEmptyState('После выбора станции здесь появится расписание прибытия и отправления.') : null}

      {station ? (
        <>
          <div className="segmented-control">
            <button
              type="button"
              className={`segment-button ${activeTab === 'departure' ? 'segment-button--active' : ''}`}
              onClick={() => onTabChange('departure')}
            >
              Отправление
              <span>{departureCount}</span>
            </button>
            <button
              type="button"
              className={`segment-button ${activeTab === 'arrival' ? 'segment-button--active' : ''}`}
              onClick={() => onTabChange('arrival')}
            >
              Прибытие
              <span>{arrivalCount}</span>
            </button>
          </div>

          {loading ? <p className="panel__empty">Обновляю расписание...</p> : null}
          {error ? <p className="error-banner">{error}</p> : null}

          {!loading && !error && activeRows.length === 0
            ? renderEmptyState('На выбранную дату для этой вкладки нет подходящих рейсов.')
            : null}

          {!loading && !error && activeRows.length > 0 ? (
            <div className="table-scroll">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>Время</th>
                    <th>Номер</th>
                    <th>Маршрут</th>
                    <th>Путь</th>
                    <th>Тип</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((item) => (
                    <tr key={item.uid}>
                      <td>
                        <strong>{formatTime(activeTab === 'departure' ? item.departure : item.arrival)}</strong>
                        <span className="subtle-row">
                          {activeTab === 'departure'
                            ? `приб. ${formatTime(item.arrival)}`
                            : `отпр. ${formatTime(item.departure)}`}
                        </span>
                      </td>
                      <td>
                        <strong>{item.number || '—'}</strong>
                        <span className="subtle-row">{item.vehicle}</span>
                      </td>
                      <td>
                        <strong>{item.direction || item.title}</strong>
                        <span className="subtle-row">{item.carrier}</span>
                      </td>
                      <td>
                        <strong>{item.platform || '—'}</strong>
                        <span className="subtle-row">{item.stops}</span>
                      </td>
                      <td>{item.isExpress ? 'Экспресс' : 'Обычный'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
