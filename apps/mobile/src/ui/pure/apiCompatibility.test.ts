import { describe, expect, it } from "vitest";
import { compatibilityAccept, decodeCompatibility } from "./apiCompatibility";

const body = (webUrl = "https://crew.example/discover") => ({ error: "client_update_required", compatibility: { reason: "update_required", apiVersion: 1, minimumBuild: 120, webUrl } });
describe("API compatibility metadata", () => {
  it("keeps public web alternatives explicit and free of credentials or personal query parameters", () => {
    expect(decodeCompatibility(body(), 426, "/v1/places?lat=48&lng=2")).toMatchObject({ reason: "update_required", minimumBuild: 120, webUrl: "https://crew.example/discover" });
    for (const url of ["javascript:alert(1)", "http://crew.example/discover", "https://user:password@crew.example/discover", "https://crew.example/discover?token=secret", "https://crew.example/discover#secret", "https://crew.example/chat", "https://crew.example/discover/secret"]) {
      expect(decodeCompatibility(body(url), 426, "/v1/places")?.webUrl).toBeUndefined();
    }
    for (const path of ["/v1/mutations", "/v1/me", "/v1/chat", "/v1/places/bar/review"]) expect(decodeCompatibility(body(), 426, path)?.webUrl).toBeUndefined();
    expect(decodeCompatibility(body(), 426, "/v1/places", "POST")?.webUrl).toBeUndefined();
  });
  it("distinguishes a missing API route from a missing venue or an authentication refusal", () => {
    expect(decodeCompatibility({ statusCode: 404, error: "Not Found", message: "Route GET:/v1/new-feature not found" }, 404, "/v1/new-feature")?.reason).toBe("server_outdated");
    expect(decodeCompatibility({ error: "not_found" }, 404, "/v1/places/missing")).toBeUndefined();
    for (const status of [200, 401, 403, 429]) expect(decodeCompatibility(body(), status, "/v1/places")).toBeUndefined();
    expect(decodeCompatibility({ compatibility: { reason: "unknown" } }, 400, "/v1/places")).toBeUndefined();
    expect(decodeCompatibility(null, 404, "/v1/places")).toBeUndefined();
  });
  it("normalizes malformed optional version fields and never sends secrets in version metadata", () => {
    const notice = decodeCompatibility({ compatibility: { reason: "feature_removed", minimumBuild: -1, minimumApiVersion: "2", apiVersion: Infinity } }, 410, "/v1/crews/open");
    expect(notice).toEqual({ reason: "feature_removed", apiVersion: 1 });
    expect(compatibilityAccept(120, "ios")).toBe("application/json; crew-api=1; crew-build=120; crew-client=ios");
    expect(compatibilityAccept(null, "web")).toContain("crew-build=0; crew-client=web");
    expect(compatibilityAccept(NaN, "android")).toContain("crew-build=0; crew-client=android");
    expect(compatibilityAccept(Number.MAX_SAFE_INTEGER, "ios").length).toBeLessThan(128);
  });
});
