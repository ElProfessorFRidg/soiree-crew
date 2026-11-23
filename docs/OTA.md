# Corrections à distance sur iOS

GitHub Actions continue à produire les IPA iPhone et iPad. Après avoir installé un IPA équipé d’Expo Updates, l’app récupère les corrections disponibles au lancement. Sans connexion, elle démarre avec le code déjà présent sur l’appareil. Un téléchargement terminé peut être appliqué à la prochaine ouverture à froid.

## Activer Preview

1. Lier un projet Expo dont le slug correspond à celui dans `apps/mobile/app.json`. Créer les canaux `preview-iphone` et `preview-ipad`, chacun associé à sa branche Expo du même nom.
2. Renseigner `CREW_EXPO_PREVIEW_PROJECT_ID` (UUID du projet) dans les variables GitHub et `EXPO_TOKEN` dans les secrets GitHub. Le compte du jeton doit pouvoir publier sur le projet Expo.
3. Construire et installer le nouvel IPA Preview. Dans sa release, le fichier `ios-build-info-iphone.json` ou `ios-build-info-ipad.json` identifie le canal et le runtime intégrés.
4. Pousser une correction JavaScript ou d’interface sur la branche de cette PR. Le workflow **Build** réutilise le dernier IPA compatible de cette PR. Depuis `main`, il utilise la dernière release publique. Le workflow **Expo OTA** permet aussi une publication manuelle à partir du tag exact d’un IPA.
5. Si un nouveau binaire est nécessaire, **Build** lance les compilations comme d’habitude. L’option **Force IPA** permet de demander un nouveau binaire explicitement.
6. Ouvrir l’app connectée, la relancer après le téléchargement, puis vérifier le correctif et l’identifiant OTA dans Réglages. Vérifier aussi le démarrage hors ligne.

Une fois la Preview validée, renseigner `CREW_EXPO_PUBLIC_PROJECT_ID`, créer les canaux `public-iphone` et `public-ipad` de la même façon, puis sortir un IPA public. La publication OTA publique se lance depuis `main`. Les anciens IPA continuent à recevoir les nouvelles releases via GitHub.

## Compatibilité et retour arrière

Le workflow reprend la version, le numéro de build et le canal validés dans l’IPA. Il compare la correction au commit exact de cette release. Les fichiers JS, TS et ressources prévus dans l’app et ses bibliothèques partagées sont éligibles. Les changements côté serveur et la documentation peuvent accompagner la publication. Un changement de dépendances, de code natif ou de configuration serveur impose un nouvel IPA. Chaque modèle et chaque build ont leur propre runtime.

Depuis Expo, republier une version OTA précédente sur le canal compatible, ou utiliser le retour au bundle embarqué pour ce runtime. Conserver le tag GitHub du build lorsqu’un correctif est publié permet de retrouver la version de l’IPA installée.


Les nouveautés OTA sont publiées dans GitHub, AltStore et l’écran Nouveautés. Elles ne changent ni le numéro ni le lien de téléchargement de l’IPA. Les deux variantes iOS ont chacune leur entrée. Les changements réservés au serveur et à la documentation n’entraînent pas de publication mobile.
