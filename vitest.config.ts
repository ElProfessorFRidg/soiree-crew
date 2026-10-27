import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/server/src/**/*.test.ts", "tools/**/*.test.mjs"],
    // Server tests boot a PGlite database per test: slow on a loaded machine, so give them room.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
