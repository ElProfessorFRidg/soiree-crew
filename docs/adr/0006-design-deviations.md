# ADR 0006: where the app departs from the approved prototype

Status: accepted, 2026-10-28.

## Context

The design in `design/` is approved and is ported as drawn. A few places cannot be ported as drawn, either because a standing rule of `PROMPT.md` outranks the board, or because what the board shows needs something this project does not have. Each case is listed here so that a reviewer comparing the app with the boards knows the difference is on purpose.

## Decisions

### Arrival flow (Arrivee board)

- **Consent before the profile.** The board asks for the weight on screen 4 and for the health-data consent on screen 7. SEC-08 and GDPR article 9 want explicit consent before the health data is collected, so the app asks for it first.
- **Fewer steps before the app.** The order is Age, Welcome, Account (only when "Créer un compte" or "J'ai déjà un compte" is picked), Consent, Profile (only with the consent), Crew, Notifications. Without an account the Crew step is a short "Ton crew t'attend" invite to make one. The progress bar counts only the steps shown.
- **Detected settings left the flow.** Screen 5 becomes a closable card on the first Party screen ("Réglé pour la France · Modifier") that opens Settings, Region. Everything on that screen was already guessed right for most people, and it delayed the first value.
- **Notifications come last and ask the phone there.** The step says what will ring, then the system prompt follows on "Terminer" when at least one reminder is on. Reminders and sign-in no longer ask by themselves, so no prompt comes up in the middle of a party; switching a reminder on later asks, after an explanation. Location, camera and photos are asked at first use, after a short explanation sheet (`system/askPermission.ts`), never during the arrival.
- **Going on without the consent.** The board keeps "Continuer" disabled until the switch is on. The app also offers "Continuer sans calcul de taux": games, the Bar and the crew work, the Party screen shows a calm card with a button to give the consent later (`/health-consent`).
- **Welcome screen.** Three small value cards (the estimate and its way back to zero, the crew, games and the Bar) fill the space under the title; "Jouer sans compte" became "Continuer sans compte", since drinks and the estimate work without an account too.
- **No Apple, Google, passkey or e-mail-link sign-in.** Screen 3 shows those four buttons. Accounts live on the crew's own server (ADR 0002): a username alone, with an optional e-mail and password added later in Moi, or a code from a phone already signed in. The account screen is the same form as in the Crew tab, official server preselected and "Changer" for another one.
- **First name and nickname** are not asked on the profile screen: the username typed for the account is also the name the crew sees until it is changed in Moi.
- **No usage statistics switch.** The board has an optional "Statistiques d'usage" consent. The app collects no analytics, so there is nothing to consent to.
- **Reassurance lines removed** ("Personne d'autre ne le voit", "Tu peux retirer ton accord quand tu veux"). The owner asked for every line of that kind to go. Consent text keeps only what GDPR needs: what the data is and what happens without it, plus the link to the policy.

### Recipe pictures (Bar board)

- DESIGN.md §7 asks for real photos, or flat colour blocks until then. The app draws each of the 472 recipes (glass, colour, ice, garnish) in `bar/RecipeArt.tsx`, and the liquid keeps a two-stop vertical gradient at the owner's request. It is the only gradient in the app; `tools/slop-lint/design.mjs` allows it in that file alone.

## Consequences

- Reviewers check the arrival flow against this order, not the board's numbering.
- If accounts with platform sign-in are added later, screen 3 of the board can be ported as drawn and this section shrinks.
