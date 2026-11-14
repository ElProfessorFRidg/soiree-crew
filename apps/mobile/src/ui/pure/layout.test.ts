import { describe, expect, it } from "vitest";
import { contentLayout, navigationWidth } from "./layout";

describe("adaptive tablet layout", () => {
  it("switches between bottom navigation, rail and expanded sidebar as the window resizes", () => {
    expect([500, 834, 1366].map(navigationWidth)).toEqual([0, 88, 216]);
  });
  it("uses the scene width after the sidebar, including portrait and Split View", () => {
    expect(contentLayout(834, 1194, 88)).toMatchObject({ width: 746, innerWidth: 706, columns: 2, split: false });
    expect(contentLayout(500, 1000)).toMatchObject({ columns: 1, split: false, mapWidth: 460 });
  });
  it("fits map and detail panes in landscape without overflowing", () => {
    const layout = contentLayout(1366, 1024, 216);
    expect(layout.split).toBe(true);
    const detailWidth = layout.innerWidth - layout.mapWidth - 24;
    expect(detailWidth).toBeGreaterThan(350);
    expect(layout.mapWidth + detailWidth + 24).toBe(layout.innerWidth);
  });
  it("caps ultrawide content and keeps game columns usable", () => {
    const layout = contentLayout(2048, 1024, 216);
    expect(layout.contentWidth).toBe(1280);
    expect(layout.columns).toBe(3);
    expect((layout.innerWidth - 20 * (layout.columns - 1)) / layout.columns).toBeGreaterThan(350);
  });
  it("returns to compact mode without retaining stale tablet geometry", () => {
    const wide = contentLayout(1366, 1024, navigationWidth(1366));
    const narrow = contentLayout(390, 844, navigationWidth(390));
    expect(wide.split).toBe(true);
    expect(narrow).toMatchObject({ sidebar: 0, split: false, columns: 1, mapWidth: 350 });
  });
});
