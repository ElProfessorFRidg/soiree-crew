import { StyleSheet, View } from "react-native";
import { radius } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { VISIBILITY_KEYS, type VisibilityKey } from "@/onboarding/visibility";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Icon } from "@/ui/Icon";
import { Text } from "@/ui/Text";

/**
 * A small profile as a stranger would read it, with one thing opened or closed. The other four
 * lines are shown as plain placeholders so the eye lands on the one that changes.
 */
export function ProfilePreview({ focus, open, name, personId, caption, selected }: { focus: VisibilityKey; open: boolean; name: string; personId: string; caption: string; selected: boolean }) {
  const i18n = useT();
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: selected ? theme.amber : theme.line }]}
      accessible
      accessibilityLabel={`${caption}. ${open ? i18n.t(`journey.sample.${focus}`) : i18n.t("journey.previewHidden")}`}
    >
      <Text variant="label">{caption}</Text>
      <View style={styles.head}>
        <Avatar personId={personId} name={name} size={28} />
        <Text variant="h3" numberOfLines={1} style={styles.flex}>
          {name}
        </Text>
      </View>
      {VISIBILITY_KEYS.map((key) => {
        const live = key === focus;
        if (!live) return <View key={key} style={[styles.bar, { backgroundColor: theme.surfaceRaised }]} />;
        return open ? (
          <View key={key} style={styles.line}>
            <Icon name="check" size={14} color={theme.amber} />
            <Text variant="small" numberOfLines={2} style={styles.flex}>
              {i18n.t(`journey.sample.${key}`)}
            </Text>
          </View>
        ) : (
          <View key={key} style={[styles.line, styles.hidden, { borderColor: theme.line }]}>
            <Icon name="lock" size={14} color={theme.textMuted} />
            <Text variant="small">{i18n.t("journey.previewHidden")}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: 8, padding: 12, borderRadius: radius.card, borderWidth: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { height: 8, borderRadius: 4, width: "70%" },
  line: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28 },
  hidden: { borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", borderRadius: 8, paddingHorizontal: 6 },
  flex: { flex: 1 },
});
