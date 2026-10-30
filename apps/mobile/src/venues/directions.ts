import { Linking, Platform } from "react-native";
import type { UserPreferences } from "@crew/units";

export type MapsApp = NonNullable<UserPreferences["mapsApp"]>;

/** QOL-18: Apple Maps only exists on iOS. */
export const MAPS_APPS: MapsApp[] = Platform.OS === "ios" ? ["apple", "google", "waze"] : ["google", "waze"];
export const MAPS_NAMES: Record<MapsApp, string> = { apple: "Apple Maps", google: "Google Maps", waze: "Waze" };

/** The chosen app, else the phone's own: Apple Maps on iOS, Google Maps elsewhere. */
export function mapsAppOf(preference: UserPreferences["mapsApp"]): MapsApp {
  if (preference && MAPS_APPS.includes(preference)) return preference;
  return Platform.OS === "ios" ? "apple" : "google";
}

interface Target {
  lat: number;
  lng: number;
  /** The venue's name or address, shown as the destination's label where the app allows it. */
  label?: string;
}

/** The app URL first, then a web URL that works without the app (and opens it when installed). */
export function directionsUrls(app: MapsApp, { lat, lng, label }: Target): string[] {
  const at = `${lat},${lng}`;
  const q = label ? encodeURIComponent(label) : "";
  switch (app) {
    case "apple":
      return [`maps://?daddr=${at}${q ? `&q=${q}` : ""}`, `https://maps.apple.com/?daddr=${at}${q ? `&q=${q}` : ""}`];
    case "waze":
      return [`waze://?ll=${at}&navigate=yes`, `https://waze.com/ul?ll=${at}&navigate=yes`];
    case "google":
      return [
        Platform.OS === "ios" ? `comgooglemaps://?daddr=${at}&directionsmode=walking` : `google.navigation:q=${at}&mode=w`,
        `https://www.google.com/maps/dir/?api=1&destination=${at}&travelmode=walking`,
      ];
  }
}

/** QOL-18: directions to a venue in the app the user picked once. Falls back to the web if the app is missing. */
export async function openDirections(preference: UserPreferences["mapsApp"], target: Target): Promise<void> {
  const urls = Platform.OS === "web" ? directionsUrls(mapsAppOf(preference), target).slice(1) : directionsUrls(mapsAppOf(preference), target);
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Not installed: try the next one.
    }
  }
}
