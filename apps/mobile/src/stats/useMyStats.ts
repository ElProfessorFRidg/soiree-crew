import { useEffect, useMemo, useState } from "react";
import { fetchMyStats, type MyStats, type StatsFilter } from "@/server/statsData";
import { useSession } from "@/server/session";

/**
 * N-13, N-16: my habits and filters from the server. My drinks stay on the phone; the server says
 * which nights a venue or a person keeps, and the screen filters its own figures on those nights.
 * Without an account nothing is asked and nothing is filtered.
 */
export function useMyStats(): {
  data: MyStats | null;
  filter: StatsFilter;
  setFilter: (next: StatsFilter) => void;
  /** Night keys to keep, null when nothing is filtered (or the server's answer is not there yet). */
  nights: ReadonlySet<string> | null;
} {
  const signedIn = useSession((state) => !!state.session);
  const [filter, setFilter] = useState<StatsFilter>({});
  const [data, setData] = useState<MyStats | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    void fetchMyStats(filter)
      .then((next) => {
        if (current) setData(next);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [signedIn, filter]);
  const filtering = !!(filter.venueId || filter.userId);
  // While the filtered answer is on its way, an empty set shows nothing rather than everything.
  const nights = useMemo(() => (filtering ? new Set(data?.nights ?? []) : null), [filtering, data]);
  return { data, filter, setFilter, nights };
}
