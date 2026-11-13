import { describe, expect, it } from "vitest";
import { ageFromBirthDate, birthDateText, checklistDone, daysInMonth, legalAge, nextStep, previousStep, progress, visibleSteps, VISIBILITY_STEPS, type FlowContext } from "./flow";
import { CHOICE_ORDER, choicesFor, findableFor, isVisibilityKey, opensTo, VISIBILITY_ITEMS } from "./visibility";

const base: FlowContext = { signedIn: false, accountVisited: false, health: true, notificationsSupported: true, locationSupported: true };
const member: FlowContext = { ...base, signedIn: true, accountVisited: true };

describe("arrival steps (O-01 to O-05, PREF-02, PROF-01)", () => {
  it("goes through the whole flow with an account, one question per screen", () => {
    expect(visibleSteps(member)).toEqual([
      "welcome",
      "account",
      "photo",
      "consent",
      "bac",
      "region",
      "venues",
      "titles",
      "badges",
      "find",
      "presence",
      "crew",
      "notifications",
      "location",
      "closing",
    ]);
  });

  it("has no separate date-of-birth step: the account form asks it only when an account is created", () => {
    expect(visibleSteps(member)).not.toContain("birth");
    expect(visibleSteps({ ...member, accountFirst: true })).not.toContain("birth");
    expect(visibleSteps(base)).not.toContain("birth");
  });

  it("puts the crew step after the visibility screens and before the permissions", () => {
    const steps = visibleSteps(member);
    expect(steps.indexOf("crew")).toBe(steps.indexOf("presence") + 1);
    expect(steps.indexOf("crew")).toBeLessThan(steps.indexOf("notifications"));
    expect(visibleSteps(base)).not.toContain("crew");
  });

  it("has no visibility screen without an account: the server keeps what was chosen", () => {
    const steps = visibleSteps(base);
    for (const key of VISIBILITY_STEPS) expect(steps).not.toContain(key);
    expect(steps).toEqual(["welcome", "photo", "consent", "bac", "region", "notifications", "location", "closing"]);
  });

  it("has no BAC step without the health consent, and no notification or location step on the web", () => {
    expect(visibleSteps({ ...base, health: false, notificationsSupported: false, locationSupported: false })).toEqual(["welcome", "photo", "consent", "region", "closing"]);
  });

  it("asks for consent before the weight (SEC-08)", () => {
    const steps = visibleSteps(member);
    expect(steps.indexOf("consent")).toBeLessThan(steps.indexOf("bac"));
  });

  it("finishes after the closing screen", () => {
    expect(nextStep("closing", base)).toBe("done");
    expect(nextStep("region", member)).toBe("venues");
    expect(nextStep("presence", member)).toBe("crew");
    expect(nextStep("crew", member)).toBe("notifications");
  });

  it("goes back one screen at a time, past the account form once signed in", () => {
    expect(previousStep("account", member)).toBe("welcome");
    expect(previousStep("photo", member)).toBe("welcome");
    expect(previousStep("photo", { ...member, signedIn: false })).toBe("account");
    expect(previousStep("presence", member)).toBe("find");
    expect(previousStep("closing", member)).toBe("location");
    expect(previousStep("welcome", base)).toBeNull();
  });

  it("counts only the steps shown after the welcome screen", () => {
    expect(progress("photo", base)).toEqual({ index: 0, total: 7 });
    expect(progress("closing", member)).toEqual({ index: 13, total: 14 });
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

describe("date of birth (O-02)", () => {
  const now = Date.UTC(2026, 10, 12);
  it("counts whole years on the day", () => {
    expect(ageFromBirthDate("2008-11-12", now)).toBe(18);
    expect(ageFromBirthDate("2008-11-13", now)).toBe(17);
    expect(ageFromBirthDate("2000-02-29", now)).toBe(26);
  });
  it("refuses text that is not a day", () => {
    expect(ageFromBirthDate("2001-02-30", now)).toBeNull();
    expect(ageFromBirthDate("1800-01-01", now)).toBeNull();
    expect(ageFromBirthDate("soon", now)).toBeNull();
  });
  it("writes and measures dates the way the server reads them", () => {
    expect(birthDateText(1996, 5, 2)).toBe("1996-05-02");
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
  });
});

describe("visibility choices (PROF-01, PROF-02)", () => {
  it("has the five screens, each stored under its own server section", () => {
    expect(VISIBILITY_ITEMS.map((i) => i.section)).toEqual(["venues", "titles", "badges", "find", "presence"]);
    expect(isVisibilityKey("find")).toBe(true);
    expect(isVisibilityKey("records")).toBe(false);
  });
  it("offers the four audiences with the private one last and nothing chosen", () => {
    expect(CHOICE_ORDER).toEqual(["everyone", "friends", "crews", "me"]);
    expect(opensTo(undefined, "everyone")).toBe(false);
  });
  it("never offers Everyone for presence tonight: only crew mates ever see it", () => {
    expect(choicesFor("presence")).toEqual(["friends", "crews", "me"]);
    expect(choicesFor("badges")).toEqual(CHOICE_ORDER);
  });
  it("opens to a stranger only on Everyone", () => {
    expect(opensTo("everyone", "everyone")).toBe(true);
    expect(opensTo("friends", "everyone")).toBe(false);
    expect(opensTo("crews", "crews")).toBe(true);
  });
  it("lets the name be searched only on Everyone", () => {
    expect(findableFor("everyone")).toBe("search");
    expect(findableFor("crews")).toBeUndefined();
  });
});
