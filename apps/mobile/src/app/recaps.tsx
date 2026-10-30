import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useT } from "@/i18n";
import { fetchRecaps, type RecapSummary } from "@/server/recapData";
import { useTheme } from "@/theme";
import { Row, Tag } from "@/ui/controls";
import { Icon } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";
import { showToast } from "@/ui/Toast";
import { SkeletonRows } from "@/ui/Skeleton";
import { EmptyState } from "@/ui/EmptyState";
import { showFailure } from "@/server/errors";

/** O-41: every recap is kept. */
export default function RecapsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const [recaps, setRecaps] = useState<RecapSummary[] | null>(null);

  const load = useCallback(
    () =>
      fetchRecaps()
        .then((data) => setRecaps(data.recaps))
        .catch(showFailure(i18n)),
    [i18n],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const date = (at: number) => new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(at));

  return (
    <Screen back title={i18n.t("recap.list")} withToasts onRefresh={load}>
      {recaps === null ? <SkeletonRows /> : null}
      {recaps && recaps.length === 0 ? <EmptyState icon="moon" text={i18n.t("recap.none")} /> : null}
      <View>
        {recaps?.map((recap, index) => (
          <Row
            key={recap.id}
            title={recap.name}
            subtitle={`${date(recap.startsAt)}, ${i18n.number(recap.going)} ${i18n.plural("recap.present", recap.going)}`}
            leading={<Icon name="x:sparkle" color={theme.textMuted} />}
            trailing={recap.seenAt === null ? <Tag label={i18n.t("recap.title")} tone="amber" /> : <Icon name="chev" color={theme.textMuted} />}
            onPress={() => router.push({ pathname: "/recap", params: { id: recap.id } })}
            last={index === recaps.length - 1}
          />
        ))}
      </View>
    </Screen>
  );
}
