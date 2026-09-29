import {RefObject, useEffect, useRef} from 'react';

import {CatLoader} from './CatLoader';

type Props = {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  /** Scroll container to watch; defaults to the page viewport. */
  rootRef?: RefObject<HTMLElement | null>;
};

/** Invisible marker that asks for the next page when it scrolls near view. */
export function InfiniteSentinel({hasMore, loading, onLoadMore, rootRef}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(entries => entries.some(e => e.isIntersecting) && onLoadMore(), {
      root: rootRef?.current ?? null,
      rootMargin: '400px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, rootRef]);

  if (!hasMore) return null;
  return (
    <div ref={ref} className="infinite-sentinel" aria-hidden>
      {loading ? <CatLoader size="sm" label="" /> : null}
    </div>
  );
}
