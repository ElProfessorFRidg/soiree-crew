import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GAME_LEVELS, type GameLevel } from "@crew/games";
import { Field } from "@/crew/Field";
import { CREW_CARD_KINDS, deleteCrewCard, refreshCrewCards, reviewCrewCard, useCrewCards, writeCrewCard, type CrewCardKind } from "@/games/crewCards";
import { useGameT } from "@/games/i18n";
import { haptic } from "@/motion/haptics";
import { useCrewData } from "@/server/crewData";
import { useSession } from "@/server/session";
import { newId } from "@/state/store";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Panel, Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { useT } from "@/i18n";

const NO_CARDS: never[] = [];

/** N-33: cards written by the crew, played once the admin approved them. */
export default function CrewCardsScreen() {
  const g = useGameT();
  const i18n = useT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const crew = useCrewData((state) => state.crews[0]);
  const cards = useCrewCards((state) => (crew ? state.byCrew[crew.id] : undefined)) ?? NO_CARDS;
  const [kind, setKind] = useState<CrewCardKind>("neverEver");
  const [level, setLevel] = useState<GameLevel>("normal");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const offline = () => showToast({ tone: "danger", message: i18n.t("crew.offline") });
  const isAdmin = crew?.role === "admin";

  const load = useCallback(() => {
    if (crew) void refreshCrewCards(crew.id).catch(() => undefined);
  }, [crew]);
  useFocusEffect(load);

  if (!crew) {
    return (
      <Screen back title={g.t("crewCards.title")}>
        <Text>{g.t("crewCards.needCrew")}</Text>
      </Screen>
    );
  }

  const send = () => {
    setBusy(true);
    void writeCrewCard(crew.id, { id: newId(), kind, level, text: text.trim() })
      .then((res) => {
        haptic.confirmed();
        setText("");
        showToast({ message: res.status === "approved" ? g.t("crewCards.added") : g.t("crewCards.waiting") });
        load();
      })
      .catch(offline)
      .finally(() => setBusy(false));
  };
  const pending = cards.filter((c) => c.status === "pending");
  const approved = cards.filter((c) => c.status === "approved");
  const kindLabel = (k: CrewCardKind) => g.t(`crewCards.kind.${k}`);

  return (
    <Screen back title={g.t("crewCards.title")} withToasts>
      <Text variant="small">{g.t("crewCards.intro")}</Text>
      <Text variant="label">{g.t("crewCards.game")}</Text>
      <View style={styles.chips}>
        {CREW_CARD_KINDS.map((k) => (
          <Chip key={k} label={kindLabel(k)} selected={k === kind} onPress={() => setKind(k)} />
        ))}
      </View>
      <Segmented<GameLevel>
        accessibilityLabel={g.t("crewCards.level")}
        value={level}
        items={GAME_LEVELS.map((l) => ({ value: l, label: g.t(`levels.${l}`) }))}
        onChange={setLevel}
      />
      <Field label={g.t("crewCards.text")} hint={g.t(`crewCards.hint.${kind}`)} value={text} onChangeText={setText} maxLength={220} multiline />
      <Button label={isAdmin ? g.t("crewCards.add") : g.t("crewCards.propose")} height={52} disabled={text.trim().length < 4} loading={busy} onPress={send} />

      {isAdmin && pending.length ? (
        <Panel>
          <Text variant="label">{g.t("crewCards.toReview")}</Text>
          {pending.map((c) => (
            <View key={c.id} style={[styles.card, { borderTopColor: theme.line }]}>
              <Text variant="small">{`${kindLabel(c.kind)}, ${g.t(`levels.${c.level}`)}`}</Text>
              <Text>{c.text}</Text>
              <View style={styles.row}>
                <Button label={g.t("crewCards.approve")} height={44} style={styles.flex} onPress={() => void reviewCrewCard(c.id, true).then(load).catch(offline)} />
                <Button label={g.t("crewCards.reject")} variant="outline" height={44} style={styles.flex} onPress={() => void reviewCrewCard(c.id, false).then(load).catch(offline)} />
              </View>
            </View>
          ))}
        </Panel>
      ) : null}

      <Text variant="label">{g.plural("crewCards.inPlay", approved.length)}</Text>
      {approved.length === 0 ? <Text variant="small">{g.t("crewCards.none")}</Text> : null}
      {cards
        .filter((c) => c.status !== "pending" || !isAdmin)
        .map((c) => (
          <View key={c.id} style={[styles.card, { borderTopColor: theme.line }]}>
            <Text variant="small">
              {`${kindLabel(c.kind)}, ${g.t(`levels.${c.level}`)}`}
              {c.status === "pending" ? `, ${g.t("crewCards.pending")}` : c.status === "rejected" ? `, ${g.t("crewCards.rejected")}` : ""}
            </Text>
            <Text>{c.text}</Text>
            {c.authorId === me || isAdmin ? (
              <Button label={g.t("crewCards.remove")} variant="outline" height={40} onPress={() => void deleteCrewCard(c.id).then(load).catch(offline)} />
            ) : null}
          </View>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { gap: 6, paddingTop: 12, borderTopWidth: 1 },
  row: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
});
