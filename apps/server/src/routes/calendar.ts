import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertCrewMember, requireUser, type Context } from "../context";
import { hashToken, newToken } from "../crypto";
import { buildCalendar, type CalendarEvent } from "../icalendar";
import { audiencesOf, canSee } from "../profileRules";
import { crewTimeZone } from "../territory";
import { isTimeZone, nightOf, offsetMinutes, userClock } from "../time";

const DAY_MS = 24 * 3_600_000;
/** N-06: past parties stay in the feed this long, so last weekend is still there. */
const FEED_PAST_MS = 60 * DAY_MS;
/** QOL-21: how far ahead the crew tab looks for birthdays. */
const BIRTHDAY_DAYS = 14;

/** N-06: the feed is read by calendar apps, not the app, so its few words live here in both languages. */
const copy = {
  fr: { night: "Soirée du crew", goingOut: "Je sors", maybe: "Je sors peut-être", calendar: (crew: string) => `${crew} · Soirée Crew` },
  en: { night: "Crew night", goingOut: "Going out", maybe: "Maybe going out", calendar: (crew: string) => `${crew} · Soirée Crew` },
};

function addDays(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Local midnight of a night key in a time zone, ms UTC. */
function localMidnight(key: string, timeZone: string): number {
  const guess = Date.parse(`${key}T00:00:00Z`);
  return guess - offsetMinutes(guess, timeZone) * 60_000;
}

/** QOL-21: the next date (today included) a month and day comes round, 29 February falling on the 28th in other years. */
export function nextBirthday(today: string, month: number, day: number): string {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const last = new Date(Date.UTC(y, month, 0)).getUTCDate();
    const key = `${y}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
    if (key >= today) return key;
  }
  return today;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);

function feedUrl(ctx: Context, token: string): string {
  return `${ctx.publicUrl.replace(/\/+$/, "")}/v1/calendar/${token}.ics`;
}

export function calendarRoutes(app: FastifyInstance, ctx: Context): void {
  /** QOL-02: the phone reports its time zone; nights and birthdays are then counted on the person's clock. */
  app.put("/v1/me/clock", async (request) => {
    const user = requireUser(request);
    const input = z.object({ timeZone: z.string().min(1).max(64).refine(isTimeZone) }).parse(request.body);
    await ctx.db.query("update users set time_zone = $2 where id = $1", [user.id, input.timeZone]);
    return { ok: true };
  });

  /** N-06: my private feed link for this crew, if I made one. */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/calendar", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const row = (await ctx.db.query<{ sealed_token: string }>("select sealed_token from calendar_tokens where user_id = $1 and crew_id = $2", [user.id, request.params.id]))[0];
    return { url: row ? feedUrl(ctx, ctx.sealer.open<string>(row.sealed_token)) : null };
  });

  /** N-06: creates the link, or replaces it (the old one stops working at once). */
  app.post<{ Params: { id: string } }>("/v1/crews/:id/calendar", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const token = newToken();
    await ctx.db.transaction(async (tx) => {
      await tx.query("delete from calendar_tokens where user_id = $1 and crew_id = $2", [user.id, request.params.id]);
      await tx.query("insert into calendar_tokens (token_hash, sealed_token, user_id, crew_id, created_at) values ($1, $2, $3, $4, $5)", [
        hashToken(token),
        ctx.sealer.seal(token),
        user.id,
        request.params.id,
        ctx.now(),
      ]);
    });
    return { url: feedUrl(ctx, token) };
  });

  app.delete<{ Params: { id: string } }>("/v1/crews/:id/calendar", async (request, reply) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    await ctx.db.query("delete from calendar_tokens where user_id = $1 and crew_id = $2", [user.id, request.params.id]);
    return reply.status(204).send();
  });

  /**
   * N-06: the subscription itself, public because calendar apps send no token header. The link is
   * the secret: an unknown or revoked one, or one whose owner left the crew, is a bare 404.
   */
  app.get<{ Params: { token: string } }>("/v1/calendar/:token.ics", async (request, reply) => {
    const token = request.params.token;
    const notFound = () => reply.status(404).header("cache-control", "no-store").send({ error: "not_found" });
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return notFound();
    const row = (
      await ctx.db.query<{ user_id: string; crew_id: string; name: string }>(
        `select t.user_id, t.crew_id, c.name from calendar_tokens t join crews c on c.id = t.crew_id
         join crew_members m on m.crew_id = t.crew_id and m.user_id = t.user_id where t.token_hash = $1`,
        [hashToken(token)],
      )
    )[0];
    if (!row) return notFound();

    const now = ctx.now();
    const prefs = (await ctx.db.query<{ data: string }>("select data from user_preferences where user_id = $1", [row.user_id]))[0];
    const language = prefs && (JSON.parse(prefs.data) as { language?: string }).language === "fr" ? "fr" : "en";
    const words = copy[language];

    const parties = await ctx.db.query<{ id: string; name: string; starts_at: number; ends_at: number; closed_at: number | null; created_at: number }>(
      "select id, name, starts_at, ends_at, closed_at, created_at from parties where crew_id = $1 and ends_at >= $2 order by starts_at limit 500",
      [row.crew_id, now - FEED_PAST_MS],
    );
    const events: CalendarEvent[] = parties.map((p) => ({
      uid: `party-${p.id}@soiree-crew`,
      start: p.starts_at,
      end: Math.max(p.starts_at, p.closed_at ?? p.ends_at),
      summary: p.name.trim() || words.night,
      description: row.name,
      updatedAt: p.created_at,
    }));

    // The subscriber's own plans (N-01): nobody else's status ever goes into a feed.
    const clock = await userClock(ctx.db, row.user_id);
    const timeZone = clock.timeZone ?? (await crewTimeZone(ctx.db, row.crew_id));
    const tonight = nightOf(now, timeZone, clock.dayBoundaryHour);
    const plans = await ctx.db.query<{ night: string; status: string; from_minute: number | null; to_minute: number | null; place: string; updated_at: number }>(
      "select night, status, from_minute, to_minute, place, updated_at from night_statuses where user_id = $1 and night >= $2 and status in ('going_out', 'maybe') order by night",
      [row.user_id, addDays(tonight, -1)],
    );
    for (const plan of plans) {
      const summary = plan.status === "going_out" ? words.goingOut : words.maybe;
      const base = { uid: `night-${row.user_id}-${plan.night}@soiree-crew`, summary, location: plan.place || undefined, updatedAt: plan.updated_at };
      if (plan.from_minute === null) events.push({ ...base, date: plan.night });
      else {
        const start = localMidnight(plan.night, timeZone) + plan.from_minute * 60_000;
        const end = plan.to_minute === null ? start : localMidnight(plan.night, timeZone) + plan.to_minute * 60_000;
        events.push({ ...base, start, end });
      }
    }

    return reply
      .header("content-type", "text/calendar; charset=utf-8")
      .header("content-disposition", 'inline; filename="crew.ics"')
      // Private: only the holder of the link may cache it.
      .header("cache-control", "private, max-age=900")
      .send(buildCalendar({ name: words.calendar(row.name), now, events }));
  });

  /**
   * QOL-21: crew mates whose birthday comes in the next two weeks, for those allowed to see it
   * (profile audiences, crew mates by default). The year never comes along.
   */
  app.get<{ Params: { id: string } }>("/v1/crews/:id/birthdays", async (request) => {
    const user = requireUser(request);
    await assertCrewMember(ctx, request.params.id, user.id);
    const clock = await userClock(ctx.db, user.id);
    const timeZone = clock.timeZone ?? (await crewTimeZone(ctx.db, request.params.id));
    const now = ctx.now();
    const today = new Date(now + offsetMinutes(now, timeZone) * 60_000).toISOString().slice(0, 10);
    const rows = await ctx.db.query<{ user_id: string; display_name: string; audiences: string; birth_month: number; birth_day: number; friend: boolean }>(
      `select m.user_id, u.display_name, p.audiences, p.birth_month, p.birth_day,
              exists (select 1 from friendships f where f.status = 'accepted'
                      and ((f.user_a = $2 and f.user_b = m.user_id) or (f.user_b = $2 and f.user_a = m.user_id))) as friend
       from crew_members m join users u on u.id = m.user_id join profiles p on p.user_id = m.user_id
       where m.crew_id = $1 and m.user_id <> $2 and p.birth_month is not null and p.birth_day is not null
         and not exists (select 1 from blocks b where (b.blocker = $2 and b.blocked = m.user_id) or (b.blocker = m.user_id and b.blocked = $2))`,
      [request.params.id, user.id],
    );
    const birthdays = rows
      .filter((r) => canSee(audiencesOf(JSON.parse(r.audiences) as Record<string, unknown>).birthday, { me: false, friend: r.friend, crewMate: true }))
      .map((r) => {
        const date = nextBirthday(today, r.birth_month, r.birth_day);
        return { userId: r.user_id, name: r.display_name, month: r.birth_month, day: r.birth_day, date, inDays: daysBetween(today, date) };
      })
      .filter((b) => b.inDays <= BIRTHDAY_DAYS)
      .sort((a, b) => a.inDays - b.inDays || a.name.localeCompare(b.name));
    return { today, birthdays };
  });
}

