import { Redirect, useLocalSearchParams } from "expo-router";
import { contentFor } from "@crew/games";
import { GameUiProvider } from "@/games/GameUiProvider";
import { GAME_SCREENS } from "@/games/play";
import { startSession, useGamesStore } from "@/games/store";
import { useAppStore } from "@/state/store";

export default function GamePlayRoute() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const session = useGamesStore((s) => s.session);
  const language = useAppStore((s) => s.preferences.language);
  // No session for this game (app reopened on this URL, a stale link): back to its setup sheet.
  if (!session || session.gameId !== gameId) {
    return gameId ? <Redirect href={{ pathname: "/games/[gameId]", params: { gameId } }} /> : <Redirect href="/(tabs)/games" />;
  }
  const Game = GAME_SCREENS[session.gameId];
  return (
    <GameUiProvider>
      {/* A new session id remounts the game: "Play again" starts from a clean state. */}
      <Game key={session.id} session={session} content={contentFor(language)} onAgain={() => startSession(session.gameId)} />
    </GameUiProvider>
  );
}
