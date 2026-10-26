import { Easing } from "react-native-reanimated";
import { easing } from "@crew/design-tokens";

/** The cubic-bezier tokens of design/tokens.json as Reanimated easings. */
export const easings = {
  out: Easing.bezier(...easing.out),
  toggle: Easing.bezier(...easing.toggle),
  flip: Easing.bezier(...easing.flip),
  reorder: Easing.bezier(...easing.reorder),
  overshoot: Easing.bezier(...easing.overshoot),
  spin: Easing.bezier(...easing.spin),
};
