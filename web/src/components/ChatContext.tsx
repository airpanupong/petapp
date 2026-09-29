import {Link} from 'react-router-dom';
import {ChevronRight, Eye, HeartHandshake, QrCode, Siren} from 'lucide-react';

import {ConversationContext} from '../api/chat.api';
import {resolveMediaUrl} from '../api/uploads.api';
import {animalLabel} from '../lib/format';
import {MediaImage} from './MediaImage';

const KIND = {
  sighting: {label: 'เบาะแส', icon: Eye, tone: 'badge-tip'},
  lost: {label: 'ตามหา', icon: Siren, tone: 'badge-lost'},
  found: {label: 'มีคนพบ', icon: HeartHandshake, tone: 'badge-found'},
  pet: {label: 'สแกน QR', icon: QrCode, tone: 'tone-lavender'},
} as const;

function subject(ctx: ConversationContext) {
  if (ctx.kind !== 'found') return ctx.pet_name ?? '';
  return ctx.animal_type === 'dog' || ctx.animal_type === 'cat' ? `น้อง${animalLabel(ctx.animal_type)}` : 'น้อง';
}

export function ChatContextTag({context}: {context?: ConversationContext | null}) {
  if (!context) return null;
  const kind = KIND[context.kind];
  const Icon = kind.icon;
  const name = subject(context);
  return (
    <span className={`badge chat-context-tag ${kind.tone}`}>
      <Icon size={12} />
      <span>{name ? `${kind.label} · ${name}` : kind.label}</span>
    </span>
  );
}

function describe(ctx: ConversationContext) {
  const name = subject(ctx);
  switch (ctx.kind) {
    case 'sighting':
      return ctx.mine ? `มีคนแจ้งเบาะแส ${name} ของคุณ` : `คุณแจ้งเบาะแสให้เจ้าของ ${name}`;
    case 'lost':
      return ctx.mine ? `คุยเรื่องประกาศตามหา ${name} ของคุณ` : `คุยเรื่องประกาศตามหา ${name}`;
    case 'found':
      return ctx.mine ? `คุยเรื่อง${name}ที่คุณพบ` : `คุยเรื่อง${name}ที่มีคนพบ`;
    case 'pet':
      return ctx.mine ? `มีคนสแกน QR ของ ${name}` : `ติดต่อเจ้าของ ${name} ผ่าน QR`;
  }
}

function postHref(ctx: ConversationContext) {
  return ctx.post_id ? `/${ctx.kind === 'found' ? 'found' : 'lost'}/${ctx.post_id}` : null;
}

/** Marker inside the thread where the conversation moved on to another post. */
export function ChatContextDivider({context}: {context?: ConversationContext | null}) {
  if (!context) return null;
  const href = postHref(context);
  return (
    <div className="chat-divider">
      {href ? (
        <Link to={href} aria-label={describe(context)}>
          <ChatContextTag context={context} />
        </Link>
      ) : (
        <ChatContextTag context={context} />
      )}
    </div>
  );
}

/** Banner under the chat header saying which post this conversation is about. */
export function ChatContextBanner({context}: {context?: ConversationContext | null}) {
  if (!context) return null;
  const href = postHref(context);
  const body = (
    <>
      <span className="chat-context-thumb">
        <MediaImage src={resolveMediaUrl(context.image_url)} alt="" type={context.animal_type} lazy />
      </span>
      <span className="chat-context-text">
        <ChatContextTag context={context} />
        <span className="muted small">{describe(context)}</span>
      </span>
      {href ? <ChevronRight size={18} className="muted" /> : null}
    </>
  );
  return href ? (
    <Link to={href} className="chat-context">{body}</Link>
  ) : (
    <div className="chat-context">{body}</div>
  );
}
