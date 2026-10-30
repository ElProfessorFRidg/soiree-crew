/**
 * O-43, COM-08: screens that keep a server list on show (friends, moderation notices) listen here.
 * "open" fires each time the live socket (re)connects: anything sent while it was down is
 * refetched then, so a list never stays stale after a disconnect.
 */
export type LiveHint = "open" | "friends.changed" | "moderation.notice";

const listeners = new Set<(hint: LiveHint) => void>();

export function onLiveHint(listener: (hint: LiveHint) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitLiveHint(hint: string): void {
  if (hint !== "open" && hint !== "friends.changed" && hint !== "moderation.notice") return;
  for (const listener of listeners) {
    try {
      listener(hint);
    } catch {
      // One screen failing to refresh must not stop the others.
    }
  }
}
