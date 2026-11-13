import type { ProfileDraft } from "@/profile/ProfileFields";
import type { Audience, VisibilityKey } from "./visibility";

// O-01 to O-05, PREF-02, PROF-01, PROF-02: which arrival steps a person sees, in which order. Kept free
// of React so the order, the progress count and the way back are tested on their own.

export type Step =
  | "welcome"
  | "account"
  | "birth"
  | "photo"
  | "consent"
  | "bac"
  | "region"
  | VisibilityKey
  | "crew"
  | "notifications"
  | "location"
  | "closing";

export type PermissionAnswer = "granted" | "skipped";

/** What the arrival flow keeps between launches: every answer is written as it is given. */
export interface OnboardingDraft {
  step: Step;
  /** The account form opens on a new account or on "J'ai déjà un compte". */
  accountMode: "create" | "signin";
  /** The account step was opened at least once, so it counts in the progress. */
  accountVisited: boolean;
  /** Where the account step leads once the account exists. */
  accountReturn: Step | null;
  health: boolean;
  /** "Continuer sans calcul de taux": no body data, no profile step. */
  skippedHealth: boolean;
  consentAt: number | null;
  profile: ProfileDraft;
  /** Date of birth as YYYY-MM-DD; only the age is ever shown. */
  birthDate: string | null;
  /** The profile photo, a small JPEG as a data address, kept on this phone. */
  photo: string | null;
  /** The photo is on the server too; false until it was sent (it needs an account). */
  photoSent: boolean;
  /** The audience chosen on each visibility screen; missing means not answered yet. */
  visibility: Partial<Record<VisibilityKey, Audience>>;
  permissions: Partial<Record<"notifications" | "location", PermissionAnswer>>;
  savedAt: number;
}

/** First days on the Party screen: the checklist, the settings card and what ticks them. */
export interface FirstRun {
  /** On once the new arrival flow was finished; older installs never see the cards. */
  active: boolean;
  /** Cards closed by hand. */
  dismissed: FirstRunCard[];
  invitedAt: number | null;
  playedAt: number | null;
}

export type FirstRunCard = "settings" | "checklist" | "preview" | "notifications";

export interface FlowContext {
  signedIn: boolean;
  accountVisited: boolean;
  /** Signing in to an account that exists asks for it first; a new account comes after the date of birth, so a minor never gets one. */
  accountFirst?: boolean;
  health: boolean;
  /** A browser tab cannot send local reminders, so the web has no notifications step. */
  notificationsSupported: boolean;
  /** Only the phone asks for its position. */
  locationSupported: boolean;
}

/** The visibility screens, in the order they come. They need an account: the server keeps what was chosen. */
export const VISIBILITY_STEPS: readonly VisibilityKey[] = ["venues", "titles", "badges", "find", "presence"];

/** The steps actually shown, welcome first. */
export function visibleSteps(context: FlowContext): Step[] {
  const steps: Step[] = ["welcome"];
  if (context.accountVisited && context.accountFirst) steps.push("account");
  // The date of birth is asked inside the account form, only when an account is created: a guest or someone signing in is never asked.
  if (context.accountVisited && !context.accountFirst) steps.push("account");
  steps.push("photo", "consent");
  if (context.health) steps.push("bac");
  steps.push("region");
  if (context.signedIn) steps.push(...VISIBILITY_STEPS, "crew");
  if (context.notificationsSupported) steps.push("notifications");
  if (context.locationSupported) steps.push("location");
  steps.push("closing");
  return steps;
}

/** The step after this one, or "done". A step that is no longer shown leads to the one that comes after its place. */
export function nextStep(step: Step, context: FlowContext): Step | "done" {
  const steps = visibleSteps(context);
  const index = steps.indexOf(step);
  if (index === -1) return steps[1] ?? "done";
  return steps[index + 1] ?? "done";
}

/** The way back skips the account form once the account exists: there is nothing left to fill. */
export function previousStep(step: Step, context: FlowContext): Step | null {
  const steps = visibleSteps(context).filter((s) => s === step || s !== "account" || !context.signedIn);
  const index = steps.indexOf(step);
  return index > 0 ? (steps[index - 1] ?? null) : null;
}

/** Progress after the welcome screen: "step n of total", counting only the steps shown. */
export function progress(step: Step, context: FlowContext): { index: number; total: number } {
  const steps = visibleSteps(context).slice(1);
  return { index: Math.max(0, steps.indexOf(step)), total: steps.length };
}

/** Legal drinking age of the country picked for the legal limit (O-02, decision D-04). */
export function legalAge(country: string): number {
  return country.startsWith("US") ? 21 : 18;
}

/** The age on the day `now`, from a YYYY-MM-DD date; null when the text is not a real date. */
export function ageFromBirthDate(birthDate: string, now: number): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  const today = new Date(now);
  const before = today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  return today.getUTCFullYear() - y - (before ? 1 : 0);
}

export function birthDateText(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function freshDraft(profile: ProfileDraft, health: boolean): OnboardingDraft {
  return {
    step: "welcome",
    accountMode: "create",
    accountVisited: false,
    accountReturn: null,
    health,
    skippedHealth: false,
    consentAt: null,
    profile,
    birthDate: null,
    photo: null,
    photoSent: false,
    visibility: {},
    permissions: {},
    savedAt: Date.now(),
  };
}

export interface ChecklistState {
  hasLogged: boolean;
  invited: boolean;
  played: boolean;
}

/** The first-run checklist goes once every item is ticked; it never comes back. */
export function checklistDone(state: ChecklistState): boolean {
  return state.hasLogged && state.invited && state.played;
}
