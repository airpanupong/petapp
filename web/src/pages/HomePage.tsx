import {useCallback, useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {AlertCircle, Gift, HeartHandshake, MapPinned, PawPrint, Siren} from 'lucide-react';

import {getFeed, listAds} from '../api/community.api';
import {getMyPosts} from '../api/users.api';
import {trackAdEvent} from '../api/features.api';
import {resolveMediaUrl} from '../api/uploads.api';
import {useAuthStore} from '../store/authStore';
import {FoundPost, LostPost} from '../types/api';
import {CatLoader} from '../components/CatLoader';
import {FoundCard, LostCard} from '../components/PostCards';
import {AnimalOption, PetMascot} from '../components/PetMascot';
import {EmptyState} from '../components/ui';
import {AppSetupCard} from '../components/PermissionHints';
import {LostCheckinPrompt, needsCheckin} from '../components/LostCheckinPrompt';
import {BreedColorFilter} from '../components/BreedColorFilter';
import {InfiniteSentinel} from '../components/InfiniteSentinel';
import {matchesPetOption} from '../lib/petOptions';

type Feed = 'all' | 'lost' | 'found';
type Item = {kind: 'lost'; at: string; mine: boolean; post: LostPost} | {kind: 'found'; at: string; mine: boolean; post: FoundPost};

const ANIMALS = ['', 'dog', 'cat', 'other'];
const PAGE_SIZE = 20;

const SHOW_ADS = false;

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const ads = useQuery({queryKey: ['ads'], queryFn: listAds, enabled: SHOW_ADS});
  const ad = ads.data?.[0];
  const [feed, setFeed] = useState<Feed>('all');
  const [animal, setAnimal] = useState('');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const chooseAnimal = (a: string) => {
    setAnimal(a);
    setBreed('');
    setColor('');
  };

  const myId = user?.id;
  const myPosts = useQuery({queryKey: ['my-posts'], queryFn: getMyPosts, enabled: !!myId});
  const myLost = useMemo(() => (myPosts.data?.lost ?? []).filter(p => p.status === 'active'), [myPosts.data]);

  const others = useInfiniteQuery({
    queryKey: ['feed', myId ?? '', feed, animal, breed, color],
    queryFn: ({pageParam}) =>
      getFeed({kind: feed, animal_type: animal || undefined, breed: breed || undefined, color: color || undefined, cursor: pageParam, limit: PAGE_SIZE}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.next_cursor ?? undefined,
  });
  const counts = others.data?.pages[0]?.counts;
  const {fetchNextPage} = others;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);

  // Own posts come from "my posts" and stay on top; the feed leaves them out.
  const mine = useMemo<Item[]>(() => {
    const list: Item[] = [];
    if (feed !== 'found') myLost.forEach(post => list.push({kind: 'lost', at: post.lost_at, mine: true, post}));
    if (feed !== 'lost')
      (myPosts.data?.found ?? []).filter(p => p.status === 'active').forEach(post => list.push({kind: 'found', at: post.found_at, mine: true, post}));
    return list
      .filter(i => {
        const [type, itemBreed, itemColor] =
          i.kind === 'lost' ? [i.post.pet?.animal_type, i.post.pet?.breed, i.post.pet?.color] : [i.post.animal_type, i.post.breed_guess, i.post.color];
        return (
          (!animal || type === animal) &&
          matchesPetOption(type, 'breed', itemBreed, breed) &&
          matchesPetOption(type, 'color', itemColor, color)
        );
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [feed, animal, breed, color, myLost, myPosts.data]);

  const items = useMemo<Item[]>(() => {
    const seen = new Set(mine.map(i => `${i.kind}-${i.post.id}`));
    const list = [...mine];
    for (const page of others.data?.pages ?? []) {
      for (const i of page.items) {
        const key = `${i.kind}-${i.post.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push(i.kind === 'lost' ? {kind: 'lost', at: i.post.lost_at, mine: false, post: i.post} : {kind: 'found', at: i.post.found_at, mine: false, post: i.post});
      }
    }
    return list;
  }, [mine, others.data]);
  const checkins = useMemo(() => myLost.filter(needsCheckin), [myLost]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'อรุณสวัสดิ์' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const loading = others.isLoading;

  return (
    <div className="page">
      <section className="home-head">
        <div className="home-head-text">
          <span className="badge tone-pink">
            <PawPrint size={13} /> {greet}
            {user ? `, ${user.display_name}` : ''}
          </span>
          <h1>น้อง ๆ ที่รอกลับบ้าน</h1>
          <p>ถ้าเห็นน้องหน้าตาคุ้น ๆ แถวบ้าน กดดูรายละเอียดแล้วช่วยแจ้งเจ้าของได้เลย</p>
          <div className="btn-row home-head-actions">
            <button className="btn btn-danger btn-sm" onClick={() => navigate('/report/lost')}>
              <AlertCircle size={16} /> น้องฉันหาย
            </button>
            <button className="btn btn-mint btn-sm" onClick={() => navigate('/report/found')}>
              <HeartHandshake size={16} /> ฉันพบน้อง
            </button>
          </div>
        </div>
        <div className="home-head-pets" aria-hidden>
          <PetMascot type="dog" size={96} />
          <PetMascot type="cat" size={96} />
        </div>
      </section>

      {checkins.map(p => (
        <LostCheckinPrompt key={p.id} post={p} linkToPost />
      ))}

      <AppSetupCard />

      <div className="home-filters">
        <div className="segmented">
          <button className={feed === 'all' ? 'active' : ''} onClick={() => setFeed('all')}>
            ทั้งหมด
          </button>
          <button className={feed === 'lost' ? 'active' : ''} onClick={() => setFeed('lost')}>
            <Siren size={14} /> ตามหา {counts ? <span className="seg-count">{counts.lost}</span> : null}
          </button>
          <button className={feed === 'found' ? 'active' : ''} onClick={() => setFeed('found')}>
            <HeartHandshake size={14} /> มีคนพบ {counts ? <span className="seg-count">{counts.found}</span> : null}
          </button>
        </div>
        <div className="chips">
          {ANIMALS.map(a => (
            <button key={a} className={`chip ${animal === a ? 'active' : ''}`} onClick={() => chooseAnimal(a)}>
              {a ? <AnimalOption type={a} /> : 'ทุกชนิด'}
            </button>
          ))}
          <Link to="/nearby" className="chip">
            <MapPinned size={13} style={{verticalAlign: -2}} /> ดูบนแผนที่
          </Link>
        </div>
        <BreedColorFilter animal={animal} breed={breed} color={color} onBreedChange={setBreed} onColorChange={setColor} />
      </div>

      {loading ? (
        <CatLoader label="กำลังเรียกน้อง ๆ มาเข้าแถว" />
      ) : items.length ? (
        <div className="grid grid-3 grid-4 home-grid">
          {items.map(i =>
            i.kind === 'lost' ? (
              <LostCard key={`l-${i.post.id}`} post={i.post} mine={i.mine} />
            ) : (
              <FoundCard key={`f-${i.post.id}`} post={i.post} mine={i.mine} />
            ),
          )}
          <InfiniteSentinel hasMore={!!others.hasNextPage} loading={others.isFetchingNextPage} onLoadMore={loadMore} />
        </div>
      ) : (
        <EmptyState animal={animal || 'cat'} title="ยังไม่มีประกาศในหมวดนี้" description="เยี่ยมเลย! แปลว่าน้อง ๆ อยู่บ้านกันครบ" />
      )}

      {ad ? (
        <a
          className="card"
          href={ad.target_url ?? '#'}
          target="_blank"
          rel="noreferrer"
          onClick={() => void trackAdEvent(ad.id, 'click').catch(() => undefined)}
          style={{display: 'flex', gap: 16, alignItems: 'center', background: 'linear-gradient(135deg, #fff3d6, #ffe3e9)'}}>
          {ad.image_url ? (
            <img src={resolveMediaUrl(ad.image_url)} alt="" style={{width: 72, height: 72, borderRadius: 18, objectFit: 'cover'}} />
          ) : (
            <div className="quick-icon tone-butter" style={{width: 64, height: 64}}><Gift size={28} /></div>
          )}
          <div style={{flex: 1, minWidth: 0}}>
            <span className="badge tone-butter">Sponsored · {ad.advertiser_name}</span>
            <h3 style={{fontSize: 17, marginTop: 6}}>{ad.title}</h3>
            <p className="muted small">{ad.description}</p>
          </div>
        </a>
      ) : null}
    </div>
  );
}
