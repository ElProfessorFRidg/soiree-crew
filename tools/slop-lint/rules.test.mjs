import { describe, expect, it } from "vitest";
import { check } from "./rules.mjs";

const rulesHit = (text, locale) => check(text, locale).map((f) => f.rule);

describe("SLOP-04 lint", () => {
  it("passes the reviewed DESIGN.md §9 samples", () => {
    const good = [
      "Pinte refusée : la soirée est fermée depuis {hours} h.",
      "Le serveur ne répond pas. On réessaie tout seuls.",
      "Pas de réseau. {count} actions partiront dès que tu captes.",
      "Estimation, pas un éthylotest. Ne prends jamais le volant sur cette base.",
      "Le Zinc est à toi.",
      "Doucement. Le récap est prêt.",
      "Encore debout ?",
    ];
    for (const text of good) expect(rulesHit(text, "fr")).toEqual([]);
  });

  it("catches each rule", () => {
    expect(rulesHit("Ta soirée — enfin", "fr")).toContain("R-01 dash");
    expect(rulesHit("Saved -- done", "en")).toContain("R-01 dash");
    expect(rulesHit("Drink added successfully", "en")).toContain("R-02 successfully");
    expect(rulesHit("Verre ajouté avec succès", "fr")).toContain("R-02 avec succès");
    expect(rulesHit("Santé 🍻🔥", "fr")).toContain("R-03 emoji count");
    expect(rulesHit("Allez !!", "fr")).toContain("R-06 stacked marks");
    expect(rulesHit("Vous avez bu 3 verres", "fr")).toContain("R-08 vous");
    expect(rulesHit("A seamless night out", "en")).toContain("R-10 English blacklist");
    expect(rulesHit("N'hésite pas à inviter le crew", "fr")).toContain("R-11 French blacklist");
  });

  it("does not flag hyphenated words or placeholders", () => {
    expect(rulesHit("check-in au Zinc, peut-être", "fr")).toEqual([]);
    expect(rulesHit("{count} drinks", "en")).toEqual([]);
  });
});
