# How to read the prototype files

These `.dc.html` files come from a design canvas. They are a **spec**, not production code, and they do not run on their own (they need the canvas runtime, which is not included). Read them; do not port their code literally.

Each file is one board: several phone screens side by side (`<div class="pw">` = one screen with its caption, `<div class="ph">` = the 390×844 phone).

## Template syntax

- `{{name}}` or `{{obj.field}}`: a value computed in the logic class at the bottom of the file (`renderVals()`).
- `<sc-if value="{{flag}}">…</sc-if>`: shown only when `flag` is true.
- `<sc-for list="{{items}}" as="it">…</sc-for>`: repeated for each item, `{{it.x}}` inside.
- `onClick="{{handler}}"`, `onInput`, `onPointerDown`, etc.: event handlers returned by `renderVals()`.
- `<a href="Other.dc.html">`: navigation to another board.
- Classes (`btn`, `chip`, `row`, `pan`, `sheet`, `toast`, `sw`, `seg`, `tile`, `num`…) are defined in `design/base.css` and specified in `design/DESIGN.md`.

## The logic class

`class Component extends DCLogic` holds the screen state (`this.state`, `setState`) and lifecycle (`componentDidMount` for timers). It tells you exactly:

- what each control changes,
- the fake server delays used to show optimistic updates (around 900 ms),
- the timings of sequences (check-in signals every 650 ms, crash curve tick 120 ms, SOS hold 2 s…),
- the demo rules of every game (Autoroute checkpoints, bomb fuse range, roulette result from the final angle…).

Treat those rules as the intended behaviour, then implement them properly: real server responses instead of timeouts, real multi-touch for Le Doigt, real online players for Dessine vite, real maps, native widgets and Live Activities.

## Screens to check visually

The user can export images of the boards from the canvas into `design/screens/`. When images are there, compare your implementation with them screen by screen.
