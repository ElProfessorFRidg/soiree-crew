import { type ReactNode } from "react";
import { GameUiContext, useComputedGameUi } from "./hooks";

/** Computes the adaptive level once for a games screen and shares it with every control. */
export function GameUiProvider({ children }: { children: ReactNode }) {
  const ui = useComputedGameUi();
  return <GameUiContext.Provider value={ui}>{children}</GameUiContext.Provider>;
}
