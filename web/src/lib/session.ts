export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

const KEY = 'petapp.session';
let memorySession: SessionTokens | null = null;

export function getMemorySession() {
  return memorySession;
}

export async function loadSession(): Promise<SessionTokens | null> {
  if (memorySession) return memorySession;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    memorySession = JSON.parse(raw) as SessionTokens;
    return memorySession;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export async function saveSession(tokens: SessionTokens) {
  memorySession = tokens;
  localStorage.setItem(KEY, JSON.stringify(tokens));
}

export async function clearSession() {
  memorySession = null;
  localStorage.removeItem(KEY);
}
