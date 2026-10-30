import iconsJson from "../../../design/icons.json";

// O-35: one icon per party mood, on the same 24 grid as design/icons.json (stroke 2, round caps
// and joins, no fill). Moods that already have an icon there reuse it.

export const moodIcons = {
  /** Party popper with confetti. */
  party: "M4 20l4-11 7 7-11 4zM13.5 3.5v2.5M18.5 9h2.5M16.5 6.5l2-2M10.5 6.5l.6-1.4M17.5 13l1.4.6",
  /** Cake with one candle. */
  birthday: "M5 12h14v8H5zM4 20h16M5 15.5c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 12V8.5M12 6.5c-.9-.9-.9-1.9 0-3 .9 1.1.9 2.1 0 3z",
  /** Champagne flute with bubbles. */
  champagne: "M9.5 3h5l-.4 7.5a2.1 2.1 0 0 1-4.2 0L9.5 3zM12 12.6V20M9 20.5h6M9.7 7h4.6M17.5 4h.01M18.5 7.5h.01M17 10.5h.01",
  /** Half sun on the horizon. */
  sunset: "M3 17h18M6 17a6 6 0 0 1 12 0M12 5v3M5.3 9.3l1.8 1.8M18.7 9.3l-1.8 1.8M8 20.5h8",
  /** Party mask. */
  costume: "M3 8.5c3-1.3 6-1.3 9 .7 3-2 6-2 9-.7 0 5-2 8-5 8-1.8 0-2.8-2-4-2s-2.2 2-4 2c-3 0-5-3-5-8zM6.8 11.3h2.4M14.8 11.3h2.4",
  wine: iconsJson.icons.wine,
  fire: iconsJson.icons.flame,
  night: iconsJson.icons.moon,
  home: iconsJson.icons.home,
  /** Palm tree. */
  tropical: "M12.5 21c0-4.5.4-8 1.5-11M14 10c-1.4-2.8-4.6-3.8-7.5-2.4M14 10c2.6-2 5.6-1.6 7 .4M14 10c-2.8-.3-5.4 1.2-6.4 3.8M14 10c2.4.6 4.2 2.4 4.8 4.8M8.5 21h8",
} as const;

export type MoodIconName = keyof typeof moodIcons;
