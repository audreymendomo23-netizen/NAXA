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

1. Le dernier statut CI observable sur le commit antérieur `55af0d6abcdc1b0af105b022459251addd97f6c3` était `ci/circleci: quality = failure`. La cause détaillée de ce run n'était pas lisible depuis le connecteur ; ce n'est donc pas une preuve de build rouge ou vert du nouveau HEAD. Le pipeline doit être relancé ou ses journaux consultés.
2. Le Replay contrôlé ne comporte aucun compte Promoteur/Pharmacie actif ni aucun compte Livreur de recette. Il est donc impossible de certifier ici la lecture réelle de la liste avec ces deux rôles, ou de présenter un parcours Auth complet à deux utilisateurs.
3. Pas de création/acceptation réelle d'invitation entre deux comptes Auth, pas de commande réelle avec lignes et décrément FEFO, pas de recette Android/navigateur/caméra/GPS, pas de notification Push reçue sur un appareil et pas de pilote en pharmacie.
4. L'alerte Supabase « SECURITY DEFINER exécutable par authenticated » couvre de nombreuses fonctions de l'application. La RPC Livreur est toutefois explicitement restreinte à `authenticated`, vérifie `auth.uid()`, vérifie les rôles et périmètres, et ne figurait pas dans la liste des fonctions accessibles à `anon`. Cette alerte globale n'est pas à elle seule une preuve d'accès non autorisé.
5. Les rapports Livreur sont exportés en CSV ; aucun rapport PDF/BI spécifique Livreur n'est certifié dans ce lot.
6. Un incident après retrait physique nécessite une gestion manuelle Pharmacie/support ; il ne déclenche pas de réaffectation automatique.

## Frontière Production

Aucune migration Supabase Production, aucune modification de données Production et aucun déploiement Vercel Production ne sont inclus dans cette clôture. Le changement de code sur `main` ne signifie pas que le parcours est déjà disponible en Production.
