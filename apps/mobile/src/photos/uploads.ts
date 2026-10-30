import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "@/server/api";
import { newId } from "@/state/store";

/** Longest side sent to the server. Enough for a phone screen, about 300 KB in JPEG. */
const MAX_SIDE = 1600;
const QUALITY = 0.72;
const MAX_ATTEMPTS = 6;

export interface PendingPhoto {
  id: string;
  partyId: string;
  /** The re-encoded copy on this phone, kept until the server has it. */
  uri: string;
  width: number;
  height: number;
  status: "pending" | "sending" | "failed";
  attempts: number;
  /** Web keeps the data itself: there is no file to read back later. */
  data?: string;
  /** COM-02: a photo for my review of this place instead of a party album (partyId is then empty). */
  reviewVenueId?: string;
}

interface UploadState {
  queue: PendingPhoto[];
}

export const useUploads = create<UploadState>()(
  persist((): UploadState => ({ queue: [] }), {
    name: "crew-photo-uploads",
    storage: createJSONStorage(() => AsyncStorage),
    // A send interrupted by the app being killed is simply pending again.
    merge: (stored, current) => ({
      ...current,
      queue: ((stored as Partial<UploadState> | undefined)?.queue ?? []).map((p) => (p.status === "sending" ? { ...p, status: "pending" as const } : p)),
    }),
  }),
);

const patch = (id: string, change: Partial<PendingPhoto>) =>
  useUploads.setState((s) => ({ queue: s.queue.map((p) => (p.id === id ? { ...p, ...change } : p)) }));

/**
 * QOL-09: HEIC or anything else comes back as a resized JPEG. Re-encoding drops
 * every metadata block, the location included, before anything leaves the phone.
 */
async function prepare(asset: ImagePicker.ImagePickerAsset): Promise<{ uri: string; width: number; height: number; data?: string }> {
  const longest = Math.max(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (longest > MAX_SIDE) context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: Platform.OS === "web" });
  return { uri: saved.uri, width: saved.width, height: saved.height, ...(saved.base64 ? { data: saved.base64 } : {}) };
}

/** Opens the camera or the library, then queues the photos for this party. Returns how many were added. */
export async function addPhotos(partyId: string, source: "camera" | "library"): Promise<number> {
  return pickAndQueue(source, 10, { partyId });
}

/**
 * COM-02: photos for my review of a place, same resizing and metadata stripping, same retry queue.
 * The review must exist on the server first; `room` is how many more it can take (3 at most).
 */
export async function addReviewPhotos(venueId: string, source: "camera" | "library", room: number): Promise<number> {
  return pickAndQueue(source, room, { partyId: "", reviewVenueId: venueId });
}

async function pickAndQueue(source: "camera" | "library", limit: number, target: { partyId: string; reviewVenueId?: string }): Promise<number> {
  if (limit <= 0) return 0;
  const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  // -1: refused, the system may ask again; -2: refused for good, only the settings can help.
  if (!permission.granted) return permission.canAskAgain ? -1 : -2;
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 1, exif: false });
  if (result.canceled) return 0;
  const assets = result.assets.slice(0, limit);
  for (const asset of assets) {
    const ready = await prepare(asset);
    useUploads.setState((s) => ({ queue: [...s.queue, { id: newId(), ...target, ...ready, status: "pending", attempts: 0 }] }));
  }
  void flushUploads();
  return assets.length;
}

/**
 * N-19: one receipt photo for an expense, re-encoded like album photos (no location kept).
 * Returns the JPEG as base64 and a uri to preview it, null when cancelled, -1 / -2 when refused.
 */
export async function pickReceipt(source: "camera" | "library"): Promise<{ uri: string; data: string } | null | -1 | -2> {
  const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return permission.canAskAgain ? -1 : -2;
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1, exif: false });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const ready = await prepare(asset);
  return { uri: ready.uri, data: ready.data ?? (await new File(ready.uri).base64()) };
}

let running = false;

/** Sends what is waiting, one photo at a time, and keeps the rest for the next try (SYNC-06 spirit). */
export async function flushUploads(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const next = useUploads.getState().queue.find((p) => p.status === "pending" || (p.status === "failed" && p.attempts < MAX_ATTEMPTS));
      if (!next) return;
      patch(next.id, { status: "sending" });
      try {
        const data = next.data ?? (await new File(next.uri).base64());
        const path = next.reviewVenueId ? `/v1/places/${next.reviewVenueId}/review/photos` : `/v1/parties/${next.partyId}/photos`;
        await api(path, { method: "POST", body: { id: next.id, data, width: next.width, height: next.height } });
        useUploads.setState((s) => ({ queue: s.queue.filter((p) => p.id !== next.id) }));
        if (Platform.OS !== "web") new File(next.uri).delete();
      } catch {
        patch(next.id, { status: "failed", attempts: next.attempts + 1 });
        return;
      }
    }
  } finally {
    running = false;
  }
}

export function retryUpload(id: string): void {
  patch(id, { status: "pending", attempts: 0 });
  void flushUploads();
}

export function dropUpload(id: string): void {
  useUploads.setState((s) => ({ queue: s.queue.filter((p) => p.id !== id) }));
}

export interface AlbumPhoto {
  id: string;
  userId: string;
  name: string;
  width: number;
  height: number;
  at: number;
  url: string;
  /** N-37: false when the person who took it said no to stories. */
  storyOk?: boolean;
}

export async function fetchAlbum(partyId: string): Promise<AlbumPhoto[]> {
  return (await api<{ photos: AlbumPhoto[] }>(`/v1/parties/${partyId}/photos`)).photos;
}

export function deletePhoto(id: string): Promise<unknown> {
  return api(`/v1/photos/${id}`, { method: "DELETE" });
}
