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

Le responsable crée une invitation liée à une adresse e-mail et à un poste, puis transmet le lien personnel. Le destinataire crée ou connecte lui-même son compte Client, confirme son adresse, finalise son profil et accepte le lien. Le jeton est à usage unique, expire après sept jours et ne peut pas être accepté depuis une autre adresse e-mail.

## Règles communes

- Un poste Examens est une affectation professionnelle distincte du rôle global du compte.
- Les rôles `directeur` et `livreur` ne sont pas attribuables par ces parcours.
- Les affectations révoquées restent dans l’historique.
- Révoquer une affectation met `is_active=false`, `active_role=false` et renseigne `revoked_at`. Cela ne supprime ni l’identité `auth.users`, ni le profil NAXA, et ne suspend pas le compte.
- Un compte peut être affecté de nouveau si les contrôles métier sont satisfaits.

## Vérifications effectuées

- Le contrat SQL Examens a été exécuté sur le projet Supabase Replay `pwfftcsjyeibxxqhwysw` et s’est terminé sans exception.
- Le contrat couvre l’affectation directe d’un compte existant, les refus d’accès non autorisé, les doublons, les rôles interdits, l’invitation, la vérification de l’adresse, l’acceptation unique, la révocation, la conservation du profil et de l’identité Auth, puis la réaffectation.
- Les permissions RPC ont été contrôlées précédemment : exécution réservée aux utilisateurs authentifiés, pas à `anon`.
- Aucun test réel d’envoi Gmail ni test navigateur de bout en bout n’est déclaré ici.
- Le contrôle CircleCI `ci/circleci: quality` était encore `pending` au dernier relevé. Le chantier ne doit donc pas être marqué vert avant résultat CI et vérification fonctionnelle navigateur.

## Protection des environnements

Les modifications et essais de base de données de ce chantier ciblent uniquement Replay. Aucune migration ni aucun déploiement Production n’est inclus dans ce travail.
