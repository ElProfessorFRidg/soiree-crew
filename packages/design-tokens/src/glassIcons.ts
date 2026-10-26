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
