/**
 * Unified Nearby map (MapLibre) — one instance morphs flat ↔ globe via projection.
 * Other pages still use Leaflet + OSM street tiles.
 */

import type {StyleSpecification} from 'maplibre-gl';

export const MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const MAP_TILE_MAX_ZOOM = 19;

/** Zoom at/below this feels like “world / globe” (UI + pin set). */
export const WORLD_VIEW_ZOOM = 4.5;

export const WORLD_FLY_ZOOM = 2.2;
export const LOCAL_RETURN_ZOOM = 12;

/**
 * OSM tiles tinted for a BUMP-like globe: deep blue seas, green/sand land,
 * dark space behind the sphere — then eases back to normal street colors when zoomed in.
 */
export function atlasGlobeStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'Pet haii Atlas',
    projection: {type: 'globe'},
    sources: {
      osm: {
        type: 'raster',
        tiles: [MAP_TILE_URL],
        tileSize: 256,
        attribution: MAP_TILE_ATTR,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          // Space void around the globe → soft sky when closer
          'background-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            '#020617',
            3,
            '#0a1628',
            6,
            '#7eb8d8',
            10,
            '#b9daf0',
          ],
        },
      },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: {
          // Globe: richer blue/green, darker. Street: near-natural OSM.
          'raster-saturation': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            0.45,
            4,
            0.28,
            8,
            0.05,
            12,
            0,
          ],
          'raster-contrast': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            0.28,
            4,
            0.18,
            8,
            0.06,
            12,
            0,
          ],
          'raster-brightness-min': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            0.02,
            5,
            0.05,
            12,
            0.08,
          ],
          'raster-brightness-max': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            0.62,
            3,
            0.7,
            6,
            0.82,
            10,
            0.92,
            14,
            0.96,
          ],
          'raster-hue-rotate': [
            'interpolate',
            ['linear'],
            ['zoom'],
            0,
            8,
            6,
            4,
            12,
            0,
          ],
        },
      },
    ],
    sky: {
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 3, 0.75, 6, 0.25, 9, 0],
    },
    light: {
      anchor: 'viewport',
      position: [1.15, 210, 28],
      color: '#c8e4ff',
      intensity: 0.22,
    },
  };
}

/** Legacy Three.js globe (unused on Nearby). */
export const GLOBE_EARTH_URL = '/globe/earth.jpg';
export const GLOBE_ENTER_DISTANCE = 2.05;
