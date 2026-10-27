import { fromBase64, newRecoveryKey, normaliseRecoveryKey, openBackup, sealBackup, toBase64, utf8 } from "@crew/mls";
import { api } from "@/server/api";
import { useSession } from "@/server/session";
import { loadSealed, removeSealed, saveSealed } from "./secure";
import { updateMeta } from "./engine";
import { useChat, type ChatMessage } from "./store";

// MSG-08: an optional encrypted copy of the history, opened only with a recovery key the person
// writes down. Without it, history does not follow to a new phone, and the app says so up front.

const keyName = () => `${useSession.getState().session?.userId}.backupKey`;
const AUTO_EVERY_MS = 24 * 3_600_000;

interface Archive {
  v: 1;
  at: number;
  conversations: Record<string, ChatMessage[]>;
}

export async function hasRecoveryKey(): Promise<boolean> {
  return Boolean(await loadSealed<string>(keyName()));
}

/** Makes the key and keeps it on this phone (sealed), so later backups need no typing. */
export async function createRecoveryKey(): Promise<string> {
  const key = newRecoveryKey();
  await saveSealed(keyName(), key);
  return key;
}

export async function backupNow(): Promise<number> {
  const key = await loadSealed<string>(keyName());
  if (!key) throw new Error("no_key");
  const { messages } = useChat.getState();
  // Disappearing messages never go into a backup.
  const conversations = Object.fromEntries(Object.entries(messages).map(([id, list]) => [id, list.filter((m) => m.expiresAt === undefined && !m.deleted && m.status !== "held")]));
  const archive: Archive = { v: 1, at: Date.now(), conversations };
  const sealed = sealBackup(utf8.encode(JSON.stringify(archive)), key);
  const res = await api<{ updatedAt: number }>("/v1/chat/backup", { method: "PUT", body: { data: toBase64(sealed) } });
  updateMeta((m) => ({ ...m, backupAt: res.updatedAt }));
  return res.updatedAt;
}

/** Once a day at most, when a key exists. */
export async function backupIfDue(): Promise<void> {
  const { backupAt } = useChat.getState().meta;
  if (backupAt && Date.now() - backupAt < AUTO_EVERY_MS) return;
  if (await hasRecoveryKey()) await backupNow().catch(() => undefined);
}

export type RestoreResult = "ok" | "badKey" | "none";

export async function restoreBackup(typed: string): Promise<RestoreResult> {
  const key = normaliseRecoveryKey(typed);
  if (!key) return "badKey";
  let data: string;
  try {
    data = (await api<{ data: string }>("/v1/chat/backup")).data;
  } catch {
    return "none";
  }
  let archive: Archive;
  try {
    archive = JSON.parse(utf8.decode(openBackup(fromBase64(data), key))) as Archive;
  } catch {
    return "badKey";
  }
  useChat.setState((s) => {
    const messages = { ...s.messages };
    for (const [id, list] of Object.entries(archive.conversations)) {
      const known = new Set((messages[id] ?? []).map((m) => m.id));
      messages[id] = [...list.filter((m) => !known.has(m.id)), ...(messages[id] ?? [])].sort((a, b) => a.at - b.at);
    }
    return { messages };
  });
  for (const [id, list] of Object.entries(useChat.getState().messages)) await saveSealed(`${useSession.getState().session?.userId}.h.${id}`, list);
  await saveSealed(keyName(), key);
  return "ok";
}

export async function turnOffBackup(): Promise<void> {
  await api("/v1/chat/backup", { method: "DELETE" }).catch(() => undefined);
  await removeSealed(keyName());
  updateMeta((m) => ({ ...m, backupAt: null }));
}
