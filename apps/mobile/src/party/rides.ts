import { Linking } from "react-native";

/** QOL-18: ride apps open in the app when installed, on the web otherwise. */
export const RIDE_APPS = [
  { id: "uber", name: "Uber", app: "uber://", web: "https://m.uber.com/ul/" },
  { id: "bolt", name: "Bolt", app: "bolt://", web: "https://bolt.eu/" },
  { id: "heetch", name: "Heetch", app: "heetch://", web: "https://www.heetch.com/" },
  { id: "freenow", name: "FREENOW", app: "freenow://", web: "https://www.free-now.com/" },
  { id: "g7", name: "G7", app: "g7taxi://", web: "https://www.g7.fr/" },
] as const;

export async function openRide(app: (typeof RIDE_APPS)[number]): Promise<void> {
  try {
    await Linking.openURL(app.app);
  } catch {
    await Linking.openURL(app.web);
  }
}

export type RideApp = (typeof RIDE_APPS)[number];
