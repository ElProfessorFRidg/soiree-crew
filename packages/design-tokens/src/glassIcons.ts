// Glass icons for quick adds (O-20), drawn on the same 24 grid as design/icons.json:
// stroke 2, round caps and joins, no fill.

export const glassIcons = {
  /** Straight pint glass, slightly flared. */
  pint: "M6.5 3h11l-1.4 18H7.9L6.5 3zM7.1 8h9.8",
  /** Small tumbler for a demi or a half pint. */
  demi: "M7.5 7h9l-1 13h-7l-1-13zM8 11h8",
  /** Bottle. */
  bottle: "M10 2.5h4M10.5 2.5v4.2L8.5 9.5V21h7V9.5l-2-2.8V2.5M8.5 13h7",
  /** Stemmed wine glass. */
  wine: "M7.5 3h9c.4 4.5-.9 8-4.5 8s-4.9-3.5-4.5-8zM12 11v9M8.5 21h7M7.8 6.5h8.4",
  /** Shot glass. */
  shot: "M8 8h8l-1 9H9L8 8zM8.5 11.5h7",
  /** Cocktail glass with a straw. */
  cocktail: "M4.5 5h15L12 13 4.5 5zM12 13v7M8.5 21h7M15 3l-2.5 6.5",
  /** Cider: rounded glass. */
  cider: "M7 5h10v9a5 5 0 0 1-10 0V5zM7 9h10M12 19v2",
  /** Can for seltzers and sodas. */
  can: "M8 4h8v16H8zM8 7h8M8 17h8",
  /** Soft drink with a straw, no alcohol. */
  soft: "M7.5 8h9l-1.2 13H8.7L7.5 8zM13 8l1.5-5.5 2.5.5",
} as const;

export type GlassIconName = keyof typeof glassIcons;

/** App icons missing from design/icons.json, drawn in the same style. */
export const extraIcons = {
  /** BAC curve. */
  curve: "M3 20h18M4 16c2.5 0 3-8 6-8s3.5 6 6 6c1.8 0 2.6-2.3 4-2.3",
  /** Target for the personal limit. */
  target: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9zM12 11.5h.01",
  /** Play a video. */
  play: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM10 8.5v7l6-3.5z",
  /** Scan a code with the camera. */
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10",
  /** One step down on a stepper, the pair of "plus". */
  minus: "M5 12h14",
  /** Something made for you: alibi, recap, wrapped. "sparkdot" is only the end dot of a sparkline. */
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8l1.8.7l-1.8.7l-.7 1.8l-.7-1.8l-1.8-.7l1.8-.7z",
  /** O-76: the alibi of the day, a masquerade mask (a cover story). */
  mask: "M2.8 9.4C2.8 7.5 4.3 6 6.2 6c2.4 0 3.6 1.1 5.8 1.1S15.4 6 17.8 6c1.9 0 3.4 1.5 3.4 3.4c0 3.9-2.4 6.6-5 6.6c-2 0-2.9-1.9-4.2-1.9s-2.2 1.9-4.2 1.9c-2.6 0-5-2.7-5-6.6zM6.6 10.6c.8-.9 2.2-.9 3 0M14.4 10.6c.8-.9 2.2-.9 3 0",
  /** Check again: an arrow coming round. */
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  /** The photo strip. */
  film: "M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM6 9h12M6 15h12",
} as const;

export type ExtraIconName = keyof typeof extraIcons;
