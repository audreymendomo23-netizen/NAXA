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

1. Le statut CI vérifié sur le HEAD `5bd68df7aaf02e9762af47a339ea18c63e1e68b2` était `ci/circleci: quality = failure` (run [10115](https://circleci.com/gh/audreymendomo23-netizen/NAXA/10115)). Le connecteur GitHub ne donne que le statut agrégé ; les logs de ce run ne sont pas accessibles depuis les outils disponibles. La correction des assertions de contrat est commise, mais `npm test`, `tsc`, `lint` et `next build` n'ont pas été exécutés localement sur le HEAD final. Ce point reste donc BLOQUANT pour une certification de build.
2. Le Replay contrôlé ne comporte aucun compte Promoteur/Pharmacie actif ni aucun compte Livreur de recette. Il est donc impossible de certifier ici la lecture réelle de la liste avec ces deux rôles, ou de présenter un parcours Auth complet à deux utilisateurs.
3. Pas de création/acceptation réelle d'invitation entre deux comptes Auth, pas de commande réelle avec lignes et décrément FEFO, pas de recette Android/navigateur/caméra/GPS, pas de notification Push reçue sur un appareil et pas de pilote en pharmacie.
4. Supabase signale explicitement `public.naxa_livreurs_management_list(uuid[])` dans le lint `authenticated_security_definer_function_executable` (WARN, comptage projet : 179 fonctions). C'est une RPC `SECURITY DEFINER` voulue pour lire une liste de profils restreinte depuis l'interface ; son ACL n'accorde `EXECUTE` qu'à `authenticated` et `service_role`, jamais à `anon` ou `PUBLIC`. Son corps exige `auth.uid()` et revalide les rôles et périmètres Promoteur/Pharmacie/Admin avant toute lecture. Les deux tables sensibles `naxa_delivery_mission_offers` et `naxa_livreur_invites` ont RLS activée et aucun droit SELECT pour `anon` ou `authenticated`; seules les voies RPC contrôlées peuvent les gérer. L'avertissement SECURITY DEFINER reste consigné et doit être réexaminé si le corps ou les grants changent.
5. Les rapports Livreur sont exportés en CSV ; aucun rapport PDF/BI spécifique Livreur n'est certifié dans ce lot.
6. Un incident après retrait physique nécessite une gestion manuelle Pharmacie/support ; il ne déclenche pas de réaffectation automatique.

## Frontière Production

Aucune migration Supabase Production, aucune modification de données Production et aucun déploiement Vercel Production ne sont inclus dans cette clôture. Le changement de code sur `main` ne signifie pas que le parcours est déjà disponible en Production.
