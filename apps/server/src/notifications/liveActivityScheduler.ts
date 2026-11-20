import type { Context } from "../context";
import { activityKitPayload, type LiveActivityPush } from "./apns";

// A standard Live Activity is active for at most eight hours on iOS.
const PUSH_INTERVAL_MS = 5 * 60_000;
const RETRY_INTERVAL_MS = 30_000;
const ROLLOVER_WINDOW_MS = 10 * 60_000;
const SNAPSHOT_FRESH_MS = 15 * 60_000;

/** A remote restart must never present a cached reading or alert as newly observed. */
export function sanitizeRolloverSnapshot(snapshot: Record<string, unknown>, now: number): Record<string, unknown> {
  const copy = { ...snapshot };
  const sampledAt = copy.generatedAt;
  if (typeof sampledAt !== "number" || !Number.isFinite(sampledAt) || sampledAt > now + 60_000 || now - sampledAt > SNAPSHOT_FRESH_MS) {
    for (const key of ["bac", "bacForecast", "status", "drive", "under", "bacColor", "limitFrac"]) delete copy[key];
    if (copy.party && typeof copy.party === "object" && !Array.isArray(copy.party)) {
      const party = { ...(copy.party as Record<string, unknown>) };
      delete party.alert;
      copy.party = party;
    }
  }
  return copy;
}

/** Remove safety-sensitive readings from periodic APNs pushes when the device
 * has stopped providing snapshots; resending the same payload is not a new
 * measurement. The countdown can continue independently. */
export function sanitizeScheduledState(state: Record<string, unknown>, now: number): Record<string, unknown> {
  const copy = { ...state };
  if (typeof copy.subtitle !== "string") return copy;
  try {
    const decoded: unknown = JSON.parse(copy.subtitle);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      copy.subtitle = null;
      return copy;
    }
    copy.subtitle = JSON.stringify(sanitizeRolloverSnapshot(decoded as Record<string, unknown>, now));
  } catch {
    copy.subtitle = null;
  }
  return copy;
}

interface DueActivity {
  token_hash: string;
  token_sealed: string;
  state_sealed: string;
  expires_at: number;
}

/** One-at-a-time scheduler. DB claims avoid duplicate sends across multiple server replicas. */
export async function sweepActivityPushes(ctx: Context, log: (event: string, details: Record<string, unknown>) => void = () => undefined): Promise<void> {
  const now = ctx.now();
  if (!ctx.push?.enabled("ios")) return;
  // Rotate at most once per old generation, even with multiple workers.
  // The remote start does not guarantee delivery: keep the old generation until its Apple limit.
  const rotations = await ctx.db.query<{
    session_hash:string; token_sealed:string; state_sealed:string; attributes_sealed:string;
  }>(`update live_activity_start_devices s set rotation_pending_at=$1
      where session_hash in (
        select s2.session_hash from live_activity_start_devices s2
        join live_activity_devices a on a.session_hash=s2.session_hash
        where a.state_sealed is not null and a.attributes_sealed is not null
          and a.expires_at > $1 and a.expires_at <= $1 + $2
          -- Only the newest registered generation may trigger a rollover. Old generations
          -- must never restart another activity after a newer one is already running.
          and a.created_at = (select max(latest.created_at) from live_activity_devices latest where latest.session_hash=s2.session_hash)
          and (s2.rotation_pending_at is null or s2.rotation_pending_at < a.created_at)
        order by a.expires_at limit 20 for update of s2 skip locked
      ) returning s.session_hash,s.token_sealed,
        (select a.state_sealed from live_activity_devices a where a.session_hash=s.session_hash order by a.created_at desc limit 1) as state_sealed,
        (select a.attributes_sealed from live_activity_devices a where a.session_hash=s.session_hash order by a.created_at desc limit 1) as attributes_sealed`,
    [now,ROLLOVER_WINDOW_MS]);
  for (const item of rotations) {
    try {
      const contentState=ctx.sealer.open<Record<string,unknown>>(item.state_sealed);
      const attributes=ctx.sealer.open<Record<string,unknown>>(item.attributes_sealed);
      attributes.startedAt=now;
      // Do not restart an already ended night from a cached snapshot.
      const snapshot = JSON.parse(String(contentState.subtitle ?? "{}")) as {zeroAt?:number|null;party?:{endsAt?:number}|null;bacForecast?:unknown;generatedAt?:number};
      if (!(typeof snapshot.zeroAt === "number" && snapshot.zeroAt > now) &&
          !(typeof snapshot.party?.endsAt === "number" && snapshot.party.endsAt > now)) {
        log("activitykit.rollover",{outcome:"night_ended"});
        continue;
      }
      contentState.subtitle = JSON.stringify(sanitizeRolloverSnapshot(snapshot as Record<string, unknown>, now));
      const token=ctx.sealer.open<string>(item.token_sealed);
      const message: LiveActivityPush={token,event:"start",contentState,attributes,timestamp:now};
      // Shrink BEFORE sending: retrying a timeout with a different payload could start two activities.
      if (Buffer.byteLength(JSON.stringify(activityKitPayload(message)),"utf8") > 4096) {
        const slim = JSON.parse(String(contentState.subtitle)) as Record<string, unknown>;
        delete slim.bacForecast;
        contentState.subtitle=JSON.stringify(slim);
      }
      if (Buffer.byteLength(JSON.stringify(activityKitPayload(message)),"utf8") > 4096) {
        log("activitykit.rollover",{outcome:"oversized"});
        continue;
      }
      const result=await ctx.push.sendLiveActivity(message);
      log("activitykit.rollover",{outcome:result});
      if (result==="gone") await ctx.db.query("delete from live_activity_start_devices where session_hash=$1",[item.session_hash]);
      // An APNs timeout may still have delivered a remote start. Never retry the same
      // generation blindly: it can create two activities on the lock screen.
      // A subsequent device registration (new created_at) re-arms the next generation.
    } catch {
      log("activitykit.rollover",{outcome:"exception"});
      // Keep the claim on uncertain delivery for the same deduplication reason.
    }
  }
  await ctx.db.query("delete from live_activity_devices where expires_at <= $1", [now]);
  const due = await ctx.db.query<DueActivity>(
    `update live_activity_devices set next_push_at = $2, last_push_at = $1
     where token_hash in (
       select token_hash from live_activity_devices
       where next_push_at <= $1 and expires_at > $1 and state_sealed is not null
       order by next_push_at limit 50 for update skip locked
     ) returning token_hash, token_sealed, state_sealed, expires_at`,
    [now, now + PUSH_INTERVAL_MS],
  );
  if (due.length) log("activitykit.batch", { count: due.length });
  for (const row of due) {
    try {
      const token = ctx.sealer.open<string>(row.token_sealed);
      const contentState = sanitizeScheduledState(ctx.sealer.open<Record<string, unknown>>(row.state_sealed), now);
      const result = await ctx.push.sendLiveActivity({ token, event: "update", contentState, timestamp: now, staleDate: Math.min(row.expires_at, now + 15 * 60_000) });
      log("activitykit.delivery", { outcome: result }); // Never log tokens, state, BAC or user identifiers.
      if (result === "gone") await ctx.db.query("delete from live_activity_devices where token_hash = $1", [row.token_hash]);
      if (result === "error") await ctx.db.query("update live_activity_devices set next_push_at = $2 where token_hash = $1 and next_push_at = $3", [row.token_hash, now + RETRY_INTERVAL_MS, now + PUSH_INTERVAL_MS]);
    } catch {
      log("activitykit.delivery", { outcome: "exception" });
      // Do not silently disable the activity after a transient failure; retry until expiry.
      await ctx.db.query("update live_activity_devices set next_push_at = $2 where token_hash = $1 and next_push_at = $3", [row.token_hash, now + RETRY_INTERVAL_MS, now + PUSH_INTERVAL_MS]);
    }
  }
}

export function startActivityPushScheduler(ctx: Context, onError: (error: unknown) => void, log: (event: string, details: Record<string, unknown>) => void = () => undefined): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await sweepActivityPushes(ctx, log); } catch (error) { onError(error); }
    finally { running = false; }
  };
  const interval = setInterval(() => { void tick(); }, 60_000);
  interval.unref();
  void tick();
  return () => clearInterval(interval);
}
