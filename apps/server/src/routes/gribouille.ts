import { randomInt, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  GRIBOUILLE_LANGUAGES,
  GRIBOUILLE_MAX_PLAYERS,
  GRIBOUILLE_REVEAL_MS,
  GribouilleError,
  addGribouilleStrokes,
  advanceGribouille,
  coalesceDrawingEvents,
  createGribouille,
  guessGribouille,
  joinGribouille,
  leaveGribouille,
  mathRandom,
  startGribouille,
  swapGribouilleWord,
  touchGribouille,
  viewGribouille,
  type DrawingEvent,
  type GribouilleErrorCode,
  type GribouilleRoom,
} from "@crew/games";
import { assertCrewMember, HttpError, requireUser, type Context } from "../context";
import { RateLimiter } from "../ratelimit";
import { isAbusive } from "../textFilter";

const HOUR_MS = 3_600_000;
/** A room nobody touched for this long is dropped; a finished one goes sooner. */
const ROOM_IDLE_MS = 4 * HOUR_MS;
const FINISHED_KEEP_MS = 30 * 60_000;
/** No 0, O, 1, I or L: a code read aloud across a table must not be ambiguous. */
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";

const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("stroke.start"), id: z.string().min(1).max(40), colour, width: z.number().min(0.004).max(0.08), point }),
  z.object({ type: z.literal("stroke.extend"), id: z.string().min(1).max(40), points: z.array(point).min(1).max(300) }),
  z.object({ type: z.literal("clear") }),
  z.object({ type: z.literal("undo") }),
]);

const STATUS: Record<GribouilleErrorCode, number> = {
  full: 409,
  started: 409,
  bad_phase: 409,
  no_swap: 409,
  not_host: 403,
  not_drawer: 403,
  not_in_room: 404,
  not_enough_players: 400,
  too_many_events: 429,
};

/** The engine's refusals leave as the same HttpError codes the rest of the API uses. */
function guarded<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof GribouilleError) throw new HttpError(STATUS[error.code], error.code);
    throw error;
  }
}

/**
 * O-63 Gribouille online. Rooms live in memory: a game lasts minutes and a server restart only costs the
 * game in progress. The live socket carries hints ("gribouille.changed"), never data: a phone then asks
 * for the room (and the strokes since the last one it has), so the word stays on the server and the access
 * rules live in one place. The engine is in @crew/games; this file is its transport.
 */
export function gribouilleRoutes(app: FastifyInstance, ctx: Context): void {
  const rooms = new Map<string, GribouilleRoom>();
  const byCode = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const creates = new RateLimiter(12, HOUR_MS, ctx.now);
  const strokes = new RateLimiter(900, 60_000, ctx.now);
  const joins = new RateLimiter(20, 10 * 60_000, ctx.now);
  const joinsByAddress = new RateLimiter(60, 10 * 60_000, ctx.now);
  const guesses = new RateLimiter(120, 60_000, ctx.now);
  const rng = mathRandom;

  const sweeper = setInterval(sweep, 10 * 60_000);
  sweeper.unref();

  app.addHook("onClose", async () => {
    clearInterval(sweeper);
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });

  const tell = (room: GribouilleRoom, except?: string) =>
    ctx.live.notify(room.players.filter((p) => !p.left && p.id !== except).map((p) => p.id), { type: "gribouille.changed", roomId: room.id });

  /** Wakes the room when the next deadline passes, so a turn ends on time even if every phone is asleep. */
  function schedule(room: GribouilleRoom): void {
    const old = timers.get(room.id);
    if (old) clearTimeout(old);
    timers.delete(room.id);
    const turn = room.turn;
    if (!turn || (room.phase !== "drawing" && room.phase !== "reveal")) return;
    const deadline = room.phase === "drawing" ? turn.startedAt + turn.timeLimitMs : (turn.endedAt ?? ctx.now()) + GRIBOUILLE_REVEAL_MS;
    const timer = setTimeout(() => {
      timers.delete(room.id);
      try {
        if (advanceGribouille(room, ctx.now(), rng)) tell(room);
        schedule(room);
      } catch (error) {
        app.log.error({ err: error, roomId: room.id }, "gribouille: advancing the room failed");
      }
    }, Math.max(250, deadline - ctx.now()));
    timer.unref();
    timers.set(room.id, timer);
  }

  function forget(room: GribouilleRoom): void {
    rooms.delete(room.id);
    byCode.delete(room.code);
    const timer = timers.get(room.id);
    if (timer) clearTimeout(timer);
    timers.delete(room.id);
  }

  function sweep(): void {
    const now = ctx.now();
    for (const room of rooms.values()) {
      const lastSeen = Math.max(...room.players.map((p) => p.lastSeen));
      if (now - lastSeen > (room.phase === "end" ? FINISHED_KEEP_MS : ROOM_IDLE_MS)) forget(room);
    }
  }

  function roomOf(id: string): GribouilleRoom {
    const room = rooms.get(id);
    if (!room) throw new HttpError(404, "not_found");
    return room;
  }

  /** Brings the room up to date with the clock, and tells the others when that changed anything. */
  function fresh(room: GribouilleRoom): void {
    if (advanceGribouille(room, ctx.now(), rng)) {
      tell(room);
      schedule(room);
    }
  }

  function newCode(): string {
    for (;;) {
      const code = Array.from({ length: 4 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join("");
      if (!byCode.has(code)) return code;
    }
  }

  async function nameOf(userId: string): Promise<string> {
    const rows = await ctx.db.query<{ display_name: string }>("select display_name from users where id = $1", [userId]);
    return rows[0]?.display_name ?? "?";
  }

  const createSchema = z.object({
    crewId: z.string().uuid().nullable().optional(),
    language: z.enum(GRIBOUILLE_LANGUAGES),
    level: z.enum(["normal", "hard", "extreme"]).default("normal"),
    rounds: z.number().int().min(1).max(3).default(2),
  });

  app.post("/v1/gribouille", async (request, reply) => {
    const user = requireUser(request);
    const input = createSchema.parse(request.body);
    creates.check(user.id);
    if (input.crewId) await assertCrewMember(ctx, input.crewId, user.id);
    sweep();
    const room = createGribouille({
      id: randomUUID(),
      code: newCode(),
      hostId: user.id,
      hostName: await nameOf(user.id),
      crewId: input.crewId ?? null,
      language: input.language,
      level: input.level,
      rounds: input.rounds,
      now: ctx.now(),
    });
    rooms.set(room.id, room);
    byCode.set(room.code, room.id);
    // The crew sees a game waiting in its Games tab.
    if (room.crewId) {
      const members = await ctx.db.query<{ user_id: string }>("select user_id from crew_members where crew_id = $1 and user_id <> $2", [room.crewId, user.id]);
      ctx.live.notify(members.map((m) => m.user_id), { type: "gribouille.changed", roomId: room.id });
    }
    return reply.status(201).send(viewGribouille(room, user.id, ctx.now()));
  });

  /** Lobbies of the crews I am in, so a friend's game is one tap away. */
  app.get("/v1/gribouille/open", async (request) => {
    const user = requireUser(request);
    const mine = await ctx.db.query<{ crew_id: string }>("select crew_id from crew_members where user_id = $1", [user.id]);
    const crews = new Set(mine.map((m) => m.crew_id));
    const open = [...rooms.values()].filter((room) => room.phase === "lobby" && room.crewId && crews.has(room.crewId) && room.players.length < GRIBOUILLE_MAX_PLAYERS);
    return {
      rooms: open.map((room) => ({ id: room.id, code: room.code, crewId: room.crewId, language: room.language, level: room.level, host: room.players.find((p) => p.id === room.hostId)?.name ?? "", players: room.players.length })),
    };
  });

  app.post("/v1/gribouille/join", async (request) => {
    const user = requireUser(request);
    joins.check(user.id);
    joinsByAddress.check(request.ip);
    const { code } = z.object({ code: z.string().trim().min(4).max(4) }).parse(request.body);
    const id = byCode.get(code.toUpperCase());
    if (!id) throw new HttpError(404, "not_found");
    const room = roomOf(id);
    const known = room.players.some((p) => p.id === user.id);
    guarded(() => joinGribouille(room, user.id, "", ctx.now()));
    if (!known) {
      // The name is only fetched for a new seat; a returning player keeps the one they had.
      const player = room.players.find((p) => p.id === user.id);
      if (player) player.name = await nameOf(user.id);
    }
    fresh(room);
    tell(room, user.id);
    return viewGribouille(room, user.id, ctx.now());
  });

  /** The state of the room, and the strokes after `since`: what a phone asks for after a hint, a poll or a reconnection. */
  app.get<{ Params: { id: string }; Querystring: { since?: string } }>("/v1/gribouille/:id", async (request) => {
    const user = requireUser(request);
    const room = roomOf(request.params.id);
    guarded(() => touchGribouille(room, user.id, ctx.now()));
    fresh(room);
    const since = Number(request.query.since ?? 0);
    return viewGribouille(room, user.id, ctx.now(), Number.isFinite(since) ? since : 0);
  });

  app.post<{ Params: { id: string } }>("/v1/gribouille/:id/start", async (request) => {
    const user = requireUser(request);
    const room = roomOf(request.params.id);
    fresh(room);
    guarded(() => startGribouille(room, user.id, ctx.now(), rng));
    schedule(room);
    tell(room, user.id);
    return viewGribouille(room, user.id, ctx.now());
  });

  app.post<{ Params: { id: string } }>("/v1/gribouille/:id/strokes", async (request) => {
    const user = requireUser(request);
    strokes.check(user.id);
    const { events } = z.object({ events: z.array(eventSchema).min(1).max(120) }).parse(request.body);
    const room = roomOf(request.params.id);
    fresh(room);
    const count = guarded(() => addGribouilleStrokes(room, user.id, coalesceDrawingEvents(events as DrawingEvent[]), ctx.now()));
    tell(room, user.id);
    return { count };
  });

  app.post<{ Params: { id: string } }>("/v1/gribouille/:id/guess", async (request) => {
    const user = requireUser(request);
    guesses.check(user.id);
    const { text } = z.object({ text: z.string().trim().min(1).max(80) }).parse(request.body);
    const room = roomOf(request.params.id);
    fresh(room);
    const outcome = guarded(() => guessGribouille(room, user.id, text, ctx.now(), isAbusive(text)));
    fresh(room);
    tell(room, user.id);
    return { result: outcome.result, points: outcome.result === "correct" ? outcome.points : 0 };
  });

  app.post<{ Params: { id: string } }>("/v1/gribouille/:id/swap", async (request) => {
    const user = requireUser(request);
    const room = roomOf(request.params.id);
    fresh(room);
    guarded(() => swapGribouilleWord(room, user.id, ctx.now(), rng));
    return viewGribouille(room, user.id, ctx.now());
  });

  app.post<{ Params: { id: string } }>("/v1/gribouille/:id/leave", async (request, reply) => {
    const user = requireUser(request);
    const room = rooms.get(request.params.id);
    if (!room) return reply.status(204).send();
    guarded(() => leaveGribouille(room, user.id, ctx.now(), rng));
    if (room.players.every((p) => p.left) || room.players.length === 0) forget(room);
    else {
      schedule(room);
      tell(room, user.id);
    }
    return reply.status(204).send();
  });
}
