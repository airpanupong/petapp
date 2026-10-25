type Props = {
  count?: number;
  layout?: 'grid' | 'list';
};

/** Placeholder cards while a feed or pet list is still loading. */
export function CardSkeleton({count = 6, layout = 'grid'}: Props) {
  return (
    <div className={layout === 'grid' ? 'grid grid-3 grid-4 home-grid' : 'list'} role="status" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({length: count}, (_, index) => (
        <article className="card post-card skeleton-card" key={index}>
          <div className="skeleton-media" />
          <div className="post-body">
            <span className="skeleton-line w-70" />
            <span className="skeleton-line w-90" />
            <span className="skeleton-line w-40" />
          </div>
        </article>
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return <div className="skeleton-map" role="status" aria-label="กำลังโหลดแผนที่" />;
}

/** Stand-in for หน้าแรก, ใกล้ฉัน, and น้องของฉัน while the page itself is still loading. */
export function PageSkeleton({variant = 'feed'}: {variant?: 'feed' | 'nearby' | 'pets'}) {
  return (
    <div className="page" role="status" aria-busy="true" aria-label="กำลังโหลด">
      <div className="skeleton-page-head">
        <span className="skeleton-line w-40" />
        <span className="skeleton-line w-70" />
      </div>
      {variant === 'nearby' ? (
        <div className="split">
          <MapSkeleton />
          <CardSkeleton count={4} layout="list" />
        </div>
      ) : (
        <CardSkeleton />
      )}
    </div>
  );
}
