# Programme de stabilisation QA NAXA

Date : 6 novembre 2026  
Branche de travail : `qa/e2e-stabilisation-20261106`  
Production : non modifiée, aucun déploiement Production effectué.

## Gouvernance et périmètre

- Toutes les corrections de cette campagne sont isolées sur la branche QA. Aucun merge vers `main` avant validation.
- Le dépôt GitHub reste privé. L'historique ancien et les archives ZIP doivent être assainis et revus avant toute publication ; la mise en public actuelle n'est pas autorisée par cette campagne QA.
- L'organisation Supabase NAXA est sur Free. Le Supabase Development Branching natif nécessite l'offre Pro et un coût accepté ; Replay (`pwfftcsjyeibxxqhwysw`) reste le seul bac à sable utilisé à ce stade.
- Aucun secret Production ne doit être injecté dans GitHub Actions. Les comptes et clés E2E doivent être dédiés à Replay.
- Les workflows QA n'exécutent aucune sauvegarde Production.

## Contrôles initiaux

- Sur le commit `689e97329918ca668a8ffe35548716202e5de635`, le scan Gitleaks complet de l'historique, des branches/tags récupérés, du working tree et des archives ZIP passe : 5 213 commits inspectés, aucune fuite après exclusion de quatre faux positifs localStorage vérifiés.
- `npm test` : 109/109 tests PASS.
- TypeScript avait identifié deux imports dupliqués de `verifierSecuriteMotDePasse` dans les pages création de compte et mot de passe oublié ; les deux doublons ont été retirés.
- Après correction, le workflow qualité `42275443308` passe : tests, TypeScript, ESLint et build Next.js PASS.
- L'audit de dépendances sur le socle initial restait bloquant : 12 vulnérabilités, dont une critique et deux hautes, principalement liées à Next.js 14.2.35/PostCSS et à la chaîne PWA Workbox/serialize-javascript.

## Migration sécurité dépendances

Versions de cette branche :

- Next.js `15.5.29`, React / React DOM `19.3.1`.
- `eslint-config-next` `15.5.29`, types React `19.3.0`.
- `@supabase/supabase-js` `2.119.0`, `@supabase/ssr` `0.12.7`.
- Remplacement de `@ducanh2912/next-pwa` par `@serwist/next` / `serwist` `9.5.13`.
- PostCSS `8.5.32`.
- `package-lock.json` lockfileVersion 3 généré pour figer les dépendances.

## Politique PWA renforcée

- Cache runtime limité aux images publiques (Wikimedia et objets Supabase du bucket public), à la page de connexion et à quelques routes publiques.
- Aucun cache API et aucune mise en cache des écrans Pharmacie, Admin ou autres pages authentifiées.
- Les objets Storage privés/signés ne sont pas admis dans le cache image.
- Le fallback `/offline.html` est précaché.
- Les anciennes caches de navigation/login sont supprimées lors de l'activation du nouveau Service Worker.

## Résultats qui restent attendus

1. Nouveau run `npm ci` + 109+ tests + TypeScript + ESLint + Next build sur le nouveau couple Next/React/Serwist.
2. `npm audit --omit=dev --audit-level=high` sans vulnérabilité haute/critique.
3. Scan Gitleaks intégral vert sur le commit contenant le lockfile.
4. Recettes Replay/Auth multi-rôles : Client, Promoteur, Pharmacie et Livreur réels, invitations, commande et stock, flux livraison, stockage upload/download et nettoyage fixtures.
5. Recette navigateur/Android, PWA installée, caméra/galerie/PDF, GPS au premier plan et mode hors ligne.
6. Seulement après ces preuves : verrouillage des protections de branche disponibles, préparation du miroir public assaini, puis revue Production séparée.

## Limite d'interprétation

Un statut vert sur CI ne remplace pas les recettes fonctionnelles Auth/Storage, la recette sur appareil physique ou les tests de restauration/Production. Aucun résultat non observé ne doit être déclaré PASS.
