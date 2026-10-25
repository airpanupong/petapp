import {Component, ReactNode, useCallback, useState} from 'react';

import {MapView, type MapMarker} from './MapView';
import {UnifiedNearbyMap} from './UnifiedNearbyMap';
import type {UserPosition} from '../lib/geo';
import {canCreateWebGL} from '../lib/webgl';
import {WORLD_VIEW_ZOOM} from '../lib/mapImagery';

type MapProps = {
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
};

type BoundaryProps = {children: ReactNode; fallback: ReactNode};
type BoundaryState = {failed: boolean};

/** Catches MapLibre/WebGL crashes so Nearby never goes blank. */
class MapErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {failed: false};
  static getDerivedStateFromError() {
    return {failed: true};
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LeafletFallback(props: MapProps) {
  return (
    <MapView
      center={props.center}
      zoom={props.zoom}
      markers={props.markers}
      radiusKm={props.radiusKm}
      userPosition={props.userPosition}
      recenterKey={props.recenterKey}
      className={props.className}
      worldMode={props.worldMode}
      onWorldModeChange={props.onWorldModeChange}
      worldZoomThreshold={props.worldZoomThreshold ?? WORLD_VIEW_ZOOM}
    />
  );
}

/**
 * Prefers one MapLibre map (flat ↔ globe). If WebGL is unavailable, falls back
 * to Leaflet so the page still works.
 */
export function NearbyMap(props: MapProps) {
  const [forceLeaflet, setForceLeaflet] = useState(() => !canCreateWebGL());
  const onFatal = useCallback(() => setForceLeaflet(true), []);

  const leaflet = <LeafletFallback {...props} />;

  if (forceLeaflet) return leaflet;

  return (
    <MapErrorBoundary fallback={leaflet}>
      <UnifiedNearbyMapSafe {...props} onFatal={onFatal} />
    </MapErrorBoundary>
  );
}

function UnifiedNearbyMapSafe(props: MapProps & {onFatal: () => void}) {
  const {onFatal, ...mapProps} = props;
  return <UnifiedNearbyMap {...mapProps} onFatalError={onFatal} />;
}
