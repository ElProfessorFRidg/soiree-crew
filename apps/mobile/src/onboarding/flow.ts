import type { ProfileDraft } from "@/profile/ProfileFields";

// O-01 to O-05: which arrival steps a person sees, in which order. Kept free of React so the
// order, the progress count and the way back are tested on their own.

export type Step = "welcome" | "account" | "consent" | "profile" | "crew" | "notifications";

/** What the arrival flow keeps between launches (O-04 draft restored). */
export interface OnboardingDraft {
  step: Step;
  /** The account form opens on a new account or on "J'ai déjà un compte". */
  accountMode: "create" | "signin";
  /** The account step was opened at least once, so it counts in the progress. */
  accountVisited: boolean;
  /** Where the account step leads once the account exists (the crew step can send there). */
  accountReturn: Step | null;
  health: boolean;
  /** "Continuer sans calcul de taux": no body data, no profile step. */
  skippedHealth: boolean;
  consentAt: number | null;
  profile: ProfileDraft;
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
  health: boolean;
  /** A browser tab cannot send local reminders, so the web has no notifications step. */
  notificationsSupported: boolean;
}

/** The steps actually shown, welcome first. The crew step shows a short invite when signed out. */
export function visibleSteps(context: FlowContext): Step[] {
  const steps: Step[] = ["welcome"];
  if (context.accountVisited) steps.push("account");
  steps.push("consent");
  if (context.health) steps.push("profile");
  steps.push("crew");
  if (context.notificationsSupported) steps.push("notifications");
  return steps;
}

/** The step after this one, or "done". */
export function nextStep(step: Step, context: FlowContext): Step | "done" {
  const steps = visibleSteps(context);
  const index = steps.indexOf(step);
  if (index === -1) return "consent";
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
