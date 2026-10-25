import {FormEvent, KeyboardEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {InfiniteData, useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {ArrowLeft, ImagePlus, Send, Ban, Check, CheckCheck} from 'lucide-react';
import {PetMascot} from '../components/PetMascot';

import {ChatMessage, getConversation, listMessages, sendMessage} from '../api/chat.api';
import {setViewingConversation} from '../lib/chatInbox';
import {blockUser} from '../api/moderation.api';
import {resolveMediaUrl, uploadImage} from '../api/uploads.api';
import {getApiErrorMessage} from '../api/client';
import {useAuthStore} from '../store/authStore';
import {toast} from '../store/toastStore';
import {confirmAction} from '../store/confirmStore';
import {formatTime} from '../lib/format';
import {cursorOf} from '../lib/pagination';
import {CatLoader} from '../components/CatLoader';
import {AssembleScope, useAssembleHold} from '../lib/assembleHold';
import {InfiniteSentinel} from '../components/InfiniteSentinel';
import {ChatContextBanner, ChatContextDivider} from '../components/ChatContext';
import {Avatar, StaffBadge} from '../components/ui';
import {isStaff} from '../lib/roles';
import {Lightbox} from '../components/MediaImage';

const PAGE_SIZE = 40;

export default function ChatThreadPage() {
  const {id = ''} = useParams();
  const qc = useQueryClient();
  const me = useAuthStore(s => s.user);
  const conversation = useQuery({queryKey: ['conversation', id], queryFn: () => getConversation(id)});
  // Page 0 is the latest messages; each next page is older. Pages are oldest-first inside.
  const messages = useInfiniteQuery({
    queryKey: ['messages', id],
    queryFn: ({pageParam}) => listMessages(id, {before: pageParam, limit: PAGE_SIZE}),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.length === PAGE_SIZE ? cursorOf(last[0]) : undefined),
    staleTime: 0,
  });
  const rows = useMemo(() => [...(messages.data?.pages ?? [])].reverse().flat(), [messages.data]);
  const [text, setText] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const fromBottom = useRef(0);
  const shown = useRef<{first?: string; last?: string}>({});
  const {fetchNextPage} = messages;
  const loadOlder = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  const showMessages = useAssembleHold(messages.isLoading);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = parseFloat(getComputedStyle(el).maxHeight) || Infinity;
    const next = el.scrollHeight + el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(next, max)}px`;
    el.style.overflowY = next > max ? 'auto' : 'hidden';
  }, [text]);

  const other = conversation.data?.other_member ?? conversation.data?.members?.find(m => m.id !== me?.id);

  useEffect(() => {
    setViewingConversation(id);
    return () => setViewingConversation(null);
  }, [id]);

  const firstId = rows[0]?.id;
  const lastId = rows[rows.length - 1]?.id;
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const prev = shown.current;
    if (lastId !== prev.last) {
      el.scrollTo({top: el.scrollHeight, behavior: prev.last ? 'smooth' : 'auto'});
    } else if (firstId !== prev.first) {
      // Older messages were added above; keep the same message in view.
      el.scrollTop = el.scrollHeight - fromBottom.current;
    }
    shown.current = {first: firstId, last: lastId};
  }, [firstId, lastId]);

  const send = useMutation({
    mutationFn: (payload: {content?: string; image_url?: string; message_type?: string}) => sendMessage(id, payload),
    onSuccess: saved => {
      setText('');
      qc.setQueryData<InfiniteData<ChatMessage[]>>(['messages', id], current => {
        if (!current?.pages.length || current.pages.some(page => page.some(row => row.id === saved.id))) return current;
        const pages = [...current.pages];
        pages[0] = [...pages[0], saved];
        return {...current, pages};
      });
    },
    onError: e => toast.error(getApiErrorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (content && !send.isPending) send.mutate({content});
  };

  // Enter sends on desktop; Shift+Enter, IME composition and touch keyboards insert a newline.
  const onTextKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  };

  const sendImage = async (file?: File) => {
    if (!file) return;
    try {
      const url = await uploadImage(file);
      send.mutate({image_url: url, message_type: 'image'});
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const block = async () => {
    if (!other) return;
    const ok = await confirmAction({
      title: `บล็อก ${other.display_name}?`,
      message: 'คุณจะไม่ได้รับข้อความจากผู้ใช้นี้อีก',
      confirmLabel: 'บล็อก',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await blockUser(other.id);
      toast.ok('บล็อกผู้ใช้แล้ว');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  return (
    <div className="page">
      <div className="card chat">
        <div className="chat-head">
          <Link to="/chat" className="icon-btn" aria-label="กลับ">
            <ArrowLeft size={18} />
          </Link>
          <Avatar name={other?.display_name} url={other?.avatar_url} />
          <div style={{flex: 1, minWidth: 0}}>
            <div className="chat-list-name">
              <b style={{fontWeight: 500}}>{other?.display_name ?? 'แชท'}</b>
              <StaffBadge role={other?.role} />
            </div>
            <p className="muted" style={{fontSize: 12}}>
              {isStaff(other?.role) ? 'ข้อความจากทีมผู้ดูแลระบบ Pet haii' : 'คุยกันอย่างสุภาพ อย่าโอนเงินก่อนเจอน้องนะ'}
            </p>
          </div>
          {other ? (
            <button className="icon-btn" onClick={block} title="บล็อก">
              <Ban size={17} />
            </button>
          ) : null}
        </div>
        <ChatContextBanner context={conversation.data?.context} />
        <div
          className="chat-body"
          ref={bodyRef}
          onScroll={e => (fromBottom.current = e.currentTarget.scrollHeight - e.currentTarget.scrollTop)}>
          {showMessages.show ? (
            <AssembleScope id={showMessages.id}><CatLoader size="sm" label="" /></AssembleScope>
          ) : rows.some(m => m.message_type !== 'context') ? (
            <>
            <InfiniteSentinel hasMore={!!messages.hasNextPage} loading={messages.isFetchingNextPage} onLoadMore={loadOlder} rootRef={bodyRef} />
            {rows.map(m => {
              if (m.message_type === 'context') return <ChatContextDivider key={m.id} context={m.context} />;
              const mine = m.sender_id === me?.id;
              return (
                <div key={m.id} className={`bubble ${mine ? 'me' : ''}`}>
                  {m.image_url ? <ChatImage src={resolveMediaUrl(m.image_url)!} /> : null}
                  {m.content}
                  <span className="bubble-meta">
                    <time>{formatTime(m.created_at)}</time>
                    {mine ? (
                      m.read_at ? (
                        <CheckCheck size={15} className="read-tick read" aria-label="อ่านแล้ว" />
                      ) : (
                        <Check size={15} className="read-tick" aria-label="ส่งแล้ว" />
                      )
                    ) : null}
                  </span>
                </div>
              );
            })}
            </>
          ) : (
            <div className="empty">
              <PetMascot type="cat" size={80} className="empty-mascot" />
              <p className="muted small">ทักทายกันก่อนเลย</p>
            </div>
          )}
        </div>
        <form className="chat-input" onSubmit={submit}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void sendImage(e.target.files?.[0])} />
          <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="ส่งรูป">
            <ImagePlus size={19} />
          </button>
          <textarea
            ref={textRef}
            className="input chat-input-text"
            rows={1}
            maxLength={4000}
            placeholder="พิมพ์ข้อความ..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={onTextKeyDown}
          />
          <button className="btn btn-primary" disabled={!text.trim() || send.isPending} aria-label="ส่ง">
            <Send size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatImage({src}: {src: string}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img src={src} alt="รูปในแชท" style={{cursor: 'zoom-in'}} onClick={() => setOpen(true)} />
      {open ? <Lightbox src={src} alt="รูปในแชท" onClose={() => setOpen(false)} /> : null}
    </>
  );
}
