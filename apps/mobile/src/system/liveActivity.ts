import { AppState, Platform } from "react-native";
import { estimateBac, estimateDriving } from "@crew/bac";
import { avatarColor, themes } from "@crew/design-tokens";
import { breathRatio, countryRules, drivingLimit, formatBacValue } from "@crew/units";
import { bacColor } from "@/drinks/display";
import { createTranslator, type Translator } from "@/i18n";
import { formatClock } from "@/i18n/format";
import { moodColour } from "@/party/mood";
import { useCrewData, type LiveParty, type Party } from "@/server/crewData";
import { useSession } from "@/server/session";
import { useAppStore } from "@/state/store";
import { initials } from "@/ui/Avatar";

// HUB-02 on iOS: the night on the lock screen and in the Dynamic Island, drawn by our own SwiftUI
// view (native/live-activity). Alone it shows the figure, glasses and the way back to zero; with
// the crew at a party it shows who is there and the alerts first. The countdowns are drawn by iOS
// from the dates, so they stay right with the app closed; the figure carries the time it was worked
// out. QOL-27: discreet by default, no figure and no name unless figures on the lock screen are on.

type LiveActivityModule = typeof import("expo-live-activity");

let module: LiveActivityModule | null | undefined;
function live(): LiveActivityModule | null {
  if (module !== undefined) return module;
  try {
    // Loaded on iOS only: the module has no Android or web side.
    module = Platform.OS === "ios" ? (require("expo-live-activity") as LiveActivityModule) : null;
  } catch {
    module = null;
  }
  return module;
}

/** What the Swift view decodes from the activity's subtitle. Every string is already translated. */
export interface NightPayload {
  mode: "solo" | "party";
  show: boolean;
  accent: string;
  startAt: number | null;
  zeroAt: number | null;
  limitFrac: number | null;
  bac: string | null;
  unit: string | null;
  bacColor: string | null;
  stamp: string;
  status: string | null;
  drinksN: number;
  waterN: number;
  drinks: string;
  water: string;
  under: string | null;
  zeroLabel: string | null;
  zeroIn: string;
  tonight: string;
  estimate: string;
  party: {
    name: string;
    venue: string | null;
    here: string;
    hereN: number;
    home: string | null;
    people: { i: string; c: string }[];
    more: number;
    alert: string | null;
    endsAt: number;
    ends: string;
    url: string;
  } | null;
  actions: { again: string; water: string; sos: string; home: string | null };
}

const FACES = 4;

/** The alert the crew would want first: someone very high, unwell, then gone quiet (O-88, N-36, N-29). */
function partyAlert(members: LiveParty["members"], me: string | null, i18n: Translator, show: boolean, dangerBac: number): string | null {
  const others = members.filter((m) => m.userId !== me && m.response === "going" && m.homeSafeAt === null);
  const danger = others.find((m) => m.bac !== null && m.bac >= dangerBac);
  const unwell = others.find((m) => m.unwellAt);
  const quiet = others.find((m) => m.quiet);
  const who = danger ?? unwell ?? quiet;
  if (!who) return null;
  if (!show) return i18n.t("liveActivity.alertDiscreet");
  if (who === danger) return i18n.t("liveActivity.danger", { name: who.displayName });
  if (who === unwell) return i18n.t("liveActivity.unwell", { name: who.displayName });
  return i18n.t("liveActivity.quiet", { name: who.displayName });
}

export function buildNightPayload(input: {
  now: number;
  party: Party | null;
  live: LiveParty | null;
  me: string | null;
}): NightPayload | null {
  const { now, party, live: partyLive, me } = input;
  const { profile, drinks, water, preferences, lockScreenNumbers } = useAppStore.getState();
  const i18n = createTranslator(preferences.language);
  const clock = (at: number) => formatClock(at, preferences.language, preferences.hourCycle);
  const rules = countryRules(preferences.legalCountry);
  const ratio = breathRatio(rules);
  const limit = drivingLimit(rules, preferences.driverCategory);
  const value = (bac: number) => formatBacValue(bac, preferences.bacUnit, ratio, i18n.locale);

  // Tonight's glasses: since the start of the party, or the last 12 hours when alone.
  const since = party ? Math.min(party.startsAt, now) - 3 * 3_600_000 : now - 12 * 3_600_000;
  const tonight = drinks.filter((d) => d.consumedAt >= since && d.consumedAt <= now);
  const alcohol = tonight.filter((d) => d.abv > 0);
  const waterN = water.filter((w) => w.at >= since && w.at <= now).length;
  const intakes = drinks
    .filter((d) => d.abv > 0)
    .map((d) => ({ id: d.id, volumeMl: d.volumeMl, abv: d.abv, consumedAt: d.consumedAt, withFood: d.withFood, ...(d.food ? { food: d.food } : {}) }));
  const estimate = profile && intakes.length ? estimateBac(intakes, profile, now) : null;
  const driving = profile && intakes.length ? estimateDriving(intakes, profile, now, limit) : null;
  const drinking = !!estimate && estimate.bac > 0 && estimate.backToZeroAt !== null;
  if (!drinking && !party) return null;

  const show = lockScreenNumbers;
  const zeroAt = drinking ? estimate!.backToZeroAt : null;
  const startAt = alcohol.length ? Math.min(...alcohol.map((d) => d.consumedAt)) : party ? party.startsAt : null;
  const under = driving && driving.underLimitAt !== null && driving.underLimitAt > now ? driving.underLimitAt : null;
  const span = zeroAt !== null && startAt !== null ? zeroAt - startAt : 0;
  const status = !estimate
    ? null
    : estimate.trend === "rising" && estimate.peak && estimate.peak.at > now
      ? i18n.t("liveActivity.rising", { time: clock(estimate.peak.at) })
      : estimate.trend === "falling"
        ? i18n.t("liveActivity.falling")
        : null;

  let partyPart: NightPayload["party"] = null;
  if (party) {
    const members = partyLive?.members ?? [];
    const here = members.filter((m) => m.response === "going" && m.homeSafeAt === null && (m.arrivedAt ?? m.lastActivityAt) != null);
    const homeN = members.filter((m) => m.response === "going" && m.homeSafeAt !== null).length;
    const hereN = here.length || members.filter((m) => m.response === "going").length;
    const venues = new Map<string, number>();
    for (const m of here) if (m.venue) venues.set(m.venue.name, (venues.get(m.venue.name) ?? 0) + 1);
    const venue = [...venues.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const shown = here.slice(0, FACES);
    // QOL-27: in discreet mode no name leaves the app, not even unshown.
    partyPart = {
      name: show ? party.name || i18n.t(`newParty.moods.${party.mood}` as "newParty.moods.party") : "",
      venue: show ? venue : null,
      here: i18n.plural("liveActivity.here", hereN),
      hereN,
      home: homeN ? i18n.plural("liveActivity.home", homeN) : null,
      people: show ? shown.map((m) => ({ i: initials(m.displayName), c: avatarColor(m.userId) })) : [],
      more: Math.max(0, here.length - shown.length),
      alert: partyAlert(members, me, i18n, show, 2.0),
      endsAt: party.endsAt,
      ends: i18n.t("liveActivity.ends", { time: clock(party.endsAt) }),
      url: `live?id=${encodeURIComponent(party.id)}`,
    };
  }

  return {
    mode: party ? "party" : "solo",
    show,
    accent: party ? moodColour(party.mood) : themes.dark.amber,
    startAt,
    zeroAt,
    limitFrac: under !== null && span > 0 && startAt !== null ? (under - startAt) / span : null,
    bac: show && estimate ? value(estimate.bac) : null,
    unit: show ? i18n.t(`units.${preferences.bacUnit}`) : null,
    bacColor: estimate ? bacColor(estimate.bac, limit) : null,
    stamp: i18n.t("liveActivity.stamp", { time: clock(now) }),
    status: show ? status : null,
    drinksN: alcohol.length,
    waterN,
    drinks: i18n.plural("party.drinks", alcohol.length),
    water: i18n.plural("party.waters", waterN),
    under: !show || !driving ? null : driving.rising ? i18n.t("party.drivingRising") : driving.tooCloseToCall ? i18n.t("liveActivity.driveClose") : under !== null ? i18n.t("liveActivity.under", { value: value(limit), time: clock(under) }) : null,
    zeroLabel: zeroAt !== null ? i18n.t("liveActivity.title", { time: clock(zeroAt) }) : null,
    zeroIn: zeroAt !== null ? i18n.t("liveActivity.zeroIn") : "",
    tonight: i18n.t("liveActivity.tonight"),
    estimate: i18n.t("liveActivity.estimate"),
    party: partyPart,
    actions: {
      again: i18n.t("quick.again"),
      water: i18n.t("quick.water"),
      sos: i18n.t("quick.sos"),
      home: party ? i18n.t("liveActivity.homeAction") : null,
    },
  };
}

let timer: ReturnType<typeof setTimeout> | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;

function currentParty(now: number): { party: Party | null; live: LiveParty | null } {
  const { parties, live } = useCrewData.getState();
  const party = parties.find((p) => p.myResponse === "going" && p.closedAt === null && p.startsAt <= now && p.endsAt >= now) ?? null;
  return { party, live: party ? (live[party.id] ?? null) : null };
}

export function syncLiveActivity(): void {
  const mod = live();
  if (!mod) return;
  const { liveActivityId, preferences } = useAppStore.getState();
  const i18n = createTranslator(preferences.language);
  const now = Date.now();
  const { party, live: partyLive } = currentParty(now);
  // Only used to leave my own alerts out of the party's.
  const me = useSession.getState().session?.userId ?? null;
  try {
    const payload = buildNightPayload({ now, party, live: partyLive, me });
    if (!payload) {
      if (liveActivityId) {
        mod.stopActivity(liveActivityId, { title: i18n.t("liveActivity.ended") });
        useAppStore.setState({ liveActivityId: null });
      }
      return;
    }
    const end = payload.zeroAt ?? payload.party?.endsAt ?? null;
    const state = {
      // The plain line is what an older view, or a payload it cannot read, falls back to.
      title: payload.zeroLabel ?? payload.party?.ends ?? i18n.t("liveActivity.tonight"),
      subtitle: JSON.stringify(payload),
      ...(end !== null ? { progressBar: { date: end } } : {}),
    };
    if (liveActivityId) mod.updateActivity(liveActivityId, state);
    else {
      const id = mod.startActivity(state, {
        backgroundColor: themes.dark.bg,
        titleColor: themes.dark.text,
        subtitleColor: themes.dark.textMuted,
        progressViewTint: themes.dark.amber,
        progressViewLabelColor: themes.dark.text,
        deepLinkUrl: "/",
        timerType: "digital",
      });
      if (id) useAppStore.setState({ liveActivityId: id });
    }
  } catch {
    // Live Activities turned off for the app, or an iOS older than 16.2: the app works without.
    useAppStore.setState({ liveActivityId: null });
  }
}

/** Follows what is logged and the party, and refreshes the figure each minute while the app is open. */
export function watchLiveActivity(): void {
  if (Platform.OS !== "ios") return;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(syncLiveActivity, 800);
  };
  const tick = (on: boolean) => {
    clearInterval(ticker);
    if (on) ticker = setInterval(syncLiveActivity, 60_000);
  };
  schedule();
  tick(true);
  AppState.addEventListener("change", (status) => {
    tick(status === "active");
    // Leaving the app: one last update so the figure on the lock screen is as fresh as it gets.
    schedule();
  });
  useAppStore.subscribe((state, previous) => {
    if (
      state.drinks === previous.drinks &&
      state.water === previous.water &&
      state.profile === previous.profile &&
      state.lockScreenNumbers === previous.lockScreenNumbers &&
      state.preferences === previous.preferences
    )
      return;
    schedule();
  });
  useCrewData.subscribe((state, previous) => {
    if (state.parties !== previous.parties || state.live !== previous.live) schedule();
  });
}
