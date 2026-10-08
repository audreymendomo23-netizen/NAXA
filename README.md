# NAXA : base de l'application

Votre médicament, à 2 minutes. Next.js 14 + Supabase + Tailwind, PWA, 100 % offre gratuite.

## Démarrage
1. npm install
2. Créer un projet Supabase (gratuit). Dans Database > Extensions, activer pg_cron.
3. Dans l'éditeur SQL, exécuter dans cet ordre : supabase/schema.sql, supabase/migration_002_catalogue_panier.sql, supabase/migration_003_security_hardening.sql, supabase/migration_004_corrections.sql, supabase/migration_006_auth_profile_age_gate.sql, supabase/migration_007_pharmacie_promoteur_caisses.sql, supabase/migration_008_pharmacie_promoteur_caisses.sql, puis (démo seulement) supabase/seed.sql.
4. Planifier l'expiration des réservations avec le job naxa-expire toutes les 5 minutes.
5. Copier .env.example vers .env.local et renseigner les clés. La clé service_role ne doit jamais être exposée.
6. npm run dev, puis ouvrir /admin après avoir configuré un compte administrateur.

## Fonctionnalités
Recherche et scan d'ordonnance (OCR avec choix import téléphone/caméra), accès protégé par connexion pour les actions opérationnelles, traduction des noms de médicaments du bandeau « Les plus recherchés », classement prix/distance/temps, circulation, réservation 3 h, WhatsApp, paiement guidé par code marchand, reçu imprimable, panneau pharmacie, espace admin, fiches produits, panier et PWA.

Aucune photo de médicament n'est fournie : à ajouter par l'équipe NAXA (droits d'usage à vérifier).

## État

### Phase 0 — terminée et validée
- Cahier des charges et prompt maître lus et pris comme sources de vérité.
- Code existant conservé ; aucune réécriture de l'application.

### Phase 1 — fondations — consolidée
- Projet Supabase NAXA connecté et sain.
- Schéma initial + migrations catalogue/panier, sécurité et âge appliqués.
- RLS activé sur les tables publiques concernées.
- Données de démonstration chargées.
- pg_cron activé et expiration des réservations planifiée toutes les 5 minutes.
- Parcours compte : connexion username/mot de passe, récupération username → OTP e-mail → changement de mot de passe, création en 3 étapes, unicité username, téléphone avec indicatif/pays et date de naissance.
- Google OAuth : connexion directe sans OTP, callback finalisant correctement la session Supabase et conservation de la destination retour.
- Validation d'âge : 3 politiques obligatoires côté interface et serveur.
- Contrôles serveur du panier renforcés ; écriture des fiches produits limitée à l'administration.
- Import de stock conservé.
- Accueil : CTA pharmacie isolé, disclaimer repositionné, numéros 1510 / 119 / 1511.
- Documents juridiques : Conditions, Confidentialité et Sécurité enrichis selon le comportement réel.
- Authentification : tous les écrans principaux utilisent désormais le conteneur sans défilement auth-ecran, y compris /nouveau-mot-de-passe.
- Création de compte : bandeau « Les plus recherchés » masqué, interface mobile recentrée/compactée et téléphone séparé en pays, indicatif et numéro avec longueur contrôlée.
- Création de compte : sélecteur pays compact affichant uniquement drapeau + indicatif au repos ; le nom du pays apparaît uniquement à l’ouverture du sélecteur.
- Création de compte : coche jaune de validation ajoutée aux informations correctement renseignées.
- Mot de passe oublié : le serveur vérifie désormais l’existence réelle du compte avant tout envoi d’OTP ; un compte inexistant reçoit une erreur et n’accède pas à l’étape OTP.
- PR #17 : ces deux corrections sont fusionnées dans main, sans migration DB ni réécriture destructive.
- Build Production PR #17 : compilation Next.js réussie, contrôle TypeScript sans erreur bloquante, déploiement Production READY.

### Consolidation finale — 4 octobre 2026
- PR #11 : consolidation authentification, âge, accueil et politiques, fusionnée.
- PR #12 : documentation de consolidation, fusionnée.
- PR #13 : suppression du dernier scroll parasite de /nouveau-mot-de-passe, fusionnée dans main.
- PR #15 : correction finale UX de /creation-compte, fusionnée dans main.
- PR #15 : aucun changement métier, aucune migration DB et aucune réécriture destructive.
- Build Production : compilation Next.js réussie et vérification TypeScript sans erreur bloquante.
- Déploiement Production final issu de main : READY sur le projet Vercel existant naxa.
- Correction PR #13 strictement ciblée : min-h-screen remplacé par le conteneur d'authentification existant auth-ecran (100dvh + overflow:hidden), sans changement fonctionnel.
- Contrôle statique des cinq écrans principaux : /connexion, /creation-compte, /mot-de-passe-oublie, /verification-age, /nouveau-mot-de-passe : aucun conteneur de page ne conserve de scroll volontaire.

### Phase 3 — pharmacies pilotes — infrastructure consolidée
- PR #19 : panneau pharmacie renforcé, fusionnée dans main.
- Stock : quantité réellement modifiable depuis `/pharmacie` ; persistance dans `stocks` conservée avec le mécanisme `updated_at` existant.
- Garde : bouton « De garde » branché sur la RPC sécurisée `set_garde` existante.
- Hors connexion : file locale IndexedDB pour les modifications manuelles de quantité, badge « Hors connexion », synchronisation au retour réseau.
- Conflits : comparaison de `updated_at` avant écriture distante ; l'équipe pharmacie peut garder la valeur serveur ou réappliquer sa modification locale.
- Import existant conservé : Excel/CSV, reconnaissance des colonnes nom/désignation/produit, prix, quantité, dosage/conditionnement et péremption.
- Vérification Supabase du 5 octobre 2026 : 3 pharmacies de démonstration actives existent déjà à Yaoundé, avec 3 lignes de stock chacune. Elles ne sont pas considérées comme des pharmacies pilotes réelles tant que les données/équipes réelles n'ont pas été fournies.
- Aucune nouvelle table, migration ou dépendance ajoutée pour ce chantier.

### Architecture des comptes pharmacie — consolidée en Production
- Une pharmacie reste une seule entité côté client : un seul stock, une seule identité et les mêmes réservations pour toute l'équipe.
- Le compte principal de la pharmacie est le **Promoteur**. L'équipe NAXA crée la pharmacie et son compte Promoteur ; la pharmacie devient ensuite autonome.
- Le Promoteur est le compte parent : il crée, bloque et réactive les comptes **Caisses** enfants.
- Les Caisses sont des utilisateurs opérationnels de la même pharmacie, pas des sous-pharmacies. Elles partagent le stock, les réservations et le statut de garde de leur pharmacie.
- Un compte Caisse bloqué perd son accès opérationnel sans désactiver la pharmacie ni les autres caisses.
- La formation terrain doit utiliser les comptes Caisse pour apprendre l'import et la gestion quotidienne du stock, afin que l'équipe pharmacie prenne elle-même la main.

### Règles de gouvernance
- PR #21 : architecture Promoteur parent / Caisses enfants, fusionnée dans `main` par squash après évaluation complète.
- Déploiement Production issu de la consolidation PR #21 : READY sur le projet Vercel existant `naxa`.
- Contrôle post-déploiement : commit `5ad95ce30dd43b3c140e0048606c81dd5143e490`, Vercel READY, aucun log runtime `error/fatal` sur les 30 premières minutes contrôlées.
- Aucun déploiement Preview volontaire.
- Production uniquement après évaluation complète et autorisation explicite.
- Aucune suppression ou réécriture destructive.
- Le prompt maître et le cahier des charges restent prioritaires.

## Production
- Projet Vercel existant : `naxa`.
- Déploiement Production courant : `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6`, commit `5ad95ce30dd43b3c140e0048606c81dd5143e490`, état **READY**.
- Alias Production : `naxa-opal.vercel.app` et `naxa-naxa3.vercel.app`.
- Le déploiement provient de `main` après fusion de PR #21.
- Contrôle post-déploiement : état Vercel READY ; statut GitHub Vercel SUCCESS ; aucun log runtime error/fatal trouvé sur la fenêtre de contrôle de 30 minutes.
- Aucun nouveau projet Vercel et aucun Preview volontaire.

## Prochain point du cahier des charges
La consolidation technique est terminée et la fonctionnalité Promoteur/Caisses est en Production. Il reste la **mise en service terrain réelle** :
1. identifier 3 à 5 pharmacies pilotes réelles ;
2. créer leurs comptes Promoteur via l'accès NAXA `/admin` ;
3. faire créer/activer par chaque Promoteur les comptes Caisses de son équipe ;
4. importer leurs stocks réels via le mécanisme existant ;
5. vérifier fraîcheur, prix, quantités, péremptions et formats ;
6. former les équipes à `/pharmacie` (réservations, stock, statut de garde, hors connexion) ;
7. valider le parcours complet sur données réelles avant de passer au chantier Qualité.
Le chantier suivant devra préserver les règles : aucune auto-inscription pharmacie, aucun numéro WhatsApp côté client, aucune livraison, réservation/paiement facultatifs.


## Mise à jour de continuité — 08/10/2026 — Niveau 1 Documentation
La section historique ci-dessus reste conservée. Pour l'état courant, la référence est :
- branche de travail : `rewrite/naxa-from-main-20261007` ;
- HEAD de travail au contrôle : `b2fc8b793cbac1d11a089c88d736386faf0af658` avant les corrections documentaires de niveau 1 ;
- `main` au contrôle : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471` ;
- PR #30 : fermée, non fusionnée (validation CI remplacée par le gate CircleCI) ;
- Qualité/CI : non verte ; aucune preuve d'exécution ne doit être inventée ;
- Production : aucun changement effectué dans ce chantier.

**Priorité actuelle :** corriger et prouver la qualité avant tout passage ERP supplémentaire. Les paragraphes historiques annonçant une consolidation « terminée » ne valent pas fermeture du chantier Qualité courant.

**Niveau 1 — Documentation / traçabilité : 🟢 corrigé.** Références complémentaires : `docs/CONTINUITE_NAXA.md`, `docs/FUSION.md`, `CONTRADICTIONS.md`, `docs/CAHIER_DES_CHARGES.md`.


## Niveau 2 — Gouvernance Git — 08/10/2026
Le chantier courant est `rewrite/naxa-from-main-20261007`. `main` reste la source de vérité et n'a pas été modifié. Les branches historiques sont conservées comme archives et ne constituent pas des sources concurrentes. Voir `docs/GIT_GOUVERNANCE.md`.

**Niveau 2 : 🟢 corrigé.**


## État du chantier — Niveau 3
Le niveau 3 a fait l'objet d'une correction statique : ESLint/Next configuré, script lint rendu exploitable et versions npm figées. La preuve d'exécution TypeScript/lint/build reste à obtenir via un runner réel. Le dépôt ne contient toujours pas de `package-lock.json`, et la génération locale a été bloquée par l'absence d'accès au registre npm. **Le niveau 3 n'est donc pas déclaré vert.**


## Mise à jour de continuité — Niveau 3 — 08/10/2026
- Gate CircleCI réel : **SUCCESS** sur le commit `f1fcd801f37989bdd17e667a0e88c17dd3e5f4e6`, pipeline #167.
- Contrôles exécutés : installation npm, TypeScript, ESLint et build Next.js.
- Niveau 3 : **🟢 VERT** pour la qualité technique exécutée.
- `package-lock.json` reste absent ; la reproductibilité npm transitive est enregistrée comme amélioration séparée et n'est pas présentée comme validée.
- `main` reste inchangé et aucune Production n'a été modifiée.
