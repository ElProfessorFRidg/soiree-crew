import { expect, it } from "vitest";
import { deliveryComment } from "./report-route.mjs";

const base = { sha: "0123456789abcdef", runUrl: "https://github.com/o/r/actions/runs/1" };

it("warns that a fix needs a new IPA and folds the reason", () => {
  const { marker, body } = deliveryComment({
    ...base, route: "ipa", channel: "preview", version: "0.2.20",
    reason: "New IPA: this change cannot patch `v0.2.19-preview.28+build.400` (iphone) over the air.\nChanges outside the mobile JS and assets require a new IPA:\n- apps/mobile/package.json",
  });
  expect(marker).toBe("<!-- crew-delivery-preview -->");
  expect(body).toContain("New IPA needed");
  expect(body).toContain("`0.2.20`");
  expect(body).toContain("<details><summary>Why</summary>");
  expect(body).toContain("- apps/mobile/package.json");
});

it("offers /ipa on a Preview OTA, not on public", () => {
  const preview = deliveryComment({ ...base, route: "ota", channel: "preview", reason: "OTA update on top of `v0.2.18-preview.28+build.390`." });
  expect(preview.body).toContain("Comment `/ipa`");
  const pub = deliveryComment({ ...base, route: "ota", channel: "public", reason: "OTA update on top of `v0.2.18+build.390`." });
  expect(pub.marker).toBe("<!-- crew-delivery-public -->");
  expect(pub.body).not.toContain("/ipa");
});

it("says the IPA asked with /ipa is building", () => {
  const { body } = deliveryComment({ ...base, route: "ipa", channel: "preview", version: "0.2.21", reason: "New IPA: asked for with /ipa." });
  expect(body).toContain("**IPA `0.2.21` building**, asked with `/ipa`.");
  expect(body).not.toContain("<details>");
});
