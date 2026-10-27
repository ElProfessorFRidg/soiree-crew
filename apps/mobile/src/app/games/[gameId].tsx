import { Redirect, useLocalSearchParams } from "expo-router";
import { isGameId } from "@crew/games";
import { GameUiProvider } from "@/games/GameUiProvider";
import { SetupScreen } from "@/games/SetupScreen";

export default function GameSetupRoute() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  if (!gameId || !isGameId(gameId)) return <Redirect href="/(tabs)/games" />;
  return (
    <GameUiProvider>
      <SetupScreen gameId={gameId} />
    </GameUiProvider>
  );
}
