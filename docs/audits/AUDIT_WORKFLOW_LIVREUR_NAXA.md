# Audit du workflow Livreur NAXA

Date de contrôle : 6 novembre 2026  
Dépôt : `audreymendomo23-netizen/NAXA` — branche `main`  
Environnement SQL autorisé pour cette recette : Supabase Replay `pwfftcsjyeibxxqhwysw`.

## Verdict

**Implémentation métier et migrations Replay avancées ; certification complète de lancement non acquise.** Le périmètre applicatif et SQL est implémenté dans `main`. Les recettes transactionnelles SQL du flux de livraison sont PASS. Les recettes Auth réelles à deux comptes, le build/typecheck/lint final, les appareils Android, les notifications externes et le pilote terrain ne sont pas démontrés dans cette passe.

## Décisions métier implémentées

- Le Livreur est une affectation professionnelle d'un compte Client NAXA. Un même compte peut recevoir plusieurs affectations Livreur dans plusieurs pharmacies, mais ne peut pas cumuler une autre fonction professionnelle active.
- Un Promoteur peut affecter/inviter dans son réseau actif. Une Pharmacie ne peut agir que sur ses propres Livreurs. Les autorisations sont vérifiées côté SQL, pas seulement dans l'interface.
- L'inscription suit le parcours NAXA normal : compte Client, e-mail confirmé, consentement et vérification de majorité (18 ans révolus). Le jeton d'invitation est individuel, à usage unique et expire après sept jours. Le Promoteur ou la Pharmacie ne crée pas de mot de passe pour le livreur.
- Le Gestionnaire de stock démarre la préparation puis confirme `prete_au_retrait`. Une mission ne peut pas être publiée sur la seule base d'un statut générique `preparation`.
- Le Livreur accepte atomiquement une mission, confirme le retrait, partage éventuellement sa position au premier plan, déclare l'arrivée et les incidents. Il ne peut pas confirmer lui-même la remise finale.
- Le Client suit les étapes et confirme la réception. Une pharmacie peut réaffecter une mission avant le retrait physique ; après retrait, la réaffectation automatique est interdite.
- La révocation d'une affectation Livreur est bloquée lorsqu'une mission ouverte a été acceptée. Une Pharmacie peut révoquer uniquement une affectation de sa propre pharmacie.

## Composants applicatifs et SQL

- Migrations : `20261106150000` à `20261106172700` — workflow, contrôles de rôle, invitations, journal des offres, préparation Stock, notifications, identité, pharmacie active, révocation et RPC de liste d'équipe.
- Pages : `/pharmacie/affectations`, `/pharmacie/gestionnaire-stock/commandes`, `/pharmacie/livreur`, `/invitation/livreur`, suivi Client sur `/reservation/[id]`.
- Interfaces : `LivreurWorkspaceClient`, `LivreursAssignmentsManager`, `SuiviLivraison`, formulaire et acceptation d'invitation.
- Export de performances : CSV. Le GPS est volontaire et limité au premier plan ; le suivi en arrière-plan n'est pas revendiqué.

## Preuves Replay

- Les migrations Livreur, jusqu'à `20261106172700_livreur_management_list_rpc`, figurent dans l'historique Replay.
- La fonction `public.naxa_livreurs_management_list(uuid[])` existe. Son ACL SQL accorde `EXECUTE` à `authenticated` et `service_role`, pas à `anon` ni à `PUBLIC`.
- La RPC a été exécutée avec un contexte `authenticated` d'Administrateur et une pharmacie active du projet : résultat `[]`, cohérent avec l'absence d'affectations Livreur de recette.
- Replay contenait, au contrôle, un profil Administrateur actif, neuf pharmacies actives, zéro affectation Livreur, zéro mission, zéro événement et zéro invitation persistants. Les fixtures des tests métier antérieurs ont été annulées par `ROLLBACK`.
- Le journal `public.naxa_delivery_mission_offers` a RLS activée ; `anon` et `authenticated` ne disposent pas du privilège SELECT. Son ACL ne donne l'accès qu'à `postgres` et `service_role`.
- Les scénarios transactionnels précédemment exécutés ont validé le contrôle de rôle multi-pharmacies, la porte de préparation Stock, la publication, l'acceptation atomique, le suivi GPS, les notifications, la confirmation Client, les KPI, la réaffectation avant retrait et la révocation avec mission ouverte.

## Corrections de cette clôture

- Le compteur d'équipe affiche désormais des livreurs actifs distincts, et non le nombre d'affectations. Un compte affecté à trois pharmacies n'est compté qu'une fois.
- Le test de contrat a été corrigé : les motifs regex contenant des parenthèses et points échappés doublement ne pouvaient pas correspondre aux instructions SQL réelles. Les contrôles de destinataire et d'identité utilisent désormais des comparaisons de chaînes non ambiguës.
- Le script de test couvre maintenant la migration `naxa_livreurs_management_list`, son cloisonnement Promoteur/Pharmacie/Admin, son ACL et le composant de gestion d'équipe.

## Réserves qui empêchent le vert intégral

1. Les statuts CI contrôlés sur les commits source `8d1fdce` (run [10109](https://circleci.com/gh/audreymendomo23-netizen/NAXA/10109)) et `46dc5da` (run [10111](https://circleci.com/gh/audreymendomo23-netizen/NAXA/10111)), puis sur les commits documentaires `2042a54` ([10113](https://circleci.com/gh/audreymendomo23-netizen/NAXA/10113)), `5bd68df` ([10115](https://circleci.com/gh/audreymendomo23-netizen/NAXA/10115)) et `3b6ab7b` ([10117](https://circleci.com/gh/audreymendomo23-netizen/NAXA/10117)) sont tous `ci/circleci: quality = failure`. Le connecteur GitHub ne donne que le statut agrégé ; les logs CircleCI ne sont pas accessibles depuis les outils disponibles et l'ouverture du run retourne une page inaccessible. Les assertions de contrat ont été corrigées dans le script, mais `npm test`, `tsc`, `lint` et `next build` n'ont pas été exécutés localement sur le HEAD final. Ce point reste donc BLOQUANT pour une certification de build.
2. Le Replay contrôlé ne comporte aucun compte Promoteur/Pharmacie actif ni aucun compte Livreur de recette. Il est donc impossible de certifier ici la lecture réelle de la liste avec ces deux rôles, ou de présenter un parcours Auth complet à deux utilisateurs.
3. Pas de création/acceptation réelle d'invitation entre deux comptes Auth, pas de commande réelle avec lignes et décrément FEFO, pas de recette Android/navigateur/caméra/GPS, pas de notification Push reçue sur un appareil et pas de pilote en pharmacie.
4. Supabase signale explicitement `public.naxa_livreurs_management_list(uuid[])` dans le lint `authenticated_security_definer_function_executable` (WARN, comptage projet : 179 fonctions). C'est une RPC `SECURITY DEFINER` voulue pour lire une liste de profils restreinte depuis l'interface ; son ACL n'accorde `EXECUTE` qu'à `authenticated` et `service_role`, jamais à `anon` ou `PUBLIC`. Son corps exige `auth.uid()` et revalide les rôles et périmètres Promoteur/Pharmacie/Admin avant toute lecture. Les deux tables sensibles `naxa_delivery_mission_offers` et `naxa_livreur_invites` ont RLS activée et aucun droit SELECT pour `anon` ou `authenticated`; seules les voies RPC contrôlées peuvent les gérer. L'avertissement SECURITY DEFINER reste consigné et doit être réexaminé si le corps ou les grants changent.
5. Les rapports Livreur sont exportés en CSV ; aucun rapport PDF/BI spécifique Livreur n'est certifié dans ce lot.
6. Un incident après retrait physique nécessite une gestion manuelle Pharmacie/support ; il ne déclenche pas de réaffectation automatique.

## Frontière Production

Aucune migration Supabase Production et aucune modification de données Production ne sont incluses dans cette clôture. L'historique Vercel contrôlé sur le projet NAXA ne contient aucun déploiement pour le commit Livreur `3b6ab7b` (0 résultat) ; la dernière Production listée reste sur le commit autorisé `8ebe45267b97c3b0c666b1df3f9e73df0b08c005`. Aucun déploiement Vercel n'a été demandé ou créé dans cette passe. Le code livré sur `main` n'est donc pas encore disponible en Production.


## Correction de la règle de permanence — branche QA du 7 novembre 2026

- Le profil Livreur dédié reste un compte Client autonome : affectation ordinaire sans expiration, sans autre poste professionnel actif ; le déclencheur interdit ensuite de lui attribuer un poste staff.
- Un membre déjà affecté à une pharmacie peut recevoir une permanence Livreur de type urgence avec expiration ; un Promoteur peut désigner un membre de son réseau pour une autre pharmacie active de ce même réseau. La Pharmacie ne peut affecter que ses propres membres.
- La permanence temporaire coexiste avec les affectations habituelles, mais un seul espace professionnel reste actif à la fois. Les affectations Livreur temporaires qui se chevauchent sont interdites, y compris entre deux pharmacies du même réseau.
- Une mission déjà acceptée reste actionnable après l'heure de fin de permanence jusqu'à sa clôture ; une affectation expirée ne permet jamais de prendre une nouvelle mission. Le sélecteur de l'application conserve l'accès au poste Livreur seulement lorsqu'une mission est encore ouverte.
- Le flux d'invitation reste réservé au profil Livreur dédié. Le formulaire d'affectation existant sert à la permanence temporaire du personnel.
- Vérification Replay requise : contrôle des fonctions, déclencheur et ACL après application de la migration. Aucun changement Production ni déploiement Vercel.

- Correctif de compatibilité multi-pharmacie : plusieurs affectations Livreur simultanées sur des pharmacies différentes restent possibles ; les chevauchements dans une même pharmacie sont bloqués. L’espace actif reste unique par compte.


## Complément de construction — profil autonome Livreur (7 novembre 2026)

- Création de la route protégée \`/pharmacie/livreur/profil\`, accessible uniquement à un compte actif dont l'espace professionnel sélectionné est Livreur.
- Le profil affiche les informations personnelles, l'e-mail de connexion en lecture seule, l'état de vérification du compte et la date de création.
- Les champs prénom, nom, nom d'utilisateur et téléphone sont modifiables sur son propre profil uniquement. Les contrôles de format sont appliqués côté interface ; la mise à jour passe par la politique RLS du compte connecté et vérifie le retour de la ligne mise à jour.
- Le changement de mot de passe appelle le contrôle de sécurité NAXA contre les mots de passe compromis avant \`auth.updateUser\`.
- La page liste les affectations Livreur personnelles, leurs pharmacies, leur type permanent/temporaire, les dates et l'état ; elle précise qu'un seul espace de pharmacie est actif à la fois.
- Le tableau de bord renvoie vers ce profil autonome au lieu du profil Client.
- Le rôle, les affectations, les privilèges, les dates de permanence et les informations de vérification d'identité restent hors du formulaire d'édition.
- Le script de test ciblé couvre le garde d'accès, la mise à jour du profil, le contrôle du mot de passe et le lien de navigation. Le build et la recette Auth multi-comptes restent à certifier séparément.
