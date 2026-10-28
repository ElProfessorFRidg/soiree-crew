import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { space } from "@crew/design-tokens";
import type { AnyIconName } from "@/ui/Icon";
import type { Translator } from "@/i18n";
import { useLiveParty } from "@/server/crewData";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/controls";

// HUB-01 (Soiree board, level 0): four tiles under the add button, then everything else as one
// scrolling row of chips instead of a list of links.

export function QuickTiles({ i18n }: { i18n: Translator }) {
  const live = useLiveParty();
  const partyId = live?.party.id;
  const tiles: { label: string; icon: AnyIconName; variant?: "secondary" | "danger"; go: () => void }[] = [
    { label: i18n.t("party.tileGames"), icon: "dice", go: () => router.push("/(tabs)/games") },
    partyId
      ? { label: i18n.t("party.tileRound"), icon: "euro", go: () => router.push({ pathname: "/round", params: { partyId } }) }
      : { label: i18n.t("party.tileCheers"), icon: "glass", go: () => router.push("/cheers") },
    partyId
      ? { label: i18n.t("party.tileHome"), icon: "home", go: () => router.push({ pathname: "/home", params: { id: partyId } }) }
      : { label: i18n.t("curve.open"), icon: "x:curve", go: () => router.push("/curve") },
    { label: i18n.t("party.sos"), icon: "alert", variant: "danger", go: () => router.push("/sos") },
  ];
  return (
    <View style={styles.tiles}>
      {tiles.map((tile) => (
        <Button
          key={tile.label}
          label={tile.label}
          icon={tile.icon}
          vertical
          height={76}
          fontSize={13}
          variant={tile.variant ?? "secondary"}
          style={styles.tile}
          onPress={tile.go}
        />
      ))}
    </View>
  );
}

export function MoreChips({ i18n }: { i18n: Translator }) {
  const live = useLiveParty();
  const partyId = live?.party.id;
  const chips: { label: string; icon: AnyIconName; go: () => void }[] = [
    // Without a party, the curve and cheers are tiles already.
    ...(partyId
      ? [
          { label: i18n.t("curve.open"), icon: "x:curve" as const, go: () => router.push("/curve") },
          { label: i18n.t("party.tileCheers"), icon: "glass" as const, go: () => router.push("/cheers") },
        ]
      : []),
    { label: i18n.t("limits.open"), icon: "x:target", go: () => router.push("/limits") },
    { label: i18n.t("party.history"), icon: "clock", go: () => router.push("/history") },
    ...(partyId
      ? [
          { label: i18n.t("money.open"), icon: "euro" as const, go: () => router.push("/money") },
          { label: i18n.t("items.open"), icon: "check" as const, go: () => router.push({ pathname: "/items", params: { partyId } }) },
          { label: i18n.t("album.open"), icon: "camera" as const, go: () => router.push({ pathname: "/album", params: { partyId } }) },
          { label: i18n.t("whereTo.open"), icon: "pin" as const, go: () => router.push({ pathname: "/where-to", params: { id: partyId } }) },
        ]
      : []),
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
      {chips.map((chip) => (
        <Chip key={chip.label} label={chip.label} icon={chip.icon} onPress={chip.go} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, paddingHorizontal: 4 },
  chipRow: { marginHorizontal: -space.screenX },
  chips: { gap: 8, paddingHorizontal: space.screenX, paddingVertical: 6 },
});
