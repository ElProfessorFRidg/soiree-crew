// Tells the PR how a change reaches the phones: OTA update, new IPA (and why), or checks only.
// Preview decisions update one comment on the PR; a push to main adds the public decision to the
// merged PR. The reason comes from the build workflow's route step (plan-ota.mjs, select-ota-base.mjs).
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const HEADLINES = {
  ota: "🔁 **OTA update.** Installed apps get this change at their next launch, no new IPA needed.",
  ipa: "⚠️ **New IPA needed.** This change cannot reach the installed apps over the air.",
  checks: "✅ **Checks only.** Nothing changes on the phones.",
};

export function deliveryComment({ route, reason, version, channel, sha, runUrl }) {
  const [title, ...details] = String(reason ?? "").trim().split("\n");
  const marker = `<!-- crew-delivery-${channel} -->`;
  const lines = [marker, `### 📱 ${channel === "preview" ? "Preview" : "Public"}: delivery to phones`, "", HEADLINES[route] ?? HEADLINES.ipa, "", title];
  if (details.length) lines.push("", ...details);
  if (route === "ipa" && version) lines.push("", `The new IPA is \`${version}\`. Install it from AltStore or the Versions screen once the build is done.`);
  lines.push("", `<sub>\`${sha.slice(0, 7)}\` · [workflow run](${runUrl})</sub>`);
  return { marker, body: lines.join("\n") };
}

function main() {
  const env = process.env;
  const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });
  const repo = env.GITHUB_REPOSITORY;
  const preview = Boolean(env.PR_NUMBER);
  const pr = env.PR_NUMBER || JSON.parse(gh("api", `repos/${repo}/commits/${env.GITHUB_SHA}/pulls`))[0]?.number;
  const { marker, body } = deliveryComment({
    route: env.ROUTE, reason: env.REASON, version: env.VERSION, channel: preview ? "preview" : "public",
    sha: env.GITHUB_SHA, runUrl: `${env.GITHUB_SERVER_URL}/${repo}/actions/runs/${env.GITHUB_RUN_ID}`,
  });
  console.log(body);
  if (!pr) return;
  const comments = JSON.parse(gh("api", "--paginate", "--slurp", `repos/${repo}/issues/${pr}/comments?per_page=100`)).flat();
  const mine = comments.find((c) => c.user?.login === "github-actions[bot]" && c.body?.includes(marker));
  if (mine) gh("api", "-X", "PATCH", `repos/${repo}/issues/comments/${mine.id}`, "-f", `body=${body}`);
  else gh("api", "-X", "POST", `repos/${repo}/issues/${pr}/comments`, "-f", `body=${body}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    // A missing comment must never fail the build.
    console.error(`Could not update the PR comment: ${error.message}`);
  }
}
