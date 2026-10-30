import { describe, expect, it } from "vitest";
import { momentToCelebrate, type CrewMoment } from "./celebrate";

const now = Date.UTC(2026, 10, 8, 20, 0);
const moments: CrewMoment[] = [
  { id: "nights-1", kind: "nights", value: 1, night: "2025-11-01" },
  { id: "anniversary-1", kind: "anniversary", value: 1, night: "2026-11-01" },
  { id: "nights-10", kind: "nights", value: 10, night: "2026-11-07" },
];

describe("crew moments to celebrate (JOY-08)", () => {
  it("picks the latest recent moment not seen yet", () => {
    expect(momentToCelebrate(moments, [], now)?.id).toBe("nights-10");
    expect(momentToCelebrate(moments, ["nights-10"], now)?.id).toBe("anniversary-1");
  });

  it("never celebrates old moments or the same one twice", () => {
    expect(momentToCelebrate(moments, ["nights-10", "anniversary-1"], now)).toBeNull();
    expect(momentToCelebrate(moments, [], Date.UTC(2026, 11, 31))).toBeNull();
  });
});
