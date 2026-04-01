export function FavoritesPanel({ favorites, onSelect, onRemove }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Избранное</p>
          <h2 className="panel__title">Быстрый доступ</h2>
        </div>
      </div>

      {favorites.length === 0 ? (
        <p className="panel__empty">
          Добавьте станцию в избранное из табло, чтобы быстро возвращаться к ней с телефона.
        </p>
      ) : (
        <div className="favorites-list">
          {favorites.map((station) => (
            <article key={station.code} className="favorite-card">
              <button type="button" className="favorite-card__select" onClick={() => onSelect(station)}>
                <strong>{station.title}</strong>
                <span>{station.settlementTitle || station.regionTitle || 'Станция'}</span>
              </button>
              <button type="button" className="icon-button" onClick={() => onRemove(station.code)}>
                Убрать
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
