/** A connected device: anything with a send method, so tests can use a fake. */
export interface LiveSocket {
  send(data: string): void;
}

export type LiveEvent =
  | { type: "party.changed"; partyId: string }
  /** N-36: someone at the party does not feel well; `near` when only the nearest were told so far. */
  | { type: "party.unwell"; partyId: string; userId: string; near?: boolean }
  /** N-29: a member gave no sign of life for longer than the party's threshold. */
  | { type: "party.quiet"; partyId: string; userId: string; batteryLow: boolean }
  /** O-88: a member's estimate went past 2.0 g/L. */
  | { type: "party.danger"; partyId: string; userId: string }
  /** N-25: the night is over; everyone going says when they are home. */
  | { type: "party.homeCheck"; partyId: string }
  | { type: "crew.changed"; crewId: string }
  | { type: "sync"; reason: "own_write" }
  | { type: "security.newDevice" }
  /** MSG-01: a conversation's group changed (devices, timer); without an id, look at all of them. */
  | { type: "chat.roster"; conversationId?: string }
  | { type: "chat.message"; conversationId: string }
  | { type: "chat.typing"; conversationId: string; userId: string }
  /** JOY-01: the other phone of a knock; `proof` when it also confirmed both check-ins. */
  | { type: "cheers"; withUserId: string; withName: string; proof: boolean };

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
