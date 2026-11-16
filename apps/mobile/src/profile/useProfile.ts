import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState, type SetStateAction } from "react";
import { fetchProfile, type ProfileView } from "@/server/profileData";
import { useSession } from "@/server/session";

/** A profile belongs to its account, server, target and privacy preview, including while hidden. */
export function useProfile(userId = "me", as?: "stranger" | "friend" | "crew") {
  const session = useSession((state) => state.session);
  const context = useMemo(() => ({ session, userId, as }), [session, userId, as]);
  const [state, setState] = useState<{ context: typeof context; profile: ProfileView | null; error: unknown; loading: boolean }>(() => ({ context, profile: null, error: null, loading: !!session }));
  const active = useRef(false);
  const sequence = useRef(0);

  const load = useCallback(async (recheckCompatibility = false) => {
    const request = ++sequence.current;
    // Only my own view keeps an offline snapshot; public previews and other people need a fresh permission check.
    const keepPrevious = (previous: typeof state) => previous.context === context && context.userId === "me" && !context.as ? previous.profile : null;
    if (!context.session) {
      setState({ context, profile: null, error: null, loading: false });
      return;
    }
    setState((previous) => ({ context, profile: keepPrevious(previous), error: null, loading: true }));
    try {
      const profile = await fetchProfile(context.userId, context.as, { recheckCompatibility });
      if (active.current && request === sequence.current) setState({ context, profile, error: null, loading: false });
    } catch (error) {
      if (active.current && request === sequence.current) {
        setState((previous) => ({ context, profile: keepPrevious(previous), error, loading: false }));
        return error;
      }
    }
  }, [context]);
  const refresh = useCallback(async () => {
    const error = await load(true);
    if (error) throw error;
  }, [load]);

  useFocusEffect(useCallback(() => {
    active.current = true;
    void load();
    return () => { active.current = false; sequence.current += 1; };
  }, [load]));

  const setProfile = useCallback((update: SetStateAction<ProfileView | null>) => {
    setState((previous) => previous.context !== context ? previous : { ...previous, profile: typeof update === "function" ? update(previous.profile) : update });
  }, [context]);
  // Hide a previous account or wider preview synchronously, before the focus effect starts.
  const current = state.context === context ? state : { profile: null, error: null, loading: !!session };
  return { ...current, context, connected: !!session, refresh, setProfile };
}
