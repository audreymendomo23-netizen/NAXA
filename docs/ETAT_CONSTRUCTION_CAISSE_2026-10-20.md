# NAXA ERP — État de construction du parcours Caisse

Date : 20 octobre 2026  
Branche de travail : `main`  
Périmètre : construction statique et raccordements visibles dans le dépôt. Aucun test, aucune migration Supabase et aucun déploiement ne sont exécutés par cette intervention.

## Décisions prises par contradiction

1. Le cahier des charges est la référence fonctionnelle ; les composants et tables déjà présents priment sur la création de doublons.
2. Les pages dynamiques inconnues ne doivent pas se transformer silencieusement en page Clients : la route utilise désormais `notFound()` pour un segment non reconnu.
3. La recherche de clients et de crédits doit filtrer les données déjà chargées sans élargir le périmètre RLS ni inventer de fiches.
4. Les rapports doivent annoncer leur périmètre réel et offrir des périodes explicites. Les données restent limitées aux 500 ventes personnelles les plus récentes chargées ; elles ne sont pas présentées comme les résultats globaux de la pharmacie.
5. L’historique des ventes doit offrir recherche, statut et plage de dates. Le filtre ne modifie aucune donnée métier.
6. Aucun mode de paiement électronique n’est activé sans confirmation effective du canal marchand. Une référence saisie par l’utilisateur ne vaut pas preuve de paiement.
7. Les questions de seuils, plafonds, modes de paiement et règles de pharmacie ne sont pas résolues par des valeurs arbitraires en dur.

## Changements construits sur main

- `7eae31a` — `src/app/pharmacie/caisse/[section]/page.tsx`
  - rejet explicite des segments de route inconnus ;
  - recherche des clients et des crédits ouverts.
- `ddc359d` — même fichier
  - sélection de période des indicateurs (jour, 7 jours, 30 jours, ventes chargées) ;
  - avertissement visible sur le périmètre limité des données.
- `7c78713` — même fichier
  - filtres de dates de début et de fin pour l’historique.

Les écrans existants de clients, assurances, historique, annulations, rapports, profil, notifications et service restent réunis dans la route dynamique `src/app/pharmacie/caisse/[section]/page.tsx`. La barre latérale comporte les six destinations de navigation et l’action de déconnexion, soit sept entrées fonctionnelles au niveau du menu.

## Limites non corrigées dans cette passe

Ces points nécessitent un contrat métier confirmé, un raccordement serveur/base qui n’a pas été trouvé dans les chemins inspectés, ou une vérification d’exécution. Ils ne doivent pas être déclarés implémentés sur la seule base de l’interface.

- **Paiement fractionné / modes multiples** : le tableau de bord courant appelle `vente_encaisser_finaliser` pour le règlement en espèces ; le paiement fractionné et le rapprochement de deux modes ne sont pas démontrés.
- **Tiers payant au comptoir** : l’écran Assurances consulte couvertures et dossiers ; il ne démontre pas le calcul transactionnel complet de la part assureur et de la part client au moment de la vente.
- **API de vente décrite en Partie 2B** : dans `src/app/api/caisse`, seule la route `security` a été trouvée dans l’arborescence inspectée. La route de vente `POST /api/caisse/ventes` du document n’a pas été trouvée à cet emplacement.
- **File hors ligne** : le module `src/lib/caisse/hors-ligne.ts` décrit par la Partie 2B n’a pas été trouvé dans `src/lib/caisse` (où `calculs.ts` et `format.ts` sont présents). Pas de blocage de déconnexion/clôture fondé sur une file qui n’est pas présente à cet emplacement.
- **Fin de service complète** : le tableau de bord permet un comptage global et appelle `caisse_cloturer`, mais la grille de coupures, le fond conservé, la remise au coffre, les écarts par opérateur Mobile Money, les seuils paramétrés, l’approbation responsable et le rapport PDF ne sont pas démontrés dans le parcours inspecté.
- **Création de client / assuré** : les pages affichent les fiches et couvertures existantes ; elles n’offrent pas un parcours complet prouvé de création lié à une identité autorisée.
- **Rapports** : la période est désormais filtrable, mais la source reste limitée aux 500 ventes les plus récentes chargées ; ce n’est pas une agrégation serveur paginée.
- **Historique Auth** : le profil indique explicitement que les événements de connexion Auth ne sont pas disponibles dans les tables/API consultées.
- **Build, lint, typecheck, tests SQL/RPC, tests fonctionnels et RLS** : volontairement non exécutés conformément à la demande de laisser de côté les vérifications qui nécessitent des tests.

## État

- **Construction statique réalisée dans cette passe : VERT**, pour les changements de navigation invalide, recherche client/crédit, filtres de dates et période de rapports.
- **Parcours Caisse complet selon le cahier des charges : NON DÉMONTRÉ**. Les limites ci-dessus restent visibles et ne sont pas masquées par le statut de construction.
- **Tests et déploiement : NON EXÉCUTÉS**. Aucun déploiement n’est autorisé par cette intervention.

Ce document ne remplace pas les tests ni la validation des mutations sensibles en base.