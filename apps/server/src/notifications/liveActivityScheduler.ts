import type { Context } from "../context";

// A standard Live Activity is active for at most eight hours on iOS.
const PUSH_INTERVAL_MS = 5 * 60_000;
const RETRY_INTERVAL_MS = 30_000;

interface DueActivity {
  token_hash: string;
  token_sealed: string;
  state_sealed: string;
  expires_at: number;
}

/** One-at-a-time scheduler. DB claims avoid duplicate sends across multiple server replicas. */
export async function sweepActivityPushes(ctx: Context, log: (event: string, details: Record<string, unknown>) => void = () => undefined): Promise<void> {
  const now = ctx.now();
  await ctx.db.query("delete from live_activity_devices where expires_at <= $1", [now]);
  if (!ctx.push?.enabled("ios")) return;
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
      const contentState = ctx.sealer.open<Record<string, unknown>>(row.state_sealed);
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
