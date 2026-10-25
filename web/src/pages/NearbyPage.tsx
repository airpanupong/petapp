import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {Eye, Globe2, HeartHandshake, List, Map as MapIcon, LocateFixed, Siren} from 'lucide-react';

import {FeedItem, getFeed, getNearby} from '../api/community.api';
import {Coords, useUserPosition} from '../lib/geo';
import {DEFAULT_CENTER} from '../lib/config';
import {LOCAL_RETURN_ZOOM, WORLD_FLY_ZOOM, WORLD_VIEW_ZOOM} from '../lib/mapImagery';
import {animalLabel, distanceLabel, timeAgo} from '../lib/format';
import type {MapMarker} from '../components/MapView';
import {NearbyMap} from '../components/NearbyMap';
import {CatLoader} from '../components/CatLoader';
import {FoundCard, LostCard} from '../components/PostCards';
import {AnimalOption} from '../components/PetMascot';
import {EmptyState, PageTitle} from '../components/ui';
import {LocationNotice} from '../components/PermissionHints';
import {BreedColorFilter} from '../components/BreedColorFilter';
import {matchesPetOption} from '../lib/petOptions';
import {NearbyPetItem, NearbyPetRail} from '../components/NearbyPetRail';

const RADII = [1, 3, 5, 10, 20];
const ANIMALS = ['', 'dog', 'cat', 'other'];
const TYPES = [
  {value: '', label: 'ทุกประเภท'},
  {value: 'lost', label: 'หาย', icon: Siren},
  {value: 'found', label: 'พบ', icon: HeartHandshake},
  {value: 'sighting', label: 'เบาะแส', icon: Eye},
] as const;

function localZoomForRadius(km: number) {
  return km > 10 ? 11 : km > 3 ? 13 : 14;
}

function adminTitle(title: string, createdByAdmin?: boolean) {
  return createdByAdmin ? `${title} · เพิ่มโดยแอดมิน` : title;
}

export default function NearbyPage() {
  const geo = useUserPosition();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [recenterKey, setRecenterKey] = useState(0);
  const [mapZoom, setMapZoom] = useState(14);
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
  /** Same MapLibre instance — low zoom = globe, high zoom = street. */
  const [worldMode, setWorldMode] = useState(false);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  const usingFallback = useRef(false);
  useEffect(() => {
    if (geo.position && (!coords || usingFallback.current)) {
      usingFallback.current = false;
      setCoords({latitude: geo.position.latitude, longitude: geo.position.longitude});
      setRecenterKey(k => k + 1);
    } else if (!coords) {
      usingFallback.current = true;
      setCoords(DEFAULT_CENTER);
    }
  }, [coords, geo.position, geo.status]);

  const enterLocal = useCallback(
    (nextRadius?: number) => {
      const r = nextRadius ?? radius;
      setWorldMode(false);
      setMapZoom(localZoomForRadius(r));
      setRecenterKey(k => k + 1);
    },
    [radius],
  );

  const enterWorld = useCallback(() => {
    setWorldMode(true);
    setMapZoom(WORLD_FLY_ZOOM);
    setView('map');
    setRecenterKey(k => k + 1);
  }, []);

  const leaveWorld = useCallback(() => {
    setWorldMode(false);
    setMapZoom(LOCAL_RETURN_ZOOM);
    setRecenterKey(k => k + 1);
  }, []);

  const locate = () => {
    if (geo.position) {
      setCoords({latitude: geo.position.latitude, longitude: geo.position.longitude});
      enterLocal();
    } else {
      geo.request();
    }
  };

  const onWorldModeChange = useCallback((world: boolean, zoom: number) => {
    setWorldMode(world);
    setMapZoom(zoom);
  }, []);

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

  const feedKind = postType === 'lost' || postType === 'found' ? postType : 'all';

  const systemFeed = useInfiniteQuery({
    queryKey: ['system-pets', feedKind, animal, breed, color],
    queryFn: ({pageParam}) =>
      getFeed({
        kind: feedKind,
        animal_type: animal || undefined,
        breed: breed || undefined,
        color: color || undefined,
        cursor: pageParam,
        limit: 30,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.next_cursor ?? undefined,
    enabled: !!coords,
    staleTime: 60_000,
  });

  const feedItems = useMemo(() => systemFeed.data?.pages.flatMap(p => p.items) ?? [], [systemFeed.data]);

  const loadMorePets = useCallback(() => {
    if (systemFeed.hasNextPage && !systemFeed.isFetchingNextPage) void systemFeed.fetchNextPage();
  }, [systemFeed]);

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
  const sightings = useMemo(() => (breed || color ? [] : nearby.data?.sightings ?? []), [nearby.data, breed, color]);

  const localMarkers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [];
    lost.forEach(p =>
      list.push({
        id: `l-${p.id}`,
        position: p,
        kind: 'lost',
        animal: p.pet?.animal_type,
        title: adminTitle(p.pet?.name ?? p.title, p.created_by_admin),
        href: `/lost/${p.id}`,
      }),
    );
    found.forEach(p =>
      list.push({
        id: `f-${p.id}`,
        position: p,
        kind: 'found',
        animal: p.animal_type,
        title: adminTitle(`พบ${animalLabel(p.animal_type)}`, p.created_by_admin),
        href: `/found/${p.id}`,
      }),
    );
    sightings.forEach(s =>
      list.push({
        id: `s-${s.id}`,
        position: s,
        kind: 'sighting',
        icon: 'eye',
        title: s.pet_name ? `พบเห็น ${s.pet_name}` : 'มีคนพบเห็น',
        href: `/lost/${s.lost_post_id}`,
      }),
    );
    return list;
  }, [lost, found, sightings]);

  const feedToMarkers = useCallback((items: FeedItem[]): MapMarker[] => {
    const out: MapMarker[] = [];
    for (const item of items) {
      if (item.kind === 'lost') {
        const p = item.post;
        out.push({
          id: `gl-${p.id}`,
          position: p,
          kind: 'lost',
          animal: p.pet?.animal_type,
          title: adminTitle(p.pet?.name ?? p.title, p.created_by_admin),
          href: `/lost/${p.id}`,
        });
      } else {
        const p = item.post;
        out.push({
          id: `gf-${p.id}`,
          position: p,
          kind: 'found',
          animal: p.animal_type,
          title: adminTitle(`พบ${animalLabel(p.animal_type)}`, p.created_by_admin),
          href: `/found/${p.id}`,
        });
      }
    }
    return out;
  }, []);

  const worldMarkers = useMemo(() => feedToMarkers(feedItems.slice(0, 120)), [feedItems, feedToMarkers]);
  const activeMarkers = worldMode ? (worldMarkers.length ? worldMarkers : localMarkers) : localMarkers;

  const total = lost.length + found.length + sightings.length;
  const myPosition = geo.position ?? null;

  const railItems = useMemo<NearbyPetItem[]>(() => {
    const items: NearbyPetItem[] = [];
    if (myPosition) {
      items.push({
        id: 'me',
        name: 'ฉัน',
        kind: 'me',
        subtitle: 'ตำแหน่งของคุณ',
        latitude: myPosition.latitude,
        longitude: myPosition.longitude,
      });
    }
    for (const item of feedItems) {
      if (item.kind === 'lost') {
        const p = item.post;
        items.push({
          id: `gl-${p.id}`,
          name: p.pet?.name ?? p.title,
          kind: 'lost',
          subtitle: p.location_text || undefined,
          imageUrl: p.image_url || p.pet?.profile_image_url,
          animal: p.pet?.animal_type,
          href: `/lost/${p.id}`,
          latitude: p.latitude,
          longitude: p.longitude,
        });
      } else {
        const p = item.post;
        items.push({
          id: `gf-${p.id}`,
          name: `พบ${animalLabel(p.animal_type)}`,
          kind: 'found',
          subtitle: p.location_text || undefined,
          imageUrl: p.image_url,
          animal: p.animal_type,
          href: `/found/${p.id}`,
          latitude: p.latitude,
          longitude: p.longitude,
        });
      }
    }
    return items;
  }, [myPosition, feedItems]);

  const focusPet = useCallback((item: NearbyPetItem) => {
    setSelectedPetId(item.id);
    setCoords({latitude: item.latitude, longitude: item.longitude});
    setWorldMode(false);
    // Street-level target — map flyTo eases in gradually from current (often globe) zoom
    setMapZoom(15);
    setView('map');
    setRecenterKey(k => k + 1);
  }, []);

  return (
    <div className="page">
      <PageTitle
        title="ใกล้ฉัน"
        subtitle={
          worldMode
            ? `มุมมองโลก · ${activeMarkers.length} หมุดน้อง`
            : `ประกาศในรัศมี ${radius} กม. · ${total} รายการ`
        }
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
            <button
              key={r}
              className={`chip ${!worldMode && radius === r ? 'active' : ''}`}
              onClick={() => {
                setRadius(r);
                enterLocal(r);
              }}>
              {r} กม.
            </button>
          ))}
          <button className="chip" onClick={locate}>
            <LocateFixed size={13} style={{verticalAlign: -2}} /> ตำแหน่งฉัน
          </button>
          <button className={`chip ${worldMode ? 'active' : ''}`} onClick={() => (worldMode ? leaveWorld() : enterWorld())}>
            <Globe2 size={13} style={{verticalAlign: -2}} /> {worldMode ? 'แผนที่ใกล้ๆ' : 'ดูโลก'}
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
        <p className="muted small">
          {worldMode
            ? 'แผนที่ตัวเดียว · มุมมองลูกโลก (ซูมเข้าเพื่อดูถนนใกล้ๆ)'
            : 'แผนที่ตัวเดียว · ซูมออกต่อเนื่องจนเป็นลูกโลก'}
        </p>
      </div>

      {geo.status !== 'granted' && coords ? <LocationNotice status={geo.status} onRetry={geo.request} /> : null}

      {!coords ? (
        <CatLoader label="กำลังหาตำแหน่งของคุณ" />
      ) : (
        <div className="split">
          <div className={`split-sticky ${view === 'list' ? 'hide-below-tablet' : ''}`}>
            <div className={`map-stage ${worldMode ? 'is-space' : ''}`}>
              <NearbyMap
                center={center}
                zoom={mapZoom}
                markers={activeMarkers}
                radiusKm={radius}
                userPosition={myPosition}
                recenterKey={recenterKey}
                className="map-tall"
                worldMode={worldMode}
                onWorldModeChange={onWorldModeChange}
                worldZoomThreshold={WORLD_VIEW_ZOOM}
              />
              {!worldMode ? <p className="map-zoom-hint hide-tablet-up">ซูมออกเพื่อดูลูกโลก</p> : null}
              {view === 'map' ? (
                <NearbyPetRail
                  items={railItems}
                  selectedId={selectedPetId}
                  onSelect={focusPet}
                  onLocate={locate}
                  loading={systemFeed.isLoading}
                  hasMore={!!systemFeed.hasNextPage}
                  loadingMore={systemFeed.isFetchingNextPage}
                  onLoadMore={loadMorePets}
                />
              ) : null}
            </div>
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
                    <div className="quick-icon tone-butter">
                      <Eye size={20} />
                    </div>
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
