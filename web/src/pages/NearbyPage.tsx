import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {Eye, HeartHandshake, List, Map as MapIcon, LocateFixed, Siren} from 'lucide-react';

import {getNearby} from '../api/community.api';
import {Coords, useUserPosition} from '../lib/geo';
import {DEFAULT_CENTER} from '../lib/config';
import {animalLabel, distanceLabel, timeAgo} from '../lib/format';
import {MapView, MapMarker} from '../components/MapView';
import {CatLoader} from '../components/CatLoader';
import {FoundCard, LostCard} from '../components/PostCards';
import {AnimalOption} from '../components/PetMascot';
import {EmptyState, PageTitle} from '../components/ui';
import {LocationNotice} from '../components/PermissionHints';
import {BreedColorFilter} from '../components/BreedColorFilter';
import {matchesPetOption} from '../lib/petOptions';

const RADII = [1, 3, 5, 10, 20];
const ANIMALS = ['', 'dog', 'cat', 'other'];
const TYPES = [
  {value: '', label: 'ทุกประเภท'},
  {value: 'lost', label: 'หาย', icon: Siren},
  {value: 'found', label: 'พบ', icon: HeartHandshake},
  {value: 'sighting', label: 'เบาะแส', icon: Eye},
] as const;

export default function NearbyPage() {
  const geo = useUserPosition();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [radius, setRadius] = useState(5);
  const [animal, setAnimal] = useState('');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const chooseAnimal = (a: string) => {
    setAnimal(a);
    setBreed('');
    setColor('');
  };
  const [postType, setPostType] = useState<'' | 'lost' | 'found' | 'sighting'>('');
  const [view, setView] = useState<'map' | 'list'>('map');

  const usingFallback = useRef(false);
  useEffect(() => {
    if (geo.position && (!coords || usingFallback.current)) {
      usingFallback.current = false;
      setCoords({latitude: geo.position.latitude, longitude: geo.position.longitude});
      setRecenterKey(k => k + 1);
    } else if (!coords && (geo.status === 'denied' || geo.status === 'unavailable' || geo.status === 'unsupported')) {
      usingFallback.current = true;
      setCoords(DEFAULT_CENTER);
    }
  }, [coords, geo.position, geo.status]);

  const locate = () => {
    if (geo.position) {
      setCoords({latitude: geo.position.latitude, longitude: geo.position.longitude});
      setRecenterKey(k => k + 1);
    } else {
      geo.request();
    }
  };

  const center = coords ?? DEFAULT_CENTER;
  const nearby = useQuery({
    queryKey: ['nearby', center.latitude.toFixed(3), center.longitude.toFixed(3), radius, animal, postType],
    queryFn: () =>
      getNearby({
        latitude: center.latitude,
        longitude: center.longitude,
        radius_km: radius,
        animal_type: animal || undefined,
        post_type: postType || undefined,
      }),
    enabled: !!coords,
  });

  const lost = useMemo(
    () =>
      (nearby.data?.lost ?? []).filter(
        p => matchesPetOption(p.pet?.animal_type, 'breed', p.pet?.breed, breed) && matchesPetOption(p.pet?.animal_type, 'color', p.pet?.color, color),
      ),
    [nearby.data, breed, color],
  );
  const found = useMemo(
    () =>
      (nearby.data?.found ?? []).filter(
        p => matchesPetOption(p.animal_type, 'breed', p.breed_guess, breed) && matchesPetOption(p.animal_type, 'color', p.color, color),
      ),
    [nearby.data, breed, color],
  );
  // Sightings carry no breed or color, so they drop out once either filter is set.
  const sightings = useMemo(() => (breed || color ? [] : nearby.data?.sightings ?? []), [nearby.data, breed, color]);

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    lost.forEach(p =>
      list.push({
        id: `l-${p.id}`,
        position: p,
        kind: 'lost',
        animal: p.pet?.animal_type,
        popup: (
          <Link to={`/lost/${p.id}`}>
            <b>{p.pet?.name ?? p.title}</b>
            <br />
            {p.location_text} · {timeAgo(p.lost_at)}
          </Link>
        ),
      }),
    );
    found.forEach(p =>
      list.push({
        id: `f-${p.id}`,
        position: p,
        kind: 'found',
        animal: p.animal_type,
        popup: (
          <Link to={`/found/${p.id}`}>
            <b>พบ{animalLabel(p.animal_type)}</b>
            <br />
            {p.location_text} · {timeAgo(p.found_at)}
          </Link>
        ),
      }),
    );
    sightings.forEach(s =>
      list.push({
        id: `s-${s.id}`,
        position: s,
        kind: 'sighting',
        icon: 'eye',
        popup: (
          <Link to={`/lost/${s.lost_post_id}`}>
            <b>{s.pet_name ? `พบเห็น ${s.pet_name}` : 'มีคนพบเห็น'}</b>
            <br />
            {s.location_text} · {timeAgo(s.seen_at)}
          </Link>
        ),
      }),
    );
    return list;
  }, [center, lost, found, sightings]);

  const total = lost.length + found.length + sightings.length;

  return (
    <div className="page">
      <PageTitle
        title="ใกล้ฉัน"
        subtitle={`ประกาศในรัศมี ${radius} กม. · ${total} รายการ`}
        action={
          <div className="segmented hide-tablet-up">
            <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
              <MapIcon size={15} /> แผนที่
            </button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              <List size={15} /> รายการ
            </button>
          </div>
        }
      />

      <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <div className="chips">
          {RADII.map(r => (
            <button key={r} className={`chip ${radius === r ? 'active' : ''}`} onClick={() => setRadius(r)}>
              {r} กม.
            </button>
          ))}
          <button className="chip" onClick={locate}>
            <LocateFixed size={13} style={{verticalAlign: -2}} /> ตำแหน่งฉัน
          </button>
        </div>
        <div className="chips">
          {ANIMALS.map(a => (
            <button key={a} className={`chip ${animal === a ? 'active' : ''}`} onClick={() => chooseAnimal(a)}>
              {a ? <AnimalOption type={a} /> : 'ทั้งหมด'}
            </button>
          ))}
          <span style={{width: 1, background: 'var(--border)'}} />
          {TYPES.map(t => (
            <button key={t.value} className={`chip ${postType === t.value ? 'active' : ''}`} onClick={() => setPostType(t.value)}>
              <span className="animal-option">
                {'icon' in t ? <t.icon size={14} /> : null}
                {t.label}
              </span>
            </button>
          ))}
        </div>
        <BreedColorFilter animal={animal} breed={breed} color={color} onBreedChange={setBreed} onColorChange={setColor} />
      </div>

      {geo.status !== 'granted' && coords ? <LocationNotice status={geo.status} onRetry={geo.request} /> : null}

      {!coords ? (
        <CatLoader label="กำลังหาตำแหน่งของคุณ" />
      ) : (
        <div className="split">
          <div className={`split-sticky ${view === 'list' ? 'hide-below-tablet' : ''}`}>
            <MapView center={center} zoom={radius > 10 ? 11 : radius > 3 ? 13 : 14} markers={markers} radiusKm={radius} userPosition={geo.position} recenterKey={recenterKey} className="map-tall" />
          </div>
          <div className={`list ${view === 'map' ? 'hide-below-tablet' : ''}`}>
            {nearby.isLoading ? (
              <CatLoader label="กำลังดมกลิ่นหาน้อง" />
            ) : total === 0 ? (
              <EmptyState animal="dog" title="ยังไม่มีประกาศในรัศมีนี้" description="ลองขยายรัศมีหรือเปลี่ยนตัวกรองดูนะ" />
            ) : (
              <>
                {lost.map(p => (
                  <LostCard key={p.id} post={p} />
                ))}
                {found.map(p => (
                  <FoundCard key={p.id} post={p} />
                ))}
                {sightings.map(s => (
                  <Link key={s.id} to={`/lost/${s.lost_post_id}`} className="list-item">
                    <div className="quick-icon tone-butter"><Eye size={20} /></div>
                    <div className="grow">
                      <b>เบาะแส {s.pet_name ?? ''}</b>
                      <p>
                        {s.location_text || 'ไม่ระบุ'} · {timeAgo(s.seen_at)}
                        {s.distance_km != null ? ` · ${distanceLabel(s.distance_km)}` : ''}
                      </p>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
