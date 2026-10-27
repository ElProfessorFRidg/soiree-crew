import { Redirect, useLocalSearchParams } from "expo-router";
import { isGameId } from "@crew/games";
import { GameUiProvider } from "@/games/GameUiProvider";
import { HeroTarget } from "@/motion/hero";
import { SetupScreen } from "@/games/SetupScreen";

export default function GameSetupRoute() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  if (!gameId || !isGameId(gameId)) return <Redirect href="/(tabs)/games" />;
  return (
    <GameUiProvider>
      {/* MOT-05: the catalogue card grows into this screen, then fades over it. */}
      <HeroTarget heroKey={`game:${gameId}`} hide={false} style={{ flex: 1 }}>
        <SetupScreen gameId={gameId} />
      </HeroTarget>
    </GameUiProvider>
  );
}
