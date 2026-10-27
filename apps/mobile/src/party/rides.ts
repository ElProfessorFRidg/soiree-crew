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

/**
 * QOL-22, until GTFS feeds are wired in: the maps app's public-transport directions from here,
 * where the next night bus or metro and the last departures are listed.
 */
export async function openTransit(): Promise<void> {
  await Linking.openURL("https://www.google.com/maps/dir/?api=1&travelmode=transit");
}
