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

/** O-41: every recap is kept. */
export default function RecapsScreen() {
  const i18n = useT();
  const theme = useTheme();
  const [recaps, setRecaps] = useState<RecapSummary[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      void fetchRecaps()
        .then((data) => setRecaps(data.recaps))
        .catch(() => showToast({ tone: "danger", message: i18n.t("crew.offline") }));
    }, [i18n]),
  );

  const date = (at: number) => new Intl.DateTimeFormat(i18n.locale, { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(at));

  return (
    <Screen back title={i18n.t("recap.list")} withToasts>
      {recaps && recaps.length === 0 ? <Text>{i18n.t("recap.none")}</Text> : null}
      <View>
        {recaps?.map((recap, index) => (
          <Row
            key={recap.id}
            title={recap.name}
            subtitle={`${date(recap.startsAt)}, ${i18n.number(recap.going)} ${i18n.plural("recap.present", recap.going)}`}
            leading={<Icon name="sparkdot" color={theme.textMuted} />}
            trailing={recap.seenAt === null ? <Tag label={i18n.t("recap.title")} tone="amber" /> : <Icon name="chev" color={theme.textMuted} />}
            onPress={() => router.push({ pathname: "/recap", params: { id: recap.id } })}
            last={index === recaps.length - 1}
          />
        ))}
      </View>
    </Screen>
  );
}
