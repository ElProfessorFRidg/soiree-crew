import { afterEach, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, next: string) => { values.set(key, next); }),
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({ default: storage }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("serializes probe writes and restores only the selected server's dev journal", async () => {
  vi.stubGlobal("__DEV__", true);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  const { recordPublicProbe, recentPublicProbes } = await import("../../server/diagnosticLog");
  const selected = "https://first.example";
  recordPublicProbe(selected, "/v1/health", "SC_OK");
  recordPublicProbe("https://second.example", "/v1/info", "SC_HTTP_500");
  recordPublicProbe(selected, "/v1/ready", "SC_DB_01");
  expect(await recentPublicProbes(selected)).toEqual([
    expect.stringContaining("/v1/health · SC_OK"),
    expect.stringContaining("/v1/ready · SC_DB_01"),
  ]);
  vi.resetModules();
  const restarted = await import("../../server/diagnosticLog");
  expect(await restarted.recentPublicProbes(selected)).toHaveLength(2);
});


it("restores API evidence only for the originating account and server, with a redacted route", async () => {
  const { recordNetworkDiagnostic, savedNetworkDiagnostics } = await import("../../server/diagnosticLog");
  const server = "https://api.example";
  recordNetworkDiagnostic({
    at: 123, server, accountId: "account-one", feature: "/v1/users/private-id/profile?secret=1", method: "GET",
    code: "SC_API_01", status: 200, format: "html", reason: "server_outdated", durationMs: 17, attempted: true,
  });
  await savedNetworkDiagnostics(server, "account-one");
  vi.resetModules();
  const restarted = await import("../../server/diagnosticLog");
  expect(await restarted.savedNetworkDiagnostics(server, "account-two")).toEqual([]);
  expect(await restarted.savedNetworkDiagnostics("https://other.example", "account-one")).toEqual([]);
  expect(await restarted.savedNetworkDiagnostics(server, "account-one")).toMatchObject([
    { feature: "/v1/users/:id/profile", code: "SC_API_01", status: 200, format: "html" },
  ]);
});
