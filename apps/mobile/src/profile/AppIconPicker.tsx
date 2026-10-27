import { useEffect, useState } from "react";
import { Alert, Image, Platform, Pressable, StyleSheet, View } from "react-native";
import * as AppIcon from "expo-quick-actions/icon";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { fetchProfile } from "@/server/profileData";
import { useSession } from "@/server/session";
import { useTheme } from "@/theme";
import { Text } from "@/ui/Text";

type IconId = "default" | "boss" | "globetrotter" | "nomad";
type Title = "mayor" | "conqueror" | "explorer" | "nomad";

/** Which crew title unlocks which icon (N-34, GLOSSARY): holding a bar, exploring, roaming. */
const ICONS: { id: IconId; image: number; unlockedBy: Title | null }[] = [
  { id: "default", image: require("../../assets/icon.png") as number, unlockedBy: null },
  { id: "boss", image: require("../../assets/icons/icon-boss.png") as number, unlockedBy: "mayor" },
  { id: "globetrotter", image: require("../../assets/icons/icon-globetrotter.png") as number, unlockedBy: "explorer" },
  { id: "nomad", image: require("../../assets/icons/icon-nomad.png") as number, unlockedBy: "nomad" },
];

/** JOY-03: alternate app icons, each unlocked by a crew title. */
export function AppIconPicker() {
  const i18n = useT();
  const theme = useTheme();
  const session = useSession((state) => state.session);
  const [titles, setTitles] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState<IconId>("default");

  useEffect(() => {
    if (session) {
      void fetchProfile("me")
        .then((p) => setTitles(new Set((p.sections.titles ?? []).map((t) => t.kind))))
        .catch(() => undefined);
    }
    void AppIcon.getIcon?.()
      .then((name) => setCurrent((name as IconId | null) ?? "default"))
      .catch(() => undefined);
  }, [session]);

  if (!AppIcon.isSupported || Platform.OS === "web") return null;

  const choose = (id: IconId) => {
    const apply = () =>
      void AppIcon.setIcon?.(id === "default" ? null : id)
        .then(() => {
          haptic.confirmed();
          setCurrent(id);
        })
        .catch(() => undefined);
    // Android restarts the app to switch icons: say so before it happens.
    if (Platform.OS === "android") {
      Alert.alert(i18n.t("appIcon.restartTitle"), i18n.t("appIcon.restartBody"), [
        { text: i18n.t("common.back"), style: "cancel" },
        { text: i18n.t("appIcon.apply"), onPress: apply },
      ]);
    } else apply();
  };

  return (
    <View style={styles.wrap}>
      <Text variant="label">{i18n.t("appIcon.title")}</Text>
      <View style={styles.row}>
        {ICONS.map((icon) => {
          const unlocked = icon.unlockedBy === null || titles.has(icon.unlockedBy);
          const selected = icon.id === current;
          return (
            <Pressable
              key={icon.id}
              accessibilityRole="button"
              accessibilityLabel={i18n.t(`appIcon.names.${icon.id}`)}
              accessibilityState={{ selected, disabled: !unlocked }}
              disabled={!unlocked}
              onPress={() => choose(icon.id)}
              style={[styles.cell, { borderColor: selected ? theme.amber : "transparent", opacity: unlocked ? 1 : 0.35 }]}
            >
              <Image source={icon.image} style={styles.image} />
              <Text variant="tab" align="center">
                {i18n.t(`appIcon.names.${icon.id}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="small">{i18n.t("appIcon.hint")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", gap: 10 },
  cell: { flex: 1, alignItems: "center", gap: 4, padding: 6, borderWidth: 2, borderRadius: 16 },
  image: { width: 56, height: 56, borderRadius: 13 },
});
