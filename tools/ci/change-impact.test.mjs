import { expect, it } from "vitest";
import { classify } from "./change-impact.mjs";
it.each(["README.md","packages/games/README.md","apps/server/package.json","research/example.py","tools/catalog.py","apps/mobile/src/game.test.ts","tools/ci/change-impact.mjs","tools/ci/dependency-impact-test.py"])("checks only: %s", p => expect(classify(p)).toBe("checks"));
it.each(["apps/mobile/src/game.tsx","packages/mls/src/runtime.ts","apps/mobile/src/sound.m4a"])("OTA: %s", p => expect(classify(p)).toBe("ota"));
it.each(["apps/mobile/app.config.ts","apps/mobile/package.json","pnpm-lock.yaml","tools/ci/check-ios-app.py","apps/mobile/native/startup/CrewStartupDiagnostics.swift",".github/workflows/build.yml",".github/workflows/ota.yml","apps/mobile/native/tests/bridge.swift",".github/actions/build/action.yml"])("native risk: %s", p => expect(classify(p)).toBe("ipa"));
