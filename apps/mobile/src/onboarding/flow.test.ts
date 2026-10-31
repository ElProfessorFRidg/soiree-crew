import { describe, expect, it } from "vitest";
import { checklistDone, legalAge, nextStep, previousStep, progress, visibleSteps, type FlowContext } from "./flow";

const base: FlowContext = { signedIn: false, accountVisited: false, health: true, notificationsSupported: true };

describe("arrival steps (O-01 to O-05)", () => {
  it("goes welcome, consent, profile, crew, notifications without an account", () => {
    expect(visibleSteps(base)).toEqual(["welcome", "consent", "profile", "crew", "notifications"]);
  });

  it("shows the account step only once it was opened", () => {
    expect(visibleSteps({ ...base, accountVisited: true })).toEqual(["welcome", "account", "consent", "profile", "crew", "notifications"]);
  });

  it("has no profile step without the health consent, and no notifications step on the web", () => {
    expect(visibleSteps({ ...base, health: false, notificationsSupported: false })).toEqual(["welcome", "consent", "crew"]);
  });

  it("finishes after the last step shown", () => {
    expect(nextStep("notifications", base)).toBe("done");
    expect(nextStep("crew", { ...base, notificationsSupported: false })).toBe("done");
    expect(nextStep("consent", { ...base, health: false })).toBe("crew");
  });

  it("goes back past the account form once signed in", () => {
    const signedIn = { ...base, signedIn: true, accountVisited: true };
    expect(previousStep("consent", signedIn)).toBe("welcome");
    expect(previousStep("consent", { ...signedIn, signedIn: false })).toBe("account");
    expect(previousStep("account", signedIn)).toBe("welcome");
    expect(previousStep("welcome", base)).toBeNull();
  });

  it("counts only the steps shown after the welcome screen", () => {
    expect(progress("consent", base)).toEqual({ index: 0, total: 4 });
    expect(progress("crew", { ...base, health: false, notificationsSupported: false })).toEqual({ index: 1, total: 2 });
  });

  it("asks 21 in the United States and 18 elsewhere", () => {
    expect(legalAge("US-CA")).toBe(21);
    expect(legalAge("FR")).toBe(18);
  });

  it("closes the checklist only once everything is ticked", () => {
    expect(checklistDone({ hasLogged: true, invited: true, played: false })).toBe(false);
    expect(checklistDone({ hasLogged: true, invited: true, played: true })).toBe(true);
  });
});
