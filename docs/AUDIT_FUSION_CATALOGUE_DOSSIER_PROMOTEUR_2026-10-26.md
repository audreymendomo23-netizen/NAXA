# Audit 360° — Fusion Catalogue NAXA / Dossier Promoteur
Date : 26 octobre 2026
Branche auditée : `main`
Commit de référence : `7ed220f7f1e98009a32ef1bcd506ea5e100064c6`

## Décision métier confirmée
- Le sélecteur de création comprend Pharmacie et les écosystèmes réellement créables.
- « Dispositifs médicaux » / suivi connecté est un service à valeur ajoutée : il reste fonctionnel dans NAXA mais ne doit pas être une option de création d’établissement.
- La sélection ne révèle pas le formulaire. Le clic explicite sur « VALIDER » (jaune canari #FFE23D) confirme le choix, puis affiche le formulaire correspondant.
- Pharmacie et Parapharmacie proposent le choix d’architecture ; les autres créations indépendantes ne l’affichent pas et le serveur doit refuser toute architecture injectée pour ces univers.
- Bébé & Maman n’est jamais un établissement autonome. Il est enregistré comme service actif dans le dossier de la pharmacie partenaire de parrainage. La pharmacie existante reste la source de vérité pour l’identité, l’adresse et le Promoteur.
- Le Dossier Promoteur devient transversal à tous les types de dossiers, sans dupliquer les identités et sans casser les parcours métier existants.

## Étape 1 — Audit 360° des dépendances

### UI et routage
- `src/app/admin/page.tsx` : tableau de bord et formulaire « Créer une pharmacie » dans la même page. Le sélecteur Catalogue actuel est un GET vers `/admin/univers` avec bouton « Continuer » ; la création réelle n’accepte que `creerPharmacie`.
- `src/app/admin/actions.ts` : `creerPharmacie` crée le compte Auth, la pharmacie, les données privées WhatsApp, les cases de pièces reçues, le profil Promoteur, la convention, l’abonnement, l’architecture et le lien `promoteur_pharmacies`. Le processus est une suite d’écritures compensées par nettoyage applicatif, pas une seule transaction DB.
- `src/components/admin/GeolocalisationChamps.tsx` : champs latitude/longitude et géolocalisation ; requis par le flux pharmacie.
- `src/components/admin/IdentificationPromoteur.tsx` et `src/lib/promoteur-validation.ts` : identité, username, téléphone international, âge, e-mail et mot de passe ; réutilisables pour les fiches indépendantes.
- `src/app/admin/univers/page.tsx` et `src/app/admin/univers/actions.ts` : catalogue/partenaires, activation, produits, professionnels du suivi. Les créations partenaires utilisent `partners` + `partner_universes`, sans compte Promoteur, contrat ou formulaire d’identité Promoteur.
- `src/app/admin/prestations/{page,actions}.tsx` : offres rattachées à `partners`, publication par RPC.
- `src/app/admin/examens/{page,actions}.tsx` : centres rattachés à `partners`, services, packs, créneaux et rendez-vous.
- `src/app/admin/promoteurs/page.tsx` : liste uniquement `pharmacies`. `src/app/admin/promoteurs/actions.ts` valide les dossiers pharmacie par RPC transactionnelle `admin_valider_dossier_pharmacie`.
- `src/app/admin/pharmacies/[id]/{page,actions}.tsx` : fiche détaillée pharmacie, pièces déclarées et fichiers, Promoteur, convention, abonnement, architecture et historique. C’est le bon endroit pour afficher le service Bébé & Maman actif, sans créer une fiche établissement indépendante.
- `src/components/admin/AdminNavigation.tsx` et `src/app/admin/layout.tsx` : navigation et accès à l’administration ; à conserver, en changeant uniquement les liens d’entrée utiles.

### Modèle de données identifié dans le code
- Pharmacie/Promoteur : `pharmacies`, `pharmacie_privee`, `pharmacie_documents_recus`, `pharmacie_documents`, `pharmacie_document_historique`, `profiles`, `promoteur_pharmacies`, `conventions_promoteurs`, `abonnements_promoteurs`, `pharmacie_architectures`, `naxa_architectures`.
- Catalogue multi-univers : `universes`, `feature_flags`, `partners`, `partner_universes`, `partner_members`, `partner_products`, `audit_log`.
- Prestations : `home_service_offers` et demandes associées, toutes centrées sur `partner_id`.
- Examens : `exam_centers.partner_id` (unique), puis `exam_services`, `exam_packs`, horaires, créneaux et rendez-vous.
- Les fichiers SQL historiques `supabase/migration_*.sql` et les migrations versionnées sous `supabase/migrations/` coexistent. Les notes du dépôt précisent que les migrations historiques ne sont pas à rejouer sur une base existante ; tout nouveau schéma doit être additif et être placé dans le répertoire versionné approprié.
- Les migrations 098/107/112/124 démontrent que partenaires, centres d’examens et prestations sont aujourd’hui liés par `partner_id`. Le modèle pharmacie est distinct et ne doit pas être dupliqué dans `partners` pour satisfaire Bébé & Maman.
- Les tests 154/155 vérifient déjà l’atomicité de validation du dossier pharmacie, la cohérence convention/abonnement/architecture, les fichiers privés et l’audit. Les tests 119 et 124 couvrent les garde-fous Bébé & Maman et le périmètre des prestations.

### Contradictions et risques
1. Le sélecteur est sur `/admin`, tandis que le catalogue réel et les créations partenaires sont sur `/admin/univers` : deux points d’entrée concurrents.
2. Le formulaire affiché sur `/admin` ne crée que des pharmacies ; les autres univers n’ont pas le même parcours d’identité Promoteur.
3. `partners.partner_type` ne comporte pas le type « pharmacie » et les contraintes actuelles ne permettent pas de représenter une pharmacie en tant que partenaire générique sans migration.
4. `profiles` Promoteur, contrat, abonnement et architecture sont actuellement validés comme un ensemble propre au modèle pharmacie. Il serait risqué de réutiliser tel quel ce provisionnement pour les autres univers.
5. Bébé & Maman est actuellement une valeur de `universes` et de `partner_universes`, avec des produits `partner_products`; le besoin métier impose au contraire un service attaché au dossier pharmacie, pas un établissement `partners`.
6. Le registre Promoteur ne lit que les pharmacies et ne peut pas montrer les dossiers de partenaires indépendants.
7. Les écritures de `creerPharmacie` sont compensées par plusieurs suppressions en cas d’échec ; la nouvelle création générique doit utiliser une opération transactionnelle côté PostgreSQL pour ne pas laisser un compte, dossier ou lien orphelin.
8. Il ne faut pas supprimer `suivi`, son flag, ses tables ni ses écrans publics : seule son entrée dans le sélecteur de création d’établissement disparaît.
9. Les statistiques du catalogue limitent certains partenaires/produits à 100 enregistrements ; ces limites ne doivent pas être réutilisées comme source exhaustive pour le registre transversal.

## Étape 2 — Audit de l’implémentation cible

### Architecture retenue
1. Un composant client unique de création sur `/admin` : état de sélection, bouton « VALIDER » canari, puis formulaire conditionnel. Le formulaire n’apparaît pas avant le clic de confirmation.
2. Un contrat de formulaire commun : identité du promoteur, contacts/compte, pièces justificatives, tarif et informations d’établissement. Les champs pharmacie (coordonnées GPS, WhatsApp, pièces réglementaires) sont conservés ; les champs non applicables sont masqués et contrôlés côté serveur.
3. Un modèle de dossier administratif transversal additif, qui identifie le type de dossier et référence soit une pharmacie existante, soit un partenaire indépendant. Il ne remplace pas les tables métier existantes.
4. Une opération serveur transactionnelle pour provisionner le dossier d’un univers indépendant et son propriétaire ; l’architecture est autorisée uniquement pour Pharmacie/Parapharmacie. La création de compte Auth et les transactions SQL doivent être conçues sans supposer que Auth et PostgreSQL partagent une transaction : prévoir un état de provisionnement et une compensation sûre.
5. Bébé & Maman utilise une recherche de pharmacies partenaires et un rattachement à la pharmacie existante ; le dossier pharmacie présente « Bébé & Maman — Service actif » lorsque le rattachement est activé. Aucune ligne de pharmacie ou de partenaire autonome n’est créée pour ce service.
6. Le registre `/admin/promoteurs` devient transversal : dossiers pharmacie + dossiers de partenaires indépendants, avec navigation vers les fiches existantes et une fiche de dossier générique. La pharmacie parrainant Bébé & Maman reste une seule fiche.
7. Les pages opérationnelles `/admin/univers`, `/admin/prestations` et `/admin/examens` restent en place ; elles deviennent des vues de gestion secondaires, pas des canaux concurrents de création initiale.

### Étapes de réalisation
- Étape 3 : définir/ajouter le schéma de dossiers et le rattachement Bébé & Maman, avec RLS, index, RPC sécurisées et tests SQL non destructifs.
- Étape 4 : construire l’interface unique avec sélection + bouton VALIDER et les formulaires conditionnels.
- Étape 5 : implémenter les actions serveur validées, la recherche de pharmacie partenaire et le statut « Service actif » dans le dossier pharmacie.
- Étape 6 : rendre le registre Promoteur transversal, avec fiches existantes conservées et navigation vers les dossiers génériques.
- Étape 7 : tests ciblés, audit de contradiction, contrôles de références/imports et vérification du statut de déploiement. Aucun déploiement ni écriture Supabase Production sans autorisation explicite.

## Limites de preuve à cette étape
- Audit statique du code versionné sur `main), commit de référence ci-dessus.
- Les migrations n’ont pas été appliquées à Supabase Production ; aucune requête n’a été exécutée sur la base de production.
- Aucun build, lint, typecheck ou test SQL n’a été exécuté pendant cet audit.
- Le schéma de production effectif et les données réelles de rattachement ne sont donc pas déclarés vérifiés.


## Étapes exécutées sur `main` après l’audit

### Étape 3 — Schéma additif
- `supabase/migrations/20261026100000_admin_unified_universe_dossiers.sql` ajoute le registre transversal `admin_partner_dossiers`, les coordonnées/WhatsApp partenaires, la relation `pharmacie_services` pour Bébé & Maman et trois RPC protégées : création transactionnelle d’un dossier indépendant, activation/désactivation du service pharmacie, validation atomique d’un dossier partenaire.
- `supabase/migrations/20261026113000_harden_unified_dossier_relations.sql` ajoute la FK vers l’univers Bébé & Maman et les index de clés étrangères.
- Les dossiers indépendants sont créés en attente ; le compte propriétaire est désactivé jusqu’à validation. La validation active ensemble le partenaire, son association et le compte. Les dossiers pharmacie continuent d’utiliser le flux et la RPC existants.
- Aucune migration n’a été appliquée à la production. Les deux migrations ont été appliquées au projet de test `naxa-ci-replay-2` pour vérifier la syntaxe et le contrat SQL.

### Étape 4 — Formulaire unique
- `src/components/admin/CatalogueCreation.tsx` remplace le sélecteur « Continuer » par « VALIDER » jaune canari. La fiche apparaît seulement après le clic.
- Sélecteur : Pharmacie, Parapharmacie, Bébé & Maman, Examens médicaux, Prestations à domicile et Aide NAXA. « Dispositifs médicaux » n’est pas une option de création.
- Pharmacie et Parapharmacie gardent le choix d’architecture. Les autres formulaires indépendants n’affichent pas ce champ.
- Bébé & Maman n’affiche que la recherche de pharmacie de parrainage et le bouton de rattachement ; l’autocomplétion ferme la liste au clic extérieur.
- Les créations pharmacie continuent d’utiliser `creerPharmacie`; les créations indépendantes passent par `creerDossierUnivers` et la RPC transactionnelle.

### Étape 5 — Service Bébé & Maman et cohérence des activations
- `src/app/admin/pharmacies/[id]/page.tsx` affiche le bloc « Services rattachés » et le badge « SERVICE ACTIF » dans le dossier pharmacie ; l’activation/désactivation est auditée par la RPC.
- `src/app/admin/rattacher-service-bebe-maman.ts` rattache le service depuis le Catalogue en utilisant uniquement l’ID d’une pharmacie active et visible.
- L’activation d’une association autonome Bébé & Maman est bloquée côté serveur et l’ancienne interface d’association n’offre plus l’ouverture d’une association inactive. La désactivation d’une association legacy reste possible.
- La création partenaire legacy depuis `/admin/univers` est bloquée ; cette page renvoie vers le formulaire unique.
- `src/app/api/auth/login/route.ts` et `src/app/(auth)/connexion/page.tsx` conservent le compte propriétaire en attente tant que le dossier n’est pas validé, puis orientent un propriétaire de partenaire actif vers l’espace partenaire.

### Étape 6 — Dossier Promoteur transversal
- `src/app/admin/promoteurs/page.tsx` liste les dossiers pharmacie existants et les dossiers indépendants des autres univers dans le même registre.
- `src/app/admin/promoteurs/partenaires/[id]/page.tsx` affiche l’identité du Promoteur, le partenaire, le tarif, l’architecture déclarée, les pièces reçues et le statut.
- `src/app/admin/promoteurs/partenaires/actions.ts` appelle une RPC qui valide le dossier et active le partenaire/association dans une seule transaction.
- `src/app/admin/univers/page.tsx` ne propose plus de création partenaire concurrente et redirige vers le canal unique ; l’activation générique ne peut pas contourner la validation du dossier.

### Étape 7 — Contrôles réalisés
- Test SQL `supabase/tests/20261026100000_admin_unified_universe_dossiers.sql` exécuté sur `naxa-ci-replay-2` : **PASS structurel** (présence des tables, RLS, privilèges anon, RPC protégées, service lié à la pharmacie et index/FK).
- Les migrations de test sont enregistrées dans l’historique du projet CI replay. Aucun test n’a écrit de dossier métier ni créé de compte utilisateur.
- Les avis Supabase Performance ne signalent plus de clé étrangère non indexée sur les nouvelles tables ; les index sont signalés « inutilisés » dans ce projet de test car aucune donnée métier n’y a été créée.
- Le lint sécurité signale les RPC `SECURITY DEFINER` exécutables par les utilisateurs authentifiés, comme attendu pour des RPC appelées par le serveur ; chacune vérifie `public.is_admin()`, et les tests confirment que le rôle `anon` ne peut pas les exécuter.
- Pas de build, lint TypeScript, tests applicatifs, parcours navigateur ni CI CircleCI exécutés dans ce chantier.

## Résultat de l’audit de contradiction après construction

- **Cohérent** : un seul canal d’entrée ; choix confirmé par « VALIDER » ; architecture seulement Pharmacie/Parapharmacie ; création indépendante en attente ; validation transactionnelle ; registre Promoteur transversal ; Bébé & Maman attaché à une pharmacie existante.
- **Cohérent** : la production auditée en lecture seule n’a pas encore les tables `admin_partner_dossiers` et `pharmacie_services`. La migration est donc indispensable avant que les nouvelles actions fonctionnent en production. Aucun changement de schéma ni donnée n’a été écrit sur la production.
- **Point de périmètre conservé** : le catalogue public `/bebe-maman` utilise encore la RPC historique `get_universe_catalog`, basée sur `partner_products` et `partners`. Le présent chantier interdit les nouvelles créations et associations autonomes Bébé & Maman et ajoute le service au dossier pharmacie, mais ne migre pas le modèle public des produits/réservations vers un catalogue pharmacie. Cette migration du catalogue public nécessiterait un modèle de produits et de réservations lié à `pharmacies`, et ne doit pas être prétendue réalisée par le seul rattachement administratif.
- **Point métier enregistré** : l’architecture Parapharmacie est enregistrée dans le dossier administratif. Le système d’habilitations opérationnelles existant reste celui des `partner_members` ; aucune hiérarchie de caisses pharmacie n’est provisionnée pour un partenaire par cette seule valeur.
- **Production et déploiement** : aucun SQL n’a été exécuté sur le projet Supabase de production et aucun déploiement n’a été déclenché manuellement.
