import {KeyboardEvent, useEffect, useRef, useState} from 'react';
import {LocateFixed, MapPin, Search} from 'lucide-react';

import {MapView, LatLng} from './MapView';
import {getCurrentPosition} from '../lib/geo';
import {DEFAULT_CENTER} from '../lib/config';
import {PlaceResult, reverseGeocode, searchPlaces} from '../api/geo.api';

type Props = {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  locationText: string;
  onLocationTextChange: (text: string) => void;
  radiusKm?: number;
};

const SEARCH_DELAY_MS = 700;

export function LocationPicker({value, onChange, locationText, onLocationTextChange, radiusKm}: Props) {
  const [locating, setLocating] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [noResult, setNoResult] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  // Text we filled in ourselves (from a result or reverse lookup) must not trigger a new search.
  const autoText = useRef<string | null>(null);
  const typed = useRef(false);

  const fillFromMap = async (p: LatLng) => {
    if (locationText.trim() && locationText !== autoText.current) return;
    try {
      const name = await reverseGeocode(p);
      if (!name) return;
      autoText.current = name;
      onLocationTextChange(name);
    } catch {
      // Place names are a convenience; the pin is what matters.
    }
  };

  const pick = (p: LatLng) => {
    onChange(p);
    setResults([]);
    void fillFromMap(p);
  };

  const locate = async () => {
    setLocating(true);
    const pos = await getCurrentPosition();
    setLocating(false);
    setRecenterKey(k => k + 1);
    pick(pos);
  };

  const choose = (r: PlaceResult) => {
    autoText.current = r.name;
    typed.current = false;
    onLocationTextChange(r.name);
    onChange({latitude: r.latitude, longitude: r.longitude});
    setRecenterKey(k => k + 1);
    setResults([]);
    setNoResult(false);
  };

  useEffect(() => {
    if (!value) void locate();
  }, []);

  useEffect(() => {
    const q = locationText.trim();
    if (!typed.current || q.length < 2 || q === autoText.current) {
      setResults([]);
      setNoResult(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchPlaces(q, value, controller.signal);
        setResults(found);
        setNoResult(found.length === 0);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DELAY_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [locationText]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (results[0]) choose(results[0]);
  };

  const center = value ?? DEFAULT_CENTER;

  return (
    <div className="field">
      <span>ตำแหน่ง (พิมพ์ค้นหาสถานที่ หรือแตะบนแผนที่เพื่อปักหมุด)</span>
      <MapView
        center={center}
        zoom={15}
        className="map-sm"
        radiusKm={radiusKm}
        onPick={pick}
        recenterKey={recenterKey}
        markers={value ? [{id: 'picked', position: value, kind: 'lost', icon: 'pin'}] : []}
      />
      <div style={{display: 'flex', gap: 8}}>
        <div className="place-search">
          <Search size={16} className="place-search-icon" />
          <input
            className="input"
            placeholder="ค้นหาสถานที่ เช่น ซอยอารีย์ 3, BTS อารีย์"
            value={locationText}
            enterKeyHint="search"
            onKeyDown={onKeyDown}
            onChange={e => {
              typed.current = true;
              onLocationTextChange(e.target.value);
            }}
          />
        </div>
        <button type="button" className="btn btn-soft" onClick={locate} disabled={locating} aria-label="ตำแหน่งฉัน">
          <LocateFixed size={16} />
          <span className="hide-mobile">{locating ? 'กำลังหา...' : 'ตำแหน่งฉัน'}</span>
        </button>
      </div>
      {results.length ? (
        <ul className="place-results" role="listbox">
          {results.map(r => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button type="button" onClick={() => choose(r)}>
                <MapPin size={16} />
                <span>
                  <b>{r.name}</b>
                  <small>{r.address}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : searching ? (
        <span className="muted small">กำลังค้นหาสถานที่...</span>
      ) : noResult ? (
        <span className="muted small">ไม่พบสถานที่นี้ ลองพิมพ์ชื่ออื่น หรือแตะบนแผนที่เพื่อปักหมุดเอง</span>
      ) : value ? (
        <span className="muted small">
          {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
        </span>
      ) : null}
    </div>
  );
}
