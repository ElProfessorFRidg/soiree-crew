import { expect, it } from "vitest";
import { deliveryComment } from "./report-route.mjs";

const base = { sha: "0123456789abcdef", runUrl: "https://github.com/o/r/actions/runs/1" };

it("warns that a fix needs a new IPA and lists why", () => {
  const { marker, body } = deliveryComment({
    ...base, route: "ipa", channel: "preview", version: "0.2.20",
    reason: "New IPA: this change cannot patch `v0.2.19-preview.28+build.400` (iphone) over the air.\nChanges outside the mobile JS and assets require a new IPA:\n- apps/mobile/package.json",
  });
  expect(marker).toBe("<!-- crew-delivery-preview -->");
  expect(body).toContain("New IPA needed");
  expect(body).toContain("- apps/mobile/package.json");
  expect(body).toContain("`0.2.20`");
});

it("keeps public and preview decisions apart", () => {
  const ota = deliveryComment({ ...base, route: "ota", channel: "public", reason: "OTA update on top of `v0.2.18+build.390`." });
  expect(ota.marker).toBe("<!-- crew-delivery-public -->");
  expect(ota.body).toContain("OTA update.");
  expect(ota.body).not.toContain("The new IPA");
});
