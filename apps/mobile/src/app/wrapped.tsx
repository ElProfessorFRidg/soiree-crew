import * as Sharing from "expo-sharing";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { radius } from "@crew/design-tokens";
import { useT, type Translator } from "@/i18n";
import { api } from "@/server/api";
import { useCrewData } from "@/server/crewData";
import { useTheme } from "@/theme";
import { Button } from "@/ui/Button";
import { Segmented } from "@/ui/controls";
import { Screen } from "@/ui/Screen";
import { SkeletonRows } from "@/ui/Skeleton";
import { Numeral, Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { showFailure } from "@/server/errors";
import { canShareImages } from "@/system/share";

interface Wrapped {
  period: "month" | "year";
  key: string;
  nights: number;
  parties: number;
  venuesVisited: number;
  topVenue: { name: string; visits: number } | null;
  regulars: { userId: string; name: string; nights: number }[];
  homeSafe: number;
  busiestWeekday: number | null;
  biggestNight: { name: string; at: number; people: number } | null;
  quote: { text: string; saidBy: string | null; votes: number } | null;
  drinks?: number;
  water?: number;
}

type Choice = "thisMonth" | "lastMonth" | "thisYear";

function periodOf(choice: Choice): { period: "month" | "year"; key: string } {
  const now = new Date();
  if (choice === "thisYear") return { period: "year", key: String(now.getFullYear()) };
  const date = choice === "lastMonth" ? new Date(now.getFullYear(), now.getMonth() - 1, 15) : now;
  return { period: "month", key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` };
}

function titleOf(w: Wrapped, crewName: string, i18n: Translator): string {
  const when =
    w.period === "year" ? w.key : new Intl.DateTimeFormat(i18n.locale, { month: "long", year: "numeric" }).format(new Date(`${w.key}-15T12:00:00`));
  return i18n.t("wrapped.heading", { crew: crewName, when });
}

/** N-15: the crew's month or year, one fact per card, and one image to share. */
export default function WrappedScreen() {
  const { crewId } = useLocalSearchParams<{ crewId: string }>();
  const i18n = useT();
  const theme = useTheme();
  const crew = useCrewData((state) => state.crews.find((c) => c.id === crewId));
  const [choice, setChoice] = useState<Choice>("thisMonth");
  const [data, setData] = useState<Wrapped | null>(null);
  const [sharing, setSharing] = useState(false);
  const card = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    setData(null);
    const { period, key } = periodOf(choice);
    void api<Wrapped>(`/v1/crews/${crewId}/wrapped?period=${period}&key=${key}`)
      .then(setData)
      .catch(showFailure(i18n));
    // offline only shows a toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewId, choice]);

  const share = async () => {
    if (!card.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(card, { format: "png", quality: 1, result: Platform.OS === "web" ? "data-uri" : "tmpfile" });
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: i18n.t("wrapped.share") });
      else throw new Error("unavailable");
    } catch {
      showToast({ tone: "danger", message: i18n.t("recap.shareFailed") });
    } finally {
      setSharing(false);
    }
  };

  const weekday = (d: number) => new Intl.DateTimeFormat(i18n.locale, { weekday: "long" }).format(new Date(2026, 10, 1 + d));
  const fact = (value: string, label: string) => (
    <View style={styles.fact}>
      <Numeral size={44} color={theme.amber}>
        {value}
      </Numeral>
      <Text variant="h3">{label}</Text>
    </View>
  );

  return (
    <Screen
      back
      title={i18n.t("wrapped.title")}
      withToasts
      footer={canShareImages && data && data.nights > 0 ? <Button label={i18n.t("wrapped.share")} icon="share" height={56} loading={sharing} onPress={() => void share()} /> : undefined}
    >
      <Segmented<Choice>
        accessibilityLabel={i18n.t("wrapped.title")}
        value={choice}
        items={[
          { value: "thisMonth", label: i18n.t("wrapped.thisMonth") },
          { value: "lastMonth", label: i18n.t("wrapped.lastMonth") },
          { value: "thisYear", label: i18n.t("wrapped.thisYear") },
        ]}
        onChange={setChoice}
      />
      {!data ? <SkeletonRows /> : null}
      {data && data.nights === 0 ? <Text>{i18n.t("wrapped.empty")}</Text> : null}
      {data && data.nights > 0 ? (
        // The shared image: a 9:16 frame, everything that matters in it.
        <View ref={card} collapsable={false} style={[styles.story, { backgroundColor: theme.surface }]}>
          <Text variant="h2">{titleOf(data, crew?.name ?? "", i18n)}</Text>
          {fact(i18n.number(data.nights), i18n.plural("wrapped.nights", data.nights))}
          {data.topVenue ? fact(data.topVenue.name, i18n.plural("wrapped.topVenue", data.topVenue.visits)) : null}
          {data.regulars[0] ? fact(data.regulars[0].name, i18n.plural("wrapped.regular", data.regulars[0].nights)) : null}
          {data.biggestNight ? fact(i18n.number(data.biggestNight.people), i18n.t("wrapped.biggest", { name: data.biggestNight.name })) : null}
          {data.busiestWeekday ? <Text variant="h3">{i18n.t("wrapped.weekday", { day: weekday(data.busiestWeekday) })}</Text> : null}
          {data.homeSafe > 0 ? <Text>{i18n.plural("wrapped.homeSafe", data.homeSafe)}</Text> : null}
          {typeof data.water === "number" && typeof data.drinks === "number" && data.drinks > 0 ? (
            <Text>{i18n.t("wrapped.drinksWater", { drinks: i18n.number(data.drinks), water: i18n.number(data.water) })}</Text>
          ) : null}
          {data.quote ? (
            <View style={styles.quote}>
              <Text variant="h3">{i18n.t("wrapped.quote", { text: data.quote.text })}</Text>
              {data.quote.saidBy ? <Text variant="small">{data.quote.saidBy}</Text> : null}
            </View>
          ) : null}
          <Text variant="small">{i18n.plural("wrapped.venues", data.venuesVisited)}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  story: { borderRadius: radius.card, padding: 24, gap: 18 },
  fact: { gap: 2 },
  quote: { gap: 4 },
});
