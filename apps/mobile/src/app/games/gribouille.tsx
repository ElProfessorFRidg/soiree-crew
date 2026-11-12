import { GameUiProvider } from "@/games/GameUiProvider";
import { GribouilleScreen } from "@/games/online/GribouilleScreen";

/** O-63: Gribouille online, several phones on one server room. */
export default function GribouilleRoute() {
  return (
    <GameUiProvider>
      <GribouilleScreen />
    </GameUiProvider>
  );
}
