# État du chantier — Parapharmacie, Bébé & Maman

**Mis à jour : 18 octobre 2026**  
**Branche de référence :** `main`  
**Dernier commit documenté avant cette mise à jour :** `8f28004138a2c3ceee137125d98994b120b919fe`

## Périmètre et règles

- Univers concernés : `parapharmacie` et `bebe-maman`.
- Les nouveaux produits restent en brouillon. La publication dépend du partenaire, de l'association partenaire-univers et de l'activation de l'univers.
- Le panier est local à l'appareil et les réservations sont regroupées par partenaire et univers.
- Le stock physique est décrémenté au retrait confirmé ; les mouvements restent journalisés et le stock ne peut pas devenir négatif.
- Aucun paiement en ligne ni service de livraison n'est ajouté à ces parcours.
- Préserver intégralement les tables et parcours historiques de la Pharmacie.
- Ne pas appliquer les migrations de ce chantier à Supabase Production sans autorisation explicite.

## Changements de code sur `main`

- `283ba8808aaa2a06ee84ead615915bc5420ed370` — suppression de séquences `\\n` littérales qui cassaient le JSX de la page du catalogue partenaire.
- `b27b18b23787582943916673df01cbd0497bf541` — aperçu CSV compatible avec les champs cités, séparateurs et retours à la ligne ; validation des quantités, seuils et dates ; messages d'import explicites.
- `493f989a74e3fe94b58786d8bb05dbd103de626f` — protection de l'export CSV contre les formules de tableur précédées d'espaces ou de caractères de contrôle.
- `3dec154143894a5382e8c73daff19c8f5481a40b` — migration additive 110 : expiration périodique des réservations multi-univers toutes les cinq minutes, sans toucher aux réservations Pharmacie.
- `d8be61d7934c5c9d9c6ada02d1c939422bad9de4` — migration additive 111 et RPC de lecture sécurisée des alertes stock/expiration ; les alertes ne sont plus limitées aux 200 produits récents affichés dans la liste.
- `a9061861c8a5ba7fda1e374c0532f14eaad31e90` — le panneau partenaire traite une réservation arrivée à expiration comme expirée et vérifie l'état réellement écrit après une transition pour ne pas afficher un faux succès.
- `c112b41a298c23e66bfda9ee05ec55d9996862d2` et `a7c70029c3dd41766d5808512c6146bfef74ca3a` — socle SQL des prestations à domicile : offres, demandes, coordonnées séparées et adresse exacte masquée jusqu’à confirmation ; accès direct aux écritures de demandes bloqué.
- `19c1b593fb9f28cc6db32b5615336e276804fdd7` — actions serveur pour envoyer une demande et l’annuler.
- `fce1aa9094c93896e055f38e18fb1011effccb40` — intégration des demandes à domicile dans l’espace client unique « Achats / Réservations / Commandes », sans bloquer le suivi Pharmacie si les tables de prestations ne sont pas encore installées.
- `d2baaa27e694abe4f5b003078bc6d386fc78a8ff` — cloche de notifications visible dans l’espace partenaire Prestations.
- `e2fc6bf4ca98dd7fe09b9b70ec07de361d834d0a` — migration 114 : notification in-app aux responsables du partenaire à la création d’une demande, et au client/partenaire lors des changements de statut, sans inclure l’adresse exacte dans le message.
- `c54c2f34621364bfbcf3932b97448b5fc893f307` et `39155462805398339504a477be706e8e78973f95` — migration 115 et interface de notifications : le destinataire peut marquer les notifications de prestations comme lues, et le badge est mis à jour sans toucher aux notifications historiques de la Pharmacie.
- `b92f876e11f28415e6abd5db7317c146e9d6e1b5` — l’interface permet également de marquer comme lues les notifications de validation d’offres.
- `418987b97e87db7c3cef23828268bd7e7246ea89` — cloche de notifications également disponible dans l’interface d’administration des prestations.
- `8963e5e77636a91808632b80f85573e284104106` — migration 113 : le partenaire ne peut plus publier directement une offre en contournant la validation administrative.
- `cf231cc6ab8140fc12dba0738901e769833d3d84` et `9e3645a0503d36906b3cd443e254e238380748a1` — catalogue public, formulaire de demande et reçu privé client.
- `6d3c94700fdeb29b1cf75667262428e0479928f6`, `18dcc1652223f33df35603f7b7bd19a1671ff78d`, `f8d83c18ad8833e8b14726af57cfa181c8954570`, `09950f9fcdd1c145441448a6e983dfcfe21703e6`, `8f28004138a2c3ceee137125d98994b120b919fe` — espace partenaire, validation administrative, navigation conditionnelle et verrouillage du type de partenaire.


- `5e17714961c63a5a6013390ede9c5bfb4844ea12` — réduction des lectures de coordonnées privées côté partenaire : l’interface ne demande les adresses exactes et téléphones que pour les demandes déjà `confirmed` ou `completed`. La RLS Supabase demeure la frontière de sécurité ; ce filtre UI/lecture applique en plus le principe de minimisation.

- `59216cbe6d387dc5f2dd7cc4c052a0ba72fd994c` — l’espace client unique permet désormais d’annuler directement une demande de prestation encore « En attente du professionnel » ; l’action serveur existante appelle la RPC contrôlée, confirme le statut réellement enregistré et redirige vers le reçu privé de la demande.

## Migrations SQL à valider

- Les migrations 098 à 109 constituent les dépendances des univers, catalogues, réservations et créneaux d'examens.
- Migration 110 : `supabase/migration_110_universe_reservation_expiry_cron.sql`.
- Migration 111 : `supabase/migration_111_partner_catalogue_alerts.sql`.
- Migration 112 : `supabase/migration_112_home_services_requests.sql`.
- Migration 113 : `supabase/migration_113_home_service_offer_publish_guard.sql`.
- Migration 114 : `supabase/migration_114_home_service_notifications.sql`.
- Migration 115 : `supabase/migration_115_mark_user_notification_read.sql`.
- Migration 116 : `supabase/migration_116_harden_universe_function_search_paths.sql`.
- Migration 117 : `supabase/migration_117_home_service_offer_notifications.sql`.
- Migration 118 : `supabase/migration_118_home_service_rls_indexes.sql`.
- La migration 110 exige l'extension `pg_cron` et programme le job `naxa-expire-universe-reservations`.
- La migration 111 dépend de la colonne `low_stock_threshold` ajoutée en migration 105.
- La migration 112 ajoute le socle des prestations à domicile ; elle dépend du socle partenaires/universes, notamment de la fonction `universe_partner_is_public` (migration 100).
- La migration 113 remplace la politique trop large d’écriture partenaire sur les offres : création en brouillon uniquement, modification/archivage possible, publication réservée à la fonction administrative.
- La migration 114 réutilise les notifications de la migration 075 ; les notifications ne contiennent jamais l’adresse exacte ni le téléphone du client.
- La migration 115 n’autorise le marquage que pour une notification dont l’utilisateur est le destinataire ; l’interface limite cette action aux notifications `home_service_request`.
- La migration 116 place explicitement `pg_temp` en dernier dans le `search_path` des fonctions `SECURITY DEFINER` du chantier pour éviter l’ombrage des objets `public`.
- La migration 117 avertit les administrateurs d’une nouvelle offre à valider et informe les responsables du partenaire lors d’une décision de publication, remise en brouillon ou archivage.
- La migration 118 optimise les prédicats RLS avec `(select auth.uid())` et ajoute les index de clés étrangères signalés par l’audit de performance.
- Ces fichiers sont du code source uniquement : aucune de ces migrations n'a été appliquée à Production dans ce chantier.

## Vérifications et déploiement

- Tests ciblés du parseur CSV exécutés sur des exemples avec séparateur cité, guillemets échappés, retour à la ligne cité et guillemet non fermé : réussis.
- Test structurel `supabase/tests/113_117_home_services_security_notifications.sql` exécuté sur le projet isolé `naxa-ci-replay-2` après application des migrations du périmètre : résultat `naxa_113_118_home_services_security_pass = true`.
- La migration 090 n’a pas pu être appliquée à cet environnement de test car il lui manque `private.produits_populaires(integer, integer)` ; ce blocage préexistant est hors du périmètre des prestations. Les migrations 091–118 ont été appliquées au projet de test, sans écriture dans Supabase Production.
- Compilation Next.js complète non vérifiée : Vercel a refusé la création d’un déploiement de prévisualisation avec `402 api-deployments-free-per-day` (quota quotidien atteint, réessai annoncé dans 24 h). Aucun déploiement Production n’a été lancé pour ce chantier.
- Aucun déploiement manuel n'a été lancé pour ce chantier. Les déploiements Vercel automatiques récents des commits `8963e5e77636a91808632b80f85573e284104106` et `88e3f2555824856bb3fff999608785b3ff386d88` sont `CANCELED`; le dernier déploiement `READY` de Production reste le commit ancien `b27b18b23787582943916673df01cbd0497bf541`. Le projet Vercel utilise une étape ignorée pour empêcher les publications automatiques pendant le codage. Une prévisualisation manuelle a été refusée par la limite quotidienne Vercel (`402 api-deployments-free-per-day`, réessai dans 24 h). Avant le déploiement autorisé, restaurer une configuration de build normale puis lancer un seul déploiement de la tête de `main`.
- Ne pas annoncer le chantier comme validé en Production tant que les migrations n'ont pas été vérifiées sur un environnement de test, que la compilation/suite de tests n'a pas été exécutée et que le déploiement final n'a pas été explicitement autorisé.

## Prochaine étape

Terminer les derniers ajustements du périmètre actuel (prestations à domicile : parcours partenaire/client, notifications de demande et publication), puis lancer en fin de chantier les vérifications de compilation, les tests SQL ciblés sur un environnement isolé et les contrôles des parcours. Aucun test ou migration ne doit écrire dans Supabase Production.


## Mise à jour — cahier des 6 univers du 18 octobre 2026

- **Commit de construction :** `5708f5ba2b22525bca77b4820d54d7699ee1d036` — migration additive 119 `supabase/migration_119_baby_mama_forbidden_terms_hardening.sql`.
- **Commit de test :** `8099df7479bc9edd21a6d4bb5424cb3db56da766` — test `supabase/tests/119_baby_mama_forbidden_terms.sql`.
- **But :** fermer des variantes FR/EN qui pouvaient contourner l’exclusion Bébé & Maman (laits infantiles et de croissance, préparations/substituts, céréales/farines infantiles, biberons, tétines, sucettes et variantes anglaises).
- **Protection :** le déclencheur reste limité à `bebe-maman`; le test comprend aussi un contrôle anti-faux-positif pour « lait de toilette bébé » et un contrôle de portée sur `parapharmacie`.
- **Preuve :** migration 119 appliquée au projet de test isolé `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`) ; test SQL exécuté avec résultat `naxa_119_baby_mama_forbidden_terms_pass = true`. Les contrôles incluent les variantes FR/EN, le faux positif « lait de toilette bébé » et la portée limitée à Bébé & Maman.
- **État honnête :** validation technique ciblée réussie en test ; migration non appliquée à Supabase Production. Statut : **🟢 VALIDÉ TECHNIQUEMENT — TEST ISOLÉ**, pas encore validé en production ni sur l’ensemble du parcours UI.
- **Pharmacie :** aucune table, route ou composant existant de la Pharmacie n’a été modifié par ces commits.


## Mise à jour — harmonisation des chartes du cahier du 18 octobre

- `9726f47c68bc1b8825f7245df5ac65d1d3d65914` — thèmes des pages d’accueil des univers alignés sur la palette approuvée : Parapharmacie `#0B7F85`, Bébé & Maman `#C93774`, Examens `#6D3FD0`, Prestations `#D4402B`, Dispositifs médicaux `#1D4ED8`.
- `0c4f467bf2470524047663240a9df4de24600b9f` — couleurs de la grille Parapharmacie et Bébé & Maman alignées.
- `0f8d315474375ad1991d4ba6026a4014defc35dd` — accents principaux de la page Examens alignés.
- `0d2ed4995dda14e415016060d59974f13f1b8575` — accents principaux de la page Prestations alignés.
- **Contraste calculé pour le texte blanc sur couleur forte :** Parapharmacie 4,79:1 ; Bébé & Maman 4,90:1 (teinte ajustée dans la même famille pour respecter 4,5:1) ; Examens 6,42:1 ; Prestations 4,60:1 ; Dispositifs 6,70:1.
- **État honnête :** corrections appliquées à `main`, mais compilation et parcours visuels non exécutés dans cette session. La Pharmacie et son thème n’ont pas été modifiés. Aucun déploiement lancé.


## Mise à jour — navigation vers les univers depuis les menus existants

- `c103c1f95781e598f172f36163c08213a95f8300` — ajout des libellés de navigation des univers en français et en anglais dans `src/lib/accueil-textes.ts`.
- `0149fb91063e08c01ed191fe5a10e7deb9c530ba` — ajout dans le menu trois-points de l’accueil Pharmacie de liens directs vers Pharmacie, Parapharmacie, Bébé & Maman, Dispositifs médicaux, Examens, Prestations à domicile et « Besoin d’aide ? ». Les liens sont ajoutés sans retirer les entrées existantes Client/Pharmacie.
- `4b0356debf6911e4bdb663a7e98fdb053c370df8` — correction des destinations du menu de `EnTeteClient` : les univers pointent maintenant vers leurs routes réelles, et « Besoin d’aide ? » vers `/aide` au lieu d’une recherche textuelle.
- **État honnête :** les destinations et libellés sont présents sur `main`, mais le build et les parcours navigateur ne sont pas encore exécutés. Le menu partagé a été construit et intégré depuis cette note ; voir la mise à jour ci-dessous. Le build et les parcours navigateur restent à prouver. Aucun déploiement Production n’a été lancé.


## Mise à jour — menu partagé des univers (18/10/2026)

- Création de `src/components/universes/MenuUnivers.tsx` : navigation trois-points vers les six univers et l’aide, avec libellés FR/EN selon `naxa-langue`.
- Intégration dans les pages partagées `UniverseLanding` et `UniverseCatalog`, ainsi que dans les pages actives Examens et Prestations.
- Gestion clavier et accessibilité : Échap ferme le menu et rend le focus au bouton ; clic extérieur ferme le menu ; cible tactile 44 px.
- Commits : `1b335954d243357160e605a97ecd0d07cd8aa6c6`, `3d594bc84391588fd07e2c7fa1bb19801388c8e7`, `c144c88ac54c44f3cc243126aa6194ec345a7dd5`, `97ea27b1947b7bc626c5180059219d652d88b422`, `d582740dfe44e11fad6be3d298a04e92bda52817`, `b7a3de6495fe523571cd46c376a2696d2e1b4597`.
- Statut : construit sur `main`, mais build complet et vérification navigateur non exécutés. Aucun déploiement Production ni écriture Supabase Production.
- Pharmacie : le nouveau composant est limité aux pages des univers ; le parcours Pharmacie existant n’a pas été modifié dans cette étape.


## Preuve de compilation — état observé après intégration du menu (18/10/2026)

- La vérification de statut GitHub sur le commit documentaire `4f549b2cff6f82ca2521670e30de5e16562ea56d` rapporte le contrôle Vercel en échec avec l’URL `upgradeToPro=build-rate-limit` : il s’agit de la limite de création de builds, pas d’un résultat d’erreur TypeScript exploitable.
- Le statut CircleCI est également signalé en échec mais n’est pas utilisé, conformément à `AGENTS.md` et au workflow courant.
- Aucun build local n’a pu être lancé depuis le connecteur GitHub dans cette étape ; le build reste donc non vérifié. Aucun déploiement Production n’a été déclenché.


## Correctifs de cohérence — navigation et dispositifs (18/10/2026)

- Icône du menu partagé ajustée en trois points verticaux, conforme au menu demandé. Commit : `303c2cee5405a9928cdfc8db252a94ec02c07242`.
- Route `/suivi` clarifiée : univers « Dispositifs médicaux » désactivé en phase 1, sans promesse de collecte ou de synchronisation de mesures de santé. Commit : `419279c691d1525171fe3c7ce8aee3866e26cb95`.
- État : modifications présentes sur `main`; compilation et tests navigateur restent à exécuter. Aucun déploiement Production ni écriture Supabase Production.


## État après les derniers correctifs (18/10/2026)

- Commit source du menu stable : `5a6c5e892c082c8f8d2c2c12ce8a4fcccb42ab87`.
- Documentation des correctifs : `c120e77707190acb9deed80b4405e2b5e85d2238`.
- Le statut GitHub « Vercel: success » associé au commit documentaire ne prouve pas un déploiement actif : le déploiement Vercel correspondant `dpl_BxTg8pbT83H438989MukcCXFquif`, ciblant Production, est observé à l’état `CANCELED`. Il n’est donc pas présenté comme publié.
- Le build complet et les tests de parcours ne sont toujours pas prouvés. Le contrôle Vercel précédent avait renvoyé une limite de création de build. Aucun déploiement Production réussi n’est revendiqué.

## Correction de cohérence UI — 18 octobre 2026
- `d36d908ad8e73f0bfcad7fc79f065daeb631813b`, `bc4d4bbe04427660b7df14d5e46ef8f826d6db55`, `a229d581b2f504aab0fc9163256059a60b435cee` — remplacement des messages d’erreur affichés aux clients : les détails internes sur les numéros de migrations ne sont plus exposés ; les messages indiquent une indisponibilité temporaire et une action compréhensible.


- `ebeb1b9a47f67623d91f642d952d5bae55451e35` — le badge « Bientôt disponible » n’est plus affiché par défaut sur les écrans de repli des univers actifs (Parapharmacie, Bébé & Maman, Examens médicaux, Prestations et Aide). Le badge reste explicite pour Dispositifs médicaux via `src/app/suivi/page.tsx` (`comingSoon`).
- `11f274acfe2b7180598cadf4b0437839e9e43100` — maintien explicite de l’état « à venir » pour l’univers Dispositifs médicaux, désactivé en phase 1.
- Contrôle réalisé : lecture statique des appels `UniverseLanding` et des routes concernées. Build Next.js et test navigateur non exécutés ; ne pas classer ce correctif comme validé techniquement ou en Production.
- `3ea901a4aa3a3482f091082ec2e728739d2554e6` — les boutons de réservation d’examens et de packs sont désactivés quand aucun créneau ouvert et disponible n’existe pour le centre ; évite une action apparemment valide qui échouerait forcément côté serveur.


## Audit groupé de sécurité et de parcours — 18 octobre 2026

- Rapport complet : `docs/AUDIT-BULK-UNIVERS-2026-10-18.md`.
- Audit statique effectué sur les six univers, les RPC de réservation multi-univers, les exclusions Bébé & Maman, les demandes à domicile, les notifications, les réservations d'examens et la navigation partagée.
- **Cause racine corrigée dans le code :** les RPC `reserve_universe_products` et `transition_universe_reservation` n'étaient pas incluses dans le durcissement de `search_path` de la migration 116.
- **Migration additive 120 :** `supabase/migration_120_harden_universe_reservation_search_paths.sql` place explicitement `pg_temp` en dernier pour les deux fonctions `SECURITY DEFINER`. Test structurel associé : `supabase/tests/120_universe_reservation_search_path.sql`.
- Commits : migration `a2dde11c34e45862f633a2ef181c1c1a4cbff321`, test final `8d484d5901ed2e8a5f90d50e93c6a5f6410ab5d1`, rapport `b9be13295017ab7f64b76dccabcea776795765c0`, registre `f631416ab7fb203f14948880789dbaad6d3aa2e0`.
- **Validation :** la correction et le test sont dans `main`, mais le test 120 n'a pas été exécuté, car l'accès au connecteur Supabase échoue avec `link_id must identify an eligible linked account`. Aucun projet n'a été modifié et aucune migration n'a été appliquée à Production.
- **Build et déploiement :** Vercel renvoie `upgradeToPro=build-rate-limit`. Le build Next.js, les parcours navigateur et un nouveau déploiement Production ne sont pas confirmés. CircleCI n'est pas utilisé comme gate.
- **Protection Pharmacie :** aucune table, route ni logique métier historique de la Pharmacie n'a été modifiée par la migration 120.
- **Statut :** audit statique terminé ; validation technique/fonctionnelle/Production encore bloquée par les preuves manquantes ci-dessus.


## Complément — Filtres client, partenaire et administration (18/10/2026)

- `/prestations` : recherche par prestation/professionnel/zone, filtre catégorie, tri par nom ou prix.
- `/partenaire/prestations` : recherche sur les offres et demandes, filtres de statut indépendants.
- `/admin/prestations` : recherche des offres soumises, filtre de statut et compteur des résultats.
- `/client` : recherche et filtre par statut des demandes à domicile dans l’espace « Achats / Réservations / Commandes » ; le reste du suivi (Pharmacie, panier, achats) conserve son fonctionnement.
- Ces filtres sont de présentation uniquement et ne changent ni les droits d’accès, ni les transitions de statut, ni l’accès aux coordonnées privées. Statut : code modifié ; aucun build/test navigateur n’est revendiqué.


## Complément — Filtres transversaux des six univers et du suivi (18/10/2026)

- `7fddde52f3bc6c0eb84f51b89f662ba3da665727` — `/prestations` : recherche par nom, catégorie, description, partenaire et zone ; filtre de catégorie ; tri par nom/prix ; compteur et état vide.
- `56200a3ed7e082b33337e0e30512c426b84251df` — `/partenaire/prestations` : recherche combinée des offres et demandes, filtres indépendants de statut, compteurs et états vides.
- `a8a487dce99c6d5499bacc62817196aa80cdc2fb` — `/admin/prestations` : recherche des offres à valider et filtre de statut avec compteur.
- `29928d90cee6958830f6177a40c000a40d32b827` — `/client` : recherche et filtre par statut des demandes à domicile.
- `685743cda8185214a81b11a5e56f15ecbe015ff0` — `/client` : recherche et filtre par statut des transactions Pharmacie/commandes, en complément du suivi déjà existant.
- Ces ajouts de présentation ne changent pas les règles de réservation, la séparation des univers, les statuts autorisés, les règles de retrait, les droits, ni l’accès aux coordonnées privées. La Pharmacie conserve ses routes et règles métier.
- Niveau de preuve : commits appliqués à `main`. Aucun build, test navigateur ou déploiement Production n’est revendiqué pour ce lot.
