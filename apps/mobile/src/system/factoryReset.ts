import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";
import { Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { CHAT_KEY_NAME } from "@/chat/secure";
import { SESSION_KEYS } from "@/server/session";
import { useAppStore } from "@/state/store";

/**
 * O-07: every secret the app ever puts in the iOS Keychain or the Android Keystore (a function:
 * session.ts imports this module too, so the list is read when used, not when loaded). The Keychain is
 * not emptied when the app is deleted, so these are also cleared on the first launch of a new
 * install (clearInstallLeftovers).
 */
const secretKeys = (): readonly string[] => [...SESSION_KEYS, CHAT_KEY_NAME];

/** Set on the first launch of an install: its absence with no app data means a fresh install. */
const INSTALL_MARKER = "crew-installed-v1";
/** The main store's key: present when the app has been used before the marker existed. */
const APP_STORE_KEY = "crew-app-v1";

async function forgetSecrets(): Promise<void> {
  if (Platform.OS === "web") return;
  await Promise.all(secretKeys().map((key) => SecureStore.deleteItemAsync(key).catch(() => undefined)));
}

/**
 * iOS keeps Keychain items after the app is deleted: a reinstall would find the old session and the
 * old chat key. On the first launch of an install (no marker and no app data), they are dropped, so
 * a reinstall starts as clean as the first install. An app updated from a version without the
 * marker keeps its data: only the marker is added.
 */
export async function clearInstallLeftovers(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const [marker, appData] = await Promise.all([AsyncStorage.getItem(INSTALL_MARKER), AsyncStorage.getItem(APP_STORE_KEY)]);
    if (marker) return;
    if (!appData) await forgetSecrets();
    await AsyncStorage.setItem(INSTALL_MARKER, "1");
  } catch {
    // Storage unreadable: nothing is deleted on a guess.
  }
}

/** Everything in the app's own folders: photos waiting to upload, chat media, exports, caches. */
function emptyAppFolders(): void {
  if (Platform.OS === "web") return;
  for (const folder of [Paths.document, Paths.cache]) {
    try {
      for (const item of folder.list()) {
        try {
          item.delete();
        } catch {
          // In use or already gone: the next launch does not read it without its store entry.
        }
      }
    } catch {
      // Folder unreadable: nothing more to do there.
    }
  }
}

/**
 * O-07: this phone as if the app had never been installed. Stops the Live Activity, cancels every
 * reminder and the badge, forgets the Keychain / Keystore secrets, deletes the app's files and its
 * whole storage, then restarts the app at the age gate. What lives on the server is deleted before
 * this by the caller (DELETE /v1/me), never by this function.
 */
export async function eraseEverything(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.clear();
      globalThis.sessionStorage?.clear();
    } catch {
      // Blocked storage: the reload below still starts from what the browser allows.
    }
    globalThis.location?.reload();
    return;
  }
  const { liveActivityId } = useAppStore.getState();
  if (liveActivityId && Platform.OS === "ios") {
    try {
      const live = require("expo-live-activity") as typeof import("expo-live-activity");
      live.stopActivity(liveActivityId, { title: "" });
    } catch {
      // Live Activities off: nothing on the lock screen.
    }
  }
  await Promise.all([
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined),
    Notifications.dismissAllNotificationsAsync().catch(() => undefined),
    Notifications.setBadgeCountAsync(0).catch(() => undefined),
  ]);
  await forgetSecrets();
  emptyAppFolders();
  await AsyncStorage.clear().catch(() => undefined);
  // The marker goes back at once: the restarted app must not take its own reset for a reinstall.
  await AsyncStorage.setItem(INSTALL_MARKER, "1").catch(() => undefined);
  await reloadAppAsync("Erased by the user");
}
