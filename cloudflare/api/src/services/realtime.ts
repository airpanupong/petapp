import type {Deps} from '../app';

function inbox(env: Env, userId: string) {
  return env.INBOX.get(env.INBOX.idFromName(userId));
}

/** Sends an event to every open inbox socket of the user. */
export function pushToUser(deps: Deps, userId: string, event: Record<string, unknown>): void {
  deps.waitUntil(inbox(deps.env, userId).push(event));
}

export async function isViewing(env: Env, userId: string, conversationId: string): Promise<boolean> {
  try {
    return await inbox(env, userId).isViewing(conversationId);
  } catch {
    return false;
  }
}

export function markViewed(deps: Deps, userId: string, conversationId: string): void {
  deps.waitUntil(inbox(deps.env, userId).markViewed(conversationId));
}

export function connectInbox(env: Env, userId: string, request: Request): Promise<Response> {
  return inbox(env, userId).fetch(request);
}

export function notificationPing(deps: Deps, userId: string): void {
  pushToUser(deps, userId, {type: 'notifications'});
}
