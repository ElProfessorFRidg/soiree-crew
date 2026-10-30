import { ScrollView, StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import type { StatsFilter, StatsFilters } from "@/server/statsData";
import { Chip } from "@/ui/controls";
import { Text } from "@/ui/Text";

/**
 * N-16: narrow figures to one venue and/or one person. People are only those who share their
 * nights with me (the server builds the list from their profile settings).
 */
export function FilterChips({
  options,
  value,
  onChange,
  nameOf,
}: {
  options: StatsFilters | undefined;
  value: StatsFilter;
  onChange: (next: StatsFilter) => void;
  nameOf?: (userId: string, fallback: string) => string;
}) {
  const i18n = useT();
  if (!options || (!options.venues.length && !options.people.length)) return null;
  return (
    <View style={styles.block}>
      {options.venues.length ? (
        <View style={styles.line}>
          <Text variant="label">{i18n.t("myStats.filterVenue")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label={i18n.t("myStats.anyVenue")} selected={!value.venueId} onPress={() => onChange({ ...value, venueId: null })} />
            {options.venues.map((v) => (
              <Chip key={v.id} icon="pin" label={v.name} selected={value.venueId === v.id} onPress={() => onChange({ ...value, venueId: v.id })} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {options.people.length ? (
        <View style={styles.line}>
          <Text variant="label">{i18n.t("myStats.filterPerson")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label={i18n.t("myStats.anyone")} selected={!value.userId} onPress={() => onChange({ ...value, userId: null })} />
            {options.people.map((p) => (
              <Chip
                key={p.userId}
                icon="user"
                label={nameOf ? nameOf(p.userId, p.name) : p.name}
                selected={value.userId === p.userId}
                onPress={() => onChange({ ...value, userId: p.userId })}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  line: { gap: 6 },
  chips: { flexDirection: "row", gap: 8, paddingRight: 8 },
});
