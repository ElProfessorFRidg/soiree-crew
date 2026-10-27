import Svg, { Path } from "react-native-svg";
import { iconStroke } from "@crew/design-tokens";
import type { GameId } from "@crew/games";

// One stroke icon per game, drawn on the 24 grid of design/icons.json (stroke 2, round caps, no fill).
const GAME_ICONS: Record<GameId, string> = {
  bigDeck: "M8 3h11v15H8zM5 6v15h11M11.5 8.5h4M11.5 12h4",
  tollRoad: "M5 21L9.5 3M19 21L14.5 3M12 6v2M12 11v2M12 16v2.5",
  faceOff: "M3 5h7v11H3zM14 8h7v11h-7zM6.5 9.5h.01M17.5 12.5h.01",
  pointBlank: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM12 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM12 12h.01",
  fuse: "M10 9a6 6 0 1 1 0 12a6 6 0 1 1 0-12zM14.2 10.8l2.6-2.6M17 8c.8-1.8 2.6-2.3 4-1.4M19.5 3.5v1.5",
  wheel: "M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18zM12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4",
  neverEver: "M4 5h16v11H10l-5 4v-4H4zM12 8v3.5M12 13.5h.01",
  verdict: "M13.5 3.5l6 6M10.5 6.5l6 6M12 5l-3.5 3.5M15.5 8.5L12 12M3.5 20.5l7-7M3 21h8",
  truthDare: "M5 4h14v7a7 7 0 0 1-14 0zM9 9h.01M15 9h.01M9 13.5c2 1.5 4 1.5 6 0",
  minefield: "M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16M17.3 17.3h.01",
  fingerPick: "M12 10a3 3 0 1 1 0 6a3 3 0 1 1 0-6zM5 13a7 7 0 0 1 7-7M19 13a7 7 0 0 0-7-7M2 13a10 10 0 0 1 4-8",
  impostor: "M3 9c3-2 6-2 9 0c3-2 6-2 9 0v2c-1 4-5 4-9 2c-4 2-8 2-9-2zM8 10.5h.01M16 10.5h.01M9 18h6",
  doubleAgent: "M2 8c2.5-1.6 5-1.6 7 0v2c-1 3-6 3-7 0zM15 8c2-1.6 4.5-1.6 7 0v2c-1 3-6 3-7 0zM5 9.5h.01M18.5 9.5h.01M8 17c2.5 2 5.5 2 8 0",
  quickDraw: "M3 18c3-4 5 1.5 8-2s4-6 7-3M14.5 3.5l4 4-8 8H6.5v-4z",
  crash: "M3 20h18M4 17c4 0 7-2.5 9.5-9.5l3.5 6.5M17 14l1.5-1.5",
};

export function GameIcon({ game, size = 24, color }: { game: GameId; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={GAME_ICONS[game]} stroke={color} strokeWidth={iconStroke.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
