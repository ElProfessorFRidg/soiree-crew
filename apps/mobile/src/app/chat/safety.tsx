import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fromBase64, groupDigits, keySetTag, safetyNumber } from "@crew/mls";
import { updateMeta } from "@/chat/engine";
import { useNames } from "@/chat/names";
import { useChat } from "@/chat/store";
import { useT } from "@/i18n";
import { api } from "@/server/api";
import { useSession } from "@/server/session";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Numeral, Text } from "@/ui/Text";

type Devices = { devices: { deviceId: string; signatureKey: string }[] };

/** MSG-05: the number two people compare, out loud or side by side, to be sure nobody sits in between. */
export default function SafetyNumberScreen() {
  const { userId } = useLocalSearchParams<{ userId: string; conversationId?: string }>();
  const i18n = useT();
  const name = useNames();
  const me = useSession((s) => s.session?.userId ?? "");
  const meta = useChat((s) => s.meta);
  const [result, setResult] = useState<{ number: string; tag: string } | "none" | null>(null);

  useEffect(() => {
    void Promise.all([api<Devices>(`/v1/chat/users/${me}/devices`), api<Devices>(`/v1/chat/users/${userId}/devices`)])
      .then(([mine, theirs]) => {
        if (!mine.devices.length || !theirs.devices.length) return setResult("none");
        const keys = (d: Devices) => d.devices.map((x) => fromBase64(x.signatureKey));
        setResult({ number: safetyNumber({ userId: me, keys: keys(mine) }, { userId, keys: keys(theirs) }), tag: keySetTag(keys(theirs)) });
      })
      .catch(() => setResult("none"));
  }, [me, userId]);

  const who = name(userId);
  const verified = result && result !== "none" && meta.verified[userId] === result.tag;
  const groups = result && result !== "none" ? groupDigits(result.number) : [];

  return (
    <Screen back title={who}>
      {meta.keyChanged[userId] ? (
        <Panel tint="amber">
          <Text variant="small">{i18n.t("chat.keyChanged", { name: who })}</Text>
        </Panel>
      ) : null}
      {result === null ? <SkeletonRows /> : null}
      {result === "none" ? <Text>{i18n.t("chat.noKeysYet", { name: who })}</Text> : null}
      {result && result !== "none" ? (
        <Panel style={styles.center}>
          <View accessible accessibilityLabel={groups.join(" ")} style={styles.grid}>
            {[0, 1, 2, 3].map((row) => (
              <Numeral key={row} size={22} style={styles.line}>
                {groups.slice(row * 3, row * 3 + 3).join("  ")}
              </Numeral>
            ))}
          </View>
          <Button
            label={verified ? i18n.t("chat.verifiedButton") : i18n.t("chat.markVerified")}
            variant={verified ? "secondary" : "primary"}
            icon={verified ? "check" : "shield"}
            height={44}
            onPress={() =>
              updateMeta((m) => {
                const { [userId]: _seen, ...keyChanged } = m.keyChanged;
                const verifiedMap = { ...m.verified };
                if (verified) delete verifiedMap[userId];
                else verifiedMap[userId] = result.tag;
                return { ...m, verified: verifiedMap, keyChanged };
              })
            }
          />
        </Panel>
      ) : null}
      <Text>{i18n.t("chat.safetyHow", { name: who })}</Text>
      <Text variant="small">{i18n.t("chat.safetyWhy")}</Text>
      {meta.keyChanged[userId] ? (
        <Button
          label={i18n.t("chat.keyChangedOk")}
          variant="outline"
          height={44}
          onPress={() =>
            updateMeta((m) => {
              const { [userId]: _seen, ...keyChanged } = m.keyChanged;
              return { ...m, keyChanged };
            })
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center" },
  grid: { alignItems: "center", gap: 6, paddingVertical: 8 },
  line: { letterSpacing: 2 },
});
