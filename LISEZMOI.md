# Pour lancer Claude Code

1. Dézippe ce dossier dans un dossier vide, par exemple `soiree-crew`.
2. Optionnel mais utile : exporte les plans du canvas en images et mets-les dans `design/screens/`. Claude Code pourra comparer ses écrans avec la maquette.
3. Ouvre Claude Code dans ce dossier.
4. Colle ce message :

```
Lis CLAUDE.md, puis PROMPT.md en entier, puis tout le dossier design/. Commence par la phase 0 et lance les sous-agents. Fais-moi un point en français à la fin de chaque phase.
```

5. À chaque nouvelle session, colle plutôt :

```
Relis CLAUDE.md et FEATURES.md, puis reprends là où tu t'étais arrêté.
```

Ce qu'il y a dedans :
- `PROMPT.md` : le prompt maître, avec en plus une section qui l'oblige à reprendre le design validé.
- `design/` : la maquette (les 100 écrans en source), le design system (`DESIGN.md`, `tokens.json`, `icons.json`) et `SCREENS.md` qui décrit chaque écran, ses fonctions et ses animations.
- `CLAUDE.md` : la mémoire du projet que Claude Code relit à chaque session.

Il te demandera seulement ce qui bloque vraiment : comptes développeur Apple et Google, clés d'API, services payants.
