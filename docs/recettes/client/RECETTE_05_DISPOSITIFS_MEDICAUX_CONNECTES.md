# Recette 05 — Dispositifs médicaux connectés / suivi privé

- Dépendance : Recette 09 validée sur ses critères P1.
- Replay et simulateurs autorisés uniquement ; aucune donnée de santé réelle.
- Ce parcours est un suivi privé conditionné, pas un catalogue commercial de dispositifs.

## Cas bulk
1. Accès avec `suivi_is_enabled_user=true`, false, erreur RPC et session absente.
2. Liste appareils, filtres, ajout, activation/désactivation, retrait et reconnexion.
3. Bluetooth : permission accordée/refusée, appareil absent, appairage, déconnexion, signal perdu, reconnexion.
4. Mesure automatique : réception, validation, doublon, valeur hors plage, horodatage et unité.
5. Mesure manuelle : saisie, préremplissage, correction, validation et erreur.
6. Historique : pagination, filtres, courbes, absence de mesure et fuseaux horaires.
7. Alertes : seuil, création, modification, activation, désactivation, suppression et acquittement.
8. Rappels : création, horaires, répétition, permission notification refusée, modification et suppression.
9. Programmations : jours/heures, pause, reprise, modification et suppression.
10. Consentements : lecture, acceptation, retrait et effet immédiat.
11. Partage professionnel : recherche, sélection de familles de données, partage, révocation, accès notes et déconnexion.
12. Dossier clinique et export PDF : contenu, autorisation, téléchargement, révocation et lien expiré.
13. Synchronisation hors ligne : file locale, reprise réseau, doublons et ordre temporel.
14. Assistance à domicile : création, contexte d'origine et suivi.

## Sécurité et preuves
Isolation entre Clients ; refus d'accès sans activation ; aucun partage après révocation ; journal de consentement ; tests UI simulés + API/RPC/SQL. Une simulation Bluetooth navigateur ne prouve pas un fonctionnement sur appareil physique.

État initial : NON EXÉCUTÉE.
