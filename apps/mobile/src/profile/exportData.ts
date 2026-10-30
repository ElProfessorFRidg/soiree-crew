import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { api } from "@/server/api";

const FORMATS = {
  json: { mimeType: "application/json", UTI: "public.json" },
  csv: { mimeType: "text/csv", UTI: "public.comma-separated-values-text" },
} as const;

/**
 * N-17, SEC-08: downloads everything the server keeps about me and hands it to the share sheet.
 * JSON keeps the structure; CSV is one file, one row per record, the kind of data in the first
 * column (a share sheet passes one file, and a spreadsheet filters on that column).
 */
export async function exportMyData(format: keyof typeof FORMATS = "json"): Promise<void> {
  const text = format === "csv" ? (await api<{ csv: string }>("/v1/me/export?format=csv")).csv : JSON.stringify(await api<unknown>("/v1/me/export"), null, 2);
  const name = `soiree-crew-${new Date().toISOString().slice(0, 10)}.${format}`;
  const { mimeType, UTI } = FORMATS[format];
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  await file.write(text);
  // Some share targets read the file after the sheet closes: it is deleted at the next launch
  // (purgePlainFiles), not right away.
  await Sharing.shareAsync(file.uri, { mimeType, UTI });
}
