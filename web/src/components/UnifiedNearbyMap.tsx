import {useEffect, useRef} from 'react';
import maplibregl, {GeoJSONSource, Map as MapLibreMap} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type {MapMarker} from './MapView';
import type {UserPosition} from '../lib/geo';
import {atlasGlobeStyle, WORLD_VIEW_ZOOM} from '../lib/mapImagery';
import {pinInnerHtml, pinPopupHtml, pinScaleForZoom, type PinKind} from '../lib/mapPins';

type Props = {
  center: {latitude: number; longitude: number};
  zoom: number;
  markers: MapMarker[];
  radiusKm?: number;
  userPosition?: UserPosition | null;
  recenterKey?: number;
  className?: string;
  worldMode?: boolean;
  onWorldModeChange?: (world: boolean, zoom: number) => void;
  worldZoomThreshold?: number;
  /** Called when MapLibre cannot start (no WebGL) — parent should fall back. */
  onFatalError?: () => void;
};

type PinEntry = {marker: maplibregl.Marker; kind: PinKind; animal: string};
type PinData = {
  kind: PinKind;
  animal: string;
  lng: number;
  lat: number;
  title: string;
  href?: string;
};

/**
 * One MapLibre map: zoom in = street view, zoom out = same map as a 3D globe.
 * HTML teardrop pins (same language as Leaflet) instead of flat circles.
 */
export function UnifiedNearbyMap({
  center,
  zoom,
  markers,
  radiusKm,
  userPosition,
  recenterKey = 0,
  className = '',
  worldMode = false,
  onWorldModeChange,
  worldZoomThreshold = WORLD_VIEW_ZOOM,
  onFatalError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsRef = useRef<Map<string, PinEntry>>(new Map());
  const worldRef = useRef(worldMode);
  const onWorldRef = useRef(onWorldModeChange);
  const lastRecenter = useRef<number | undefined>(undefined);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const fatalRef = useRef(onFatalError);
  fatalRef.current = onFatalError;

  worldRef.current = worldMode;
  onWorldRef.current = onWorldModeChange;

  const applyPinScale = (map: MapLibreMap) => {
    const scale = String(pinScaleForZoom(map.getZoom()));
    pinsRef.current.forEach(({marker}) => {
      const anchor = marker.getElement().querySelector('.map-pin-anchor') as HTMLElement | null;
      anchor?.style.setProperty('--pin-scale', scale);
    });
  };

  const openPinPopup = (map: MapLibreMap, lng: number, lat: number, kind: PinKind, title: string, href?: string) => {
    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({
      offset: 28,
      closeButton: true,
      className: 'ml-pin-popup',
      maxWidth: '240px',
    })
      .setLngLat([lng, lat])
      .setHTML(pinPopupHtml(kind, title, href))
      .addTo(map);
  };

  const syncPins = (map: MapLibreMap, list: MapMarker[], user: UserPosition | null | undefined) => {
    const next = new Map<string, PinData>();
    for (const m of list) {
      if (m.kind === 'me') continue;
      next.set(m.id, {
        kind: m.kind,
        animal: m.animal ?? '',
        lng: m.position.longitude,
        lat: m.position.latitude,
        title: m.title ?? m.id,
        href: m.href,
      });
    }
    if (user) {
      next.set('me', {
        kind: 'me',
        animal: '',
        lng: user.longitude,
        lat: user.latitude,
        title: 'คุณอยู่ที่นี่',
      });
    }

    // Remove stale
    for (const [id, entry] of pinsRef.current) {
      if (!next.has(id)) {
        entry.marker.remove();
        pinsRef.current.delete(id);
      }
    }

    const bindPinClick = (el: HTMLButtonElement) => {
      el.onclick = e => {
        e.stopPropagation();
        openPinPopup(
          map,
          Number(el.dataset.lng),
          Number(el.dataset.lat),
          (el.dataset.kind || 'lost') as PinKind,
          el.dataset.title || '',
          el.dataset.href || undefined,
        );
      };
    };

    const writePinData = (el: HTMLButtonElement, data: PinData) => {
      el.dataset.lng = String(data.lng);
      el.dataset.lat = String(data.lat);
      el.dataset.kind = data.kind;
      el.dataset.title = data.title;
      el.dataset.href = data.href ?? '';
      el.setAttribute('aria-label', data.title);
    };

    for (const [id, data] of next) {
      const existing = pinsRef.current.get(id);
      if (existing && existing.kind === data.kind && existing.animal === data.animal) {
        existing.marker.setLngLat([data.lng, data.lat]);
        const el = existing.marker.getElement() as HTMLButtonElement;
        writePinData(el, data);
        continue;
      }
      existing?.marker.remove();

      const el = document.createElement('button');
      el.type = 'button';
      el.className = `map-pin-wrap ml-pin kind-${data.kind}`;
      el.innerHTML = pinInnerHtml(data.kind, data.animal || null);
      writePinData(el, data);
      bindPinClick(el);

      const marker = new maplibregl.Marker({element: el, anchor: 'bottom', offset: [0, 2]})
        .setLngLat([data.lng, data.lat])
        .addTo(map);
      pinsRef.current.set(id, {marker, kind: data.kind, animal: data.animal});
    }

    applyPinScale(map);
  };

  // Boot map once
  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: host,
        style: atlasGlobeStyle(),
        center: [center.longitude, center.latitude],
        zoom,
        minZoom: 1.2,
        maxZoom: 18,
        attributionControl: {compact: true},
        cooperativeGestures: false,
        canvasContextAttributes: {
          antialias: false,
          powerPreference: 'low-power',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
        },
      });
    } catch (err) {
      console.warn('[UnifiedNearbyMap] WebGL init failed, falling back', err);
      fatalRef.current?.();
      return;
    }

    const fail = (reason: string) => {
      console.warn('[UnifiedNearbyMap] falling back:', reason);
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      fatalRef.current?.();
    };

    map.on('error', e => {
      const msg = String((e as {error?: Error}).error?.message ?? e);
      if (/webgl|WebGL|Failed to initialize|context/i.test(msg)) {
        fail(msg);
      }
    });

    map.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');

    const resize = () => {
      try {
        map.resize();
      } catch {
        /* ignore */
      }
    };
    requestAnimationFrame(() => {
      resize();
      requestAnimationFrame(resize);
    });
    const ro = new ResizeObserver(() => resize());
    ro.observe(host);

    const blankTimer = window.setTimeout(() => {
      if (!mapRef.current) return;
      try {
        const canvas = map.getCanvas();
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (gl && gl.isContextLost()) {
          fail('WebGL context lost');
          return;
        }
        if (host.clientWidth < 8 || host.clientHeight < 8) {
          fail('map container has no size');
        }
      } catch (err) {
        fail(String(err));
      }
    }, 2500);

    map.on('load', () => {
      resize();
      if (radiusKm && radiusKm > 0) {
        map.addSource('radius', {
          type: 'geojson',
          data: circlePolygon(center.latitude, center.longitude, radiusKm),
        });
        map.addLayer({
          id: 'radius-fill',
          type: 'fill',
          source: 'radius',
          paint: {'fill-color': '#f2657f', 'fill-opacity': 0.08},
        });
        map.addLayer({
          id: 'radius-line',
          type: 'line',
          source: 'radius',
          paint: {'line-color': '#f2657f', 'line-width': 1.5, 'line-opacity': 0.7},
        });
      }
      syncPins(map, markers, userPosition);
    });

    let lastWorld = worldMode;
    const onZoomEnd = () => {
      const z = map.getZoom();
      applyPinScale(map);
      const world = z <= worldZoomThreshold;
      if (world !== lastWorld) {
        lastWorld = world;
        onWorldRef.current?.(world, z);
      }
    };
    map.on('zoomend', onZoomEnd);
    map.on('zoom', () => applyPinScale(map));

    mapRef.current = map;
    lastRecenter.current = recenterKey;

    return () => {
      window.clearTimeout(blankTimer);
      ro.disconnect();
      popupRef.current?.remove();
      pinsRef.current.forEach(({marker}) => marker.remove());
      pinsRef.current.clear();
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly only when recenterKey changes — slow ease-in-out dive from globe → street
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lastRecenter.current === recenterKey) return;
    lastRecenter.current = recenterKey;
    const fromZoom = map.getZoom();
    const delta = Math.abs(fromZoom - zoom);
    const duration = Math.min(6500, Math.max(1400, 1200 + delta * 420));
    map.flyTo({
      center: [center.longitude, center.latitude],
      zoom,
      essential: true,
      duration,
      curve: 1.35,
      easing: (t: number) => {
        const x = t * t * (3 - 2 * t);
        return x * x * (3 - 2 * x);
      },
    });
  }, [recenterKey, center.latitude, center.longitude, zoom]);

  // Update pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    syncPins(map, markers, userPosition);
    // syncPins is stable enough via refs; recreate when data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, userPosition]);

  // Update radius circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('radius') as GeoJSONSource | undefined;
    if (!src) return;
    if (worldMode || !radiusKm) {
      src.setData({type: 'FeatureCollection', features: []});
    } else {
      src.setData(circlePolygon(center.latitude, center.longitude, radiusKm));
    }
  }, [center.latitude, center.longitude, radiusKm, worldMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.classList.toggle('is-globe-view', worldMode);
  }, [worldMode]);

  return (
    <div className={`map-host unified-map ${className}`}>
      <div className="map-pin-legend" aria-hidden>
        <span>
          <i className="lg-lost" /> ตามหา
        </span>
        <span>
          <i className="lg-found" /> พบ
        </span>
        <span>
          <i className="lg-sighting" /> เบาะแส
        </span>
      </div>
      <div ref={hostRef} className="unified-map-canvas" />
    </div>
  );
}

function circlePolygon(lat: number, lng: number, radiusKm: number, steps = 64): GeoJSON.Feature {
  const coords: [number, number][] = [];
  const R = 6371;
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI;
    const lat1 = (lat * Math.PI) / 180;
    const lng1 = (lng * Math.PI) / 180;
    const ang = radiusKm / R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(bearing));
    const lng2 =
      lng1 + Math.atan2(Math.sin(bearing) * Math.sin(ang) * Math.cos(lat1), Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2));
    coords.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: {type: 'Polygon', coordinates: [coords]},
  };
}

export default UnifiedNearbyMap;
