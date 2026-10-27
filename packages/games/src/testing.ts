import type { Player } from "./core";

/** Test players p1..pn. Lives next to the engines because every engine test uses it; not exported by the package. */
export function players(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, noAlcohol: false }));
}

/** Applies actions in order. */
export function run<S, A>(state: S, actions: readonly A[], reduce: (state: S, action: A) => S): S {
  return actions.reduce(reduce, state);
}
