import type { TextStyle } from "react-native";
import { type } from "@crew/design-tokens";

interface Options {
  /** Several lines (chat, comments): they keep the body's line rhythm. */
  multiline?: boolean;
  fontFamily?: string;
  fontSize?: number;
}

/**
 * The text of every input. iOS sizes the caret and places the placeholder from the line box, but
 * draws the typed glyphs from the font's own metrics: a lineHeight on a one-line field leaves a caret
 * taller than the text and sticking out above it, and a placeholder sitting lower than what is typed.
 * One-line fields therefore drop the lineHeight and let the field centre the line (Android: no extra
 * font padding, centred vertically); several lines keep it and start at the top.
 */
export function inputText({ multiline = false, fontFamily = type.body.fontFamily, fontSize = type.body.fontSize }: Options = {}): TextStyle {
  if (multiline) return { fontFamily, fontSize, lineHeight: Math.round(fontSize * 1.4), textAlignVertical: "top" };
  return { fontFamily, fontSize, paddingVertical: 0, textAlignVertical: "center", includeFontPadding: false };
}
