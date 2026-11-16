/** Ignore responses from an obsolete screen context or an older overlapping refresh. */
export function latestRequest<T>(fetch: () => Promise<T>, publish: (value: T) => void) {
  let generation = 0;
  let disposed = false;
  return {
    async load(): Promise<void> {
      if (disposed) return;
      const request = ++generation;
      try {
        const value = await fetch();
        if (!disposed && request === generation) publish(value);
      } catch {
        // A failed refresh leaves the last successful snapshot in place.
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
