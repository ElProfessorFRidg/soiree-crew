import { useT } from "@/i18n";
import { useAppStore } from "@/state/store";
import { Button } from "@/ui/Button";
import { mapsAppOf, MAPS_NAMES, openDirections } from "./directions";

/** QOL-18: directions in the maps app chosen in Settings (the phone's own until then). */
export function DirectionsButton({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const i18n = useT();
  const mapsApp = useAppStore((state) => state.preferences.mapsApp);
  return (
    <Button
      label={i18n.t("venue.directions")}
      accessibilityHint={i18n.t("venue.directionsHint", { app: MAPS_NAMES[mapsAppOf(mapsApp)] })}
      icon="pin"
      variant="secondary"
      height={48}
      onPress={() => void openDirections(mapsApp, { lat, lng, label })}
    />
  );
}
