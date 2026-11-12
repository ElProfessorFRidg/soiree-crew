// The remote DrawingTransport of O-63 (see drawing.ts): what the drawer does is shown at once on their own
// canvas, and goes to the server in small batches; what the server relays comes back through receive().

import type { DrawingEvent, DrawingTransport } from "../drawing";
import { coalesceDrawingEvents } from "./engine";

export interface RemoteDrawingTransport extends DrawingTransport {
  readonly kind: "remote";
  /** Events from the server (the picture of another phone, or this one after a reconnection). */
  receive(events: readonly DrawingEvent[]): void;
  /** Events this phone has produced since the transport was made. */
  sentCount(): number;
  /** A new turn: the picture is wiped for everyone listening, and what a late listener replays starts over. */
  reset(): void;
  /** Sends what is waiting, now. Resolves when the queue is empty or a send failed. */
  flushNow(): Promise<void>;
  dispose(): void;
}

export interface RemoteTransportOptions {
  /** One batch to the server; a rejection keeps the events for the next try. */
  send: (events: DrawingEvent[]) => Promise<unknown>;
  /** Wait before a batch leaves, so a finger drag becomes one message and not fifty. */
  delayMs?: number;
  /** Events per request. */
  maxBatch?: number;
  /** Wait before trying again after a failure. */
  retryMs?: number;
  /** Past this many waiting events the oldest are dropped: a long offline stretch must not grow without end. */
  maxQueue?: number;
}

export function createRemoteTransport(options: RemoteTransportOptions): RemoteDrawingTransport {
  const delayMs = options.delayMs ?? 120;
  const maxBatch = options.maxBatch ?? 100;
  const retryMs = options.retryMs ?? 1_000;
  const maxQueue = options.maxQueue ?? 2_000;
  const listeners = new Set<(event: DrawingEvent) => void>();
  let queue: DrawingEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushing: Promise<void> | null = null;
  let produced = 0;
  let disposed = false;
  // The picture so far, so a canvas that mounts late (or again) draws it from the start.
  let history: DrawingEvent[] = [];

  const emit = (event: DrawingEvent) => {
    history.push(event);
    if (history.length > 400) history = coalesceDrawingEvents(history);
    for (const listener of listeners) listener(event);
  };
  const schedule = (ms: number) => {
    if (disposed || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, ms);
  };

  async function run(): Promise<void> {
    while (queue.length > 0 && !disposed) {
      const batch = coalesceDrawingEvents(queue).slice(0, maxBatch);
      // The merged batch can be shorter than the queue it came from: count what it really covers.
      const taken = takeCovering(queue, batch);
      try {
        await options.send(batch);
      } catch {
        schedule(retryMs);
        return;
      }
      queue = queue.slice(taken);
    }
  }

  const flush = (): Promise<void> => {
    if (!flushing) {
      flushing = run().finally(() => {
        flushing = null;
        if (queue.length > 0 && !timer) schedule(delayMs);
      });
    }
    return flushing;
  };

  return {
    kind: "remote",
    send(event) {
      produced += 1;
      emit(event);
      queue.push(event);
      if (queue.length > maxQueue) queue = queue.slice(queue.length - maxQueue);
      schedule(delayMs);
    },
    subscribe(listener) {
      listeners.add(listener);
      for (const event of coalesceDrawingEvents(history)) listener(event);
      return () => listeners.delete(listener);
    },
    reset() {
      history = [];
      for (const listener of listeners) listener({ type: "clear" });
    },
    receive(events) {
      for (const event of events) emit(event);
    },
    sentCount: () => produced,
    flushNow() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return flush();
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      listeners.clear();
    },
  };
}

/** How many events of `queue`, from the start, the (merged, possibly cut) `batch` stands for. */
function takeCovering(queue: readonly DrawingEvent[], batch: readonly DrawingEvent[]): number {
  let used = 0;
  let index = 0;
  for (const event of batch) {
    if (event.type === "stroke.extend") {
      let points = 0;
      while (index < queue.length) {
        const next = queue[index] as DrawingEvent;
        if (next.type !== "stroke.extend" || next.id !== event.id) break;
        points += next.points.length;
        index += 1;
        used += 1;
        if (points >= event.points.length) break;
      }
    } else {
      index += 1;
      used += 1;
    }
  }
  return used;
}
