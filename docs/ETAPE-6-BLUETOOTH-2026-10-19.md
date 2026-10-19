# Étape canonique 6 — Synchronisation Bluetooth

Date : 19 octobre 2026  
Dépôt : `audreymendomo23-netizen/NAXA`, branche `main`

## Fait

- Le bouton devient « Synchroniser un capteur cardiaque Bluetooth ».
- La page vérifie que le contexte est HTTPS et que l’API Web Bluetooth est disponible avant de proposer la connexion.
- Lecture du service standard `heart_rate` via notification GATT `heart_rate_measurement` (plutôt que de supposer que la caractéristique autorise une lecture directe).
- Délai maximal de 12 secondes pour recevoir une mesure ; les erreurs, annulations et navigateurs incompatibles affichent une solution de saisie manuelle sans prétendre qu’une donnée a été enregistrée.
- La valeur reçue est préremplie dans le formulaire existant : c’est l’unique écran de vérification. Rien n’est enregistré avant l’action explicite « Confirmer et enregistrer la mesure Bluetooth ».
- Après confirmation, la mesure garde la source `bluetooth` dans l’historique ; la source temporaire est effacée après un enregistrement réussi.
- Le suivi connecté reste réservé à sa cohorte de test ; aucune activation de l’univers commercial `suivi`, aucun seuil clinique et aucun conseil médical n’ont été ajoutés.

## Preuve

- Code sur `main`, commit : `561a0e9521aa4436b84f987a99a6625985ffc1db`.
- Fichier : [SuiviConnecte.tsx](https://github.com/audreymendomo23-netizen/NAXA/blob/main/src/components/suivi/SuiviConnecte.tsx)
- Feuille de route : [ROADMAP-CANONIQUE-6-ETAPES-2026-10-19.md](https://github.com/audreymendomo23-netizen/NAXA/blob/main/docs/ROADMAP-CANONIQUE-6-ETAPES-2026-10-19.md)

## Reste

- Aucun capteur Bluetooth physique n’est accessible depuis cet environnement : la connexion réelle sur Chrome Android, la notification GATT et les cas d’annulation ne peuvent donc pas être certifiés ici.
- Build Next.js et E2E navigateur non exécutés. Aucun déploiement Vercel manuel lancé.
- La connexion Bluetooth demande une action utilisateur et un capteur compatible exposant le service standard de fréquence cardiaque ; les autres capteurs ne sont pas pris en charge par cette intégration.

## Suite

Le chantier Bluetooth est implémenté sur `main`. La suite est de contrôler le build et le déploiement disponible sans utiliser CircleCI/Netlify, puis de confirmer le test matériel dès qu’un appareil compatible est accessible. Aucun déploiement manuel n’est déclenché sans l’ordre explicite prévu pour cela.
