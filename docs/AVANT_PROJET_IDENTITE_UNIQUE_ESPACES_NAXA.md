# Avant-projet — Identité NAXA unique et espaces client / pharmacie

Date : 22 octobre 2026
Référence auditée : branche main, parent af8903745fbc966d8fb9b2aafe60f4e542c5583f.

## Étape 1 — Faisabilité

Conclusion : faisable sans créer un second compte Auth. Le compte utilisateur NAXA existant peut servir d'identité commune pour l'espace client et un accès professionnel révocable. Le nom d'utilisateur sert à retrouver le profil, jamais à prouver l'identité ni à accorder seul des droits.

Contraintes observées :
- profiles.role, profiles.pharmacie_id, profiles.parent_profile_id et profiles.actif portent aujourd'hui le rôle professionnel courant et son périmètre.
- Les pages et RPC ERP utilisent ces champs et des gardes serveur/RLS. Le provisionnement métier naxa_provision_caisse et les contrôles naxa_can doivent rester l'autorité pour les quotas, le réseau et les droits.
- La révocation Caisse rend le profil professionnel inactif. La connexion doit distinguer l'espace client de l'espace professionnel pour que cette révocation ne supprime pas l'identité ni l'accès client.
- Les comptes historiques n'ont pas tous nécessairement un dossier client complet. La bascule client doit rester conditionnée aux informations, à l'âge et aux consentements requis.

Limite structurelle : le schéma actuel conserve un rôle principal unique dans profiles. Ce premier incrément réutilise le profil Auth et ses données client, mais ne livre pas encore un modèle multi-rôle arbitraire ni plusieurs affectations professionnelles simultanées par personne. Une table d'affectations professionnelles dédiée sera nécessaire avant de supporter plusieurs fonctions ou plusieurs pharmacies par employé sans écraser le rôle courant.

## Étape 2 — Repérage sur main

- src/app/(auth)/connexion/page.tsx : formulaire commun client / pharmacie, identifiant et mot de passe, destination calculée depuis le rôle.
- src/app/api/auth/login/route.ts : l'ancien login professionnel exigeait un cookie issu de la validation du code pharmacie et contrôlait profiles.role / profiles.actif.
- src/app/api/pharmacie/code/route.ts et src/lib/pharmacie-code-session.ts : ancien point d'entrée du code pharmacie.
- src/app/pharmacie/actions.ts et src/app/pharmacie/caisses/page.tsx : le Promoteur créait auparavant un nouvel utilisateur Auth pour chaque Caisse, avec e-mail et mot de passe provisoire.
- naxa_provision_caisse, naxa_can et naxa_set_caisse_status : mécanismes existants à réutiliser pour quota, réseau et révocation.
- src/middleware.ts, src/app/client/page.tsx et les barres latérales pharmacie : contrôles de session et points d'entrée des espaces.

Contradiction constatée : le besoin « un compte utilisateur existant, puis une affectation professionnelle » contredisait le formulaire qui créait un second compte Auth. Le correctif cible l'affectation Caisse et le login, sans supprimer les RPC ni désactiver les contrôles métier existants.

## Étape 3 — Implémentation

- Le login API distingue espace=client et espace=pharmacie, vérifie les droits professionnels et l'état actif de la pharmacie côté serveur, et ne requiert plus le cookie du code pharmacie.
- Le formulaire de connexion transmet l'espace choisi et ouvre cet espace en l'absence d'une URL de retour explicite.
- Le Promoteur attribue désormais un accès Caissière en recherchant le nom d'utilisateur unique d'un compte client déjà créé et vérifié. Le formulaire ne collecte plus d'e-mail ni de mot de passe.
- Le provisionnement continue de passer par naxa_provision_caisse. Si cette RPC échoue, le profil d'origine est restauré lorsque l'opération de restauration est possible. Aucun nouvel utilisateur Auth n'est créé par cette action.
- Un bouton conditionnel de bascule entre espaces est ajouté aux navigations principales Promoteur, Caisse, Pharmacien et Gestionnaire de stock, ainsi qu'à l'accueil client.
- Les routes historiques du code pharmacie ne sont pas supprimées dans ce commit : elles restent disponibles pour compatibilité, mais ne sont plus exigées par le login révisé.

## Étape 4 — Vérifications et limites

La lecture des fichiers et des points d'insertion a été faite sur le commit parent. Les contrôles de code sont préparés pour préserver l'autorité des RPC et les vérifications d'accès côté serveur.

Non exécutés / non prouvés : build Next.js, TypeScript, ESLint, tests automatisés, tests SQL/RLS et parcours navigateur. Aucun résultat vert n'est revendiqué. Aucun déploiement n'est autorisé ni demandé.

### Recette à effectuer avant activation complète

1. Client existant attribué comme Caisse : même auth.uid(), profil client conservé, accès professionnel autorisé.
2. Nom d'utilisateur inconnu, ambigu, compte incomplet, non vérifié ou déjà professionnel : attribution refusée sans modification.
3. Quota, lien Promoteur/pharmacie, architecture ou abonnement refusé par les RPC : profil initial restauré.
4. Révocation professionnelle : connexion pharmacie refusée ; connexion client conservée si l'identité client reste valide.
5. Pharmacie inactive/masquée ou réseau Promoteur sans établissement actif : connexion professionnelle refusée.
6. Google/OTP, mot de passe oublié, suppression de compte et déconnexion : parcours existants à retester.
7. Vérifier les sessions professionnelles déjà ouvertes après révocation, y compris les accès API/RLS.

### Limites résiduelles

- L'affectation livrée dans ce commit couvre le poste Caisse. Les autres rôles doivent être migrés vers le même principe par leurs parcours de provisionnement respectifs.
- Le modèle actuel reste à rôle professionnel principal unique. Pour qu'un employé cumule plusieurs fonctions ou plusieurs affectations pharmacie, la prochaine évolution structurante doit introduire une table dédiée d'affectations, ses RPC et ses politiques RLS, puis migrer les gardes serveur progressivement.
- Les routes du code pharmacie restent dans le dépôt ; elles ne sont plus utilisées comme précondition de connexion par l'API révisée.
