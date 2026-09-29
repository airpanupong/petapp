import {useCallback} from 'react';
import {Link} from 'react-router-dom';
import {useInfiniteQuery} from '@tanstack/react-query';

import {listConversations} from '../api/chat.api';
import {timeAgo} from '../lib/format';
import {CatLoader} from '../components/CatLoader';
import {ChatContextTag} from '../components/ChatContext';
import {InfiniteSentinel} from '../components/InfiniteSentinel';
import {Avatar, EmptyState, PageTitle} from '../components/ui';

const PAGE_SIZE = 30;

export default function ChatListPage() {
  const chats = useInfiniteQuery({
    queryKey: ['conversations'],
    queryFn: ({pageParam}) => listConversations({before: pageParam, limit: PAGE_SIZE}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.length === PAGE_SIZE ? last[last.length - 1].cursor : undefined),
    refetchInterval: 15_000,
  });
  const rows = chats.data?.pages.flat() ?? [];
  const {fetchNextPage} = chats;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);

  return (
    <div className="page">
      <PageTitle title="แชท" subtitle="คุยกับเจ้าของน้องหรือผู้พบ" />
      {chats.isLoading ? (
        <CatLoader label="กำลังเปิดกล่องข้อความ" />
      ) : rows.length ? (
        <div className="list" style={{maxWidth: 760}}>
          {rows.map(c => {
            const other = c.other_member ?? c.members?.[0];
            const unread = c.unread_count ?? 0;
            return (
              <Link key={c.id} to={`/chat/${c.id}`} className={`list-item ${unread ? 'chat-unread' : ''}`}>
                <Avatar name={other?.display_name} url={other?.avatar_url} />
                <div className="grow" style={{minWidth: 0}}>
                  <div className="chat-list-name">
                    <b>{other?.display_name ?? 'ผู้ใช้'}</b>
                    <ChatContextTag context={c.context} />
                  </div>
                  <p>{c.last_message?.content || (c.last_message?.image_url ? 'ส่งรูปภาพ' : 'เริ่มบทสนทนา')}</p>
                </div>
                <div style={{textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end'}}>
                  <span className="muted" style={{fontSize: 11}}>{timeAgo(c.last_message?.created_at ?? c.created_at)}</span>
                  {unread ? <span className="count-pill" aria-label={`ยังไม่อ่าน ${unread} ข้อความ`}>{unread > 99 ? '99+' : unread}</span> : null}
                </div>
              </Link>
            );
          })}
          <InfiniteSentinel hasMore={!!chats.hasNextPage} loading={chats.isFetchingNextPage} onLoadMore={loadMore} />
        </div>
      ) : (
        <EmptyState animal="cat" title="ยังไม่มีข้อความ" description="เริ่มแชทได้จากหน้าประกาศสัตว์หาย/พบ" />
      )}
    </div>
  );
}
