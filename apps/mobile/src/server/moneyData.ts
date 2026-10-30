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

export interface PoolExpense {
  id: string;
  payerId: string;
  /** In the expense's own currency. */
  amount: number;
  currency: string;
  /** N-19: the same amount in the pool's currency, when it was paid in another one. */
  poolAmount?: number | null;
  rate?: string | null;
  description: string;
  split: Split;
  at: number;
  createdBy?: string;
  party?: { id: string; name: string; kind: "party" | "trip" } | null;
  venue?: { id: string; name: string } | null;
  /** Signed link, valid an hour, handed to pool members only. */
  receiptUrl?: string | null;
}

export interface PoolDetail {
  pool: { id: string; crewId?: string; name: string; currency: string; partyId: string | null };
  members: { userId: string; name: string; addedAt?: number | null; payment: { iban?: string; link?: string } | null }[];
  expenses: PoolExpense[];
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

export interface NewExpense {
  payerId: string;
  amount: number;
  currency: string;
  description: string;
  split: Split;
  /** N-19: 1 unit of `currency` in the pool's currency, as typed; required when they differ. */
  rate?: string;
  partyId?: string;
  venueId?: string;
}

/** Returns the expense id, so a receipt can follow. */
export async function addExpense(poolId: string, input: NewExpense, id: string = newId()): Promise<string> {
  await api(`/v1/pools/${poolId}/expenses`, { method: "POST", body: { id, ...input } });
  return id;
}

/** N-19: the receipt photo, already re-encoded as JPEG by the phone (base64). */
export function uploadReceipt(poolId: string, expenseId: string, data: string): Promise<unknown> {
  return api(`/v1/pools/${poolId}/expenses/${expenseId}/receipt`, { method: "PUT", body: { data } });
}

/** O-70: brings crew members into an existing pool. */
export function addPoolMembers(poolId: string, userIds: string[]): Promise<{ added: number }> {
  return api(`/v1/pools/${poolId}/members`, { method: "POST", body: { userIds } });
}

/** N-20: my share of tonight's expenses so far, per currency. */
export function fetchPartySpend(partyId: string): Promise<{ spent: { currency: string; amount: number }[] }> {
  return api(`/v1/parties/${partyId}/spend`);
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
