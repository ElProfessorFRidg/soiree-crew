/** MOT-06: when a released card leaves the table, and which way. */

export type SwipeSide = "left" | "right";

/** Past this share of the card's width, or this fast (px/s), a release commits. */
export const SWIPE_DISTANCE_SHARE = 0.32;
export const SWIPE_VELOCITY = 900;

export function swipeDecision(translationX: number, velocityX: number, width: number): SwipeSide | null {
  "worklet";
  const far = Math.abs(translationX) > width * SWIPE_DISTANCE_SHARE;
  // A fling counts only in the direction the card already moves, so a flick back cancels.
  const fling = Math.abs(velocityX) > SWIPE_VELOCITY && Math.sign(velocityX) === Math.sign(translationX);
  if (!far && !fling) return null;
  return translationX < 0 ? "left" : "right";
}

/** Tilt of a dragged card, in degrees: a little, never enough to make the text hard to read. */
export function swipeTilt(translationX: number, width: number): number {
  "worklet";
  if (width <= 0) return 0;
  return Math.max(-12, Math.min(12, (translationX / width) * 14));
}

/** How visible the action label is while dragging: 0 at rest, 1 at the commit distance. */
export function swipeLabelOpacity(translationX: number, width: number): number {
  "worklet";
  if (width <= 0) return 0;
  return Math.min(1, Math.abs(translationX) / (width * SWIPE_DISTANCE_SHARE));
}
