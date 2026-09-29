import {ReactNode, useEffect} from 'react';
import L from 'leaflet';
import {MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents, Circle, CircleMarker} from 'react-leaflet';
import {Eye, HeartHandshake, LocateFixed, LucideIcon, Siren} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import {mascotSrc} from './PetMascot';
import type {UserPosition} from '../lib/geo';

export type LatLng = {latitude: number; longitude: number};

export type MapMarker = {
  id: string;
  position: LatLng;
  kind: 'lost' | 'found' | 'sighting' | 'me';
  animal?: string | null;
  icon?: PinGlyph;
  popup?: ReactNode;
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

// lucide-react paths, inlined because Leaflet divIcons take an HTML string.
const GLYPHS: Record<PinGlyph, string> = {
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
};

const iconCache = new Map<string, L.DivIcon>();

function pinIcon({kind, animal, icon: glyph}: MapMarker) {
  const inner = glyph
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyph]}</svg>`
    : `<img src="${mascotSrc(animal, true)}" alt="" />`;
  const key = `${kind}:${inner}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      html: `<div class="map-pin pin-${kind}">${inner}</div>`,
      iconSize: [42, 42],
      iconAnchor: [4, 42],
      popupAnchor: [17, -38],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function Recenter({center, zoom, recenterKey}: {center: LatLng; zoom?: number; recenterKey?: number}) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], zoom ?? map.getZoom(), {animate: true});
  }, [center.latitude, center.longitude, zoom, recenterKey, map]);
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
  /** Bump to fly back to `center` even when it did not change. */
  recenterKey?: number;
  className?: string;
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
        radius={8}
        pathOptions={{color: '#fff', weight: 3, fillColor: '#2f7bf5', fillOpacity: 1, className: 'user-dot'}}>
        <Popup>
          <PinPopup kind="me">คุณอยู่ที่นี่</PinPopup>
        </Popup>
      </CircleMarker>
    </>
  );
}

export function MapView({center, zoom = 14, markers = [], radiusKm, onPick, userPosition, recenterKey, className = ''}: Props) {
  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      className={`map ${className}`}
      scrollWheelZoom
      attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <Recenter center={center} recenterKey={recenterKey} />
      <InvalidateOnResize />
      {onPick ? <ClickPicker onPick={onPick} /> : null}
      {radiusKm ? (
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
  );
}
