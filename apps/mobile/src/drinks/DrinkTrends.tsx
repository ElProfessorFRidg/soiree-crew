import { useEffect, useState } from "react";
import { catalogueDrink, type CatalogueDrink } from "@crew/fuzzy";
import { Field } from "@/crew/Field";
import { useT } from "@/i18n";
import { api } from "@/server/api";
import { useSession } from "@/server/session";
import { showFailure } from "@/server/errors";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/controls";
import { Text } from "@/ui/Text";
import { catalogueLabel, searchCatalogue } from "./catalogue";

export interface DrinkTrend {
  drinkId: string;
  votes: number;
}

interface VenueTrends {
  trends: DrinkTrend[];
  crewTrends: DrinkTrend[];
  myDrinkId: string | null;
}

export function trendDrinks(trends: readonly DrinkTrend[]): CatalogueDrink[] {
  return trends.flatMap(({ drinkId }) => {
    const drink = catalogueDrink(drinkId);
    return drink ? [drink] : [];
  });
}

export function useDrinkTrends(venueId: string | null, crewId: string | null) {
  const session = useSession(state => state.session);
  const path = venueId ? `/v1/venues/${venueId}/drink-trends` : crewId ? `/v1/crews/${crewId}/drink-trends` : null;
  const [result, setResult] = useState<{ path: string; session: typeof session; trends: DrinkTrend[] } | null>(null);

  useEffect(() => {
    if (!path || !session) return;
    let active = true;
    type TrendsResponse = { trends: DrinkTrend[]; crewTrends?: DrinkTrend[] };
    const request = api<TrendsResponse>(path).catch(err => {
      if (!venueId || !crewId) throw err;
      return api<TrendsResponse>(`/v1/crews/${crewId}/drink-trends`);
    });
    void request.then(response => {
      const trends = response.trends.length ? response.trends : response.crewTrends ?? [];
      if (active) setResult({ path, session, trends });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [path, session, venueId, crewId]);

  return result?.path === path && result.session === session ? result.trends : null;
}

export function VenueDrinkTrends({ venueId }: { venueId: string }) {
  const i18n = useT();
  const [data, setData] = useState<VenueTrends | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const path = `/v1/venues/${venueId}`;

  useEffect(() => {
    let active = true;
    void api<VenueTrends>(`${path}/drink-trends`).then(response => {
      if (active) setData(response);
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [path]);

  const recommend = async (drinkId: string | null) => {
    setBusy(true);
    try {
      await api(`${path}/drink-recommendation`, { method: "PUT", body: { drinkId } });
      setData(await api<VenueTrends>(`${path}/drink-trends`));
      setQuery("");
    } catch (err) {
      showFailure(i18n)(err);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Text variant="small">{i18n.t("venue.trendsUnavailable")}</Text>;
  if (!data) return null;
  const local = trendDrinks(data.trends);
  const crew = trendDrinks(data.crewTrends);
  const mine = data.myDrinkId ? catalogueDrink(data.myDrinkId) : undefined;
  const results = searchCatalogue(query, i18n, 4, null, [...data.trends, ...data.crewTrends].map(trend => trend.drinkId));
  const names = (drinks: readonly CatalogueDrink[]) => drinks.map(drink => catalogueLabel(drink, i18n)).join(" · ");

  return (
    <Panel>
      <Text variant="h3">{i18n.t("venue.drinkTrends")}</Text>
      <Text>{local.length ? names(local) : i18n.t("venue.noDrinkTrends")}</Text>
      {crew.length ? (
        <>
          <Text variant="label">{i18n.t("venue.crewDrinkTrends")}</Text>
          <Text>{names(crew)}</Text>
        </>
      ) : null}
      <Field label={i18n.t("venue.recommendDrink")} value={query} onChangeText={setQuery} autoCorrect={false} editable={!busy} />
      {results.map(drink => (
        <Button
          key={drink.id}
          label={i18n.t("venue.recommendNamedDrink", { name: catalogueLabel(drink, i18n) })}
          variant="secondary"
          disabled={busy}
          onPress={() => void recommend(drink.id)}
        />
      ))}
      {mine ? (
        <Button
          label={i18n.t("venue.removeDrinkRecommendation", { name: catalogueLabel(mine, i18n) })}
          variant="outline"
          disabled={busy}
          onPress={() => void recommend(null)}
        />
      ) : null}
    </Panel>
  );
}
