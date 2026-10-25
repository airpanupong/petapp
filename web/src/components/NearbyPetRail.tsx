import {useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {LocateFixed, PawPrint, X} from 'lucide-react';

import {resolveMediaUrl} from '../api/uploads.api';
import {animalLabel} from '../lib/format';
import {MediaImage} from './MediaImage';
import {InfiniteSentinel} from './InfiniteSentinel';

export type NearbyPetItem = {
  id: string;
  name: string;
  kind: 'lost' | 'found' | 'sighting' | 'me';
  subtitle?: string;
  imageUrl?: string | null;
  animal?: string | null;
  href?: string;
  latitude: number;
  longitude: number;
};

type Props = {
  items: NearbyPetItem[];
  selectedId?: string | null;
  onSelect: (item: NearbyPetItem) => void;
  onLocate?: () => void;
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

const KIND_LABEL: Record<NearbyPetItem['kind'], string> = {
  lost: 'ตามหา',
  found: 'พบ',
  sighting: 'เบาะแส',
  me: 'ฉัน',
};

export function NearbyPetRail({
  items,
  selectedId,
  onSelect,
  onLocate,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  const [listOpen, setListOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const pets = useMemo(() => items.filter(it => it.kind !== 'me'), [items]);
  const railPets = pets.slice(0, 24);

  return (
    <>
      <div className="nearby-rail" aria-label="น้องใกล้ฉัน">
        <div className="nearby-rail-actions">
          <button
            type="button"
            className="nearby-rail-fab"
            onClick={() => setListOpen(true)}
            aria-label="น้องในระบบ">
            <PawPrint size={18} />
          </button>
          {onLocate ? (
            <button type="button" className="nearby-rail-fab" onClick={onLocate} aria-label="ตำแหน่งของฉัน">
              <LocateFixed size={18} />
            </button>
          ) : null}
        </div>

        <div className="nearby-rail-scroller">
          {loading && !railPets.length ? (
            <p className="nearby-rail-empty">กำลังโหลดน้อง…</p>
          ) : !railPets.length ? (
            <p className="nearby-rail-empty">ยังไม่มีน้องในระบบ</p>
          ) : (
            railPets.map(it => (
              <button
                key={it.id}
                type="button"
                className={`nearby-rail-pin ${selectedId === it.id ? 'active' : ''} kind-${it.kind}`}
                onClick={() => onSelect(it)}>
                <span className="nearby-rail-label">{it.name}</span>
                <span className="nearby-rail-avatar">
                  <MediaImage src={resolveMediaUrl(it.imageUrl)} alt={it.name} type={it.animal} />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {listOpen ? (
        <div className="nearby-search-sheet" role="dialog" aria-modal="true" aria-label="น้องในระบบ">
          <div className="nearby-search-panel glass-strong">
            <div className="nearby-list-head">
              <div className="nearby-list-head-title">
                <PawPrint size={18} />
                <div>
                  <b>น้องในระบบ</b>
                  <small>
                    {loading && !pets.length
                      ? 'กำลังโหลด…'
                      : `ทั้งหมดในระบบ · ${pets.length}${hasMore ? '+' : ''} รายการ`}
                  </small>
                </div>
              </div>
              <button type="button" className="icon-btn" aria-label="ปิด" onClick={() => setListOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="nearby-search-list" ref={listRef}>
              {loading && !pets.length ? (
                <p className="muted small" style={{padding: '12px 4px'}}>
                  กำลังโหลดน้องในระบบ…
                </p>
              ) : pets.length === 0 ? (
                <p className="muted small" style={{padding: '12px 4px'}}>
                  ยังไม่มีน้องในระบบ
                </p>
              ) : (
                <>
                  {pets.map(it => (
                    <button
                      key={it.id}
                      type="button"
                      className={`nearby-search-row ${selectedId === it.id ? 'active' : ''}`}
                      onClick={() => {
                        onSelect(it);
                        setListOpen(false);
                      }}>
                      <span className={`nearby-search-avatar kind-${it.kind}`}>
                        <MediaImage src={resolveMediaUrl(it.imageUrl)} alt={it.name} type={it.animal} />
                      </span>
                      <span className="nearby-search-text">
                        <b>{it.name}</b>
                        <small>
                          {KIND_LABEL[it.kind]}
                          {it.animal ? ` · ${animalLabel(it.animal)}` : ''}
                          {it.subtitle ? ` · ${it.subtitle}` : ''}
                        </small>
                      </span>
                      {it.href ? (
                        <Link
                          to={it.href}
                          className="nearby-search-open"
                          onClick={e => e.stopPropagation()}
                          title="เปิดประกาศ">
                          เปิด
                        </Link>
                      ) : null}
                    </button>
                  ))}
                  {onLoadMore ? (
                    <InfiniteSentinel
                      hasMore={!!hasMore}
                      loading={!!loadingMore}
                      onLoadMore={onLoadMore}
                      rootRef={listRef}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
          <button type="button" className="nearby-search-backdrop" aria-label="ปิดลิสต์น้อง" onClick={() => setListOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
