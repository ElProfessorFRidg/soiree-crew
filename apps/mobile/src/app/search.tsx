import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GAMES } from "@crew/games";
import { search, type Candidate } from "@crew/fuzzy";
import { Field } from "@/crew/Field";
import { logDrink } from "@/drinks/actions";
import { drinkLabel } from "@/drinks/display";
import { presetFromCustom, presetsFor, type DrinkPreset } from "@/drinks/presets";
import { offerUndo } from "@/drinks/undoToast";
import { useGameT } from "@/games/i18n";
import { useT } from "@/i18n";
import { useCrewData } from "@/server/crewData";
import { fetchFriends } from "@/server/profileData";
import { useSession } from "@/server/session";
import { refreshVenues, useVenueData } from "@/server/venueData";
import { useAppStore } from "@/state/store";
import { useTheme } from "@/theme";
import { Avatar } from "@/ui/Avatar";
import { Chip, Row } from "@/ui/controls";
import { Icon, type AnyIconName } from "@/ui/Icon";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

type Hit =
  | { group: "venues"; id: string; title: string; crewId: string }
  | { group: "people"; id: string; title: string }
  | { group: "drinks"; id: string; title: string; preset: DrinkPreset }
  | { group: "games"; id: string; title: string };

const GROUPS: { group: Hit["group"]; icon: AnyIconName }[] = [
  { group: "venues", icon: "pin" },
  { group: "people", icon: "users" },
  { group: "drinks", icon: "glass" },
  { group: "games", icon: "dice" },
];
const RECENT_MAX = 6;

/** QOL-23: one search for bars, people, drinks and games; typos forgiven, recent searches kept. */
export default function SearchScreen() {
  const i18n = useT();
  const g = useGameT();
  const theme = useTheme();
  const me = useSession((state) => state.session?.userId);
  const crews = useCrewData((state) => state.crews);
  const venues = useVenueData((state) => state.byCrew);
  const unitSystem = useAppStore((state) => state.preferences.unitSystem);
  const hourCycle = useAppStore((state) => state.preferences.hourCycle);
  const customDrinks = useAppStore((state) => state.customDrinks);
  const recent = useAppStore((state) => state.recentSearches);
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<{ userId: string; name: string }[]>([]);
  useEffect(() => {
    for (const crew of crews) void refreshVenues(crew.id).catch(() => undefined);
    // Crews come from the cache at once; reloading their venues once per visit is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void fetchFriends()
      .then((list) => setFriends(list.friends))
      .catch(() => undefined);
  }, []);

  const candidates = useMemo(() => {
    const out: Candidate<Hit>[] = [];
    for (const [crewId, data] of Object.entries(venues)) {
      for (const v of data.venues) out.push({ value: { group: "venues", id: v.id, title: v.name, crewId }, names: [v.name] });
    }
    const people = new Map<string, string>();
    for (const crew of crews) for (const m of crew.members) if (m.id !== me) people.set(m.id, m.nickname ?? m.displayName);
    for (const f of friends) if (!people.has(f.userId)) people.set(f.userId, f.name);
    for (const [id, name] of people) out.push({ value: { group: "people", id, title: name }, names: [name] });
    const drinks = [...presetsFor(unitSystem), ...customDrinks.map(presetFromCustom)];
    for (const preset of drinks) {
      const title = drinkLabel(preset, i18n);
      out.push({ value: { group: "drinks", id: preset.id, title, preset }, names: [title] });
    }
    for (const game of GAMES) {
      const title = g.t(`games.${game.id}.name`);
      out.push({ value: { group: "games", id: game.id, title }, names: [title, g.t(`games.${game.id}.tagline`)] });
    }
    return out;
  }, [venues, crews, friends, me, unitSystem, customDrinks, i18n, g]);

  // Before typing: the crew's busiest bars right now, then two games to start a night.
  const ideas: Hit[] = [
    ...Object.entries(venues)
      .flatMap(([crewId, data]) => data.venues.filter((v) => v.kind !== "home").map((v) => ({ v, crewId })))
      .sort((a, b) => b.v.hereNow - a.v.hereNow)
      .slice(0, 3)
      .map(({ v, crewId }) => ({ group: "venues" as const, id: v.id, title: v.name, crewId })),
    ...(["bigDeck", "neverEver"] as const).map((id) => ({ group: "games" as const, id, title: g.t(`games.${id}.name`) })),
  ];
  const hits = query.trim().length >= 2 ? search(query, candidates, 24) : [];
  const remember = () => {
    const q = query.trim();
    if (q.length < 2) return;
    useAppStore.setState((s) => ({ recentSearches: [q, ...s.recentSearches.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX) }));
  };
  const open = (hit: Hit) => {
    remember();
    if (hit.group === "venues") router.push({ pathname: "/venue", params: { id: hit.id, crewId: hit.crewId } });
    else if (hit.group === "people") router.push({ pathname: "/profile", params: { id: hit.id } });
    else if (hit.group === "games") router.push({ pathname: "/games/[gameId]", params: { gameId: hit.id } });
    else {
      const drink = logDrink(hit.preset, Date.now(), false);
      if (drink) {
        router.back();
        offerUndo(drink, i18n, hourCycle);
      }
    }
  };

  return (
    <Screen back title={i18n.t("search.title")}>
      <Field
        label={i18n.t("search.label")}
        placeholder={i18n.t("search.placeholder")}
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={remember}
        maxLength={60}
      />
      {/* JOY-07: the crew's word for cheers gets an answer (EASTER_EGGS.md). */}
      {["tchin", "tchin tchin", "cheers", "salud", "prost", "santé", "sante", "saude", "saúde", "cin cin", "na zdorovie", "за здоровье"].includes(query.trim().toLowerCase()) ? (
        <Text variant="h2" align="center" color={theme.amber}>
          {i18n.t("search.eggCheers")}
        </Text>
      ) : null}
      {query.trim().length < 2 ? (
        <>
          {recent.length ? (
            <>
              <Text variant="label">{i18n.t("search.recent")}</Text>
              <View style={styles.chips}>
                {recent.map((r) => (
                  <Chip key={r} label={r} icon="clock" onPress={() => setQuery(r)} />
                ))}
              </View>
            </>
          ) : null}
          {ideas.length ? (
            <>
              <Text variant="label">{i18n.t("search.ideas")}</Text>
              {ideas.map((hit, index) => (
                <Row
                  key={`${hit.group}-${hit.id}`}
                  title={hit.title}
                  leading={<Icon name={GROUPS.find((x) => x.group === hit.group)!.icon} color={theme.textMuted} />}
                  trailing={<Icon name="chev" color={theme.textMuted} />}
                  onPress={() => open(hit)}
                  last={index === ideas.length - 1}
                />
              ))}
            </>
          ) : null}
        </>
      ) : hits.length === 0 ? (
        <Text>{i18n.t("search.none")}</Text>
      ) : (
        GROUPS.map(({ group, icon }) => {
          const list = hits.filter((h) => h.group === group);
          if (!list.length) return null;
          return (
            <View key={group}>
              <Text variant="label">{i18n.t(`search.group.${group}`)}</Text>
              {list.map((hit, index) => (
                <Row
                  key={`${group}-${hit.id}`}
                  title={hit.title}
                  subtitle={group === "drinks" ? i18n.t("search.tapToAdd") : undefined}
                  leading={group === "people" ? <Avatar personId={hit.id} name={hit.title} size={32} /> : <Icon name={icon} color={theme.textMuted} />}
                  trailing={group === "drinks" ? <Icon name="plus" color={theme.amber} /> : <Icon name="chev" color={theme.textMuted} />}
                  onPress={() => open(hit)}
                  last={index === list.length - 1}
                />
              ))}
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
