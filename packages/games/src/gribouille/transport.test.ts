import { describe, expect, it, vi } from "vitest";
import type { DrawingEvent } from "../drawing";
import { createRemoteTransport } from "./transport";

const p = (x: number) => ({ x, y: x });
const start: DrawingEvent = { type: "stroke.start", id: "a", colour: "#000000", width: 0.02, point: p(0) };
const extend = (x: number): DrawingEvent => ({ type: "stroke.extend", id: "a", points: [p(x)] });

describe("remote drawing transport", () => {
  it("shows events locally at once and sends one merged batch later", async () => {
    vi.useFakeTimers();
    const sent: DrawingEvent[][] = [];
    const transport = createRemoteTransport({ send: async (events) => void sent.push(events), delayMs: 100 });
    const seen: DrawingEvent[] = [];
    transport.subscribe((e) => seen.push(e));
    transport.send(start);
    transport.send(extend(0.1));
    transport.send(extend(0.2));
    expect(seen).toHaveLength(3);
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(150);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([start, { type: "stroke.extend", id: "a", points: [p(0.1), p(0.2)] }]);
    expect(transport.sentCount()).toBe(3);
    transport.dispose();
    vi.useRealTimers();
  });

  it("keeps events when the network fails and sends them on the retry, in order", async () => {
    vi.useFakeTimers();
    let fail = true;
    const sent: DrawingEvent[][] = [];
    const transport = createRemoteTransport({
      delayMs: 50,
      retryMs: 500,
      send: async (events) => {
        if (fail) throw new Error("offline");
        sent.push(events);
      },
    });
    transport.send(start);
    await vi.advanceTimersByTimeAsync(100);
    transport.send(extend(0.1));
    fail = false;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sent.flat().map((e) => e.type)).toEqual(["stroke.start", "stroke.extend"]);
    transport.dispose();
    vi.useRealTimers();
  });

  it("splits a long queue into requests of at most maxBatch events", async () => {
    const sizes: number[] = [];
    const transport = createRemoteTransport({ send: async (events) => void sizes.push(events.length), maxBatch: 3 });
    for (let i = 0; i < 7; i++) transport.send({ type: "undo" });
    await transport.flushNow();
    expect(sizes).toEqual([3, 3, 1]);
    transport.dispose();
  });

  it("replays the picture to a canvas that mounts late, and starts over after a reset", () => {
    const transport = createRemoteTransport({ send: async () => undefined });
    transport.receive([start, extend(0.1), extend(0.2)]);
    const late: DrawingEvent[] = [];
    transport.subscribe((e) => late.push(e));
    expect(late).toEqual([start, { type: "stroke.extend", id: "a", points: [p(0.1), p(0.2)] }]);
    transport.reset();
    expect(late[late.length - 1]).toEqual({ type: "clear" });
    const after: DrawingEvent[] = [];
    transport.subscribe((e) => after.push(e));
    expect(after).toEqual([]);
    transport.dispose();
  });

  it("hands events from the server to the canvas without sending them back", async () => {
    const send = vi.fn(async () => undefined);
    const transport = createRemoteTransport({ send });
    const seen: DrawingEvent[] = [];
    transport.subscribe((e) => seen.push(e));
    transport.receive([start, extend(0.3)]);
    await transport.flushNow();
    expect(seen).toHaveLength(2);
    expect(send).not.toHaveBeenCalled();
    expect(transport.sentCount()).toBe(0);
    transport.dispose();
  });
});
