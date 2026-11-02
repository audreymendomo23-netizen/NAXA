# Étape 1 — Cartographie des pages Administrateur NAXA
Date : 26 octobre 2026
Référence : branche `main`, cartographie du code source accessible à la date de l'examen.
Périmètre : routes `src/app/admin/**/page.tsx`, navigation Admin, layout partagé et dépendances directement visibles.
Méthode : lecture statique des 18 fichiers de page et du composant de navigation ; les fonctions des écrans sont inférées de leurs libellés, imports et accès aux données. Aucun écran n'a été testé dans un navigateur et aucune action métier n'a été exécutée.

## 1. Résultat d'inventaire

- **18 fichiers de page** repérés sous `src/app/admin/` par l'arbre GitHub récursif (réponse non tronquée).
- **12 entrées** dans `src/components/admin/AdminNavigation.tsx`.
- Les 18 pages ne sont pas toutes directement accessibles par la navigation latérale : les examens, la géolocalisation, les prestations, les détails pharmacie/partenaire et les rappels de lots ne figurent pas comme entrées de premier niveau dans le tableau de navigation observé.
- Le layout `src/app/admin/layout.tsx` appelle `requireAdminActive("/admin")` et enveloppe les pages de l'espace Admin. Plusieurs pages appellent également `requireAdminActive` elles-mêmes. Les pages client-side sans garde explicite dans leur fichier dépendent donc du layout serveur : cela doit être conservé et vérifié en test d'accès direct.
- La cartographie n'est pas une validation fonctionnelle ni une certification de sécurité. Les liens réels, permissions par action, états d'erreur et effets métier seront vérifiés à l'étape d'audit détaillé.

## 2. Cartographie des 18 pages

| # | Route | Fichier | Fonction apparente / données repérées | Visibilité navigation |
|---:|---|---|---|---|
| 1 | `/admin` | `src/app/admin/page.tsx` | Tableau de bord : pharmacies, stock horodaté, quartiers, validité Promoteurs, alertes, activité récente ; création de catalogue via `CatalogueCreation`. | Oui |
| 2 | `/admin/alertes` | `src/app/admin/alertes/page.tsx` | Alertes réseau calculées à partir des pharmacies et de la RPC `validites_promoteurs_admin`. | Oui |
| 3 | `/admin/journal` | `src/app/admin/journal/page.tsx` | Lecture du journal `audit_log`, 200 événements récents ; métadonnées brutes désormais masquées dans le rendu. | Oui |
| 4 | `/admin/messagerie` | `src/app/admin/messagerie/page.tsx` | Boîte de réception Admin, données `tickets_support` et `messages_support`, composant `AdminInbox`. | Oui |
| 5 | `/admin/promoteurs` | `src/app/admin/promoteurs/page.tsx` | Liste des dossiers Promoteurs/partenaires ; accès à `pharmacies` et `admin_partner_dossiers`. | Oui |
| 6 | `/admin/promoteurs/partenaires/[id]` | `src/app/admin/promoteurs/partenaires/[id]/page.tsx` | Détail d'un dossier partenaire et action de validation via `validerDossierPartenaire`. | Indirecte depuis les dossiers |
| 7 | `/admin/pharmacies/[id]` | `src/app/admin/pharmacies/[id]/page.tsx` | Dossier pharmacie : profil, rattachement Promoteur, services, conventions/abonnements, documents et historique. Plusieurs modèles documentaires coexistent. | Indirecte / lien à vérifier |
| 8 | `/admin/pilotage` | `src/app/admin/pilotage/page.tsx` | Pilotage réseau, RPC `stats_pilotage_scope`, indicateurs/agrégations côté client. | Oui |
| 9 | `/admin/pilotage/validite` | `src/app/admin/pilotage/validite/page.tsx` | Validité Promoteurs/conventions via `validites_promoteurs_admin`, action `reactiverPromoteur`. | Oui |
| 10 | `/admin/pilotage/rapports` | `src/app/admin/pilotage/rapports/page.tsx` | Rapports et exports CSV ; stockage/chargement côté client à examiner en audit détaillé. | Oui |
| 11 | `/admin/configuration` | `src/app/admin/configuration/page.tsx` | Configuration d'apparence/langue ; clés locales `naxa-theme-night-v1` et `naxa-langue`. Pas d'accès Supabase direct repéré dans la page. | Oui |
| 12 | `/admin/profil` | `src/app/admin/profil/page.tsx` | Profil Admin via `profiles` et client Supabase navigateur. | Oui |
| 13 | `/admin/produits` | `src/app/admin/produits/page.tsx` | Fiches produits/santé, table `produits`, génération de brouillon IA et enregistrement ; import de `PhotoUpload`. | Oui |
| 14 | `/admin/univers` | `src/app/admin/univers/page.tsx` | Univers, feature flags, partenaires, produits partenaires, professionnels de suivi et dossiers partenaires ; plusieurs actions Admin. | Oui |
| 15 | `/admin/prestations` | `src/app/admin/prestations/page.tsx` | Gestion des offres de services à domicile `home_service_offers` et statuts. | Non dans la liste latérale observée ; lien depuis Univers |
| 16 | `/admin/examens` | `src/app/admin/examens/page.tsx` | Centres, services, packs et rendez-vous d'examens : `exam_centers`, `exam_services`, `exam_packs`, `exam_appointments`. | Non dans la liste latérale observée ; lien depuis Univers |
| 17 | `/admin/geolocalisation` | `src/app/admin/geolocalisation/page.tsx` | Outils de synchronisation/géolocalisation, interface client-side. Route API et états d'erreur à auditer séparément. | Non dans la liste latérale observée |
| 18 | `/admin/rappels-lots` | `src/app/admin/rappels-lots/page.tsx` | Wrapper de 167 caractères qui délègue entièrement à `AdminRappelLotNotice`. Le comportement réel n'est pas visible dans le fichier de page et dépend du composant. | Non dans la liste latérale observée |

## 3. Navigation latérale observée

Le tableau `AdminNavigation` déclare ces 12 entrées, dans cet ordre :
1. Tableau de bord — `/admin`
2. Alertes réseau — `/admin/alertes`
3. Journal d’administration — `/admin/journal`
4. Messagerie — `/admin/messagerie`
5. Dossiers Promoteurs — `/admin/promoteurs`
6. Pilotage réseau — `/admin/pilotage`
7. Validité — `/admin/pilotage/validite`
8. Rapports — `/admin/pilotage/rapports`
9. Configuration — `/admin/configuration`
10. Profil — `/admin/profil`
11. Produits — `/admin/produits`
12. Univers & catalogue — `/admin/univers`

La correspondance de navigation est basée sur l'égalité exacte `pathname === section.href`. Il faut vérifier en navigateur l'état actif pour les sous-routes (ex. détail d'un partenaire ou d'une pharmacie) et décider si elles doivent garder l'entrée parent active. Aucun changement de navigation n'est appliqué à cette étape.

## 4. Layout partagé et garde d'accès

- `src/app/admin/layout.tsx` est le shell commun : navigation latérale, barre supérieure, compteur d'alertes et compteur de tickets ouverts.
- Le layout exécute `requireAdminActive("/admin")` et charge des données depuis `pharmacies`, `validites_promoteurs_admin` et `tickets_support`.
- Plusieurs pages serveur réexécutent explicitement `requireAdminActive`. Les pages client-side (`configuration`, `geolocalisation`, `pilotage`, `rapports`, `profil`) ne montrent pas toutes une garde dans leur propre fichier ; elles s'appuient sur le layout parent pour la protection de la route. Cette dépendance n'est pas à elle seule un défaut, mais doit être couverte par un test d'accès direct non authentifié et avec un compte inactif.
- La page détail pharmacie importe `supabaseAdmin` et `supabaseServer` directement ; ses contrôles d'autorisation internes et la séparation des opérations privilégiées doivent être examinés avec les actions serveur dans la phase détaillée.
- `/admin/rappels-lots` est un wrapper mince : l'audit de la route doit inclure `src/components/admin/AdminRappelLotNotice`.

## 5. Points de vigilance de cartographie (pas encore des conclusions de défaut)

1. **Découverte des pages :** 6 pages ne sont pas des entrées de premier niveau de la navigation latérale. Confirmer que chaque accès est voulu et qu'un lien parent fonctionnel existe.
2. **Pages à délégation :** rappels de lots et messagerie s'appuient sur des composants séparés ; la page seule ne permet pas de valider le comportement.
3. **Client vs serveur :** certaines pages utilisent le client Supabase navigateur, d'autres les accès serveur, et la page pharmacie importe un client admin privilégié. Auditer les autorisations et les mutations de chaque chemin, pas seulement la présence d'un garde de page.
4. **Données et indicateurs :** tableau de bord et layout recalculent chacun des signaux proches à partir de requêtes distinctes ; vérifier leur cohérence et la gestion d'erreurs.
5. **Modèles documentaires pharmacie :** `pharmacie_documents`/`pharmacie_document_historique` et `pharmacie_documents_recus`/`pharmacie_donnees_historique` sont tous deux référencés. Leur rôle doit rester explicite et ne pas être fusionné sans règle métier.
6. **États métier sensibles :** validation dossier, réactivation Promoteur, publication pharmacie et gestion des pièces justificatives nécessitent un audit transactionnel et des tests négatifs/positifs dédiés.

## 6. Critères de sortie de l'étape 1

- [x] Inventaire des routes de page Admin fourni par l'arbre Git, non tronqué.
- [x] Correspondance avec la navigation latérale documentée.
- [x] Layout et garde parent identifiés.
- [x] Routes dont le contenu est délégué à des composants signalées.
- [ ] Parcours navigateur et liens réels vérifiés.
- [ ] Autorisations et transitions métier vérifiées action par action.
- [ ] Tests d'accès et tests fonctionnels exécutés.

**Statut de l'étape 1 : cartographie statique réalisée.** Elle constitue l'entrée de l'étape suivante, l'audit détaillé page par page ; elle ne certifie pas encore le parcours Administrateur.

## 7. Contraintes opérationnelles respectées

- Travail direct sur `main`.
- Aucune branche ou pull request créée.
- Aucun déploiement déclenché.
- Aucune migration ni écriture Supabase effectuée pendant cette cartographie.
- Aucun test navigateur ou test automatisé n'est déclaré exécuté.

---

## Addendum — rapprochement du HEAD main (02 novembre 2026)

La cartographie ci-dessus demeure une photographie datée du 26 octobre 2026, où 18 fichiers de page avaient été recensés. Le contrôle récursif du HEAD main du 2 novembre trouve **19 fichiers page.tsx** sous src/app/admin/ et confirme toujours **12 entrées** dans AdminNavigation.tsx.

La 19e route à intégrer au registre est :

| # courant | Route | Fichier | Fonction / accès | Navigation |
|---:|---|---|---|---|
| 19 | /admin/pilotage/reglements | src/app/admin/pilotage/reglements/page.tsx | Vérification des règlements Promoteur en attente, consultation de l’historique, affichage des preuves privées et actions de confirmation/contestation. | Lien direct depuis /admin/pilotage/validite (« Gérer les règlements manuels »); pas d’entrée latérale dédiée. |

Cette route n’est donc pas orpheline : sa page parente Validité fournit un lien explicite vers elle. Son absence de la cartographie initiale était un défaut d’inventaire, pas un défaut d’accès.

### État de couverture corrigé

- Pages route détectées au HEAD du 02/11 : **19**.
- Entrées de navigation latérale : **12**.
- Route /admin/pilotage/reglements : recensée et accès parent identifié.
- Pages uniques / sous-routes : les fichiers de page restent un décompte technique; ils ne représentent pas nécessairement 19 fonctionnalités métier indépendantes.
- Revue visuelle de l’étape 12 du cahier principal : elle porte sur 18 pages dans son état documenté; la route règlements n’est pas explicitement incluse dans cette preuve visuelle. Son rendu et ses interactions restent à valider dans l’application.

Aucun changement de navigation n’est nécessaire pour corriger l’inventaire. Aucun lien entrant ne doit être inventé : le lien réel depuis la page Validité a été relu dans src/app/admin/pilotage/validite/page.tsx.
