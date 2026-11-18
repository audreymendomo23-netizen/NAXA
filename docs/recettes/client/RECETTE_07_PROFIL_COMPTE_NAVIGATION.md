# Recette 07 — Profil, compte et navigation Client

- Dépendance : Recette 09 validée sur ses critères P1.
- Replay uniquement ; données personnelles synthétiques.

## Cas bulk
1. Profil : affichage et modification nom, téléphone, e-mail ; confirmation e-mail si applicable.
2. Photo : import, caméra, recadrage, zoom, déplacement, sauvegarde, suppression et droits Storage.
3. Adresses : ajout manuel/GPS, catégories, repère, défaut, modification, suppression et adresse invalide.
4. Préférences de paiement : MTN/Orange/espèces, numéros, validation et persistance réelle.
5. Langue : français/anglais, rechargement et cohérence de toutes les pages.
6. Thème : jour/nuit, rechargement et persistance.
7. Notifications : préférences par événement/canal, autorisations Push, désactivation et révocation.
8. Mot de passe et sécurité de session : succès, erreur, session expirée et déconnexion.
9. Export des données : confirmation, périmètre, téléchargement et contrôle d'accès.
10. Suppression de compte : vérification mot de passe, confirmation, conséquences, révocation session et conservation légale éventuelle.
11. Navigation espace Client/professionnel : identité complète/incomplète, affectation active/révoquée et profil suspendu.
12. Navigation basse : destinations distinctes, URL, état sélectionné, historique navigateur et mobile.
13. Recherche générale, suggestions, menu univers, notifications et panier selon les permissions.
14. FAQ, aide, contact NAXA, formulaire et avis.
15. États vides, chargement, erreurs réseau, doubles clics et retour arrière.

## Contrôles
Distinguer données serveur et préférences locales. Tester deux sessions/appareils et vérifier qu'aucune donnée privée ne fuit. Le profil global suspendu ne doit pas être réactivé par une validation d'un autre dossier ou espace.

## Preuves
Playwright desktop/mobile + API/RLS/Storage + vérification DB/local storage explicitement séparée + nettoyage Replay.

État initial : NON EXÉCUTÉE.
