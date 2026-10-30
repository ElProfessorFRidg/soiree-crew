import { useCallback, useMemo } from "react";
import { useCrewData, type CrewMember } from "@/server/crewData";

/** QOL-11: the server's limit, so the field stops where the server would refuse. */
export const NICKNAME_MAX = 24;

/** Two players with the same name get told apart (QOL-11): « Lucas », « Lucas 2 ». */
export function distinctName(name: string, taken: readonly string[]): string {
  const base = name.trim();
  const lower = new Set(taken.map((n) => n.toLocaleLowerCase()));
  if (!lower.has(base.toLocaleLowerCase())) return base;
  let n = 2;
  while (lower.has(`${base} ${n}`.toLocaleLowerCase())) n += 1;
  return `${base} ${n}`;
}

/** What a crew member is called in this crew: the nickname the crew gave, else their name. */
export function baseName(member: Pick<CrewMember, "displayName" | "nickname">): string {
  return member.nickname?.trim() || member.displayName.trim() || "?";
}

/**
 * QOL-11: one label per person, never the same twice in a crew. Members come in join order (as the
 * server lists them), so whoever joined first keeps the plain name and the next « Lucas » becomes
 * « Lucas 2 »: the same on every phone, and stable while nobody leaves.
 */
export function distinctLabels(members: readonly Pick<CrewMember, "id" | "displayName" | "nickname">[]): Map<string, string> {
  const labels = new Map<string, string>();
  const taken: string[] = [];
  // Plain names first, so a nickname « Lucas 2 » given on purpose is not taken over by a numbered one.
  for (const m of members) {
    const name = baseName(m);
    if (!taken.some((t) => t.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      labels.set(m.id, name);
      taken.push(name);
    }
  }
  for (const m of members) {
    if (labels.has(m.id)) continue;
    const label = distinctName(baseName(m), taken);
    labels.set(m.id, label);
    taken.push(label);
  }
  return labels;
}

/** Labels for one crew, or for all my crews when no crew is given (first crew wins for a shared person). */
export function useCrewLabels(crewId?: string | null): Map<string, string> {
  const crews = useCrewData((state) => state.crews);
  return useMemo(() => {
    const scope = crewId ? crews.filter((c) => c.id === crewId) : crews;
    const out = new Map<string, string>();
    for (const crew of scope) for (const [id, label] of distinctLabels(crew.members)) if (!out.has(id)) out.set(id, label);
    return out;
  }, [crews, crewId]);
}

/**
 * QOL-11: the name to show for a person, the crew's way. `fallback` is the name the server sent,
 * used for anyone outside the crew (a guest at a party, a former member).
 */
export function useCrewNames(crewId?: string | null): (userId: string | null | undefined, fallback?: string) => string {
  const labels = useCrewLabels(crewId);
  return useCallback((userId, fallback) => (userId ? labels.get(userId) : undefined) ?? fallback ?? "?", [labels]);
}
