import { afterEach, describe, expect, it } from "vitest";
import { answerConfirmation, cancelConfirmations, confirmAction, currentConfirmation } from "../confirm";

const spec = {
  title: "Delete?",
  body: "This cannot be undone.",
  confirmLabel: "Delete",
  cancelLabel: "Keep",
};

afterEach(() => cancelConfirmations());

describe("application-owned confirmations", () => {
  it("waits for a real answer and never executes a destructive action by default", async () => {
    const pending = confirmAction(spec);
    const current = currentConfirmation();
    expect(current?.title).toBe("Delete?");
    expect(current?.destructive).toBeUndefined();
    answerConfirmation(current!.id, false);
    expect(await pending).toBe(false);
    expect(currentConfirmation()).toBeUndefined();
  });

  it("serializes concurrent requests and ignores double responses", async () => {
    const first = confirmAction(spec);
    const second = confirmAction({ ...spec, title: "Second?" });
    const firstId = currentConfirmation()!.id;
    answerConfirmation(firstId, true);
    answerConfirmation(firstId, true);
    expect(await first).toBe(true);
    expect(currentConfirmation()?.title).toBe("Second?");
    const secondId = currentConfirmation()!.id;
    answerConfirmation(secondId, false);
    expect(await second).toBe(false);
  });

  it("resolves every pending confirmation as cancelled when its host goes away", async () => {
    const first = confirmAction(spec);
    const second = confirmAction(spec);
    cancelConfirmations();
    expect(await Promise.all([first, second])).toEqual([false, false]);
  });
});
