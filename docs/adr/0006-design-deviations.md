# ADR 0006: where the app departs from the approved prototype

Status: accepted, 2026-10-28.

## Context

The design in `design/` is approved and is ported as drawn. A few places cannot be ported as drawn, either because a standing rule of `PROMPT.md` outranks the board, or because what the board shows needs something this project does not have. Each case is listed here so that a reviewer comparing the app with the boards knows the difference is on purpose.

## Decisions

### Arrival flow (Arrivee board)

- **Consent before the profile.** The board asks for the weight on screen 4 and for the health-data consent on screen 7. SEC-08 and GDPR article 9 want explicit consent before the health data is collected, so the app asks for it first: Age, Welcome, Account (optional), Consent, Profile, Detected settings, Notifications, Crew. The screens themselves follow the board.
- **No Apple, Google, passkey or e-mail-link sign-in.** Screen 3 shows those four buttons. Accounts live on the crew's own server (ADR 0002): a username, with an optional e-mail and password, or a code from a phone already signed in. The account screen is the same form as in the Crew tab.
- **First name and nickname** are typed on the account screen, not on the profile screen, because they belong to the server account. Playing without an account skips both, and the Crew step.
- **No usage statistics switch.** The board has an optional "Statistiques d'usage" consent. The app collects no analytics, so there is nothing to consent to.
- **Reassurance lines removed** ("Personne d'autre ne le voit", "Tu peux retirer ton accord quand tu veux"). The owner asked for every line of that kind to go. Consent text keeps only what GDPR needs: what the data is and what happens without it, plus the link to the policy.

### Recipe pictures (Bar board)

- DESIGN.md §7 asks for real photos, or flat colour blocks until then. The app draws each of the 472 recipes (glass, colour, ice, garnish) in `bar/RecipeArt.tsx`, and the liquid keeps a two-stop vertical gradient at the owner's request. It is the only gradient in the app; `tools/slop-lint/design.mjs` allows it in that file alone.

## Consequences

- Reviewers check the arrival flow against this order, not the board's numbering.
- If accounts with platform sign-in are added later, screen 3 of the board can be ported as drawn and this section shrinks.
