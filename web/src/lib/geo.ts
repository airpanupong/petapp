import {useCallback, useEffect, useRef, useState} from 'react';

import {DEFAULT_CENTER} from './config';
import {syncUserLocation} from '../api/features.api';
import {useAuthStore} from '../store/authStore';

export type Coords = {latitude: number; longitude: number};
export type UserPosition = Coords & {accuracy?: number | null};
export type GeoStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable' | 'unsupported';

// iOS (notably Home Screen apps) reports "prompt" again on every launch even after the user allowed location.
const GRANTED_KEY = 'petapp.location-allowed';

function rememberGrant(allowed: boolean) {
  try {
    if (allowed) localStorage.setItem(GRANTED_KEY, '1');
    else localStorage.removeItem(GRANTED_KEY);
  } catch {
    // storage unavailable (private mode); fall back to asking
  }
}

function grantRemembered() {
  try {
    return localStorage.getItem(GRANTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function getCurrentPosition(timeoutMs = 8000): Promise<Coords> {
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) {
      resolve(DEFAULT_CENTER);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        rememberGrant(true);
        resolve({latitude: pos.coords.latitude, longitude: pos.coords.longitude});
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) rememberGrant(false);
        resolve(DEFAULT_CENTER);
      },
      {enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000},
    );
  });
}

let lastSync: {at: number; pos: Coords} | null = null;

function roughKm(a: Coords, b: Coords) {
  const dLat = (a.latitude - b.latitude) * 111;
  const dLng = (a.longitude - b.longitude) * 111 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/** Lost alerts are matched against the last location the server knows. */
function syncLocation(pos: Coords) {
  if (useAuthStore.getState().status !== 'authenticated') return;
  const now = Date.now();
  if (lastSync && (now - lastSync.at < 60_000 || (now - lastSync.at < 10 * 60_000 && roughKm(lastSync.pos, pos) < 0.5))) return;
  lastSync = {at: now, pos};
  void syncUserLocation(pos.latitude, pos.longitude).catch(() => {
    lastSync = null;
  });
}

export async function locationPermission(): Promise<PermissionState | 'unsupported'> {
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    const result = await navigator.permissions.query({name: 'geolocation'});
    if (result.state === 'denied') rememberGrant(false);
    if (result.state === 'prompt' && grantRemembered()) return 'granted';
    return result.state;
  } catch {
    return grantRemembered() ? 'granted' : 'prompt';
  }
}

/**
 * Live device position. With `prompt: false` it only starts watching when the
 * permission was already granted, so pages can show the dot without asking.
 */
export function useUserPosition({prompt = true}: {prompt?: boolean} = {}) {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [status, setStatus] = useState<GeoStatus>('idle');
  const watchId = useRef<number | null>(null);
  const hasFix = useRef(false);

  const stop = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    stop();
    if (!hasFix.current) setStatus('locating');
    watchId.current = navigator.geolocation.watchPosition(
      pos => {
        hasFix.current = true;
        rememberGrant(true);
        const next = {latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy};
        setPosition(next);
        syncLocation(next);
        setStatus('granted');
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          rememberGrant(false);
          stop();
          setStatus('denied');
        } else if (!hasFix.current) {
          setStatus('unavailable');
        }
      },
      {enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000},
    );
  }, [stop]);

  useEffect(() => {
    if (prompt) request();
    else void locationPermission().then(state => state === 'granted' && request());
    return stop;
  }, [prompt, request, stop]);

  return {position, status, request};
}
