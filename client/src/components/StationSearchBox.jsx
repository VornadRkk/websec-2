function sameStationSelection(station, value) {
  if (!station) {
    return false;
  }

  const normalizedValue = String(value || '').trim().toLowerCase();

  return [station.title, station.popularTitle, station.shortTitle]
    .filter(Boolean)
    .some((title) => String(title).trim().toLowerCase() === normalizedValue);
}

export function StationSearchBox({
  label,
  value,
  onChange,
  loading,
  error,
  suggestions,
  onSelect,
  selectedStation,
}) {
  const showSuggestions = suggestions.length > 0 && !sameStationSelection(selectedStation, value);

  return (
    <div className="search-box">
      <label className="field-label">
        <span>{label}</span>
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Введите станцию" />
      </label>

      {selectedStation && (
        <div className="selected-station-pill">
          <strong>{selectedStation.title}</strong>
          <span>{selectedStation.settlementTitle || selectedStation.regionTitle || 'Станция выбрана'}</span>
        </div>
      )}

      {loading && <p className="field-hint">Ищу станции...</p>}
      {error && <p className="error-inline">{error}</p>}

      {showSuggestions && (
        <div className="suggestions">
          {suggestions.slice(0, 6).map((station) => (
            <button key={station.code} type="button" className="suggestion" onClick={() => onSelect(station)}>
              <strong>{station.title}</strong>
              <span>{station.settlementTitle || station.regionTitle || 'Станция'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
