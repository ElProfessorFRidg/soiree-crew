import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { fromBase64, openMedia, sealMedia, toBase64 } from "@crew/mls";
import { api } from "@/server/api";
import { sendMediaPayload } from "./engine";
import type { ChatMedia } from "./store";

// MSG-03: every photo and voice note is encrypted here with its own key before upload. The key
// travels inside the end-to-end encrypted message; the server stores bytes it cannot open.

const MAX_SIDE = 1600;
const THUMB_SIDE = 48;
/** The server takes 6 MB per file: about 30 s of phone video at the picker's medium quality. */
const MAX_VIDEO_BYTES = 6 * 1024 * 1024 - 64;
const MAX_VIDEO_S = 30;

async function upload(conversationId: string, plain: Uint8Array): Promise<{ blob: string; key: string }> {
  const sealed = sealMedia(plain);
  const { id } = await api<{ id: string }>(`/v1/conversations/${conversationId}/blobs`, { method: "POST", body: { data: toBase64(sealed.data) } });
  return { blob: id, key: sealed.key };
}

async function readBytes(uri: string, base64?: string): Promise<Uint8Array> {
  if (base64) return fromBase64(base64);
  if (Platform.OS === "web") return new Uint8Array(await (await fetch(uri)).arrayBuffer());
  return fromBase64(await new File(uri).base64());
}

export class VideoTooLarge extends Error {}

/** MSG-03: a short video, encrypted like everything else. Refused above the server's file size. */
async function sendVideo(conversationId: string, asset: ImagePicker.ImagePickerAsset, reply?: string): Promise<void> {
  if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) throw new VideoTooLarge();
  const bytes = await readBytes(asset.uri);
  if (bytes.length > MAX_VIDEO_BYTES) throw new VideoTooLarge();
  const { blob, key } = await upload(conversationId, bytes);
  sendMediaPayload(conversationId, {
    kind: "video",
    blob,
    key,
    mime: asset.mimeType ?? "video/mp4",
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    ...(asset.duration ? { durationMs: Math.round(asset.duration) } : {}),
    ...(reply ? { reply } : {}),
  });
}

/** Opens the camera or the library, re-encodes photos (which drops the location), encrypts and sends. -1 or -2: no permission. */
export async function sendPhoto(conversationId: string, source: "camera" | "library", reply?: string): Promise<number> {
  const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  // -1: refused, the system may ask again; -2: refused for good, only the settings can help.
  if (!permission.granted) return permission.canAskAgain ? -1 : -2;
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images", "videos"], quality: 1, exif: false, videoMaxDuration: MAX_VIDEO_S, videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return 0;
  const asset = result.assets[0];
  if (asset.type === "video") {
    await sendVideo(conversationId, asset, reply);
    return 1;
  }
  const longest = Math.max(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (longest > MAX_SIDE) context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await (await context.renderAsync()).saveAsync({ compress: 0.72, format: SaveFormat.JPEG, base64: true });
  // The thumbnail is made on the phone too and travels inside the encrypted message.
  const thumbContext = ImageManipulator.manipulate(image.uri);
  thumbContext.resize(image.width >= image.height ? { width: THUMB_SIDE } : { height: THUMB_SIDE });
  const thumb = await (await thumbContext.renderAsync()).saveAsync({ compress: 0.5, format: SaveFormat.JPEG, base64: true });
  const { blob, key } = await upload(conversationId, await readBytes(image.uri, image.base64));
  if (Platform.OS !== "web") {
    try {
      new File(image.uri).delete();
      new File(thumb.uri).delete();
    } catch {
      // A cache file left behind is cleaned by the system.
    }
  }
  sendMediaPayload(conversationId, {
    kind: "photo",
    blob,
    key,
    mime: "image/jpeg",
    width: image.width,
    height: image.height,
    ...(thumb.base64 ? { thumb: thumb.base64 } : {}),
    ...(reply ? { reply } : {}),
  });
  return 1;
}

export async function sendVoice(conversationId: string, uri: string, durationMs: number, reply?: string): Promise<void> {
  const bytes = await readBytes(uri);
  const mime = Platform.OS === "web" ? "audio/webm" : "audio/mp4";
  const { blob, key } = await upload(conversationId, bytes);
  if (Platform.OS !== "web") {
    try {
      new File(uri).delete();
    } catch {
      // Same as above.
    }
  }
  sendMediaPayload(conversationId, { kind: "voice", blob, key, mime, durationMs: Math.round(durationMs), ...(reply ? { reply } : {}) });
}

const opened = new Map<string, Promise<string>>();

/**
 * Downloads and decrypts a file once per run. Photos become data URIs held in memory; voice notes
 * need a file for the player, written to the cache and gone when the system clears it.
 */
export function openChatMedia(media: ChatMedia): Promise<string> {
  let promise = opened.get(media.blob);
  if (!promise) {
    promise = (async () => {
      const { data } = await api<{ data: string }>(`/v1/chat/blobs/${media.blob}`);
      const plain = openMedia(fromBase64(data), media.key);
      if (media.kind === "photo" || Platform.OS === "web") return `data:${media.mime};base64,${toBase64(plain)}`;
      const file = new File(Paths.cache, media.kind === "video" ? `video-${media.blob}.mp4` : `voice-${media.blob}.m4a`);
      if (!file.exists) await file.write(plain);
      return file.uri;
    })();
    promise.catch(() => opened.delete(media.blob));
    opened.set(media.blob, promise);
  }
  return promise;
}

/**
 * SEC-05: at launch, whatever a killed app left behind goes: decrypted voice notes and videos,
 * and a data export that a share target may have still been reading when the sheet closed.
 */
export function purgePlainFiles(): void {
  if (Platform.OS === "web") return;
  try {
    for (const entry of new Directory(Paths.cache).list()) {
      if (entry instanceof File && /^(voice-|video-|soiree-crew-.*\.json$)/.test(entry.name)) entry.delete();
    }
  } catch {
    // Nothing to clean, or the cache is not readable yet: next launch.
  }
}

/**
 * SEC-05: a decrypted voice note or video never stays on disk longer than needed. Called when the
 * conversation closes (every blob) and when a disappearing message expires (its blob).
 */
export function releaseChatMedia(blobs?: readonly string[]): void {
  for (const blob of blobs ?? [...opened.keys()]) {
    const promise = opened.get(blob);
    if (!promise) continue;
    opened.delete(blob);
    if (Platform.OS === "web") continue;
    void promise
      .then((uri) => {
        if (uri.startsWith("file:")) new File(uri).delete();
      })
      .catch(() => undefined);
  }
}
