import {ReactNode, useEffect, useRef} from 'react';
import L from 'leaflet';
import {MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents, Circle, CircleMarker} from 'react-leaflet';
import {Eye, HeartHandshake, LocateFixed, LucideIcon, Siren} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import type {UserPosition} from '../lib/geo';
import {MAP_TILE_ATTR, MAP_TILE_MAX_ZOOM, MAP_TILE_URL, WORLD_VIEW_ZOOM} from '../lib/mapImagery';
import {pinInnerHtml, type PinKind} from '../lib/mapPins';

export type LatLng = {latitude: number; longitude: number};

export type MapMarker = {
  id: string;
  position: LatLng;
  kind: 'lost' | 'found' | 'sighting' | 'me';
  animal?: string | null;
  icon?: PinGlyph;
  popup?: ReactNode;
  title?: string;
  href?: string;
};

type PinGlyph = 'eye' | 'user' | 'pin';

const KIND_TAG: Record<MapMarker['kind'], {label: string; icon: LucideIcon}> = {
  lost: {label: 'ตามหา', icon: Siren},
  found: {label: 'มีคนพบ', icon: HeartHandshake},
  sighting: {label: 'เบาะแส', icon: Eye},
  me: {label: 'ตำแหน่งของคุณ', icon: LocateFixed},
};

function PinPopup({kind, children}: {kind: MapMarker['kind']; children: ReactNode}) {
  const {label, icon: Icon} = KIND_TAG[kind];
  return (
    <div className="pin-popup">
      <span className={`pin-popup-tag tag-${kind}`}>
        <Icon size={12} strokeWidth={2.6} /> {label}
      </span>
      <div className="pin-popup-body">{children}</div>
    </div>
  );
}

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(m: MapMarker) {
  const key = `${m.kind}-${m.animal ?? ''}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: 'map-pin-wrap',
      html: pinInnerHtml(m.kind as PinKind, m.animal),
      iconSize: [44, 52],
      iconAnchor: [22, 50],
      popupAnchor: [0, -44],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

/**
 * Only flies when `recenterKey` changes — never fights the user’s pinch/scroll zoom.
 */
function Recenter({center, zoom, recenterKey}: {center: LatLng; zoom: number; recenterKey?: number}) {
  const map = useMap();
  const lastKey = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (recenterKey === undefined) return;
    if (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude) || !Number.isFinite(zoom)) return;
    let cancelled = false;
    const go = () => {
      if (cancelled || lastKey.current === recenterKey) return true;
      const size = map.getSize();
      // A page can mount while the route loader hides it (display: none).
      // Leaflet then unprojects a 0×0 pane and throws Invalid LatLng (NaN, NaN),
      // which unmounts the whole app.
      if (!size || size.x < 2 || size.y < 2) return false;
      try {
        map.invalidateSize();
        const fromZoom = map.getZoom();
        if (!Number.isFinite(fromZoom)) {
          map.setView([center.latitude, center.longitude], zoom, {animate: false});
        } else {
          const delta = Math.abs(fromZoom - zoom);
          const duration = Math.min(6.5, Math.max(1.4, 1.2 + delta * 0.42));
          map.stop();
          map.flyTo([center.latitude, center.longitude], zoom, {
            animate: true,
            duration,
            easeLinearity: 0.12,
          });
        }
        lastKey.current = recenterKey;
        return true;
      } catch {
        try {
          map.setView([center.latitude, center.longitude], zoom, {animate: false});
          lastKey.current = recenterKey;
          return true;
        } catch {
          return false;
        }
      }
    };
    if (go()) return () => { cancelled = true; };
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      if (go()) observer.disconnect();
    });
    observer.observe(container);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [recenterKey, center.latitude, center.longitude, zoom, map]);

  return null;
}

/** Sync parent world/local mode from Leaflet zoom without resetting the camera. */
function WorldZoomSync({
  threshold,
  worldMode,
  onWorldModeChange,
}: {
  threshold: number;
  worldMode: boolean;
  onWorldModeChange?: (world: boolean, zoom: number) => void;
}) {
  const map = useMap();
  const worldRef = useRef(worldMode);
  worldRef.current = worldMode;

  useEffect(() => {
    if (!onWorldModeChange) return;
    const sync = () => {
      try {
        const z = map.getZoom();
        const world = z <= threshold;
        if (world !== worldRef.current) onWorldModeChange(world, z);
      } catch {
        /* ignore */
      }
    };
    map.on('zoomend', sync);
    map.on('zoom', sync);
    return () => {
      map.off('zoomend', sync);
      map.off('zoom', sync);
    };
  }, [map, threshold, onWorldModeChange]);

  return null;
}

function ClickPicker({onPick}: {onPick: (p: LatLng) => void}) {
  useMapEvents({
    click: e => onPick({latitude: e.latlng.lat, longitude: e.latlng.lng}),
  });
  return null;
}

function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

type Props = {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  radiusKm?: number;
  onPick?: (p: LatLng) => void;
  userPosition?: UserPosition | null;
  recenterKey?: number;
  className?: string;
  worldMode?: boolean;
  onWorldModeChange?: (world: boolean, zoom: number) => void;
  worldZoomThreshold?: number;
  showLegend?: boolean;
};

function UserDot({position}: {position: UserPosition}) {
  const latLng: [number, number] = [position.latitude, position.longitude];
  return (
    <>
      {position.accuracy && position.accuracy < 2000 ? (
        <Circle
          center={latLng}
          radius={position.accuracy}
          interactive={false}
          pathOptions={{color: '#3b82f6', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.12}}
        />
      ) : null}
      <CircleMarker
        center={latLng}
        radius={14}
        interactive={false}
        pathOptions={{color: '#2f7bf5', weight: 0, fillColor: '#2f7bf5', fillOpacity: 0.2, className: 'user-dot-halo'}}
      />
      <CircleMarker
        center={latLng}
        radius={9}
        pathOptions={{color: '#fff', weight: 3, fillColor: '#2f7bf5', fillOpacity: 1, className: 'user-dot'}}>
        <Popup>
          <PinPopup kind="me">คุณอยู่ที่นี่</PinPopup>
        </Popup>
      </CircleMarker>
    </>
  );
}

export function MapView({
  center,
  zoom = 14,
  markers = [],
  radiusKm,
  onPick,
  userPosition,
  recenterKey = 0,
  className = '',
  worldMode = false,
  onWorldModeChange,
  worldZoomThreshold = WORLD_VIEW_ZOOM,
  showLegend = true,
}: Props) {
  return (
    <div className={`map-host map-atlas ${worldMode ? 'is-globe-view' : ''} ${className}`}>
      {showLegend ? (
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
      ) : null}
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={zoom}
        minZoom={2}
        maxZoom={MAP_TILE_MAX_ZOOM}
        className="map map-fill"
        scrollWheelZoom
        attributionControl>
        <TileLayer attribution={MAP_TILE_ATTR} url={MAP_TILE_URL} maxZoom={MAP_TILE_MAX_ZOOM} />
        <Recenter center={center} zoom={zoom} recenterKey={recenterKey} />
        <InvalidateOnResize />
        <WorldZoomSync threshold={worldZoomThreshold} worldMode={worldMode} onWorldModeChange={onWorldModeChange} />
        {onPick ? <ClickPicker onPick={onPick} /> : null}
        {radiusKm && !worldMode ? (
          <Circle
            center={[center.latitude, center.longitude]}
            radius={radiusKm * 1000}
            pathOptions={{color: '#f2657f', weight: 1.5, fillColor: '#ff8fa3', fillOpacity: 0.08}}
          />
        ) : null}
        {markers.map(m => (
          <Marker key={m.id} position={[m.position.latitude, m.position.longitude]} icon={pinIcon(m)}>
            {m.popup ? (
              <Popup>
                <PinPopup kind={m.kind}>{m.popup}</PinPopup>
              </Popup>
            ) : null}
          </Marker>
        ))}
        {userPosition ? <UserDot position={userPosition} /> : null}
      </MapContainer>
    </div>
  );
}
