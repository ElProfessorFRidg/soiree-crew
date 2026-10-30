import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { useCrewNames } from "@/crew/names";
import { haptic } from "@/motion/haptics";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { useSession } from "@/server/session";
import { newId } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Switch } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";

interface Item {
  id: string;
  label: string;
  addedBy: string;
  claimedBy: string | null;
  done: boolean;
}

/** N-32: who brings what, for one party. */
export default function ItemsScreen() {
  const { partyId } = useLocalSearchParams<{ partyId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const crews = useCrewData((state) => state.crews);
  // QOL-11: names as the party's crew knows them.
  const partyCrewId = useCrewData((state) => state.parties.find((p) => p.id === partyId)?.crewId ?? state.live[partyId]?.party.crewId);
  const crewName = useCrewNames(partyCrewId);
  const [items, setItems] = useState<Item[] | null>(null);
  const [label, setLabel] = useState("");
  const offline = showFailure(i18n);

  const load = useCallback(
    () =>
      api<{ items: Item[] }>(`/v1/parties/${partyId}/items`)
        .then((data) => setItems(data.items))
        .catch(offline),
    // offline only shows a toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partyId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const change = (body: Record<string, unknown>) => {
    haptic.select();
    void api(`/v1/parties/${partyId}/items`, { method: "POST", body }).then(load).catch(offline);
  };
  const nameOf = (id: string) => {
    if (id === me) return i18n.t("common.you");
    return crewName(id);
  };

  return (
    <Screen back title={i18n.t("items.title")} withToasts onRefresh={load}>
      <View style={styles.add}>
        <Field label={i18n.t("items.add")} placeholder={i18n.t("items.placeholder")} value={label} onChangeText={setLabel} maxLength={60} style={styles.flex} />
        <Button
          label={i18n.t("items.add")}
          icon="plus"
          height={52}
          disabled={!label.trim()}
          onPress={() => {
            change({ id: newId(), label: label.trim() });
            setLabel("");
          }}
        />
      </View>
      {items === null ? <SkeletonRows rows={3} /> : null}
      {items && items.length === 0 ? <Text>{i18n.t("items.empty")}</Text> : null}
      {items?.map((item) => (
        <View key={item.id} style={[styles.item, { borderBottomColor: theme.line }]}>
          <Switch value={item.done} onValueChange={(done) => change({ id: item.id, done })} accessibilityLabel={`${i18n.t("items.done")}, ${item.label}`} />
          <View style={styles.flex}>
            <Text variant="h3" color={item.done ? theme.textMuted : undefined}>
              {item.label}
            </Text>
            <Text variant="small">{item.claimedBy ? i18n.t("items.by", { name: nameOf(item.claimedBy) }) : i18n.t("items.free")}</Text>
          </View>
          {item.claimedBy === me ? (
            <Button label={i18n.t("items.unclaim")} variant="outline" height={36} onPress={() => change({ id: item.id, claim: false })} />
          ) : !item.claimedBy ? (
            <Button label={i18n.t("items.claim")} variant="secondary" height={36} onPress={() => change({ id: item.id, claim: true })} />
          ) : null}
          {item.addedBy === me ? (
            <Button label={i18n.t("items.remove")} variant="outline" height={36} onPress={() => change({ id: item.id, remove: true })} />
          ) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  add: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  flex: { flex: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64, borderBottomWidth: 1, flexWrap: "wrap" },
});
