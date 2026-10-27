import { create } from "zustand";
import { api } from "@/server/api";

/** JOY-01: the last cheers this phone was part of, from its own knock or the other phone's. */
export const useCheers = create<{ last: { withName: string; proof: boolean; at: number } | null }>(() => ({ last: null }));

export async function knock(crewId: string): Promise<void> {
  const res = await api<{ matched: boolean; withName?: string; proof?: boolean }>("/v1/cheers", { method: "POST", body: { crewId } });
  if (res.matched) useCheers.setState({ last: { withName: res.withName ?? "", proof: Boolean(res.proof), at: Date.now() } });
}

/** The live socket says the other phone matched this one's knock. */
export function onCheers(withName: string, proof: boolean): void {
  useCheers.setState({ last: { withName, proof, at: Date.now() } });
}
