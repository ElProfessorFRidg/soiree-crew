import type { Split } from "@crew/money";
import { newId } from "@/state/store";
import { api } from "./api";

export interface PoolSummary {
  id: string;
  name: string;
  currency: string;
  partyId: string | null;
  myBalance: number;
  members: number;
}

export interface PoolDetail {
  pool: { id: string; name: string; currency: string; partyId: string | null };
  members: { userId: string; name: string; payment: { iban?: string; link?: string } | null }[];
  expenses: { id: string; payerId: string; amount: number; currency: string; description: string; split: Split; at: number }[];
  repayments: { id: string; fromId: string; toId: string; amount: number; currency: string; at: number }[];
  settlement: { currency: string; balance: Record<string, number>; transfers: { fromId: string; toId: string; amount: number }[] }[];
}

export interface RoundsState {
  rounds: { id: string; payerId: string; amount: number; currency: string; memberIds: string[]; at: number }[];
  present: { userId: string; name: string }[];
  nextPayerId: string | null;
}

export function fetchPools(crewId: string): Promise<{ pools: PoolSummary[] }> {
  return api(`/v1/crews/${crewId}/pools`);
}

export function fetchPool(poolId: string): Promise<PoolDetail> {
  return api(`/v1/pools/${poolId}`);
}

export async function createPool(crewId: string, name: string, currency: string, memberIds: string[], partyId?: string): Promise<string> {
  const id = newId();
  await api(`/v1/crews/${crewId}/pools`, { method: "POST", body: { id, name, currency, memberIds, ...(partyId ? { partyId } : {}) } });
  return id;
}

export function addExpense(poolId: string, input: { payerId: string; amount: number; currency: string; description: string; split: Split }): Promise<unknown> {
  return api(`/v1/pools/${poolId}/expenses`, { method: "POST", body: { id: newId(), ...input } });
}

export function deleteExpense(poolId: string, expenseId: string): Promise<unknown> {
  return api(`/v1/pools/${poolId}/expenses/${expenseId}`, { method: "DELETE" });
}

export function recordRepayment(poolId: string, input: { fromId: string; toId: string; amount: number; currency: string }): Promise<unknown> {
  return api(`/v1/pools/${poolId}/repayments`, { method: "POST", body: { id: newId(), ...input } });
}

export function savePaymentDetails(input: { iban?: string; link?: string }): Promise<unknown> {
  return api("/v1/me/payment", { method: "PUT", body: input });
}

export function fetchRounds(partyId: string): Promise<RoundsState> {
  return api(`/v1/parties/${partyId}/rounds`);
}

export function logRound(
  partyId: string,
  input: { payerId: string; memberIds: string[]; drink: { presetId: string; kind: string; volumeMl: number; abv: number; name?: string }; amount: number; currency: string; description?: string },
): Promise<unknown> {
  return api(`/v1/parties/${partyId}/rounds`, { method: "POST", body: { id: newId(), ...input } });
}
