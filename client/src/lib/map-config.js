import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style.js';

function readCoordinate(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const defaultMapCenter = [
  readCoordinate(import.meta.env.VITE_MAP_CENTER_LNG, 50.100202),
  readCoordinate(import.meta.env.VITE_MAP_CENTER_LAT, 53.195878),
];

export const markerLayerName = 'stations-layer';

export const pickedPointStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: '#facc15' }),
    stroke: new Stroke({ color: '#d97706', width: 2 }),
  }),
});

export const nearbyStationStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: '#334155' }),
    stroke: new Stroke({ color: '#1f2937', width: 1.5 }),
  }),
});

export function createSelectedStationStyle(title) {
  return new Style({
    image: new CircleStyle({
      radius: 9,
      fill: new Fill({ color: '#111827' }),
      stroke: new Stroke({ color: '#f8fafc', width: 3 }),
    }),
    text: new Text({
      text: title,
      offsetY: -18,
      padding: [4, 6, 4, 6],
      fill: new Fill({ color: '#111827' }),
      backgroundFill: new Fill({ color: 'rgba(255, 255, 255, 0.96)' }),
      backgroundStroke: new Stroke({ color: '#d9dde3', width: 1 }),
    }),
  });
}
