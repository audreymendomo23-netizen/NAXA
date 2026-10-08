# N4 — Cause racine du blocage d'autorisation

## Constat
Le replay Supabase applique les migrations dans leur ordre. La migration 020_architecture_privileges.sql contenait des opérations GRANT/REVOKE sur le moteur d'autorisation avant que les fonctions concernées existent.

## Contradiction
La migration 020 révoquait/accordait notamment naxa_can, naxa_business_function, naxa_assign_privilege et naxa_revoke_privilege. Or naxa_business_function est défini dans 020b, naxa_can plus tard dans 027, et les deux noms naxa_assign_privilege / naxa_revoke_privilege ne correspondent à aucune définition canonique retrouvée. Le replay ne peut donc pas traiter ces privilèges comme s'ils étaient déjà présents.

## Correction
Les GRANT/REVOKE prématurés ont été supprimés de 020_architecture_privileges.sql. Les migrations qui définissent réellement les fonctions conservent leurs propres opérations de sécurité après création.

## Garde préventive
CircleCI contrôle désormais linéairement tous les GRANT/REVOKE ON FUNCTION contre les définitions déjà rencontrées, en incluant le schema.sql de base. Toute fonction inconnue ou toute attribution/révocation antérieure à sa définition bloque le preflight avant de consommer un replay complet.

## Preuve attendue
1. preflight SQL vert ;
2. supabase db reset complet vert ;
3. tous les fichiers supabase/tests/*.sql verts ;
4. quality CI vert ;
5. seulement ensuite N4 = 🟢.

Aucun merge vers main ni déploiement Production n'est effectué dans cette correction.
