import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { askPermission } from "@/system/askPermission";

const SIDE = 256;
const QUALITY = 0.7;

export type PhotoResult = { photo: string } | { cancelled: true } | { refused: "again" | "settings" };

/**
 * O-04: the profile photo. The permission is asked after its own explanation, the middle square is
 * kept, re-encoded small (which drops the location) and returned as a data address that stays on this phone.
 */
export async function pickProfilePhoto(source: "camera" | "library"): Promise<PhotoResult> {
  const permission = await askPermission(source === "camera" ? "camera" : "photos", source === "camera" ? "photo" : "library");
  if (!permission.granted) return permission.declined ? { cancelled: true } : { refused: permission.canAskAgain ? "again" : "settings" };
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1, exif: false };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { cancelled: true };
  const side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width !== asset.height) context.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
  if (side > SIDE) context.resize({ width: SIDE, height: SIDE });
  const saved = await (await context.renderAsync()).saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: true });
  return saved.base64 ? { photo: `data:image/jpeg;base64,${saved.base64}` } : { cancelled: true };
}
