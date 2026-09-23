import * as Keychain from 'react-native-keychain';

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

const SERVICE = 'petapp.session';
let memorySession: SessionTokens | null = null;

export function getMemorySession() {
  return memorySession;
}

export async function loadSession(): Promise<SessionTokens | null> {
  if (memorySession) {
    return memorySession;
  }
  const value = await Keychain.getGenericPassword({service: SERVICE});
  if (!value) {
    return null;
  }
  try {
    memorySession = JSON.parse(value.password) as SessionTokens;
    return memorySession;
  } catch {
    await Keychain.resetGenericPassword({service: SERVICE});
    return null;
  }
}

export async function saveSession(tokens: SessionTokens) {
  memorySession = tokens;
  await Keychain.setGenericPassword('session', JSON.stringify(tokens), {
    service: SERVICE,
  });
}

export async function clearSession() {
  memorySession = null;
  await Keychain.resetGenericPassword({service: SERVICE});
}
