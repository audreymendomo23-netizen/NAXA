# Contrôle Admin global des univers — 11 novembre 2026

## Périmètre
Depuis `/admin/univers`, l’Admin NAXA peut verrouiller et déverrouiller les cinq espaces gérés :
- Parapharmacie (`parapharmacie`)
- Bébé & Maman (`bebe-maman`)
- Examens médicaux (`examens`)
- Dispositifs médicaux / suivi connecté (`suivi`)
- Prestations à domicile (`prestations`)

L’espace Pharmacie central et Aide NAXA ne sont pas pilotés par ce contrôle.

## Règles de fonctionnement
- L’action serveur exige une session Admin active et n’accepte que les cinq slugs gérés.
- La RPC `admin_set_universe_enabled` est exécutée en SECURITY INVOKER et vérifie elle-même `public.is_admin()`.
- Le registre `universes` et le flag `feature_flags.universe.*` sont modifiés dans une même transaction.
- Pour `suivi`, le flag `suivi_connecte` est synchronisé dans la même transaction.
- La RPC écrit l’événement d’audit ; l’action serveur ne crée pas de doublon.
- L’écran relit la base après l’action et ne confirme pas une modification non persistée.
- Les associations commerciales de partenaires et la publication commerciale de dispositifs médicaux restent interdites.

## Vérification Replay
Projet : `pwfftcsjyeibxxqhwysw` (Replay uniquement).

Contrôles exécutés dans une transaction ensuite annulée :
- activation Admin des cinq univers : PASS ;
- vérification de persistance des cinq lignes `universes` et des cinq flags : PASS ;
- activation de `suivi` et synchronisation de `suivi_connecte` : PASS ;
- désactivation Admin des cinq univers et vérification des flags : PASS ;
- désactivation de `suivi` et synchronisation de `suivi_connecte` : PASS ;
- tentative d’activation par un profil non Admin : refusée (PASS).

## État de livraison initial
Le code source de l’écran et de l’action serveur, ainsi que la migration SQL idempotente, étaient préparés dans un commit Git non rattaché à `main`. Cet état initial est supersédé par la mise à jour du 13 novembre ci-dessous.

## Reprise — 13 novembre 2026

### Activation Supabase Production
Projet NAXA : `eouwtuusnsuxaejsxknf`.

- Avant l’opération, seuls Bébé & Maman et Dispositifs médicaux étaient désactivés globalement.
- La fonction Admin existante `public.admin_set_universe_enabled` a été utilisée pour activer `bebe-maman` et `suivi`, sans mise à jour brute des tables.
- La fonction a synchronisé les lignes `universes`, les flags `universe.*` et, pour `suivi`, `suivi_connecte`.
- Les deux événements `universe.enabled` correspondants ont été retrouvés dans `audit_log`.
- Vérification après écriture : les cinq espaces configurables sont à `enabled=true` dans `universes` et dans leurs flags associés. `suivi_connecte=true`.
- Les restrictions commerciales sur les dispositifs médicaux restent en place : aucune association partenaire ni publication de produit médical n’est autorisée par cette activation.
- Les restrictions de présentation commerciale propres à Bébé & Maman restent inchangées.

### Correction de l’identifiant public des dispositifs
- Le registre de base utilise le slug `suivi`, tandis que l’interface client utilise l’identifiant d’écosystème `dispositifs`.
- La route `/api/universes/status` publie désormais les deux clés, liées au même état, afin que `EnTeteClient` et `MenuUnivers` ne présentent pas les dispositifs médicaux comme verrouillés.
- Contrat de test ajouté dans `scripts/test-admin-univers-actions.cjs`.
- Commit route : `688a400b889508c85f9e7ee696ee46dd79aace2a`.
- Commit test : `a8f5b113c99c5609167232c35293e94d917b181f`.

### Déploiement et recette
- Le déploiement Production Vercel n’a pas été modifié pendant cette opération.
- Le dernier commit Production référencé dans le registre de réconciliation est `8ebe45267b97c3b0c666b1df3f9e73df0b08c005). Dans cet instantané, la route `/api/universes/status` est absente et le menu client contient encore des verrous codés en dur.
- En conséquence, les données Production sont activées, mais le menu publié ne reflétera pas ces ouvertures avant le déploiement autorisé du code actuel de `main`.
- Le test Node, le build Next.js, TypeScript, lint et le test navigateur ne sont pas déclarés exécutés dans cette passe.
