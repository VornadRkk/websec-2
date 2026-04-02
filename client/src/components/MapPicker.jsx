import { useEffect, useRef } from 'react';
import Feature from 'ol/Feature.js';
import Map from 'ol/Map.js';
import Point from 'ol/geom/Point.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import View from 'ol/View.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import TileSourceOSM from 'ol/source/OSM.js';
import VectorSource from 'ol/source/Vector.js';
import { fromLonLat, toLonLat } from 'ol/proj.js';
import {
  createSelectedStationStyle,
  defaultMapCenter,
  markerLayerName,
  nearbyStationStyle,
  pickedPointStyle,
} from '../lib/map-config.js';
import { getVectorLayerSourceByName } from '../lib/map-layers.js';

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

    const vectorLayer = new VectorLayer({
      source: new VectorSource(),
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });
    vectorLayer.set('name', markerLayerName);

    const map = new Map({
      target: mapNodeRef.current,
      controls: defaultControls({
        rotate: false,
      }),
      layers: [
        new TileLayer({
          source: new TileSourceOSM(),
        }),
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat(defaultMapCenter),
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
      onPickRef.current({ lat, lng });
    });

    mapRef.current = map;

    // OpenLayers needs an explicit size refresh after responsive/layout changes.
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            map.updateSize();
          })
        : null;

    resizeObserver?.observe(mapNodeRef.current);
    requestAnimationFrame(() => {
      map.updateSize();
    });

    return () => {
      resizeObserver?.disconnect();
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const vectorSource = getVectorLayerSourceByName(mapRef.current, markerLayerName);

    if (!vectorSource) {
      return;
    }

    vectorSource.clear();

    if (pickedPoint) {
      vectorSource.addFeature(pointFeature(pickedPoint.lng, pickedPoint.lat, pickedPointStyle));
    }

    nearbyStations.forEach((station) => {
      if (!station.longitude || !station.latitude) {
        return;
      }

      vectorSource.addFeature(pointFeature(station.longitude, station.latitude, nearbyStationStyle, { station }));
    });

    if (selectedStation?.longitude && selectedStation?.latitude) {
      vectorSource.addFeature(
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

    if (!view) {
      return;
    }

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
