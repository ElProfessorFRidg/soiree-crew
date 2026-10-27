import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import { useAppStore } from "@/state/store";

// JOY-05: an optional sound pack, off by default. On iOS it follows the silent switch: a phone
// on silent stays silent. Sounds mix with music already playing, they never stop it.

type Sound = "pour" | "clink" | "crown";

const SOURCES: Record<Sound, number> = {
  pour: require("../../assets/sounds/pour.wav") as number,
  clink: require("../../assets/sounds/clink.wav") as number,
  crown: require("../../assets/sounds/crown.wav") as number,
};

const players: Partial<Record<Sound, AudioPlayer>> = {};
let modeSet = false;

export function play(sound: Sound): void {
  if (Platform.OS === "web" || !useAppStore.getState().soundsOn) return;
  try {
    if (!modeSet) {
      modeSet = true;
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => undefined);
    }
    const player = (players[sound] ??= createAudioPlayer(SOURCES[sound]));
    player.volume = 0.6;
    void player.seekTo(0).then(() => player.play()).catch(() => undefined);
  } catch {
    // A sound that cannot play is never worth an error on a night out.
  }
}
