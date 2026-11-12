# Personnel des centres d’examens — ajout, invitation et révocation

## Périmètre

Ce document décrit les deux modes d’entrée du personnel des centres d’examens. Les rôles restent exclusivement ceux de l’écosystème Examens ; le rôle Livreur n’est pas proposé et ne peut pas être affecté ici.

## Mode 1 — Ajout direct par le responsable

Le responsable saisit l’adresse e-mail et le poste.

- Si l’adresse appartient déjà à un compte Client NAXA actif et complet, le serveur rattache immédiatement ce compte au centre via `exam_assign_existing_staff`.
- Si l’identité Auth existe mais que le profil NAXA n’est pas encore finalisé, NAXA crée une invitation nominative liée à cette adresse.
- Si aucune identité Auth n’existe, le serveur crée une identité Auth en attente, sans mot de passe et sans profil NAXA. Le marqueur `naxa_signup_pending` empêche le trigger d’inscription de créer un profil incomplet.
- Dans les deux derniers cas, un e-mail d’activation est envoyé par la passerelle Google Apps Script. Le destinataire confirme lui-même son adresse par OTP, renseigne ses informations, vérifie sa majorité, accepte les conditions, puis accepte l’invitation à usage unique.
- La création directe ne confère donc pas d’accès professionnel avant la validation du titulaire du compte.

En Production, lorsque `GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_APPS_SCRIPT_SECRET` et `NEXT_PUBLIC_SITE_URL` sont configurés, le serveur envoie le lien via Google Apps Script ; l’URL publique doit être HTTPS. L’envoi automatique est volontairement désactivé hors Production afin qu’un jeton Replay ne soit jamais envoyé vers le site Production. En Preview et en développement, l’identité en attente et l’invitation sont conservées et le responsable transmet le lien affiché dans la liste des invitations. Le responsable récupère alors le lien depuis la liste des invitations et le transmet manuellement. L’interface ne prétend jamais que l’e-mail a été envoyé.

## Mode 2 — Invitation par lien personnel

Le responsable crée une invitation liée à une adresse e-mail et à un poste, puis transmet le lien personnel. **Le lien reste réutilisable tant que l’invitation est en attente** ; il n’est pas réservé à une nouvelle inscription et n’est pas consommé par sa simple ouverture.

Trois parcours sont pris en charge :

1. **Aucun compte NAXA :** le destinataire choisit « Créer mon compte NAXA ». Le parcours d’inscription, de confirmation OTP et de finalisation du profil ramène ensuite automatiquement vers le même lien d’invitation.
2. **Compte NAXA existant, sans session ouverte :** le destinataire choisit « Me connecter à mon compte ». Après connexion par identifiant/mot de passe ou Google, NAXA revient vers la même invitation.
3. **Compte NAXA déjà connecté :** si la session correspond à l’adresse e-mail invitée, le destinataire peut accepter directement, sans se déconnecter.

Si une autre adresse est connectée, l’écran propose « Changer de compte ». Cette action ferme uniquement la session du navigateur courant (elle ne déconnecte pas les autres appareils), puis renvoie à la connexion avec retour vers l’invitation. La base de données reste l’autorité finale : elle refuse toute acceptation lorsque l’adresse confirmée du compte connecté ne correspond pas à l’adresse nominative de l’invitation.

Avant l’acceptation, le compte doit avoir une adresse confirmée et un profil Client NAXA complet, actif et majeur. L’acceptation est atomique : le serveur vérifie l’invitation et le compte, crée l’affectation, marque le jeton accepté et inscrit l’événement d’audit. Le jeton est donc consommé uniquement après une acceptation réussie. Une invitation expire après sept jours ; une invitation révoquée, expirée ou déjà acceptée ne peut plus être utilisée.

## Règles communes

- Un poste Examens est une affectation professionnelle distincte du rôle global du compte.
- Les rôles `directeur` et `livreur` ne sont pas attribuables par ces parcours.
- Les affectations révoquées restent dans l’historique.
- Révoquer une affectation met `is_active=false`, `active_role=false` et renseigne `revoked_at`. Cela ne supprime ni l’identité `auth.users`, ni le profil NAXA, et ne suspend pas le compte.
- Un compte peut être affecté de nouveau si les contrôles métier sont satisfaits.

## Vérifications effectuées

- Le contrat SQL Examens a été exécuté sur le projet Supabase Replay `pwfftcsjyeibxxqhwysw` et s’est terminé sans exception.
- Le contrat SQL a été rejoué sur Replay le 12 novembre 2026 après ajout des contrôles de révocation auditée et d’un cas d’expiration vérifié avec l’identité e-mail réellement invitée. Il couvre l’affectation directe, le refus d’un acteur non autorisé, les doublons, les rôles `directeur`/`livreur` interdits, la récupération du lien, l’adresse e-mail erronée, l’acceptation unique, la révocation, la conservation du profil et de l’identité Auth, la reprise d’un compte provisoire après confirmation/finalisation, la réaffectation et le refus d’un jeton expiré. Le script s’exécute dans une transaction terminée par `ROLLBACK` et s’est achevé sans exception.
- Contrôles SQL Replay : RLS activé sur `exam_staff_assignments` et `exam_staff_invites`; aucune lecture/écriture directe accordée sur les invitations; fonctions internes dans `private` en `SECURITY DEFINER` avec `search_path` vide; façades `public` en `SECURITY INVOKER` et exécution réservée à `authenticated`. La base impose aussi une seule affectation active par centre et utilisateur via un index unique partiel. Le conseiller Supabase signale `exam_staff_invites` en INFO (`RLS enabled no policy`) : c’est intentionnel, car les privilèges directs sont révoqués et toutes les opérations passent par les RPC contrôlées.
- La matrice TypeScript des rôles/capacités correspond à la fonction SQL `private.exam_has_capability`. Les actions directes et la révocation passent par les contrôles de capacité du centre. Le parcours Web conserve le retour après inscription OTP, connexion par mot de passe, Google et complétion du profil; le changement de compte ferme uniquement la session locale. La route de connexion normalise maintenant `retour` en chemin interne de même origine pour empêcher les redirections externes.
- **Non encore démontré dans cette révision :** compilation TypeScript, lint et test navigateur de bout en bout des trois parcours. Aucun résultat vert n’est revendiqué ici.
- Aucun test réel d’envoi Gmail n’est déclaré.

## Protection des environnements

Les modifications et essais de base de données de ce chantier ciblent uniquement Replay. Aucune migration ni aucun déploiement Production n’est inclus dans ce travail.
