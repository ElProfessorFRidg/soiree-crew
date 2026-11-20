import AsyncStorage from "@react-native-async-storage/async-storage";
import { reloadAppAsync } from "expo";
import { Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/server/session";
import { wipePreviousAccount } from "@/server/connection";
import { CHAT_KEY_NAME } from "@/chat/secure";
import { SESSION_KEYS } from "@/server/session";
import { stopOuting } from "@/location/outing";
import { KEPT_COPY_KEY, stopKeptCopy } from "@/system/keptCopy";
import { useAppStore } from "@/state/store";

/**
 * O-07: everything the app keeps in the iOS Keychain or the Android Keystore: the session, the chat
 * key and the copy that survives a reinstall. Only this reset removes them; deleting the app does
 * not, on purpose (system/keptCopy.ts).
 */
const secretKeys = (): readonly string[] => [...SESSION_KEYS, CHAT_KEY_NAME, KEPT_COPY_KEY];

async function forgetSecrets(): Promise<void> {
  if (Platform.OS === "web") return;
  // Never claim a complete erase if Keychain/Keystore deletion failed.
  await Promise.all(secretKeys().map((key) => SecureStore.deleteItemAsync(key)));
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
 * O-07: this phone as if the app had never been installed. Stops the background location, the Live Activity, cancels every
 * reminder and the badge, forgets the Keychain / Keystore secrets, deletes the app's files and its
 * whole storage, then restarts the app at the age gate. What lives on the server is deleted before
 * this by the caller (DELETE /v1/me), never by this function.
 */
export async function eraseEverything(): Promise<void> {
  if (Platform.OS === "web") {
    // Browser previews can block window.confirm and reload inside an iframe. Reset in memory
    // and on disk, then explicitly navigate to the first-run flow instead of relying on reload.
    stopKeptCopy();
    // In-memory crew, radar, invitations and account-bound caches are not part of AsyncStorage.
    // Clear them too so a web preview cannot show the previous user after a guest reset.
    wipePreviousAccount(null);
    useSession.setState({ session: null, ready: true });
    // Reset before clearing storage: Zustand persist writes on every state change.
    useAppStore.setState({ ...useAppStore.getInitialState(), hydrated: true });
    await AsyncStorage.clear();
    try {
      globalThis.sessionStorage?.clear();
    } catch {
      // Storage access can be restricted in embedded previews.
    }
    router.replace("/onboarding");
    return;
  }
  stopKeptCopy();
  await stopOuting().catch(() => undefined);
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
  // In-memory stores and the current session must be invalidated even if a native
  // reload is unavailable (for example in a development build).
  wipePreviousAccount(null);
  useSession.setState({ session: null, ready: true });
  useAppStore.setState({ ...useAppStore.getInitialState(), hydrated: true });
  await AsyncStorage.clear();
  try {
    await reloadAppAsync("Erased by the user");
  } catch {
    router.replace("/onboarding");
  }
}
