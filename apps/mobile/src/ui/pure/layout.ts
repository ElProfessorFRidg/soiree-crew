export function navigationWidth(width: number): number {
  return width >= 1180 ? 216 : width >= 768 ? 88 : 0;
}

/** Sizes follow the current window, including iPad Split View, rather than the device model. */
export function contentLayout(windowWidth: number, windowHeight: number, sidebar = 0) {
  const width = Math.max(0, windowWidth - sidebar);
  const contentWidth = Math.min(width, 1280);
  const gutter = width >= 768 ? 24 : width < 360 ? 16 : 20;
  const innerWidth = Math.max(0, contentWidth - gutter * 2);
  const split = innerWidth >= 880;
  return {
    width, height: windowHeight, contentWidth, innerWidth, gutter, split, sidebar,
    columns: innerWidth >= 1020 ? 3 : innerWidth >= 620 ? 2 : 1,
    mapWidth: split ? (innerWidth - 24) * 0.62 : innerWidth,
  };
}

/** Native iPhone tabs float over content; JavaScript tabs already reserve their own height. */
export function screenSpacing({ gutter, height, sidebar, tabbed, nativeTabs, footer = false, keyboard = false, insets }: {
  gutter: number; height: number; sidebar: number; tabbed: boolean; nativeTabs: boolean;
  footer?: boolean; keyboard?: boolean; insets: { top: number; right: number; bottom: number; left: number };
}) {
  const tabOverlay = tabbed && nativeTabs ? 64 : 0;
  const safeBottom = tabbed && !nativeTabs && !sidebar ? 0 : insets.bottom;
  return {
    top: insets.top + (height < 700 ? 10 : 14),
    left: Math.max(gutter, insets.left), right: Math.max(gutter, insets.right),
    bottom: footer ? 20 : safeBottom + 24 + tabOverlay,
    footerBottom: keyboard ? 12 : safeBottom + 12 + tabOverlay,
    sectionGap: gutter >= 24 ? 20 : 16,
    tabOverlay,
  };
}
