import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { planUpdate } from "./plan-ota.mjs";

const preview = {
  tag: "v0.2.12-preview.29+build.310",
  target: "iphone",
  projectId: "expo-project",
  paths: ["apps/mobile/src/i18n/fr.ts", "apps/mobile/src/ui/images/icon.png", "docs/OTA.md"],
  info: {
    target: "iphone",
    channel: "preview",
    updates: {
      projectId: "expo-project",
      version: "0.2.12",
      build: "310",
      stream: "preview-iphone",
      runtime: "crew-preview-iphone-310",
      serverConfig: createHash("sha256").update("\0").digest("hex"),
    },
  },
};

it("uses the exact IPA version and target when exporting an update", () => {
  expect(planUpdate(preview)).toEqual({
    version: "0.2.12", build: "310", stream: "preview-iphone", runtime: "crew-preview-iphone-310",
  });
});

it.each([
  "apps/mobile/native/startup/CrewStartupDiagnostics.swift",
  "apps/mobile/app.config.ts",
  "apps/mobile/package.json",
  "pnpm-lock.yaml",
  ".github/workflows/build.yml",
  "apps/mobile/src/module.swift",
])("requires a new IPA when %s changes", (path) => {
  expect(() => planUpdate({ ...preview, paths: [path] })).toThrow("require a new IPA");
});

it("rejects another device, build, channel, project or server configuration", () => {
  for (const changes of [
    { tag: "v0.2.12+build.310" },
    { tag: "v0.2.12-preview.29+build.311" },
    { target: "ipad" },
    { projectId: "other" },
    { serverUrl: "https://example.com" },
    { info: { target: "iphone", channel: "preview", updates: null } },
  ]) {
    expect(() => planUpdate({ ...preview, ...changes })).toThrow("must match the selected IPA");
  }
});
