import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

// The session token lives in the iOS Keychain / Android Keystore (SEC-05), never in AsyncStorage.
const TOKEN_KEY = "crew.session.token";
const URL_KEY = "crew.server.url";

export interface ServerSession {
  url: string;
  token: string;
  userId: string;
  username: string;
  displayName: string;
}

interface SessionState {
  ready: boolean;
  session: ServerSession | null;
}

export const useSession = create<SessionState>(() => ({ ready: false, session: null }));

// expo-secure-store has no web implementation: the web preview keeps the session for the tab only.
function tabStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}
async function read(key: string): Promise<string | null> {
  if (Platform.OS === "web") return tabStorage()?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function write(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    const storage = tabStorage();
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
}

export async function loadSession(): Promise<void> {
  try {
    const [token, raw] = await Promise.all([read(TOKEN_KEY), read(URL_KEY)]);
    const meta = raw ? (JSON.parse(raw) as Omit<ServerSession, "token">) : null;
    useSession.setState({ ready: true, session: token && meta ? { ...meta, token } : null });
  } catch {
    useSession.setState({ ready: true, session: null });
  }
}

export async function saveSession(session: ServerSession | null): Promise<void> {
  if (!session) {
    await write(TOKEN_KEY, null);
    await write(URL_KEY, null);
  } else {
    const { token, ...meta } = session;
    await write(TOKEN_KEY, token);
    await write(URL_KEY, JSON.stringify(meta));
  }
  useSession.setState({ session });
}

/** https only, except for a phone talking to a dev server on the local network. */
export function normaliseServerUrl(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const local = /^(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname.endsWith(".local");
    if (url.protocol === "http:" && !local) return null;
    return url.origin;
  } catch {
    return null;
  }
}
