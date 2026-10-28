import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { api } from "@/server/api";

/** N-17, SEC-08: downloads everything the server keeps about me and hands it to the share sheet. */
export async function exportMyData(): Promise<void> {
  const data = await api<unknown>("/v1/me/export");
  const json = JSON.stringify(data, null, 2);
  const name = `soiree-crew-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  await file.write(json);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: "application/json", UTI: "public.json" });
  } finally {
    // The share sheet has made its own copy: the plain export does not stay in the cache.
    try {
      file.delete();
    } catch {
      // Already gone.
    }
  }
}
