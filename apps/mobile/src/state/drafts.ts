import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "crew-draft:";
const SAVE_AFTER_MS = 400;
/** A draft older than this is a leftover, not something the user is still typing. */
const KEEP_MS = 3 * 24 * 3_600_000;

function persist(storageKey: string, pending: { current: string | null }): void {
  const next = pending.current;
  if (next === null) return;
  pending.current = null;
  const write = next.trim() ? AsyncStorage.setItem(storageKey, JSON.stringify({ value: next, at: Date.now() })) : AsyncStorage.removeItem(storageKey);
  void write.catch(() => undefined);
}

/**
 * QOL-07: text typed in a form survives the app being killed, backgrounded or
 * an error. `clear()` once the content was sent; a failed send keeps it.
 */
export function useDraft(key: string, initial = ""): [string, (next: string) => void, () => void] {
  const [value, setValue] = useState(initial);
  const touched = useRef(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = PREFIX + key;

  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!alive || !raw || touched.current) return;
        const saved = JSON.parse(raw) as { value: string; at: number };
        if (Date.now() - saved.at < KEEP_MS) setValue(saved.value);
        else void AsyncStorage.removeItem(storageKey);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [storageKey]);

  const set = useCallback(
    (next: string) => {
      touched.current = true;
      setValue(next);
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => persist(storageKey, pending), SAVE_AFTER_MS);
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    touched.current = true;
    setValue("");
    void AsyncStorage.removeItem(storageKey).catch(() => undefined);
  }, [storageKey]);

  // Leaving the screen saves what is still waiting, so the last keystrokes are kept too.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      persist(storageKey, pending);
    },
    [storageKey],
  );

  return [value, set, clear];
}
