import type { ComponentType } from "react";
import type { GameId } from "@crew/games";
import { BigDeckScreen } from "./BigDeckScreen";
import type { GameScreenProps } from "./common";
import { CrashScreen } from "./CrashScreen";
import { FaceOffScreen } from "./FaceOffScreen";
import { FingerPickScreen } from "./FingerPickScreen";
import { FuseScreen } from "./FuseScreen";
import { HiddenWordScreen } from "./HiddenWordScreen";
import { MinefieldScreen } from "./MinefieldScreen";
import { NeverEverScreen } from "./NeverEverScreen";
import { PointBlankScreen } from "./PointBlankScreen";
import { QuickDrawScreen } from "./QuickDrawScreen";
import { TollRoadScreen } from "./TollRoadScreen";
import { TruthDareScreen } from "./TruthDareScreen";
import { VerdictScreen } from "./VerdictScreen";
import { WheelScreen } from "./WheelScreen";

export const GAME_SCREENS: Record<GameId, ComponentType<GameScreenProps>> = {
  bigDeck: BigDeckScreen,
  tollRoad: TollRoadScreen,
  faceOff: FaceOffScreen,
  pointBlank: PointBlankScreen,
  fuse: FuseScreen,
  wheel: WheelScreen,
  neverEver: NeverEverScreen,
  verdict: VerdictScreen,
  truthDare: TruthDareScreen,
  minefield: MinefieldScreen,
  fingerPick: FingerPickScreen,
  impostor: HiddenWordScreen,
  doubleAgent: HiddenWordScreen,
  quickDraw: QuickDrawScreen,
  crash: CrashScreen,
};
