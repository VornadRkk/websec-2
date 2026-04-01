import { useEffect, useRef } from 'react';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import OSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style.js';

const samaraCenter = [50.100202, 53.195878];

const pickedPointStyle = new Style({
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: '#facc15' }),
    stroke: new Stroke({ color: '#d97706', width: 2 }),
  }),
});

const nearbyStationStyle = new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: '#334155' }),
    stroke: new Stroke({ color: '#1f2937', width: 1.5 }),
  }),
});

function createSelectedStationStyle(title) {
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

function pointFeature(lon, lat, style, properties = {}) {
  const feature = new Feature({
    geometry: new Point(fromLonLat([lon, lat])),
  });

  feature.setStyle(style);
  feature.setProperties(properties);
  return feature;
}

export function MapPicker({
  selectedStation,
  nearbyStations,
  pickedPoint,
  onPickCoordinates,
  onSelectStation,
}) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const vectorSourceRef = useRef(null);
  const onPickRef = useRef(onPickCoordinates);
  const onSelectStationRef = useRef(onSelectStation);

  useEffect(() => {
    onPickRef.current = onPickCoordinates;
  }, [onPickCoordinates]);

  useEffect(() => {
    onSelectStationRef.current = onSelectStation;
  }, [onSelectStation]);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) {
      return undefined;
    }

    const vectorSource = new VectorSource();
    const vectorLayer = new VectorLayer({
      source: vectorSource,
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });

    const map = new Map({
      target: mapNodeRef.current,
      controls: defaultControls({
        rotate: false,
      }),
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat(samaraCenter),
        zoom: 8,
        minZoom: 5,
        maxZoom: 17,
      }),
    });

    map.on('pointermove', (event) => {
      const target = map.getTargetElement();

      if (!target) {
        return;
      }

      const stationFeature = map.forEachFeatureAtPixel(event.pixel, (feature) => feature.get('station'));
      target.style.cursor = stationFeature ? 'pointer' : '';
    });

    map.on('singleclick', (event) => {
      const stationFeature = map.forEachFeatureAtPixel(event.pixel, (feature) => feature.get('station'));

      if (stationFeature) {
        onSelectStationRef.current?.(stationFeature);
        return;
      }

      const [lng, lat] = toLonLat(event.coordinate);

      onPickRef.current({
        lat,
        lng,
      });
    });

    mapRef.current = map;
    vectorSourceRef.current = vectorSource;

    const resizeObserver = new ResizeObserver(() => {
      map.updateSize();
    });

    resizeObserver.observe(mapNodeRef.current);
    map.updateSize();

    return () => {
      resizeObserver.disconnect();
      map.setTarget(undefined);
      mapRef.current = null;
      vectorSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!vectorSourceRef.current) {
      return;
    }

    vectorSourceRef.current.clear();

    if (pickedPoint) {
      vectorSourceRef.current.addFeature(pointFeature(pickedPoint.lng, pickedPoint.lat, pickedPointStyle));
    }

    nearbyStations.forEach((station) => {
      if (!station.longitude || !station.latitude) {
        return;
      }

      vectorSourceRef.current.addFeature(
        pointFeature(station.longitude, station.latitude, nearbyStationStyle, { station }),
      );
    });

    if (selectedStation?.longitude && selectedStation?.latitude) {
      vectorSourceRef.current.addFeature(
        pointFeature(
          selectedStation.longitude,
          selectedStation.latitude,
          createSelectedStationStyle(selectedStation.title),
          { station: selectedStation },
        ),
      );
    }
  }, [nearbyStations, pickedPoint, selectedStation]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const view = mapRef.current.getView();

    if (selectedStation?.longitude && selectedStation?.latitude) {
      view.animate({
        center: fromLonLat([selectedStation.longitude, selectedStation.latitude]),
        zoom: 11,
        duration: 750,
      });
      return;
    }

    if (pickedPoint) {
      view.animate({
        center: fromLonLat([pickedPoint.lng, pickedPoint.lat]),
        zoom: 10,
        duration: 750,
      });
    }
  }, [pickedPoint, selectedStation]);

  return (
    <div className="map-picker">
      <div ref={mapNodeRef} className="map-picker__canvas" />
      <div className="map-picker__legend">
        <span className="legend-dot legend-dot--click" />
        <span>выбранная точка</span>
        <span className="legend-dot legend-dot--station" />
        <span>станции рядом</span>
        <span className="legend-dot legend-dot--selected" />
        <span>текущая станция</span>
      </div>
    </div>
  );
}
