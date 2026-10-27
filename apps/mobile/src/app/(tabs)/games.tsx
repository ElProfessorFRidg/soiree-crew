import { CatalogueScreen } from "@/games/CatalogueScreen";
import { GameUiProvider } from "@/games/GameUiProvider";

export default function GamesTab() {
  return (
    <GameUiProvider>
      <CatalogueScreen />
    </GameUiProvider>
  );
}
