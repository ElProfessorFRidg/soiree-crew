import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { isGameId } from "@crew/games";
import { GameUiProvider } from "@/games/GameUiProvider";
import { HeroTarget } from "@/motion/hero";
import { SetupScreen } from "@/games/SetupScreen";
import { markFirstRun } from "@/onboarding/firstRunMarks";

export default function GameSetupRoute() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  // The first-run checklist: "Essaie un jeu" ticks once a game is opened.
  useEffect(() => {
    if (gameId && isGameId(gameId)) markFirstRun("played");
  }, [gameId]);
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
