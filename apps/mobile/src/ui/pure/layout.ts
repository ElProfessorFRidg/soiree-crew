export function navigationWidth(width: number): number {
  return width >= 1180 ? 216 : width >= 768 ? 88 : 0;
}

/** Sizes follow the current window, including iPad Split View, rather than the device model. */
export function contentLayout(windowWidth: number, windowHeight: number, sidebar = 0) {
  const width = Math.max(0, windowWidth - sidebar);
  const contentWidth = Math.min(width, 1280);
  const gutter = width >= 768 ? 24 : 20;
  const innerWidth = Math.max(0, contentWidth - gutter * 2);
  const split = innerWidth >= 880;
  return {
    width, height: windowHeight, contentWidth, innerWidth, gutter, split, sidebar,
    columns: innerWidth >= 1020 ? 3 : innerWidth >= 620 ? 2 : 1,
    mapWidth: split ? (innerWidth - 24) * 0.62 : innerWidth,
  };
}
