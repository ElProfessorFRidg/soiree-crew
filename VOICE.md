# Voice (SLOP-01)

`SLOP.md` lists what never to write. This file says how the app does talk. French and English are written separately, each as a native speaker would say it, never one translated from the other. Terms come from `GLOSSARY.md`.

## Who is talking

A friend in the crew who stayed sharp: quick, warm, a bit cheeky about the night, never about the person's body or drinking. Serious and plain the moment safety, money or health is involved.

## French

- Tutoiement everywhere. Never « vous », never « on vous ».
- Spoken French, written correctly: « T'as », « Ça » are fine in light copy; full forms in safety and legal copy.
- Short sentences. One idea each. A full stop is better than a comma chain.
- French typography: a space before « : », « ? » and « ! », quotes as « » with spaces inside.
- Numbers, times and money through the formatters (`21 h 30`, `12,40 €`), never written by hand.

| Kind of text | Do | Don't |
|---|---|---|
| Button | « Noter la tournée », « Je suis bien rentré » | « Cliquez ici pour enregistrer votre tournée » |
| Empty state | « Pas encore de récap. Il arrive à la fin de la soirée. » | « Oups ! Rien à afficher pour le moment 😅 » |
| Error | « Montant invalide. » « Impossible de joindre le serveur. » | « Une erreur inattendue s'est produite. » |
| Safety | « Le poids se change demain : il sert au calcul de ce soir. » | jokes, emojis, exclamation marks |
| Notification | « Le récap est prêt » + what is in it | « 🔥 Ne rate pas ça !!! » |
| Game card | bite and rhythm, a real situation | lists of three adjectives, « véritable », « incontournable » |
| Recap | facts first, then one warm line | superlatives about how much someone drank |

## English

- Plain, friendly British-neutral English ("pints", "mates" only in game decks). Contractions are fine: "You're owed", "Can't".
- Functional text follows Simplified Technical English: short sentences, active voice, one meaning per word.
- Sentence case for buttons and titles: "Log the round", not "Log The Round".

| Kind of text | Do | Don't |
|---|---|---|
| Button | "See the recap", "I'm home" | "Click here to view your amazing recap" |
| Empty state | "No pool yet. The first round of a party starts one." | "Nothing to see here... yet! 🎉" |
| Error | "Invalid amount." "Can't reach the server." | "Something went wrong. Please try again later." |
| Safety | "Change your weight tomorrow: tonight's estimate uses it." | humour, hedging, "just" |
| Notification | "The recap is ready" + what is in it | "You won't believe what happened last night!" |

## Both languages

- Never praise drinking. Records are stated as figures, not celebrated (PROF-06).
- Never moralise either: say what the app does and why, once.
- No em or en dashes, no "not just X but Y", no rhetorical questions in functional copy (`SLOP.md`).
- Name things the same way everywhere (`GLOSSARY.md`): a "tournée" is always a round, a "cagnotte" always a pool.
- Every new string lands in both `fr.ts` and `en.ts` in the same commit, and goes through `pnpm lint:slop`.
