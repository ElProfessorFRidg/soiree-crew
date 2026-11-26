import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { versionAllocation } from "./next-version.mjs";

it("continues after existing public and preview versions, independently of the build number", () => {
  const tags = ["v0.2.10+build.276", "v0.2.11-preview.25+build.286", "v0.1.50+build.200", "v0.2.80-build.250"];
  expect(versionAllocation("0.2.0", "289", tags, [])).toEqual({ version: "0.2.12", reserved: false });
  expect(versionAllocation("1.0.0", "289", tags, [])).toEqual({ version: "1.0.1", reserved: false });
});

it("moves past another run's reservation and reuses its own on retry", () => {
  const tag = "crew-version/v0.2.12";
  const reservations = [{ tag, owner: "build-289" }];
  expect(versionAllocation("0.2.0", "290", [tag], reservations)).toEqual({ version: "0.2.13", reserved: false });
  expect(versionAllocation("0.2.0", "289", [tag, "v0.2.13+build.290"], reservations)).toEqual({ version: "0.2.12", reserved: true });
  expect(() => versionAllocation("0.2.0", "", [], [])).toThrow();
});

it("reserves on published main, not the unpushed workflow-changing checkout, and reuses the same reservation on rerun", () => {
  const root = mkdtempSync(join(tmpdir(), "crew-version-"));
  const remote = join(root, "origin.git");
  const work = join(root, "work");
  const git = (...args) => execFileSync("git", args, { cwd: work, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const script = fileURLToPath(new URL("./next-version.mjs", import.meta.url));
  const run = (number, reserve = true) => execFileSync(process.execPath, [script], {
    cwd: work, encoding: "utf8", env: { ...process.env, GITHUB_RUN_NUMBER: String(number), RESERVE_VERSION: String(reserve) },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  try {
    mkdirSync(work);
    git("init", "--bare", remote);
    git("init", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    mkdirSync(join(work, ".github", "workflows"), { recursive: true });
    const workflow = join(work, ".github", "workflows", "build.yml");
    writeFileSync(workflow, "name: Before\n");
    git("add", ".");
    git("commit", "-m", "Published main");
    git("remote", "add", "origin", remote);
    git("push", "origin", "main");
    const anchor = git("rev-parse", "HEAD");
    git("checkout", "-b", "preview");
    writeFileSync(workflow, "name: After\n");
    git("commit", "-am", "Unpublished workflow change");
    expect(git("rev-parse", "HEAD")).not.toBe(anchor);

    // Reproduce the permission boundary with a real receive hook on POSIX.
    if (process.platform !== "win32") {
      writeFileSync(join(remote, "hooks", "pre-receive"), "#!/bin/sh\nwhile read old new ref; do\n  case \"$ref\" in refs/tags/crew-version/*) test \"$(git rev-parse \"$new^{commit}\")\" = \"$(git rev-parse refs/heads/main)\" || exit 1;; esac\ndone\n", { mode: 0o755 });
    }
    const first = run(381);
    expect(first).toMatch(/^version=\d+\.\d+\.\d+$/);
    const tag = "crew-version/v" + first.slice("version=".length);
    expect(git("rev-parse", tag + "^{commit}")).toBe(anchor);
    expect(git("for-each-ref", "--format=%(contents:subject)", "refs/tags/" + tag)).toBe("build-381");
    expect(run(381)).toBe(first);
    const second = run(382);
    expect(second).not.toBe(first);
    const refs = git("ls-remote", "--tags", "--refs", "origin");
    expect(run(383, false)).not.toBe(second);
    expect(git("ls-remote", "--tags", "--refs", "origin")).toBe(refs);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
