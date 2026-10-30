import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useT } from "@/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { showFailure } from "@/server/errors";
import { addPoolMembers, type PoolDetail } from "@/server/moneyData";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";

/**
 * O-70: who is in the pool, and bringing more of the crew in later. Someone added owes nothing
 * for the expenses before them: those name who they were split between.
 */
export function PoolMembers({ detail, nameOf, onAdded }: { detail: PoolDetail; nameOf: (userId: string, fallback?: string) => string; onAdded: () => void }) {
  const i18n = useT();
  const crew = useCrewData((state) => state.crews.find((c) => c.id === detail.pool.crewId));
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const inPool = new Set(detail.members.map((m) => m.userId));
  const outside = (crew?.members ?? []).filter((m) => !inPool.has(m.id));

  const add = () => {
    setBusy(true);
    void addPoolMembers(detail.pool.id, [...picked])
      .then(({ added }) => {
        haptic.confirmed();
        showToast({ message: i18n.plural("money.membersAdded", added) });
        setPicked(new Set());
        setOpen(false);
        onAdded();
      })
      .catch(showFailure(i18n))
      .finally(() => setBusy(false));
  };

  return (
    <View style={styles.block}>
      <Text variant="small">
        {i18n.plural("money.members", detail.members.length)}
        {": "}
        {detail.members.map((m) => nameOf(m.userId, m.name)).join(", ")}
      </Text>
      {crew && outside.length && !open ? <Button label={i18n.t("money.addMembers")} icon="plus" variant="outline" height={40} onPress={() => setOpen(true)} /> : null}
      {open ? (
        <Panel>
          <Text variant="label">{i18n.t("money.addMembers")}</Text>
          <Text variant="small">{i18n.t("money.addMembersHint")}</Text>
          <View style={styles.chips}>
            {outside.map((m) => (
              <Chip
                key={m.id}
                label={nameOf(m.id, m.displayName)}
                selected={picked.has(m.id)}
                onPress={() =>
                  setPicked((current) => {
                    const next = new Set(current);
                    if (next.has(m.id)) next.delete(m.id);
                    else next.add(m.id);
                    return next;
                  })
                }
              />
            ))}
          </View>
          <View style={styles.actions}>
            <Button label={i18n.t("money.cancel")} variant="outline" height={44} style={styles.flex} onPress={() => setOpen(false)} />
            <Button label={i18n.t("money.addMembersConfirm")} height={44} style={styles.flex} disabled={!picked.size} loading={busy} onPress={add} />
          </View>
        </Panel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actions: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
