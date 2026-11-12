import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { createRemoteTransport, type GribouilleView } from "@crew/games";
import { ApiError } from "@/server/api";
import { onLiveHint } from "@/server/liveHints";
import { gribouille } from "@/server/gribouilleData";

const POLL_MS = 2_000;
const POLL_DRAWING_MS = 1_500;

export interface RoomLink {
  room: GribouilleView;
  /** The last request failed for lack of network: the screen says so and keeps trying. */
  offline: boolean;
  /** The room is gone for good (finished long ago, server restarted). */
  gone: boolean;
  transport: ReturnType<typeof createRemoteTransport>;
  /** Server time minus this phone's, so the countdown follows the server's clock. */
  clockOffset: () => number;
  refresh: () => Promise<void>;
  apply: (view: GribouilleView) => void;
}

/**
 * Keeps one phone in step with its room: the server's answer replaces the state, the strokes after
 * the last one seen go to the canvas, and a gap (network lost, app in the background) is closed by
 * the next answer, since every answer is the whole truth plus the strokes missing here.
 */
export function useGribouilleRoom(initial: GribouilleView, me: string): RoomLink {
  const id = initial.id;
  const [room, setRoom] = useState(initial);
  const [offline, setOffline] = useState(false);
  const [gone, setGone] = useState(false);
  const cursor = useRef(0);
  const turn = useRef(-1);
  const offset = useRef(initial.serverNow - Date.now());
  const busy = useRef(false);
  const again = useRef(false);
  const alive = useRef(true);
  const transport = useMemo(() => createRemoteTransport({ send: (events) => gribouille.strokes(id, events) }), [id]);

  const apply = useCallback(
    (view: GribouilleView) => {
      offset.current = view.serverNow - Date.now();
      const t = view.turn;
      if (t && t.index !== turn.current) {
        // A new turn: a blank canvas, and the strokes counted from the start.
        turn.current = t.index;
        cursor.current = 0;
        transport.reset();
      }
      if (t) {
        const mine = t.drawerId === me;
        // The drawer already has their strokes on screen; only a restarted app (nothing drawn here yet) takes them back.
        if (!mine || transport.sentCount() === 0) transport.receive(t.events.slice(Math.max(0, cursor.current - t.eventsFrom)));
        cursor.current = t.eventCount;
      }
      setRoom(view);
    },
    [me, transport],
  );

  const refresh = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      do {
        again.current = false;
        let view = await gribouille.get(id, cursor.current);
        // The turn changed since the cursor was taken: the slice is of the wrong turn, so ask from the start.
        if (view.turn && view.turn.index !== turn.current && view.turn.eventsFrom !== 0) view = await gribouille.get(id, 0);
        if (!alive.current) return;
        apply(view);
        setOffline(false);
      } while (again.current);
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof ApiError && error.failure.kind === "http" && error.failure.status === 404) setGone(true);
      else setOffline(true);
    } finally {
      busy.current = false;
    }
  }, [id, apply]);

  useEffect(() => {
    alive.current = true;
    apply(initial);
    return () => {
      alive.current = false;
      transport.dispose();
    };
    // Mounted once per room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const drawing = room.phase === "drawing";
  useEffect(() => {
    if (room.phase === "end") return;
    const timer = setInterval(() => void refresh(), drawing ? POLL_DRAWING_MS : POLL_MS);
    return () => clearInterval(timer);
  }, [refresh, drawing, room.phase]);

  useEffect(() => {
    const off = onLiveHint((hint) => {
      // "open": the socket is back, so anything missed is fetched now.
      if (hint === "gribouille.changed" || hint === "open") void refresh();
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      off();
      sub.remove();
    };
  }, [refresh]);

  return { room, offline, gone, transport, clockOffset: () => offset.current, refresh, apply };
}
