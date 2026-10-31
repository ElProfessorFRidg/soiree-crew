import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { space } from "@crew/design-tokens";
import { useT } from "@/i18n";
import { ApiError } from "@/server/api";
import { CREW_CATEGORIES, fetchOpenCrews, type CrewCategory, type OpenCrew } from "@/server/crewData";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Chip, Panel } from "@/ui/controls";
import { SkeletonRows } from "@/ui/Skeleton";
import { Text } from "@/ui/Text";
import { Field } from "./Field";

type Load = { state: "loading" } | { state: "ready"; crews: OpenCrew[] } | { state: "closed" } | { state: "failed" };

/**
 * The public crews of a server: search by name, city or description, one category at a time.
 * The same list serves "Trouver" before signing up (`server` given, no session) and "Découvrir"
 * once signed in. Joining is the caller's: before an account exists it asks for one first.
 */
export function PublicCrewList({ server, onJoin }: { server?: string | null; onJoin: (crew: OpenCrew) => Promise<void> | void }) {
  const i18n = useT();
  const theme = useTheme();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CrewCategory | null>(null);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [joining, setJoining] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const signedOut = server !== undefined;

  useEffect(() => {
    if (signedOut && !server) return;
    let live = true;
    setLoad((current) => (current.state === "ready" ? current : { state: "loading" }));
    // Typing waits for a pause; a category tap or a retry goes at once.
    const id = setTimeout(
      () => {
        fetchOpenCrews(q.trim(), category, server ?? undefined)
          .then((r) => live && setLoad({ state: "ready", crews: r.crews }))
          .catch((error: unknown) => {
            if (!live) return;
            const closed = error instanceof ApiError && error.failure.kind === "http" && error.failure.status === 401;
            setLoad({ state: closed ? "closed" : "failed" });
          });
      },
      q ? 300 : 0,
    );
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [q, category, server, signedOut, attempt]);

  const join = async (crew: OpenCrew) => {
    setJoining(crew.id);
    try {
      await onJoin(crew);
    } finally {
      setJoining(null);
    }
  };

  if (signedOut && !server) return <Text muted>{i18n.t("arrival.pickServerFirst")}</Text>;
  if (load.state === "closed") return <Text muted>{i18n.t("arrival.listClosed")}</Text>;

  return (
    <View style={styles.list}>
      <Field
        label={i18n.t("arrival.searchLabel")}
        placeholder={i18n.t("arrival.searchPlaceholder")}
        value={q}
        onChangeText={setQ}
        maxLength={40}
        autoCorrect={false}
        returnKeyType="search"
      />
      {/* One scrolling row of filters, edge to edge, so the last chips are not squeezed. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        <Chip label={i18n.t("arrival.categoryAll")} selected={category === null} onPress={() => setCategory(null)} />
        {CREW_CATEGORIES.map((c) => (
          <Chip key={c} label={i18n.t(`arrival.categories.${c}`)} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
        ))}
      </ScrollView>
      {load.state === "loading" ? <SkeletonRows rows={3} /> : null}
      {load.state === "failed" ? (
        <Panel>
          <Text>{i18n.t("arrival.listFailed")}</Text>
          <Button label={i18n.t("common.retry")} variant="secondary" height={44} onPress={() => setAttempt((n) => n + 1)} />
        </Panel>
      ) : null}
      {load.state === "ready" && load.crews.length === 0 ? (
        <Text muted>{q || category ? i18n.t("arrival.noMatch") : i18n.t("arrival.noPublicCrew")}</Text>
      ) : null}
      {load.state === "ready" && load.crews.length ? (
        <Panel style={styles.rows}>
          {load.crews.map((crew, index) => (
            <View key={crew.id} style={[styles.row, index < load.crews.length - 1 && { borderBottomColor: theme.line, borderBottomWidth: 1 }]}>
              <View style={styles.text}>
                <Text variant="h3">{crew.name}</Text>
                <Text variant="small">
                  {[crew.category ? i18n.t(`arrival.categories.${crew.category}`) : null, crew.city, i18n.plural("crew.members", crew.members)].filter(Boolean).join(" · ")}
                </Text>
                {crew.description ? (
                  <Text variant="small" numberOfLines={1}>
                    {crew.description}
                  </Text>
                ) : null}
              </View>
              <Button
                label={i18n.t("crew.join")}
                accessibilityLabel={i18n.t("arrival.joinNamed", { crew: crew.name })}
                variant="secondary"
                height={44}
                loading={joining === crew.id}
                disabled={joining !== null && joining !== crew.id}
                onPress={() => void join(crew)}
              />
            </View>
          ))}
        </Panel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.blockGap },
  chipRow: { marginHorizontal: -space.screenX },
  chips: { gap: 8, paddingHorizontal: space.screenX, paddingVertical: 4 },
  rows: { gap: 0, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  text: { flex: 1, gap: 2 },
});
