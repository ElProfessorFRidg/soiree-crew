import type { Recap } from "@/server/recapData";
import { narrationEn } from "./narrationText/en";
import { narrationFr } from "./narrationText/fr";

export type Tone = "plain" | "epic" | "roast";
export const TONES: readonly Tone[] = ["plain", "epic", "roast"];

/** The few facts a narration needs: first names, places, times. Nothing about anyone's drinks. */
export interface NightFacts {
  party: string;
  date: string;
  people: string[];
  venues: string[];
  firstIn: string | null;
  takeovers: { name: string; venue: string }[];
  rounds: number;
  lastHome: { name: string; time: string } | null;
  quote: string | null;
}

export function nightFacts(recap: Recap, nameOf: (id: string | undefined) => string, date: string, clock: (at: number) => string): NightFacts {
  const venues: string[] = [];
  for (const e of recap.timeline) if (e.kind === "checkIn" && e.venueName && !venues.includes(e.venueName)) venues.push(e.venueName);
  const arrivals = recap.timeline.filter((e) => e.kind === "arrival");
  const homes = recap.timeline.filter((e) => e.kind === "homeSafe");
  const last = homes[homes.length - 1];
  const quote = [...recap.quotes].sort((a, b) => b.votes - a.votes)[0];
  return {
    party: recap.party.name,
    date,
    people: recap.participants.map((p) => p.name),
    venues,
    firstIn: arrivals[0] ? nameOf(arrivals[0].userId) : null,
    takeovers: recap.timeline.filter((e) => e.kind === "takeover").map((e) => ({ name: nameOf(e.userId), venue: e.venueName ?? "" })),
    rounds: recap.timeline.filter((e) => e.kind === "round").reduce((sum, e) => sum + (e.count ?? 1), 0),
    lastHome: last ? { name: nameOf(last.userId), time: clock(last.at) } : null,
    quote: quote?.text ?? null,
  };
}

export type NarrationText = typeof narrationFr;

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/** A stable pick, so the same night and tone always read the same until the user asks for another. */
function pick<T>(list: readonly T[], seed: number): T {
  return list[Math.abs(seed) % list.length]!;
}

function list(names: string[], and: string): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/** AI-02 without AI: the night told from its facts, by templates written for each tone. */
export function narrate(facts: NightFacts, tone: Tone, language: "fr" | "en", variant = 0): string {
  const t = language === "fr" ? narrationFr : (narrationEn as NarrationText);
  const lines = t[tone];
  let seed = variant;
  for (const ch of facts.party) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const out: string[] = [];
  out.push(fill(pick(lines.opening, seed), { date: facts.date, party: facts.party, count: facts.people.length, people: list(facts.people.slice(0, 4), t.and) }));
  if (facts.venues.length === 1) out.push(fill(pick(lines.oneVenue, seed + 1), { venue: facts.venues[0]! }));
  else if (facts.venues.length > 1) out.push(fill(pick(lines.route, seed + 1), { venues: list(facts.venues, t.then), count: facts.venues.length }));
  if (facts.firstIn) out.push(fill(pick(lines.firstIn, seed + 2), { name: facts.firstIn }));
  for (const take of facts.takeovers.slice(0, 2)) out.push(fill(pick(lines.takeover, seed + 3), take));
  if (facts.rounds > 0) out.push(fill(pick(lines.rounds, seed + 4), { count: facts.rounds }));
  if (facts.quote) out.push(fill(pick(lines.quote, seed + 5), { quote: facts.quote }));
  if (facts.lastHome) out.push(fill(pick(lines.lastHome, seed + 6), facts.lastHome));
  out.push(pick(lines.closing, seed + 7));
  const story = out.join(" ");
  // A date often opens the story: the first letter is capitalised whatever the template.
  return story.charAt(0).toLocaleUpperCase(language) + story.slice(1);
}
