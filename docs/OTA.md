# Corrections à distance sur iOS

GitHub Actions continue à produire les IPA iPhone et iPad. Après avoir installé un IPA équipé d’Expo Updates, l’app récupère les corrections disponibles au lancement. Sans connexion, elle démarre avec le code déjà présent sur l’appareil. Un téléchargement terminé peut être appliqué à la prochaine ouverture à froid.

## Activer Preview

1. Lier un projet Expo dont le slug correspond à celui dans `apps/mobile/app.json`. Créer les canaux `preview-iphone` et `preview-ipad`, chacun associé à sa branche Expo du même nom.
2. Renseigner `CREW_EXPO_PREVIEW_PROJECT_ID` (UUID du projet) dans les variables GitHub et `EXPO_TOKEN` dans les secrets GitHub. Le compte du jeton doit pouvoir publier sur le projet Expo.
3. Construire et installer le nouvel IPA Preview. Dans sa release, le fichier `ios-build-info-iphone.json` ou `ios-build-info-ipad.json` identifie le canal et le runtime intégrés.
4. Lancer le workflow **Expo OTA** depuis la branche qui contient la correction. Donner le tag exact de la release IPA installée et choisir l’appareil. Répéter pour l’autre appareil si nécessaire.
5. Ouvrir l’app connectée, la relancer après le téléchargement, puis vérifier le correctif et l’identifiant OTA dans Réglages. Vérifier aussi le démarrage hors ligne.

Une fois la Preview validée, renseigner `CREW_EXPO_PUBLIC_PROJECT_ID`, créer les canaux `public-iphone` et `public-ipad` de la même façon, puis sortir un IPA public. La publication OTA publique se lance depuis `main`. Les anciens IPA continuent à recevoir les nouvelles releases via GitHub.

## Compatibilité et retour arrière

Le workflow reprend la version, le numéro de build et le canal validés dans l’IPA. Il compare la correction au commit exact de cette release. Seuls les fichiers JS, TS et ressources prévus sous `apps/mobile/src`, ainsi que la documentation, peuvent changer. Un changement de dépendances, de code natif ou de configuration serveur impose un nouvel IPA. Chaque modèle et chaque build ont leur propre runtime.

Depuis Expo, republier une version OTA précédente sur le canal compatible, ou utiliser le retour au bundle embarqué pour ce runtime. Conserver le tag GitHub du build lorsqu’un correctif est publié permet de retrouver la version de l’IPA installée.
