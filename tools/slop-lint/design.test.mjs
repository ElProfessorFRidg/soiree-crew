import { describe, expect, it } from "vitest";
import { checkSource } from "./design.mjs";

const rules = (text, file = "apps/mobile/src/ui/Card.tsx") => checkSource(text, file).map((f) => f.rule);

describe("design tells (SLOP-08)", () => {
  it("catches glass, halos and decorative gradients", () => {
    expect(rules('import { BlurView } from "expo-blur";')).toContain("D-02 glassmorphism");
    expect(rules("<RadialGradient id='halo' />")).toContain("D-01 radial halo");
    expect(rules('import { LinearGradient } from "expo-linear-gradient";')).toContain("D-01 decorative gradient");
  });

  it("allows the functional gradients of the BAC curve and the SOS ring", () => {
    expect(rules("<LinearGradient id='threshold' />", "apps/mobile/src/bac/BacCurve.tsx")).toEqual([]);
    expect(rules("<LinearGradient id='ring' />", "apps/mobile/src/sos/SosButton.tsx")).toEqual([]);
  });

  it("catches the AI palette but not amber", () => {
    expect(rules('const accent = "#7C3AED";')).toContain("D-09 AI palette");
    expect(rules('const glow = "#22D3EE";')).toContain("D-09 AI palette");
    expect(rules('const amber = "#F4B33D";')).toEqual([]);
  });

  it("catches all caps, default fonts and emojis as icons", () => {
    expect(rules('const s = { textTransform: "uppercase" };')).toContain("D-06 all caps");
    expect(rules('const s = { fontFamily: "Inter-Bold" };')).toContain("D-05 default font");
    expect(rules("<Text>🍺</Text>")).toContain("D-10 emoji as icon");
    expect(rules("<Text>🍺</Text>", "apps/mobile/src/recap/reactions.tsx")).toEqual([]);
  });
});
