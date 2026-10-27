/** JOY-09: four photos spread over the night: the first, the last, and two in between. */
export function pickFrames<T extends { at: number }>(photos: readonly T[], count = 4): T[] {
  const sorted = [...photos].sort((a, b) => a.at - b.at);
  if (sorted.length <= count) return sorted;
  return Array.from({ length: count }, (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (count - 1))]!);
}
