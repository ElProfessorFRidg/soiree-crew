import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { estimateBac, type BodyProfile } from "@crew/bac";
import { palette } from "@crew/design-tokens";
import { breathRatio, countryRules, formatBacValue, type UiLanguage, type UserPreferences } from "@crew/units";
import { createTranslator } from "@/i18n";
import { formatClock } from "@/i18n/format";

// O-33 (Android): the home-screen widget. It runs in a headless task, outside the app, so it reads
// the persisted state straight from storage and computes the estimate itself, like the app does.

export const NIGHT_WIDGET = "Night";
/** Tokens are hex strings; the widget renderer wants them typed as such. */
const c = (hex: string) => hex as `#${string}`;
const STORE_KEY = "crew-app-v1";

interface Snapshot {
  title: string;
  line: string;
  water: string;
  pint: string;
}

interface StoredState {
  drinks?: { volumeMl: number; abv: number; consumedAt: number; withFood: boolean; id: string }[];
  profile?: BodyProfile | null;
  preferences?: UserPreferences;
  lockScreenNumbers?: boolean;
}

export async function readSnapshot(now = Date.now()): Promise<Snapshot> {
  let state: StoredState = {};
  try {
    state = (JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? "{}") as { state?: StoredState }).state ?? {};
  } catch {
    // Unreadable storage: the widget still shows its buttons.
  }
  const language = (state.preferences?.language ?? "fr") as UiLanguage;
  const i18n = createTranslator(language);
  const base = { title: i18n.t("widget.title"), water: i18n.t("widget.water"), pint: i18n.t("widget.pint") };
  const drinks = (state.drinks ?? []).filter((d) => d.abv > 0);
  if (!state.profile || !state.preferences || !drinks.length) return { ...base, line: i18n.t("widget.zero") };
  const estimate = estimateBac(drinks, state.profile, now);
  if (estimate.bac <= 0 || estimate.backToZeroAt === null) return { ...base, line: i18n.t("widget.zero") };
  const back = formatClock(estimate.backToZeroAt, language, state.preferences.hourCycle);
  // QOL-27: no figure on the home screen unless the person asked for it.
  if (!state.lockScreenNumbers) return { ...base, line: i18n.t("widget.backAt", { time: back }) };
  const ratio = breathRatio(countryRules(state.preferences.legalCountry));
  const value = `${formatBacValue(estimate.bac, state.preferences.bacUnit, ratio, i18n.locale)} ${i18n.t(`units.${state.preferences.bacUnit}`)}`;
  return { ...base, line: i18n.t("widget.levelBack", { value, time: back }) };
}

function Button({ label, uri, fill }: { label: string; uri: string; fill: boolean }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 14,
        backgroundColor: c(fill ? palette.accent.amber : palette.dark.surfaceRaised),
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TextWidget text={label} style={{ fontSize: 15, fontWeight: "700", color: c(fill ? palette.accent.onAccent : palette.dark.text) }} />
    </FlexWidget>
  );
}

export function NightWidget({ snapshot }: { snapshot: Snapshot }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: "match_parent", width: "match_parent", backgroundColor: c(palette.dark.bg), borderRadius: 22, padding: 14, flexDirection: "column", justifyContent: "space-between" }}
    >
      <FlexWidget style={{ flexDirection: "column" }}>
        <TextWidget text={snapshot.title} style={{ fontSize: 13, color: c(palette.dark.textMuted) }} />
        <TextWidget text={snapshot.line} style={{ fontSize: 18, fontWeight: "700", color: c(palette.dark.text) }} maxLines={2} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "row", flexGap: 8, width: "match_parent" }}>
        <Button label={snapshot.pint} uri="soireecrew://quick/again" fill />
        <Button label={snapshot.water} uri="soireecrew://quick/water" fill={false} />
      </FlexWidget>
    </FlexWidget>
  );
}
