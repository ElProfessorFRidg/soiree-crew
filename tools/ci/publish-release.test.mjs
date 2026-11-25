import { expect, it } from "vitest";
import { releasePlan, retrying } from "./publish-release.mjs";

const base = { version: "0.2.5", build: 115, sha: "a".repeat(40) };
it("publishes previews under immutable tags without moving public latest or consuming a public patch", () => {
  const plan = releasePlan({ ...base, channel: "preview", pr: 4 });
  expect(plan.tag).toBe("v0.2.5-preview.4+build.115");
  expect(plan.flags).toEqual(["--prerelease", "--latest=false"]);
});
it("keeps the public tag scheme and latest link", () => {
  expect(releasePlan({ ...base, channel: "public" })).toMatchObject({ tag: "v0.2.5+build.115", flags: ["--latest=true"] });
});
it("refuses missing PR identity, unknown channels and non-version strings before publishing", () => {
  expect(() => releasePlan({ ...base, channel: "preview" })).toThrow();
  expect(() => releasePlan({ ...base, channel: "beta" })).toThrow();
  expect(() => releasePlan({ ...base, version: "latest", channel: "public" })).toThrow();
});
it("retries a step that GitHub answered with a 5xx, then gives up after the last attempt", () => {
  const waits = [];
  let calls = 0;
  const flaky = () => {
    if (++calls < 3) throw new Error("HTTP 500");
    return "done";
  };
  expect(retrying(flaky, { sleep: (ms) => waits.push(ms) })).toBe("done");
  expect(calls).toBe(3);
  expect(waits).toEqual([5000, 15000]);
  expect(() => retrying(() => { throw new Error("HTTP 500"); }, { attempts: 2, sleep: () => undefined })).toThrow("HTTP 500");
});
