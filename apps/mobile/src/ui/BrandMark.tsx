import { Image, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { Text } from "./Text";

const ICON = require("../../assets/icon.png");

/**
 * The app's icon and name at the top of the party screen, as messaging apps sign their main screen:
 * a screenshot shared to a group says where it comes from.
 */
export function BrandMark() {
  const i18n = useT();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={i18n.t("common.appName")}>
      <Image source={ICON} style={styles.icon} accessibilityIgnoresInvertColors />
      <Text variant="label" style={styles.name}>
        {i18n.t("common.appName")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  icon: { width: 22, height: 22, borderRadius: 6 },
  name: { letterSpacing: 0.2 },
});
