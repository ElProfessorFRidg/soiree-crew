import { expect, it } from "vitest";
import { classify, lockImporterOnly } from "./change-impact.mjs";
it.each(["README.md","packages/games/README.md","apps/server/package.json","research/example.py","tools/catalog.py","apps/mobile/src/game.test.ts","tools/ci/change-impact.mjs"])("checks only: %s", p => expect(classify(p)).toBe("checks"));
it.each(["apps/mobile/src/game.tsx","packages/mls/src/runtime.ts","apps/mobile/src/sound.m4a"])("OTA: %s", p => expect(classify(p)).toBe("ota"));
it.each(["apps/mobile/app.config.ts","apps/mobile/package.json","pnpm-lock.yaml","tools/ci/check-ios-app.py","apps/mobile/native/startup/CrewStartupDiagnostics.swift",".github/workflows/build.yml"])("native risk: %s", p => expect(classify(p)).toBe("ipa"));
it("only accepts importer-only server changes", () => {
  const lock = "lockfileVersion: '9.0'\nimporters:\n  apps/server:\n    dependencies:\n      foo: {}\n  apps/mobile:\n    dependencies:\n      bar: {}\npackages:\n  foo@1: {}\n";
  expect(lockImporterOnly(lock,lock.replace("foo: {}","foo: {specifier: 1}"))).toBe(true);
  expect(lockImporterOnly(lock,lock.replace("bar: {}","bar: {specifier: 1}"))).toBe(false);
  expect(lockImporterOnly(lock,lock.replace("foo@1","foo@2"))).toBe(false);
});
