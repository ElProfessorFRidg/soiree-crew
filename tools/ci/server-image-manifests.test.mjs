import { readFileSync, readdirSync, existsSync } from "node:fs";
import { expect, it } from "vitest";

// The server image installs from package.json files copied one by one (so a code change keeps the install layer).
// A workspace package added without a COPY line would install fine and then fail at runtime: catch it here.
const dockerfile = readFileSync("apps/server/Dockerfile", "utf8");
const copied = [...dockerfile.matchAll(/^COPY (\S+\/package\.json) \.\/(\S+)\/$/gm)].map((m) => ({ from: m[1], to: m[2] }));

const workspace = [...readdirSync("packages").filter((d) => existsSync(`packages/${d}/package.json`)).map((d) => `packages/${d}`), "apps/server"];

it("copies the manifest of every package the server can depend on", () => {
  expect(copied.map((c) => c.to).sort()).toEqual([...workspace].sort());
});

it("copies each manifest to the directory it came from, and none that is gone", () => {
  for (const { from, to } of copied) {
    expect(from).toBe(`${to}/package.json`);
    expect(existsSync(from), `${from} does not exist`).toBe(true);
  }
});

it("installs before the code is copied, so a code change reuses the install layer", () => {
  const install = dockerfile.indexOf("pnpm install");
  expect(install).toBeGreaterThan(0);
  expect(dockerfile.indexOf("COPY packages ./packages")).toBeGreaterThan(install);
  expect(dockerfile.indexOf("COPY apps/server ./apps/server")).toBeGreaterThan(install);
});

it("runs as the unprivileged user", () => {
  expect(dockerfile).toMatch(/^USER node$/m);
});
