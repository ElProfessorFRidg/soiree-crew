import { Platform } from "react-native";
import { extraString } from "@/system/extra";

/** O-38: set by app.config.ts when the build can receive pushes (CREW_PUSH=1). Off for builds signed with a free Apple account. */
export const REMOTE_PUSH = (Platform.OS === "ios" || Platform.OS === "android") && (extraString("remotePush") ?? "").split(",").includes(Platform.OS);
