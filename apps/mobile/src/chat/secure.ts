import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { fromBase64, newLocalKey, openLocal, sealLocal, toBase64, utf8 } from "@crew/mls";

// SEC-05 for chats: history, group state and keys are sealed with one key that lives in the
// Keychain / Keystore. AsyncStorage only ever holds ciphertext.
const KEY_NAME = "crew.chat.localKey";
const PREFIX = "crew.chat.";

function tabStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

let keyPromise: Promise<string> | null = null;

function localKey(): Promise<string> {
  keyPromise ??= (async () => {
    // The web preview has no Keychain: like the session, the key lasts as long as the tab.
    const existing = Platform.OS === "web" ? (tabStorage()?.getItem(KEY_NAME) ?? null) : await SecureStore.getItemAsync(KEY_NAME);
    if (existing) return existing;
    const key = newLocalKey();
    if (Platform.OS === "web") tabStorage()?.setItem(KEY_NAME, key);
    else await SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
    return key;
  })();
  return keyPromise;
}

export async function loadSealed<T>(name: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(PREFIX + name);
  if (!raw) return null;
  try {
    return JSON.parse(utf8.decode(openLocal(fromBase64(raw), await localKey()))) as T;
  } catch {
    // Sealed with a key this device no longer has (web tab closed, app restored on a new phone).
    return null;
  }
}

export async function saveSealed(name: string, value: unknown): Promise<void> {
  const sealed = sealLocal(utf8.encode(JSON.stringify(value)), await localKey());
  await AsyncStorage.setItem(PREFIX + name, toBase64(sealed));
}

export async function removeSealed(name: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + name);
}

/** Every sealed chat item of one account, for sign-out and "delete my history". */
export async function removeAllSealed(prefix: string): Promise<void> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX + prefix));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
