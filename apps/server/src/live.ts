/** A connected device: anything with a send method, so tests can use a fake. */
export interface LiveSocket {
  send(data: string): void;
}

export type LiveEvent =
  | { type: "party.changed"; partyId: string }
  /** N-36: someone at the party does not feel well. */
  | { type: "party.unwell"; partyId: string; userId: string }
  | { type: "crew.changed"; crewId: string }
  | { type: "sync"; reason: "own_write" }
  | { type: "security.newDevice" };

/**
 * Pushes hints, never data: a device that hears "party.changed" refetches what
 * it is allowed to see through the normal endpoints, so access rules live in one place.
 */
export class LiveHub {
  private readonly sockets = new Map<string, Set<LiveSocket>>();

  add(userId: string, socket: LiveSocket): () => void {
    const set = this.sockets.get(userId) ?? new Set<LiveSocket>();
    set.add(socket);
    this.sockets.set(userId, set);
    return () => {
      set.delete(socket);
      if (set.size === 0) this.sockets.delete(userId);
    };
  }

  notify(userIds: Iterable<string>, event: LiveEvent): void {
    const payload = JSON.stringify(event);
    for (const userId of userIds) {
      for (const socket of this.sockets.get(userId) ?? []) {
        try {
          socket.send(payload);
        } catch {
          // A socket closing mid-send is cleaned up by its close handler.
        }
      }
    }
  }

  connectedCount(): number {
    let count = 0;
    for (const set of this.sockets.values()) count += set.size;
    return count;
  }
}
