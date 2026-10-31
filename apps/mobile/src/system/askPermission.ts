import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { create } from "zustand";

// The one way the app asks for a system permission: never cold. The first time a permission is
// needed, a short sheet says what it is for and what leaves the phone, then the system asks.
// A refusal is left to the caller, which knows where to say it and links to the settings.

export type PermissionKind = "location" | "camera" | "photos" | "notifications";

/** Why it is needed right now: each one has its own explanation. */
export type PermissionUse =
  | "checkin"
  | "venue"
  | "share"
  | "nearby"
  | "photo"
  | "scan"
  | "library"
  | "reminders"
  /** A photo of my own drink, kept on this phone (O-21). */
  | "drinkPhoto"
  | "drinkLibrary";

export interface PermissionAnswer {
  granted: boolean;
  /** False once the system stops asking: only the settings can turn it back on. */
  canAskAgain: boolean;
  /** The person said "Pas maintenant" on the explanation: the system was not asked, nothing to report. */
  declined: boolean;
}

interface PromptRequest {
  kind: PermissionKind;
  use: PermissionUse;
  resolve: (go: boolean) => void;
}

/** The explanation waiting for an answer, shown by PermissionPrompt at the root of the app. */
export const usePermissionPrompt = create<{ request: PromptRequest | null }>(() => ({ request: null }));

const nativeNotifications = Platform.OS === "ios" || Platform.OS === "android";

async function status(kind: PermissionKind): Promise<{ granted: boolean; canAskAgain: boolean }> {
  switch (kind) {
    case "location":
      return Location.getForegroundPermissionsAsync();
    case "camera":
      return ImagePicker.getCameraPermissionsAsync();
    case "photos":
      return ImagePicker.getMediaLibraryPermissionsAsync();
    case "notifications":
      if (!nativeNotifications) return { granted: false, canAskAgain: false };
      return Notifications.getPermissionsAsync();
  }
}

async function systemRequest(kind: PermissionKind): Promise<{ granted: boolean; canAskAgain: boolean }> {
  switch (kind) {
    case "location":
      return Location.requestForegroundPermissionsAsync();
    case "camera":
      return ImagePicker.requestCameraPermissionsAsync();
    case "photos":
      return ImagePicker.requestMediaLibraryPermissionsAsync();
    case "notifications":
      if (!nativeNotifications) return { granted: false, canAskAgain: false };
      return Notifications.requestPermissionsAsync();
  }
}

/** What the system says now, without asking anything. */
export async function permissionStatus(kind: PermissionKind): Promise<{ granted: boolean; canAskAgain: boolean }> {
  try {
    return await status(kind);
  } catch {
    // A browser without the permissions API: treat it as not decided yet.
    return { granted: false, canAskAgain: true };
  }
}

/** Shows the explanation and waits for "Continuer" (true) or "Pas maintenant" (false). */
function explain(kind: PermissionKind, use: PermissionUse): Promise<boolean> {
  return new Promise((resolve) => {
    // A second request while one is open answers the first one "not now": one sheet at a time.
    usePermissionPrompt.getState().request?.resolve(false);
    usePermissionPrompt.setState({ request: { kind, use, resolve } });
  });
}

/**
 * Asks for a permission at the moment it is needed. `use` names why, for the explanation shown
 * before the system prompt; null skips it when the screen itself already explained (the
 * notifications step) or when nothing may delay the request (the SOS).
 */
export async function askPermission(kind: PermissionKind, use: PermissionUse | null): Promise<PermissionAnswer> {
  const current = await permissionStatus(kind);
  if (current.granted) return { granted: true, canAskAgain: true, declined: false };
  if (!current.canAskAgain) return { granted: false, canAskAgain: false, declined: false };
  if (use && !(await explain(kind, use))) return { granted: false, canAskAgain: true, declined: true };
  try {
    const answer = await systemRequest(kind);
    return { granted: answer.granted, canAskAgain: answer.canAskAgain, declined: false };
  } catch {
    return { granted: false, canAskAgain: true, declined: false };
  }
}
