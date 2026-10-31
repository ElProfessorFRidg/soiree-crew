import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useMemo } from "react";
import { Platform } from "react-native";
import { askPermission } from "@/system/askPermission";
import { useAppStore } from "@/state/store";

/**
 * O-21: a photo of my own glass, shown instead of the glass icon. It stays on this phone, in the
 * app's document folder: never uploaded, never in the synced drink nor in the Keychain copy, so
 * another phone or a reinstall shows the glass icon. The store maps a drink id to the file name
 * (the folder's full path changes between iOS updates); the web keeps the JPEG itself.
 */

const FOLDER = "drink-photos";
/** A square this wide is sharp on a 3x screen at the sizes it is shown, about 40 KB in JPEG. */
const SIDE = 480;
const QUALITY = 0.7;

const web = Platform.OS === "web";
const folder = () => new Directory(Paths.document, FOLDER);

/**
 * Opens the camera or the library, crops the middle square and re-encodes it (which drops the
 * location). Returns a file in the cache (a data URI on the web) for the editor to show until the
 * drink is saved; null when cancelled, -1 / -2 when refused (the system may ask again, or not).
 */
export async function pickDrinkPhoto(source: "camera" | "library"): Promise<string | null | -1 | -2> {
  const permission = await askPermission(source === "camera" ? "camera" : "photos", source === "camera" ? "drinkPhoto" : "drinkLibrary");
  if (!permission.granted) return permission.declined ? null : permission.canAskAgain ? -1 : -2;
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  // The system crop is square on iOS only when the person keeps it so: the middle square, always.
  const side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width !== asset.height) context.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
  if (side > SIDE) context.resize({ width: SIDE, height: SIDE });
  const saved = await (await context.renderAsync()).saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: web });
  return web && saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : saved.uri;
}

function deleteFile(name: string | undefined): void {
  if (!name || web || name.startsWith("data:")) return;
  try {
    const file = new File(folder(), name);
    if (file.exists) file.delete();
  } catch {
    // Already gone: nothing to free.
  }
}

/**
 * After the drink is saved: `picked` (from pickDrinkPhoto) becomes its photo, replacing the one
 * before; null takes the photo off. The replaced file is deleted at once.
 */
export function keepDrinkPhoto(drinkId: string, picked: string | null): void {
  const before = useAppStore.getState().customDrinkPhotos[drinkId];
  let kept: string | null = null;
  if (picked && (web || picked.startsWith("data:"))) kept = picked;
  else if (picked) {
    try {
      const dir = folder();
      dir.create({ intermediates: true, idempotent: true });
      // A new name each time: an image cache never shows the old photo under the same address.
      const name = `${drinkId}-${Date.now().toString(36)}.jpg`;
      new File(picked).moveSync(new File(dir, name));
      kept = name;
    } catch {
      // The folder cannot be written: the drink keeps what it had.
      return;
    }
  }
  useAppStore.setState((state) => {
    const { [drinkId]: _old, ...rest } = state.customDrinkPhotos;
    return { customDrinkPhotos: kept ? { ...rest, [drinkId]: kept } : rest };
  });
  if (before !== kept) deleteFile(before);
}

/** Where to read a stored photo from, or null when its file is gone (another phone, a reinstall). */
export function drinkPhotoUri(stored: string | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("data:")) return stored;
  if (web) return null;
  try {
    const file = new File(folder(), stored);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** The photo of a saved drink, for `custom:<id>` presets too; null shows the glass icon. */
export function useDrinkPhoto(drinkId: string | null | undefined): string | null {
  const stored = useAppStore((state) => (drinkId ? state.customDrinkPhotos[drinkId] : undefined));
  return useMemo(() => drinkPhotoUri(stored), [stored]);
}

/** The saved drink behind a preset id ("custom:<id>"), if any. */
export function customIdOf(presetId: string): string | null {
  return presetId.startsWith("custom:") ? presetId.slice("custom:".length) : null;
}

/**
 * Photos whose drink is gone (removed here or on another phone, another account) or whose file is
 * missing leave the store, and files no drink points to leave the folder. Run at launch and once
 * the undo of a removal has passed, so "Annuler" still brings the photo back.
 */
export function pruneDrinkPhotos(): void {
  const { customDrinks, customDrinkPhotos } = useAppStore.getState();
  const ids = new Set(customDrinks.map((drink) => drink.id));
  const kept = Object.fromEntries(Object.entries(customDrinkPhotos).filter(([id, stored]) => ids.has(id) && drinkPhotoUri(stored) !== null));
  if (Object.keys(kept).length !== Object.keys(customDrinkPhotos).length) useAppStore.setState({ customDrinkPhotos: kept });
  if (web) return;
  try {
    const dir = folder();
    if (!dir.exists) return;
    const names = new Set(Object.values(kept));
    for (const entry of dir.list()) {
      if (entry instanceof File && !names.has(entry.name)) entry.delete();
    }
  } catch {
    // The folder is not readable yet: next launch.
  }
}
