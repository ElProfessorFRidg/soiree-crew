import { clearInstallLeftovers } from "@/system/factoryReset";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

// The session token lives in the iOS Keychain / Android Keystore (SEC-05), never in AsyncStorage.
const TOKEN_KEY = "crew.session.token";
const URL_KEY = "crew.server.url";
/** Kept in the Keychain / Keystore; the factory reset forgets them (system/factoryReset.ts). */
export const SESSION_KEYS = [TOKEN_KEY, URL_KEY] as const;

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
  // A reinstall on iOS finds the old install's Keychain items: drop them before reading any.
  await clearInstallLeftovers();
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

/** A real private IPv4 literal: four numbers, not a name that merely starts like one ("10.evil.com"). */
function privateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return false;
  const [a, b] = parts.map(Number) as [number, number];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "[::1]" || host.endsWith(".local") || privateIpv4(host);
}

/** https only, except for a phone talking to a dev server on the local network. */
export function normaliseServerUrl(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol === "http:" && !isLocalHost(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}
