import {useCallback} from 'react';
import {Link} from 'react-router-dom';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {BookmarkX} from 'lucide-react';

import {listFollowingCases, unfollowLostCase} from '../api/features.api';
import {getApiErrorMessage} from '../api/client';
import {toast} from '../store/toastStore';
import {CatLoader} from '../components/CatLoader';
import {AssembleScope, useAssembleHold} from '../lib/assembleHold';
import {InfiniteSentinel} from '../components/InfiniteSentinel';
import {LostCard} from '../components/PostCards';
import {EmptyState, PageTitle} from '../components/ui';

const PAGE_SIZE = 30;

export default function FollowingPage() {
  const qc = useQueryClient();
  const cases = useInfiniteQuery({
    queryKey: ['following'],
    queryFn: ({pageParam}) => listFollowingCases({before: pageParam, limit: PAGE_SIZE}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.length === PAGE_SIZE ? last[last.length - 1].cursor : undefined),
  });
  const rows = cases.data?.pages.flat() ?? [];
  const {fetchNextPage} = cases;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  const showCases = useAssembleHold(cases.isLoading);

  const unfollow = useMutation({
    mutationFn: unfollowLostCase,
    onSuccess: (_d, id) => {
      toast.ok('เลิกติดตามแล้ว');
      void qc.invalidateQueries({queryKey: ['following']});
      void qc.invalidateQueries({queryKey: ['follow', id]});
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  return (
    <div className="page">
      <PageTitle title="เคสที่ติดตาม" subtitle="ประกาศน้องหายที่คุณกดติดตาม จะได้รับแจ้งเตือนเมื่อมีเบาะแสหรือเจอน้องแล้ว" />
      {showCases.show ? (
        <AssembleScope id={showCases.id}><CatLoader label="กำลังโหลดเคสที่ติดตาม" /></AssembleScope>
      ) : rows.length ? (
        <div className="grid grid-3 grid-4 home-grid">
          {rows.map(post => (
            <div key={post.id} className="following-item">
              <LostCard post={post} />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={unfollow.isPending}
                onClick={() => unfollow.mutate(post.id)}>
                <BookmarkX size={15} /> เลิกติดตาม
              </button>
            </div>
          ))}
          <InfiniteSentinel hasMore={!!cases.hasNextPage} loading={cases.isFetchingNextPage} onLoadMore={loadMore} />
        </div>
      ) : (
        <EmptyState
          animal="dog"
          title="ยังไม่ได้ติดตามเคสไหน"
          description="กด “ติดตามเคสนี้” ในหน้าประกาศน้องหาย เพื่อรับแจ้งเตือนเมื่อมีความคืบหน้า"
          action={<Link to="/" className="btn btn-primary btn-sm">ดูประกาศน้องหาย</Link>}
        />
      )}
    </div>
  );
}
