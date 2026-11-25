import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { addedNativeImports } from "./native-imports.mjs";

it("detects newly introduced native imports", () => {
  expect(addedNativeImports(
    "import {x} from 'expo-camera'",
    "import {x} from 'expo-camera'; import('expo-location'); require('react-native-svg')",
  )).toEqual(["expo-location", "react-native-svg"]);
});

it("ignores pure JS imports", () => {
  expect(addedNativeImports("", "import {x} from 'zustand'")).toEqual([]);
});

it("reuses shipped workspace imports but rejects native imports previously used only in tests", () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-native-imports-"));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const source = new URL("./native-imports.mjs", import.meta.url).href;

  try {
    git("init", "-q");
    git("config", "user.email", "ci@example.test");
    git("config", "user.name", "CI");
    mkdirSync(join(cwd, "packages/games/src"), { recursive: true });
    mkdirSync(join(cwd, "apps/mobile/src"), { recursive: true });
    writeFileSync(join(cwd, "packages/games/src/course.ts"), "import { x } from\n 'expo-location';\n");
    writeFileSync(join(cwd, "apps/mobile/src/camera.test.ts"), "import 'expo-camera';\n");
    git("add", ".");
    git("commit", "-qm", "IPA baseline");
    const baseline = git("rev-parse", "HEAD");
    writeFileSync(join(cwd, "apps/mobile/src/camera.ts"), "import 'expo-location';\nimport 'expo-camera';\n");
    git("add", ".");
    git("commit", "-qm", "OTA candidate");

    const result = execFileSync(process.execPath, [
      "--input-type=module", "-e",
      "const { newNativeRequirements } = await import(process.argv[1]); console.log(JSON.stringify(newNativeRequirements(process.argv[2])));",
      source, baseline,
    ], { cwd, encoding: "utf8" });

    expect(JSON.parse(result)).toEqual(["expo-camera"]);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
