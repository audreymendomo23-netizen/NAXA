# NAXA — Continuité opérationnelle IA

> **Priorité opérationnelle — 13/11/2026 :** `AGENTS.md` est la source de consignes. La branche de travail et de référence est `main`. Les anciens journaux de branches, PR et interdictions de fusion ci-dessous sont conservés comme archives et ne remplacent ni `AGENTS.md`, ni les ordres explicites plus récents de l'utilisateur.

Dernière mise à jour : 2026-11-13

## Règles opérationnelles courantes

- Lire `AGENTS.md` avant toute intervention et travailler sur `main`, sans créer de nouvelle branche.
- Ne pas créer de PR. Les fusions de branches ne sont effectuées que sur ordre explicite de l'utilisateur ; l'ordre du 13/11/2026 concernant les branches parallèles recensées a été exécuté.
- Ne pas déployer et ne pas toucher à Supabase Production sans autorisation explicite correspondant à l'opération.
- Vérifier le HEAD réel et les preuves sur le SHA exact ; une PR fusionnée établit l'intégration Git, pas la réussite des tests, du build, de la CI ou de la Production.
- Garder les anciennes observations QA comme archives. Ne pas reprendre une ancienne branche comme branche active sur la seule base de ce journal.

## Journal de continuité — fusion des branches parallèles (13/11/2026)

- `main` était au SHA `722ecf3a642000085334fb92e78b38ab56245458` juste avant cette mise à jour documentaire.
- PR #102 — source `3c76a1f0bddcc0aeb00b6f2689bdba7922341dc2`, fusion `6eb5bd0c58bd818a866c71ec7f50ee4f83a2806b` : [PR #102](https://github.com/audreymendomo23-netizen/NAXA/pull/102).
- PR #104 — source `6312f8f3365f142c014638e53f9a828516ecb5f1`, fusion `c70e18c5f8ae7c5f7db2456a6c3b5920b9c70a3f` : [PR #104](https://github.com/audreymendomo23-netizen/NAXA/pull/104).
- PR #105 — source `19a47178e3347014c4bd1a84f06dde2484a93779`, fusion `f80939f60fadbd700204b71bccd1aa9b67b18f52` : [PR #105](https://github.com/audreymendomo23-netizen/NAXA/pull/105).
- PR #106 — source `f7654c3323d899e5a5845c70a52bf9b9fd9dc69d`, fusion `35ae6dfb06e1a3eaf64697904f431a2b0f268695` : [PR #106](https://github.com/audreymendomo23-netizen/NAXA/pull/106).
- Chaque PR a été relue après fusion : `closed`, `merged=true`, base `main`. Les comparaisons GitHub des quatre SHAs sources avec `main` indiquent `behind_by=0`.
- La branche `qa/e2e-stabilisation-20261106`, HEAD `f4edd8579971347aa090bf810e4357eca1ea26f8`, était déjà intégralement contenue dans `main` (`behind_by=0`) ; aucune fusion supplémentaire n'était requise.
- Contrôles de qualité : les quatre workflows GitHub Actions `NAXA quality` étaient en échec. #102/#104/#105 : 357/376 tests réussis, 19 en échec ; #106 : installation npm bloquée par le conflit ESLint 8 / peer ESLint >=9. Aucun vert CI n'est revendiqué.

## Archives historiques antérieures au 13/11/2026

## Chevauchements d'authentification identifiés
- Inscription/téléphone : `fix/signup-phone-validation` (validation 073), `fix/signup-trigger-production` (déclencheur/migration 074) et `feat/naxa-messagerie-profil-yaounde` (PR #56, onboarding et correctif téléphone). Même domaine et cause apparentée, mais périmètres techniques distincts ; vérifier les commits/migrations pour confirmer le chevauchement exact.
- OTP : `fix/auth-restore-otp-flow` (PR #57, restauration du modèle OTP) puis `fix/auth-signup-feedback-otp` (PR #58, compte à rebours, renvoi et erreurs). Branches empilées : complémentaires, pas strictement identiques.
- Identité visuelle : `feat/auth-water-bubbles` (PR #59, bulles animées) puis `feat/auth-visual-identity` (PR #60, composants et parcours visuel). Branches empilées et complémentaires.
- Sessions : `feat/session-audit` (PR #42, audit SQL) et `feat/login-session-limit` (PR #43, réponse de connexion et journalisation). Même fonctionnalité globale, couches DB/application complémentaires.
- Navigation/connexion : `fix/accueil-footer-signature-verte` (PR #54) et `feat/logo-navigation-role` (PR #52) touchent aussi la redirection selon le rôle. `fix/login-page-layout-20261012` (PR #62) porte principalement sur la connexion pharmacie et le mode hors ligne, et peut croiser la page de connexion sans être équivalent aux branches OTP.

## État de validation
Les descriptions de PR fournissent les périmètres ci-dessus, mais ne constituent pas à elles seules une preuve que toutes les branches passent la CI ni que leurs changements sont dans main. Les tests CI doivent être vérifiés sur le SHA exact de chaque branche avant toute décision.

## Journal de continuité
- 2026-10-13 : inventaire GitHub des branches d'authentification et lecture des descriptions de PR. Aucun code n'a été modifié par cette étape. Le document est le seul fichier que les commits de continuité peuvent modifier.

## Fiche de cette branche
Branche : `feat/auth-water-bubbles`
PR #59 : fond animé de bulles sur connexion, inscription et mot de passe oublié. Validation CI et aperçu mobile à confirmer selon la description de PR.

## Prochaine action autorisée
Vérifier l'état Git/PR/CI et les différences réelles avec les branches apparentées. Toute modification future reste limitée à ce document, sauf nouvelle autorisation explicite.

## Journal de continuité — point 1 : identité visuelle (2026-10-13)
- Autorisation utilisateur reçue pour corriger le lot identité visuelle avant le test final pré-déploiement.
- Branche active : `feat/auth-water-bubbles`; commit de correction code précédemment relevé : `4c184af270d7ef9ed82cdeb68e3ef098a6ad5b1a`.
- Correction ciblée dans `src/components/BullesAuthentification.tsx` : lorsque `prefers-reduced-motion` est actif, le canvas est dessiné sans boucle permanente de requestAnimationFrame; il est redessiné après redimensionnement. Les animations restent désactivées.
- PR #63 : https://github.com/audreymendomo23-netizen/NAXA/pull/63 — ouverte et non fusionnée à la dernière vérification rapportée.
- Un aperçu Vercel a précédemment été signalé prêt sur le SHA `c4316a3619115f2597828ab8e29ed7fa71b2d4d2` : https://naxa-git-feat-auth-water-bubbles-naxa3.vercel.app/connexion. Ce résultat ne prouve pas le succès des vérifications de code.
- Blocage CI : CircleCI `ci/circleci: quality = failure` sur le SHA `c4316a3619115f2597828ab8e29ed7fa71b2d4d2`, pipeline 1419 : https://circleci.com/gh/audreymendomo23-netizen/NAXA/1419. Les logs détaillés n'étaient pas accessibles via les outils disponibles; cause racine non établie. Ne pas déclarer le point vert sans preuve.
- Tentative antérieure de synchroniser la branche avec `main` bloquée par les contrôles de sécurité de l'outil GitHub; aucune synchronisation ni commit de fusion n'a été effectué. Ne pas contourner ce refus.
- Aucun merge, aucun déploiement Production, aucune écriture Supabase Production.

## RÈGLE ABSOLUE — continuité à chaque réponse
Cette procédure est obligatoire à chaque réponse liée à NAXA, y compris une réponse courte, une clarification, un audit, un blocage, une demande de code ou une réponse indiquant qu'aucun changement de code n'est nécessaire. La continuité est une tâche de livraison, pas une intention facultative.

Avant de terminer chaque intervention :
1. Lire l'état actuel du document et vérifier les faits nouveaux sur le dépôt, les branches, les PR et les contrôles pertinents.
2. Ajouter les faits nouveaux vérifiés, les actions réellement exécutées, les résultats, les liens de preuve, les blocages et la prochaine action autorisée. Éviter les doublons; ne pas écraser l'historique utile.
3. Enregistrer le document sur la branche existante autorisée, sans commit direct sur `main`, sans nouvelle branche et sans modifier d'autres fichiers sous cette autorisation.
4. Relire le document enregistré et vérifier le commit résultant.
5. Dans la réponse finale, indiquer le chemin, la branche, le commit confirmé et le lien.

Interdiction de prétendre qu'une mise à jour a été enregistrée si l'opération ou sa vérification a échoué. Si l'accès ou l'écriture est impossible, terminer par « CONTINUITÉ NON ENREGISTRÉE — BLOCAGE », nommer la cause vérifiée et maintenir cette mise à jour comme prochaine action obligatoire. Un texte dans le chat seul ne constitue pas une mise à jour du dépôt.

Respecter en toutes circonstances les règles NAXA : aucun commit direct sur `main`; aucune fusion ni aucun déploiement Production sans autorisation explicite; pour un déploiement, attendre exactement `OUI, DÉPLOIE`; Supabase Production en lecture seule; aucun secret affiché; aucun contournement de refus de sécurité; aucune dépense ou souscription sans autorisation; aucun travail Jobly pendant une tâche NAXA. Aucun statut « vert » sans preuve réelle sur le SHA exact.

## Journal de continuité — message de crédits (2026-10-13)
- L'utilisateur a fourni le message suivant d'une plateforme de build : « Build could not be completed because you are out of credits »; renouvellement annoncé le 7 novembre 2026; offre suggérée : Performance à partir de 15 $/mois avec 30 000 crédits supplémentaires par cycle.
- Ne pas attribuer ce blocage à une plateforme ou à un contrôle précis sans vérification des journaux.
- Décision : aucune souscription payante recommandée ni autorisée. Le manque de crédits signifie que ce build n'a pas abouti; ce n'est ni une preuve d'échec du code ni une preuve de réussite.
- État du point 1 : NON VERT. Les prévisualisations précédentes avaient été signalées READY/success, mais CircleCI quality était en échec sur le SHA vérifié le plus récent dans les informations disponibles; logs détaillés et cause racine toujours à obtenir.
- Prochaine action : identifier la plateforme et le build concernés, retrouver les logs CircleCI détaillés ou un rapport d'échec équivalent, corriger seulement la cause démontrée, puis exécuter et vérifier les contrôles sur le SHA exact. Ne pas fusionner ni déployer avant CI verte et validation utilisateur.

## Journal de continuité — solution alternative de vérification CI (2026-10-13)
- Recherche documentaire effectuée sur les docs officielles GitHub Actions et CircleCI.
- Recommandation principale : évaluer un workflow GitHub Actions indépendant qui exécute les contrôles de qualité et SQL sur le SHA du commit/PR, avec logs natifs et statuts visibles depuis GitHub. Cela fournit un deuxième vérificateur accessible via le connecteur GitHub, sans dépendre des logs de l'interface CircleCI.
- Coût : selon la documentation officielle GitHub, les runners standards hébergés par GitHub sont gratuits pour les dépôts publics; pour les dépôts privés, les minutes gratuites dépendent du forfait et l'usage excédentaire peut être facturé. Sources : https://docs.github.com/en/actions/concepts/billing-and-usage et https://github.com/github/docs/blob/main/content/billing/concepts/product-billing/github-actions.md. Avant activation, confirmer la visibilité du dépôt et ne jamais configurer de runner plus grand ou de dépense payante.
- Alternative de diagnostic sans migrer la CI : CircleCI expose une API officielle permettant de consulter pipelines, workflows et jobs; l'API nécessite un jeton personnel CircleCI et les autorisations correspondantes. Source : https://circleci.com/docs/guides/toolkit/api-developers-guide/. Aucun jeton n'a été demandé, créé, stocké ou affiché dans cette intervention.
- Limite : la documentation web ne prouve pas que le workflow GitHub Actions existe déjà dans NAXA, ni que les tests sont configurés pour y tourner. Aucun workflow, fichier de configuration, secret ou code applicatif n'a été modifié; seule cette continuité a été mise à jour.
- Prochaine étape proposée, nécessitant autorisation explicite de modification de configuration : examiner les workflows GitHub Actions déjà présents; s'il n'en existe pas, préparer un workflow de validation en lecture seule sur PR/commit, reproduisant les checks qualité et SQL sans toucher à Production. Faire valider le plan avant toute modification. Le statut CircleCI reste non vert tant que son échec n'est pas expliqué; un nouveau workflow vert serait une preuve indépendante, pas la preuve que CircleCI est réparé.


## Journal de continuité — vérification du quota GitHub (2026-10-13)
- Vérification via le connecteur GitHub : le dépôt `audreymendomo23-netizen/NAXA` est bien en visibilité **private**, branche par défaut `main`. Preuve : https://github.com/audreymendomo23-netizen/NAXA.
- Contrôle CI sur le SHA `4c184af270d7ef9ed82cdeb68e3ef098a6ad5b1a` : `ci/circleci: quality = failure`, pipeline 1415 : https://circleci.com/gh/audreymendomo23-netizen/NAXA/1415. La recherche des exécutions GitHub Actions associées à ce SHA n'a retourné aucune exécution.
- Limite importante : les outils GitHub disponibles ne donnent pas accès au tableau de facturation/consommation Actions du compte. Je ne peux donc pas confirmer directement le solde exact de minutes ni la date de réinitialisation. L'affirmation selon laquelle le quota est épuisé reste à confirmer par la page Billing du compte, mais elle est cohérente avec un dépôt privé et un message de limite/credits fourni par l'utilisateur.
- Documentation officielle : sur les dépôts privés, les minutes GitHub Actions sont limitées par le forfait et le dépassement peut être bloqué si aucun moyen de paiement valide n'est configuré; les runners standards sont gratuits sur les dépôts publics. https://docs.github.com/en/actions/concepts/billing-and-usage. Aucune modification de visibilité du dépôt, aucune dépense et aucun changement CI effectués.
- Conclusion opérationnelle : ne pas compter sur GitHub Actions hébergé tant que le quota privé n'est pas confirmé/rétabli. Ne pas rendre le dépôt public pour contourner la limite. Le CI CircleCI reste en échec sur le SHA vérifié; aucune preuve de CI verte n'a été obtenue.
- Prochaine action : vérifier le quota exact dans https://github.com/settings/billing (usage GitHub Actions / budgets), sans activer de paiement. Ensuite, choisir un runner externe gratuit compatible avec le dépôt privé, ou attendre le renouvellement du quota, avant de modifier la configuration CI.


## Journal de continuité — vérification GitHub et feedback PR (2026-10-13)
- État actuel de la PR #63 vérifié via GitHub : ouverte, non fusionnée, branche source `feat/auth-water-bubbles`, SHA de tête `be866cbd71520c4246644bbc04275caba24c2acb`. Aucun commentaire humain ni review soumise, aucun thread de review en ligne. Les seuls retours visibles sont des bots de déploiement.
- Feedback Vercel : Preview READY sur le SHA `be866cbd...`, déploiement `2iCajveNHPt12ToPj3nnHs3yuNec`, URL https://naxa-git-feat-auth-water-bubbles-naxa3.vercel.app. Commentaire GitHub daté du 13 octobre 2026 à 00:36 UTC.
- Vérification du statut GitHub sur ce SHA : `ci/circleci: quality = failure`, pipeline 1425 https://circleci.com/gh/audreymendomo23-netizen/NAXA/1425. Ce statut rouge ne doit pas être confondu avec la disponibilité d'un aperçu.
- État public de GitHub Status consulté : services actuellement « All Systems Operational ». L'historique mentionne un incident Actions / Pull Requests / Issues le 12 octobre 2026, avec mitigations et surveillance; cet incident passé ne suffit pas à expliquer l'échec CircleCI actuel. Source : https://www.githubstatus.com/.
- La page Billing et le feedback exact du quota privé ne sont pas accessibles via les outils disponibles. Le quota ne peut donc pas être confirmé à distance; il faut consulter la page de facturation de l'utilisateur.
- Aucun code applicatif modifié, aucune action de facturation, aucune modification de visibilité, aucune fusion ni aucun déploiement Production. La mise à jour de continuité précédente est le seul commit récent sur la branche.
- Prochaine action : obtenir les logs détaillés de CircleCI pipeline 1425 ou la cause exacte du message de quota dans GitHub Billing; ne pas traiter les succès de preview comme preuve de CI complète.


## Journal de continuité — nouvelle vérification CI GitHub (2026-10-13, reprise utilisateur)
- Relecture directe de la PR #63 : https://github.com/audreymendomo23-netizen/NAXA/pull/63. Elle est toujours ouverte. La tête de branche actuelle retournée par GitHub est désormais `e8db412820cd963281d48628ece3cbd5f417801f` (la vérification précédente avait relevé `be866cbd...`; l'état de tête a avancé depuis).
- L'API GitHub Actions a retourné `total_count: 0` pour les exécutions associées à ce SHA. Cela ne change pas le statut CircleCI.
- Tentative de lecture de la page CircleCI 1427 par l'outil web : inaccessible (erreur de lecture). Les outils GitHub disponibles ne fournissent pas les logs internes CircleCI. La cause racine du statut `quality = failure` n'est donc toujours pas déterminée; aucune correction de code ne doit être devinée.
- Vérification documentaire du statut public CircleCI : son historique signale plusieurs incidents d'exécution début octobre 2026, dont une perturbation du 9 octobre résolue le 10 octobre. Rien dans ces incidents ne prouve que le pipeline 1427 est affecté. Source : https://status.circleci.com/history.
- Aucun code, workflow ou réglage CI modifié; aucun nouveau pipeline déclenché, aucun paiement, aucune fusion et aucun déploiement Production. Seul ce document de continuité est mis à jour.
- Prochaine action : récupérer le détail du job `quality` de pipeline 1427 depuis les logs CircleCI ou une API autorisée; ensuite seulement identifier la cause et proposer une correction ciblée. CI toujours NON VERTE.


## Journal de continuité — recherche multi-options pour débloquer la CI (2026-10-13)
- Nouvelle vérification du code CI sur `feat/auth-water-bubbles` : `.circleci/config.yml` existe (blob `cb3398a2fbd45fa87cfa1701b3ec881c18079f98`). Le job `quality` exécute successivement `npm install --no-audit --no-fund`, `npx tsc --noEmit`, trois scripts de tests Node, `npm run lint` et `npm run build`. Le script `lint` dans `package.json` est `next lint`; les dépendances Next 14.2.15 et ESLint 8.57.1 sont déclarées. `.eslintrc.json` existe et désactive `react/no-unescaped-entities`. Aucun `package-lock.json` n'a été trouvé à la racine de cette branche. Ces faits identifient les étapes à examiner, mais ne prouvent pas laquelle échoue dans le pipeline 1427.
- Statut public CircleCI consulté le 13 octobre : « All Systems Operational ». Historique officiel : incident du 9 octobre 2026 ayant affecté pipelines/workflows/jobs, interface et API entre 11:15 UTC et 23:47 UTC; résolu le 10 octobre. Ce contexte justifie de vérifier les détails du job, mais ne permet pas d'attribuer l'échec du pipeline 1427 à l'incident. Source : https://status.circleci.com/.
- Documentation officielle CircleCI : l'API v2 permet de lire pipelines, workflows et jobs, mais les appels API nécessitent un jeton personnel CircleCI. Sources : https://circleci.com/docs/api/v2/ et https://circleci.com/docs/guides/toolkit/api-developers-guide/. Aucun jeton CircleCI n'est disponible via les outils connectés dans cette session; aucun secret n'a été demandé ni enregistré.
- Documentation officielle GitHub : Actions sur dépôt privé consomme le quota inclus au forfait et peut être bloqué au-delà si aucun moyen de paiement valide n'est configuré; les runners auto-hébergés ne facturent pas de minutes Actions, mais l'utilisateur supporte le coût matériel/serveur. Sources : https://docs.github.com/en/actions/concepts/billing-and-usage et https://docs.github.com/en/actions/concepts/runners/self-hosted-runners. Ne pas supposer qu'un runner auto-hébergé est gratuit en coût total si aucun ordinateur/serveur déjà disponible.
- Documentation officielle GitLab : les runners hébergés consomment les minutes de calcul du namespace; le quota Free documenté est de 400 minutes/mois. Sources : https://docs.gitlab.com/ci/runners/hosted_runners/ et https://docs.gitlab.com/ci/pipelines/compute_minutes/. Le GitLab de test déjà utilisé reste une preuve de diagnostic seulement, pas la preuve que le contrôle CircleCI de la PR est vert.
- Options à proposer à l'utilisateur, sans changement CI effectué : (A) obtenir les logs via l'API CircleCI avec un jeton personnel temporaire créé par l'utilisateur et fourni dans un canal sûr — voie la plus directe pour corriger la cause réelle; (B) demander une autorisation de modification de configuration pour ajouter un workflow GitHub Actions de vérification, en choisissant explicitement entre quota hébergé privé (peut être bloqué) et runner auto-hébergé sur une machine déjà disponible (pas de minutes Actions, mais maintenance/coût machine); (C) faire tourner une validation indépendante sur runner GitLab existant, en gardant la réserve que cela ne rend pas le statut CircleCI vert; (D) examiner un ajustement ciblé du job CircleCI après récupération des logs, notamment verrouillage des dépendances (pas de lockfile trouvé), étapes `next lint`/TypeScript/build et scripts de test. Ne pas choisir ni implémenter une option sans autorisation de changement appropriée.
- Aucune modification de code, de configuration CI ou de facturation n'a été faite; seule cette continuité est modifiée. La CI demeure NON VERTE; cause racine non établie.
- Prochaine action recommandée : voie A pour obtenir immédiatement le journal exact du job `quality` du pipeline 1427; si impossible, choisir explicitement B ou C comme contrôle indépendant, sans le présenter comme une réparation de CircleCI.


## Journal de continuité — diagnostic indépendant GitLab option C (2026-10-13)
- À la demande de l'utilisateur, contrôle sur le projet GitLab de test ID `87443849`, branche `gl-ci-test`, sans modifier le code applicatif ni `.gitlab-ci.yml`.
- Branche du banc de test vérifiée : SHA `61f5cca799f04722e46925741cd25779df569c79`, commit « fix(ci): retirer les signatures d'API obsolètes de migration 020 ». Le runner GitLab partagé est en ligne (runner ID `54907241`, type instance/shared, Linux amd64).
- Pipeline historique `2933568751` terminé `success` le 10 octobre, job `17080961731` en 24,48 s. Son journal indique `FINAL_FAILURE_COUNT=0` et `RESULT PASS` pour les migrations listées, de `migration_015...` à `migration_068...`; le journal complet indique aussi `migration_012a_can_access_pharmacy.sql`, `migration_019a_naxa_can.sql` et les migrations 020 PASS. L'exécution de test a rejoué le schéma puis les migrations dans PostgreSQL 17 isolé; aucune écriture sur Supabase Production.
- Réserve importante découverte : le script de `.gitlab-ci.yml` met volontairement `exit 0` après le résumé, même si `failures` serait supérieur à zéro. Le statut vert du job n'est donc pas à lui seul un garde-fou fiable; le contenu `FINAL_FAILURE_COUNT=0` dans le journal est la preuve diagnostique pertinente pour cette exécution précise. Ce script n'a pas été modifié, conformément à la contrainte existante.
- Nouvelle exécution déclenchée via l'API GitLab sur la même branche/SHA : pipeline `2940571672`, https://gitlab.com/audreymendomo23-netizen/NAXA/-/pipelines/2940571672. À la dernière lecture, le pipeline est encore `running`; job `17126585617` est en phase de préparation du runner et le journal s'arrête au téléchargement de l'image helper. Aucun résultat final n'est encore disponible.
- Limite de portée : ce banc GitLab ne vérifie que le replay SQL décrit dans `.gitlab-ci.yml`; il n'exécute pas les étapes CircleCI `quality` (TypeScript, tests Node, lint, build). Il ne rend donc pas CircleCI vert et ne permet pas de conclure sur l'échec CircleCI pipeline 1427 / job `quality`.
- Aucune modification du code applicatif, de `.gitlab-ci.yml`, aucune fusion ni aucun déploiement. Seul ce document de continuité est mis à jour. Statut CircleCI : toujours NON VERT / cause racine toujours non établie.
- Prochaine action de diagnostic : relever le résultat final et le journal de pipeline `2940571672`; exploiter `FINAL_FAILURE_COUNT` et la liste des premières erreurs plutôt que le seul badge GitLab. Pour la panne CircleCI `quality`, il faudra ensuite obtenir les logs de ce job CircleCI ou ajouter, avec autorisation, des tests indépendants TypeScript/lint/build sur le banc existant.


### Résultat final de l'exécution GitLab option C — pipeline 2940571672 (2026-10-13)
- Nouvelle exécution terminée avec statut GitLab `success` à 00:54:53 UTC sur SHA `61f5cca799f04722e46925741cd25779df569c79`; job `17126585617`, runner partagé `54907241`, durée 26,69 s.
- Lecture du journal final : `FINAL_FAILURE_COUNT=0`; les lignes `RESULT PASS` confirment explicitement `migration_012a_can_access_pharmacy.sql`, `migration_019a_naxa_can.sql`, `migration_020_architecture_privileges.sql`, `migration_020_authorisation_architecture_privileges.sql`, `migration_020b_architecture_accreditation.sql` et `migration_020c_architecture_privilege_gates.sql`. L'exécution a donc confirmé le replay SQL sans erreur signalée pour le jeu de migrations présent sur cette branche GitLab.
- Lien du pipeline : https://gitlab.com/audreymendomo23-netizen/NAXA/-/pipelines/2940571672 ; journal du job : https://gitlab.com/audreymendomo23-netizen/NAXA/-/jobs/17126585617.
- Réserve inchangée : le job est configuré pour terminer par `exit 0` malgré d'éventuelles erreurs de migration. Pour ce run, `FINAL_FAILURE_COUNT=0` et les lignes de résultat sont donc les éléments probants, pas seulement le statut global.
- Ce pipeline GitLab ne teste pas le job CircleCI `quality` (TypeScript, scripts Node, lint, build). CircleCI pipeline 1427 reste non résolu et ne peut pas être déclaré vert sur la base de cette preuve indépendante.


## Décision de travail — privilégier GitLab comme CI de validation (2026-10-13)
- L'utilisateur souhaite poursuivre uniquement avec GitLab pour avancer, sans confondre le statut GitLab avec CircleCI.
- Diagnostic SQL confirmé : pipeline GitLab `2940571672` sur le banc `gl-ci-test`, SHA `61f5cca799f04722e46925741cd25779df569c79`, terminé `success`; job `17126585617`; `FINAL_FAILURE_COUNT=0`; migrations `012a`, `019a` et `020` explicitement PASS dans le journal. Lien : https://gitlab.com/audreymendomo23-netizen/NAXA/-/pipelines/2940571672.
- Le `.gitlab-ci.yml` actuel ne fait que le replay SQL; il ne couvre pas encore les contrôles front-end du job CircleCI `quality` (TypeScript, tests Node, lint et build). Pour que GitLab devienne la validation complète, il faudrait élargir le pipeline GitLab et corriger le garde-fou qui termine actuellement par `exit 0` indépendamment du nombre d'erreurs. L'utilisateur avait précédemment explicitement refusé les modifications de `.gitlab-ci.yml`; aucune modification de ce fichier n'a donc été faite. Avant de toucher ce fichier, demander confirmation explicite que cette interdiction est levée.
- Même une CI GitLab complète ne rend pas automatiquement le contrôle CircleCI rouge/vert de GitHub vert. La documentation officielle GitLab décrit l'intégration CI/CD avec un dépôt GitHub externe comme une fonctionnalité Premium/Ultimate; elle exige notamment un accès GitHub approprié et une configuration d'intégration. Source : https://docs.gitlab.com/ci/ci_cd_for_external_repos/github_integration/. Ne pas activer de fonctionnalité payante ni modifier les protections GitHub sans autorisation.
- Statut : GitLab peut devenir le système de validation technique principal si l'utilisateur confirme la modification de `.gitlab-ci.yml`; CircleCI reste séparément non vert tant que son contrôle n'est pas réparé ou remplacé officiellement. Aucun code/config modifié dans cette étape, aucune fusion ni déploiement.


## Journal — CI GitLab complétée sur gl-ci-test (2026-10-13)
- Autorisation explicite de l'utilisateur : modifier `.gitlab-ci.yml` sur la branche GitLab `gl-ci-test` uniquement; aucune modification de `main`, aucune fusion et aucun déploiement.
- Commit GitLab effectué sur la seule branche `gl-ci-test` : `25c798ed225333ea3e8530533c8f0ca187b601fc`, message `ci: rendre la validation GitLab complète et bloquante`. Parent `61f5cca799f04722e46925741cd25779df569c79`. Le seul fichier modifié dans ce commit est `.gitlab-ci.yml`.
- Pipeline mis en place avec deux jobs indépendants dans le stage `validate` : `quality` sur Node 20 (installation npm, `npx tsc --noEmit`, `npm run lint`, `npm run build` avec variables Supabase factices) et `full_migration_replay` sur PostgreSQL 17 (schéma puis toutes les migrations triées).
- Fiabilisation SQL : `ON_ERROR_STOP=1` conservé pour le schéma et chaque migration; erreurs individuelles consignées dans le résumé; le job sort maintenant en échec si `FINAL_FAILURE_COUNT` est différent de zéro. Il échoue aussi si aucun fichier `migration_*.sql` n'est trouvé. La précédente terminaison inconditionnelle `exit 0` a été supprimée.
- Pipeline déclenché pour le commit exact `25c798ed225333ea3e8530533c8f0ca187b601fc` : `2940580641`, https://gitlab.com/audreymendomo23-netizen/NAXA/-/pipelines/2940580641. Dernier contrôle pendant ce journal : les deux jobs `quality` (`17126641593`) et `full_migration_replay` (`17126641594`) sont en cours de préparation des runners; résultats finaux non encore disponibles.
- Portée : le fichier `package.json` sur le banc ne définit pas de scripts `test:travel-taxi`, `test:geolocalisation` ou `test:catalogue-medicaments`; ils ne sont donc pas appelés. Les contrôles disponibles sont TypeScript, lint, build et replay SQL.
- Aucune modification de `.gitlab-ci.yml` sur GitHub, aucun commit sur `main`, aucune fusion, aucun déploiement Production. Les résultats GitLab ne changent pas le statut CircleCI.


### Première exécution de la CI GitLab complétée — résultats partiels (2026-10-13)
- Pipeline `2940580641`, SHA `25c798ed225333ea3e8530533c8f0ca187b601fc` : job `full_migration_replay` réussi en 29,64 s. Le journal termine par `FINAL_FAILURE_COUNT=0`, les migrations jusqu'à `migration_068_hierarchical_pharmacy_scope.sql` indiquent PASS. Lien du job : https://gitlab.com/audreymendomo23-netizen/NAXA/-/jobs/17126641594.
- Job `quality` (`17126641593`) toujours `running` après environ 59 s; son journal récupéré via API reste bloqué à la phase `Preparing the "docker+machine" executor` / téléchargement de l'image helper, sans encore afficher la version Node ou les commandes npm. Le runner et son manager sont signalés online/active; la cause du blocage n'est pas établie. Lien : https://gitlab.com/audreymendomo23-netizen/NAXA/-/jobs/17126641593.
- Le pipeline global reste donc `running`; il ne faut pas le déclarer vert tant que `quality` n'a pas un statut final. Aucun nouveau changement de configuration après le commit `25c798ed...`.


### Règle d'économie des crédits CI — 2026-10-13
- Demande utilisateur : limiter les vérifications CI/tests répétitifs et regrouper les contrôles en un seul appel lorsque possible, afin de préserver les crédits.
- Méthode : consulter ensemble l'état du pipeline, les jobs et les journaux utiles; ne relancer ni multiplier les tests sans cause identifiée; diagnostiquer d'abord à partir des journaux existants et n'ajouter qu'un test ciblé s'il tranche une incertitude réelle.
- Ne jamais déclarer un pipeline réussi avant les statuts finaux et leurs journaux. La validation GitLab reste distincte de CircleCI. Portée inchangée : essais autorisés sur GitLab `gl-ci-test`; aucune modification de `main`, fusion ou déploiement sans autorisation explicite.


### Statut final CI GitLab — pipeline 2940580641 (contrôle groupé, 2026-10-13)
- Statut API confirmé : pipeline `2940580641` = `success` / `passed`, SHA `25c798ed225333ea3e8530533c8f0ca187b601fc`, branche `gl-ci-test`, durée totale 142 s. Lien : https://gitlab.com/audreymendomo23-netizen/NAXA/-/pipelines/2940580641.
- Job `quality` `17126641593` = `success` (142,99 s). Le journal confirme Node `v20.20.2`, npm `10.8.2`, `npx tsc --noEmit` passé, `npm run lint` exécuté et build inclus dans le job; avertissements ESLint et avertissements de dépendances npm visibles, sans empêcher la réussite. Lien : https://gitlab.com/audreymendomo23-netizen/NAXA/-/jobs/17126641593.
- Job `full_migration_replay` `17126641594` = `success` (29,64 s), journal précédemment terminé par `FINAL_FAILURE_COUNT=0`. Lien : https://gitlab.com/audreymendomo23-netizen/NAXA/-/jobs/17126641594.
- Conclusion limitée : la CI GitLab sur cette branche et ce commit est verte. Cela ne prouve pas que CircleCI est vert, ni que la Production est déployée ou validée. Aucun changement de code, aucune fusion et aucun déploiement réalisés pendant ce contrôle.


### Décision utilisateur — CI verte, tests complémentaires en attente (2026-10-13)
- L'utilisateur valide le statut actuel comme **VERT**, avec les tests complémentaires encore en attente.
- Référence de preuve : pipeline GitLab 2940580641, commit 25c798ed225333ea3e8530533c8f0ca187b601fc, branche gl-ci-test; jobs quality et full_migration_replay réussis.
- Portée : ce vert concerne uniquement cette validation GitLab. Les tests complémentaires ne sont pas déclarés exécutés; ne pas présenter ce statut comme une validation de GitHub main, de CircleCI ou de Production.
- Méthode : GitLab reste le banc de validation courant; éviter les exécutions redondantes de CircleCI. Relancer seulement les tests complémentaires ciblés lorsqu'ils seront demandés ou nécessaires. Aucun merge ni déploiement autorisé par cette décision.


### Consigne prioritaire — ne plus utiliser CircleCI (2026-10-13)
- L'utilisateur demande explicitement d'oublier CircleCI pour la suite du travail NAXA.
- Référence de validation courante : GitLab uniquement, pipeline 2940580641 sur `gl-ci-test`, commit `25c798ed225333ea3e8530533c8f0ca187b601fc`, statut `success`; jobs `quality` et `full_migration_replay` réussis.
- Ne plus lancer, consulter ni évoquer CircleCI comme étape attendue, sauf demande explicite ultérieure de l'utilisateur.
- Les tests complémentaires restent en attente. Ne pas confondre le vert GitLab validé avec des tests complémentaires non exécutés. Aucun merge ou déploiement n'est autorisé par cette consigne.


### Tests manuels utilisateur via Vercel — préparation (2026-10-13)
- Preview Vercel à tester : https://naxa-3870fdsp8-naxa3.vercel.app ; état Vercel `READY`, déploiement `dpl_G2tTyx9ZrrL7X2EELCoNSCdmX9xX`, branche `fix/login-page-layout-20261012`, commit `fa7b72b4f253391ab45eef1d1cd9c77a77a0a055`.
- Cette preview concerne l'interface de connexion; la validation visuelle/fonctionnelle par l'utilisateur reste à faire. Commencer par connexion, puis inscription, mot de passe oublié et maintien de session.
- Préparer une checklist manuelle : affichage/mobile, champs et validations, erreurs identifiants, navigation inscription/récupération, maintien de session, chargement/erreurs réseau et comportement après actualisation. Pour chaque test, distinguer réussi, échoué et non testé; noter le message exact et une capture si échec.
- Aucun code, déploiement ou configuration modifié pendant cette préparation.


### Écart constaté sur la preview d'accueil — ne pas refaire le design validé (2026-10-13)
- L'utilisateur signale que la page affichée ne correspond pas au design d'accueil déjà validé; il ne faut pas lui demander de revalider ce design ni recommencer sa conception.
- Le lien envoyé précédemment `naxa-3870fdsp8-naxa3.vercel.app` est associé au commit `fa7b72b4f253391ab45eef1d1cd9c77a77a0a055` (`style(auth): préserver les classes existantes de connexion`), donc il n'était pas suffisamment justifié comme preuve du design d'accueil approuvé.
- Le design d'accueil précédemment accepté comprenait un accueil sans défilement, recherche texte/OCR, étapes « Je cherche… Je réserve », avertissement médical; une validation ultérieure demandait fond blanc, footer supprimé, « Made With 💚 » centré et sélecteur Fr|En à droite. Référence mémorisée : commits `d751a3a` puis `9f8e8da` (à confirmer dans l'historique Git avant de choisir un déploiement).
- Prochaine action : identifier dans l'historique Git/Vercel le commit exact qui contient le design approuvé et fournir uniquement un lien de preview qui correspond à ce commit. Ne pas modifier ni refaire le design sans audit et preuve de la différence.
- Aucun code ni déploiement modifié par ce diagnostic.


### Audit des branches et chevauchements fonctionnels (2026-10-13)
- Question utilisateur : déterminer si des branches contiennent des fonctionnalités déjà validées/travaillées sur d'autres branches, afin d'éviter de refaire le travail.
- Inventaire GitHub : branches existantes notamment `feat/accueil-entete`, `feat/accueil-etape-a`, `fix/accueil-footer-signature-verte`, `feat/auth-water-bubbles`, `feat/auth-visual-identity`, `feat/logo-navigation-role`, `feat/login-session-limit`, `feat/yaounde-pharmacy-geolocation`, `feat/yaounde-garde-crosscheck`, ainsi que plusieurs branches d'inscription, OTP et session.
- Comparaisons réelles avec `main` (HEAD `3d5be6dee774a0beb9ca58322bf579b27d1ab4dd`) : `feat/accueil-entete` diverge avec 2 commits propres et 54 commits de retard, touchant `src/app/page.tsx`, `src/components/Logo.tsx` et les logos; `feat/accueil-etape-a` a 2 commits propres et 51 de retard, touchant accueil, recherche, connexion et gardes; `fix/accueil-footer-signature-verte` a 3 commits propres et 47 de retard, touchant connexion et textes d'accueil; `feat/auth-water-bubbles` a 21 commits propres et 29 de retard, dont `src/components/BullesAuthentification.tsx); `feat/auth-visual-identity` a 1 commit propre et 8 de retard; `feat/logo-navigation-role` a 3 commits propres et 50 de retard; `feat/login-session-limit` a 1 commit propre et 58 de retard; les branches pharmacie de Yaoundé divergent fortement et portent des changements de recherche, géolocalisation, migrations et données.
- Les PR déjà fusionnées récemment dans l'historique de `main` incluent #57 (restauration OTP), #58 (retours/renvoi OTP), #59 (bulles), #60 (identité visuelle) et #61 (documents juridiques). Ne pas confondre une branche historique conservée avec des changements encore absents de `main`; vérifier chaque fichier/commit avant de récupérer une fonctionnalité.
- Conclusion provisoire : oui, les domaines fonctionnels se chevauchent et des branches anciennes ont divergé. Ce premier passage établit le risque de duplication, mais ne suffit pas à certifier quelles fonctionnalités ont été validées par l'utilisateur ni si elles sont intégralement présentes dans `main`. Prochaine étape autorisée : matrice fichier/fonctionnalité/branche/PR/validation/preuve CI, puis identifier la source exacte du design d'accueil approuvé. Aucune modification de code, fusion, ni déploiement effectués.


### Comparatif des différences fonctionnelles entre branches (2026-10-13)
- Comparaison effectuée via GitHub `compare_commits`, base `main` à `3d5be6dee774a0beb9ca58322bf579b27d1ab4dd`. Résumé des différences propres visibles dans les fichiers modifiés :
  - `feat/accueil-entete` : logos PNG et changements limités à `src/app/page.tsx` et `src/components/Logo.tsx`.
  - `feat/accueil-etape-a` : refonte plus large de l'accueil, nouveau `EnTeteAccueil.tsx`, nouveaux textes d'accueil, modifications de la recherche et ajout de la page `/gardes`; modifie aussi la connexion et les styles globaux.
  - `fix/accueil-footer-signature-verte` : surtout page de connexion et libellés/textes d'accueil; ce n'est pas une refonte complète de l'accueil.
  - `feat/auth-water-bubbles` : différence applicative identifiée sur `BullesAuthentification.tsx`; la majorité du différentiel de cette branche est le document de continuité.
  - `feat/auth-visual-identity` : comparaison contre main ne montre que le document de continuité, pas de différence applicative dans ce différentiel.
  - `feat/logo-navigation-role` : changements majeurs de `Logo.tsx` et un ajustement de `Recherche.tsx`; chevauchement possible avec la branche d'en-tête d'accueil.
  - `feat/login-session-limit` : changement ciblé dans la route API de connexion `src/app/api/auth/login/route.ts`, relatif au traitement/journalisation de connexion.
  - `feat/yaounde-pharmacy-geolocation` : route API de recherche de médicaments, catalogue pilote, trajets/taxi, tests, migrations 070-071 et documentation de géolocalisation/gardes.
  - `feat/yaounde-garde-crosscheck` : scripts de comparaison multi-sources des gardes et tests associés, documentation des sources, mêmes migrations 070 et fichiers liés au trajet; chevauchement concret avec la branche précédente, mais ajout distinct du croisement de sources.
  - `fix/signup-phone-validation` : page de validation pharmacien, migration 072 de validation à distance, migration 073 de validation téléphone et tests SQL associés.
  - `fix/signup-trigger-production` : migration 074 et test de réparation du déclencheur d'inscription.
  - `feat/naxa-messagerie-profil-yaounde` : fonctionnalités plus larges de messagerie client-pharmacie, notifications, profil, onboarding/OAuth Google et bootstrap du premier admin; migrations 075-082, avec plusieurs corrections d'inscription/téléphone qui recoupent les branches signup.
  - `feat/session-audit` : migration 069 d'audit des sessions; couche base de données complémentaire à la branche qui modifie la route API de connexion.
  - `fix/auth-restore-otp-flow` et `fix/auth-signup-feedback-otp` : leurs diffs contre main n'exposent ici que le document de continuité; les descriptions de PR suggèrent des lots OTP, mais le contenu applicatif effectif doit être comparé à leur parent/PR avant d'affirmer qu'ils ajoutent encore du code absent de main.
- Attention : « commits en avance sur main » et fichiers visibles dans le diff ne prouvent pas la validation utilisateur. Les branches sont divergées; certaines peuvent être empilées ou contenir des corrections déjà reprises ailleurs. Aucun changement applicatif effectué pendant cet audit.


### Nettoyage des branches redondantes — consigne utilisateur (2026-10-13)
- Règle demandée : supprimer une branche seulement lorsque toutes ses modifications utiles sont déjà intégrées dans une autre branche de référence; conserver toute branche avec un changement unique, non validé ou encore en PR active.
- État GitHub vérifié : HEAD de `main` = `3d5be6dee774a0beb9ca58322bf579b27d1ab4dd`. Branches avec PR ouvertes observées : `feat/auth-water-bubbles` (PR #63), `fix/login-page-layout-20261012` (PR #62), `feat/naxa-messagerie-profil-yaounde` (PR #56). Elles ne sont pas des candidates à une suppression automatique, car leurs PR sont actives et portent du travail spécifique.
- Candidats à suppression après confirmation du contenu applicatif : `feat/auth-visual-identity`, `fix/auth-restore-otp-flow`, `fix/auth-signup-feedback-otp`. Le comparatif précédent contre `main` ne montrait, pour ces branches, aucune différence applicative propre visible; les PR OTP/identité associées sont indiquées comme fusionnées dans l'historique. Ce sont donc des candidates probables, mais il faut vérifier les références PR/commits avant suppression définitive.
- Branches à ne pas supprimer sur la seule base d'un chevauchement : `feat/yaounde-pharmacy-geolocation` et `feat/yaounde-garde-crosscheck` partagent certains fichiers/migrations mais la seconde apporte le croisement multi-sources; `fix/signup-phone-validation`, `fix/signup-trigger-production` et `feat/naxa-messagerie-profil-yaounde` ont des migrations/fonctions distinctes même si les domaines se recoupent; `feat/session-audit` et `feat/login-session-limit` couvrent respectivement SQL et API.
- Limite d'exécution constatée : les actions GitHub disponibles dans cette connexion permettent de lire les branches et comparer les commits, mais aucune action de suppression de branche distante n'est exposée. Aucune branche n'a donc été supprimée. Ne pas prétendre le contraire et ne pas contourner cette limite.
- Prochaine action : utiliser une action GitHub autorisée de suppression de ref pour les seuls candidats confirmés, puis relire la liste des branches pour vérifier la suppression. Aucun code, aucune fusion, aucun déploiement et aucune écriture Supabase Production effectués.


### Besoin utilisateur reconstitué — trois branches d’authentification (2026-10-13)
- `fix/auth-restore-otp-flow` — PR #57, fusionnée : restaurer le parcours OTP e-mail lors de l’inscription. Envoyer un code avec `signInWithOtp()`, le valider avec `verifyOtp()`, puis laisser l’utilisateur définir son mot de passe; conserver les métadonnées du profil. Éviter le modèle « Confirm signup » qui envoie un lien ouvrant l’application depuis Gmail. Le modèle Supabase Magic Link/OTP doit contenir `{{ .Token }}`; SMTP Brevo déjà configuré à vérifier, sans modifier Production dans le cadre de cette branche.
- `fix/auth-signup-feedback-otp` — PR #58, fusionnée et empilée sur #57 : compte à rebours OTP visible de 40 secondes et renvoi après expiration pour l’inscription et le mot de passe oublié; jauge de mot de passe à quatre segments avec couleurs par critère; préserver les majuscules du nom d’utilisateur à l’affichage tout en normalisant pour vérification/enregistrement; bloquer les e-mails/téléphones déjà utilisés avec un message explicite; afficher les erreurs dans une bulle animée, déplaçable et refermable au toucher/clic; valider les noms/prénoms; après inscription, diriger vers l’espace correspondant au rôle réel au lieu de revenir systématiquement à l’accueil; fiabiliser le renvoi OTP du mot de passe oublié. Le compte `naxa.home@gmail.com` ne doit pas recevoir un rôle admin via l’inscription publique : provisionnement par mécanisme privilégié séparé.
- `feat/auth-visual-identity` — PR #60, fusionnée et empilée sur la PR #59 `feat/auth-water-bubbles` : identité visuelle et transitions du parcours. Écran de création réussie avec goutte lumineuse, coche, onde turquoise, message de succès et bouton Continuer; e-mail de bienvenue après confirmation réelle de l’adresse via Google Apps Script/MailApp gratuit (sans Resend), avec clé d’idempotence et sans prétendre que l’e-mail est envoyé avant confirmation du service; bouton NAXA avec onde au clic et animation « ambulance » réservée aux actions importantes; transition turquoise de 340 ms entre pages; animations cohérentes sur inscription, connexion et récupération de mot de passe, respectant la préférence de réduction des mouvements. Le lot comprend aussi les brouillons datés du 12 octobre 2026 des CGU et de la politique de confidentialité.
- Configuration et limites associées au lot identité : déployer le script Apps Script avec le compte Gmail NAXA et configurer côté serveur `GOOGLE_APPS_SCRIPT_URL`, `GOOGLE_APPS_SCRIPT_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NAXA_PRIVACY_CONTACT_EMAIL`; aucun secret ne doit être commité. Les informations légales/prestataires doivent être confirmées avant Production; les textes sont des brouillons, pas un avis juridique.
- Vérification GitHub actuelle : les PR #57, #58 et #60 sont fermées et marquées fusionnées. Le fait que les branches distantes existent encore ne signifie pas que ces besoins sont absents de `main`. Ne supprimer les branches historiques qu’après confirmation que leurs changements utiles sont intégralement présents dans la référence et qu’aucun travail unique non intégré ne subsiste.


## Chantier accueil client/pharmacie + authentification — 2026-10-13

### Accueil client
- Comparaison réelle de `src/app/page.tsx` sur `main` et `feat/accueil-etape-a` : SHA de blob identique `e3d26fc7f1cb5983b20ce96d15d2c7e961bcc618`. Le parcours client validé est donc déjà présent sur `main` : en-tête bilingue FR/EN, menu avec espaces client/pharmacie, recherche, scan d'ordonnance avec import/caméra, recherches fréquentes, géolocalisation facultative, pharmacies de garde, étapes du parcours, avertissement médical et pied de page vert.
- Aucune copie ni modification inutile de la page client n'a été faite.

### Accueil pharmacie
- Modification de code autorisée explicitement par l'utilisateur et réalisée sur la branche existante `fix/login-page-layout-20261012`, fichier `src/app/pharmacie/page.tsx`.
- Commit : `9c52163adb6669d85ee886f68215b84940589684`.
- Ajout d'un tableau de bord visuel mobile-first avec indicateurs issus des données réelles : nombre de références en stock, réservations en cours, statut de garde. Le stock, les réservations, la garde, les conflits et les fonctions hors ligne existantes sont conservés.
- Relecture du fichier après commit : présence des trois cartes confirmée.
- PR #62 : https://github.com/audreymendomo23-netizen/NAXA/pull/62 — reste en brouillon pour validation utilisateur, sans fusion.
- Aperçu Vercel : ne pas annoncer qu'il est prêt tant qu'un déploiement Vercel du SHA concerné n'a pas été retrouvé et vérifié.
- Routes à tester : accueil client `/`, connexion pharmacie `/connexion?espace=pharmacie`, espace pharmacie `/pharmacie` après authentification.

### Trois branches d'authentification
- PR #57 `fix/auth-restore-otp-flow`, PR #58 `fix/auth-signup-feedback-otp` et PR #60 `feat/auth-visual-identity` sont déjà fusionnées.
- Vérification de `main` : `src/app/creation-compte/page.tsx` contient `signInWithOtp`, `verifyOtp`, le compte à rebours OTP, la bulle d'erreur, les quatre critères de mot de passe, l'écran `SuccesCreationCompte` et la redirection par rôle.
- `src/app/mot-de-passe-oublie/page.tsx` contient aussi le compte à rebours, le renvoi OTP, la bulle d'erreur et l'indicateur de force du mot de passe.
- `src/app/layout.tsx` enveloppe le contenu avec `TransitionNAXA`; `BoutonNAXA`, `BullesAuthentification`, `SuccesCreationCompte` et la route serveur de courrier de bienvenue sont présents.
- Ces contrôles sont des vérifications statiques de code, pas une preuve d'un parcours E2E réel. Les branches sont intégrées; ne pas recopier leurs changements.

### Point d'arrêt et validation
- Aucun changement sur `main`, aucune fusion, aucun déploiement Production, aucune écriture Supabase Production.
- Pour le commit `9c52163adb6669d85ee886f68215b84940589684`, aucun déploiement Vercel correspondant n'avait encore été confirmé à la date de cette note. Le chantier attend un aperçu Vercel vérifié avant le test utilisateur.


## Règle de validation et d'aperçu — 2026-10-13
- Tous les aperçus applicatifs et tests visuels du projet passent exclusivement par Vercel.
- Ne fournir aucun lien de test d'une autre plateforme. Avant d'inviter l'utilisateur à tester, retrouver le déploiement Vercel du SHA exact et vérifier son état et son URL.
- Le SHA `9c52163adb6669d85ee886f68215b84940589684` de la PR #62 doit être publié en aperçu Vercel avant le test pharmacie. Ne pas fusionner dans `main` ni déployer en Production sans autorisation explicite.


## Aperçu Vercel du chantier pharmacie — suivi du 2026-10-13
- Déploiement Vercel déclenché manuellement sur le commit exact `9c52163adb6669d85ee886f68215b84940589684`, branche `fix/login-page-layout-20261012`.
- ID de déploiement : `dpl_Dbwgiejo4KCpQBa7N4eq8AdHbBYi`.
- URL prévue : https://naxa-6npi1dzow-naxa3.vercel.app
- Dernier état observé : `BUILDING`; ne pas présenter l'URL comme prête avant l'état `READY` et le contrôle des journaux de build.
- Inventaire Git de `main` : aucun fichier ou chemin de configuration dédié à une autre plateforme de déploiement. Les anciennes mentions documentaires ont été retirées de ce document.


## Déploiement Vercel en échec puis correction ciblée — 2026-10-13
- Le déploiement Vercel `dpl_Dbwgiejo4KCpQBa7N4eq8AdHbBYi` a terminé en `ERROR` sur le commit pharmacie `9c52163adb6669d85ee886f68215b84940589684`. Logs : `npm run build` échoue pendant la vérification TypeScript, avec l'erreur `Cannot find module 'https://esm.sh/@supabase/supabase-js@2.45.4'` dans `supabase/functions/naxa-pharmacy-code/index.ts:1`.
- Cause racine démontrée : le `tsconfig.json` inclut tous les fichiers `**/*.ts`, y compris la fonction Edge Supabase écrite pour Deno, dont l'import HTTPS n'est pas résolu par le compilateur Next.js. Ce fichier n'est pas une page/app Next.js et doit rester déployé comme fonction Supabase.
- Correction ciblée commise uniquement sur la branche existante `fix/login-page-layout-20261012` : ajout de `supabase/functions/**` à `exclude` dans `tsconfig.json`. Aucun changement du code de la fonction, aucun secret affiché, aucune écriture Production Supabase, aucune modification de `main), aucune fusion.
- Commit de correction : `585676482dc79ff4bb3e7c8b88591fe8ca117e6f` (`fix(build): exclude Deno Edge Functions from Next.js typecheck`).
- Nouveau déploiement Vercel déclenché sur ce SHA : `dpl_7P82HoxwfcZPB9WM9cxCGZsSde9q`, URL https://naxa-3nxh9k0dz-naxa3.vercel.app. Dernier état vérifié : `BUILDING`; le build n'est pas encore confirmé vert et le lien ne doit pas être présenté comme prêt à tester.
- Prochaine action : lire les journaux et l'état terminal de ce nouveau déploiement. Si un autre échec survient, corriger uniquement après avoir identifié l'erreur précise. Tests applicatifs utilisateur à faire seulement quand Vercel indique `READY`.


### Incident Google OAuth sur l’aperçu Vercel — diagnostic ciblé (2026-10-13)
- Symptôme rapporté : après le choix Google/Gmail, page blanche avec un court message en haut, puis bascule vers la page de panne/hors-ligne.
- Preview inspectée : déploiement dpl_7P82HoxwfcZPB9WM9cxCGZsSde9q, URL https://naxa-3nxh9k0dz-naxa3.vercel.app, commit 585676482dc79ff4bb3e7c8b88591fe8ca117e6f, état du build READY. Cela ne valide pas le parcours OAuth.
- Lecture statique de src/app/connexion/page.tsx sur fix/login-page-layout-20261012 : le bouton appelle Supabase signInWithOAuth(provider=google), redirige vers l’origine de la preview /auth/callback, puis vers /connexion?redirectionRole=1 par défaut. La page ne lit pas le paramètre erreur=oauth.
- Lecture statique de src/app/auth/callback/route.ts : le callback échange le code contre une session; si le code manque ou si l’échange échoue, il redirige vers /connexion?erreur=oauth. L’interface n’affiche pas explicitement cette erreur : défaut de diagnostic UX confirmé, mais pas encore preuve de la cause primaire.
- Runtime logs Vercel : la requête sur 24 h a été refusée par l’API car le plan Hobby ne conserve pas les logs runtime sur cette fenêtre. Ce refus ne prouve pas l’absence d’erreurs. Prochain contrôle : fenêtre courte, idéalement 30 min, et requêtes /auth/callback.
- Hypothèses non prouvées : URI de redirection preview absente de la liste autorisée Supabase Auth; fournisseur Google désactivé/mal configuré; échec de exchangeCodeForSession; ou service worker/cache hors ligne interceptant une navigation échouée. Ne pas modifier configuration OAuth ou code avant de distinguer ces cas.
- Aucun changement applicatif, aucune modification de main, aucune fusion, aucun déploiement Production, aucune écriture Supabase dans ce diagnostic.


### Diagnostic Google OAuth + intégration du design dès l’accueil (2026-10-13)
- Cause 2 (fournisseur Google Supabase Auth) : projet Preview confirmé comme le projet de test `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`), via les variables Preview de la branche `fix/login-page-layout-20261012`. Aucun secret n’a été lu ou modifié. L’état réel du provider Google et son Client ID/Secret ne sont pas exposés par les outils Supabase disponibles. La lecture des logs Auth a échoué avec une erreur backend; aucune conclusion « Google désactivé » n’est établie.
- Défaut OAuth confirmé : `src/app/auth/callback/route.ts` redirige en cas d’échec vers `/connexion?erreur=oauth`, mais la page ne traitait pas ce paramètre ni ne rendait l’erreur dans le design BulleErreur.
- Branche de travail isolée : `fix/login-page-layout-20261012` (PR #62), sans modification de `main`, sans fusion ni Production.
- Intégration UI commitée sur cette branche : `src/app/page.tsx` utilise `BoutonNAXA` pour l’action de localisation et affiche `BulleErreur` si la localisation échoue; `src/components/Recherche.tsx` utilise `BoutonNAXA` pour recherche/scanner et affiche `BulleErreur` pour les erreurs de catalogue/scanner; `src/app/connexion/page.tsx` traite `erreur=oauth`, rend l’erreur via `BulleErreur` et utilise `BoutonNAXA` pour connexion et Google; `src/app/globals.css` porte les durées d’animation de transition à 700 ms. Le wrapper `TransitionNAXA` était déjà monté au niveau du layout global.
- Dernier commit de cette série : `1be817104afeb895687184adfa3075057c21e102`.
- Preview Vercel déclenchée manuellement pour ce SHA : `dpl_DFiVcuLtm8JVXC9JRxVe22zYBgZK`, URL https://naxa-gh34r3ah5-naxa3.vercel.app. Dernier état observé `BUILDING`; les logs s’arrêtaient à `Installing dependencies...`. Ne pas déclarer la preview prête avant preuve Vercel ultérieure.
- Limitation de validation : aucune preuve runtime du parcours Google; les logs Supabase Auth ont retourné une erreur backend et les runtime logs Vercel ne fournissent pas d’erreur exploitable. La configuration provider/redirect reste à confirmer avant toute modification de paramètres Supabase.


### 2026-10-13 — preuve Google OAuth et intégration des animations sur l’accueil
- L’utilisateur a fourni le message Supabase Auth `400 validation_failed / Unsupported provider: provider is not enabled`. La cause Google désactivé est donc confirmée pour le projet Supabase configuré sur la preview. Aucun réglage Supabase n’a été modifié; l’activation Google nécessite les identifiants OAuth du projet et la vérification des Redirect URLs, sans toucher à Production.
- Sur la branche existante `fix/login-page-layout-20261012` (PR #62), modifications ciblées demandées : `src/app/page.tsx` importe et utilise `BoutonNAXA` et `BulleErreur` sur l’accueil; `src/components/Recherche.tsx` utilise le bouton animé et les bulles pour les erreurs de recherche/scanner; `src/app/connexion/page.tsx` affiche l’erreur `erreur=oauth` et utilise les composants animés pour les boutons/erreurs.
- Animation ambulance : durée JS portée à 1800 ms dans `src/components/BoutonNAXA.tsx`, animation CSS portée à 1800 ms dans `src/app/globals.css` pour que le mouvement et la durée concordent.
- Commits sur la branche preview (aucun changement main, aucune fusion, aucun déploiement Production) : `55d77d639c3b3dfc209ebb9540c356c209e19343`, `a9f2c24b2008098f6acf5772afc4d019bef4e48e`, `7d1e6a537c9f351ab3f3aeb34e1c02bdabf21f6a`, `1be817104afeb895687184adfa3075057c21e102`, `1791ab43d20af32d1e164d8779b9dc00de9d3d02`, `85a00d0c7cd01005bc7ebd9a1624c6e0248bb949`.
- Vérification statique après écriture : imports et appels des composants présents sur l’accueil et la recherche; traitement `erreur=oauth` présent; durée ambulance 1800 ms. Build Vercel du nouveau SHA et test mobile après ces modifications restent à confirmer.


### 2026-10-13 — suite exécutée après demande « Fais le »
- Preuve utilisateur du fournisseur Google : Supabase Auth retourne `400 validation_failed` avec `Unsupported provider: provider is not enabled`. Projet de test confirmé `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`, ACTIVE_HEALTHY). Les connecteurs Supabase disponibles ne permettent pas de modifier le réglage Auth Google ni de saisir des secrets OAuth; aucune configuration Supabase n’a été changée. Étape requise par un administrateur du projet : activer Google dans Authentication → Sign In / Providers, fournir Google Client ID/Secret dans le projet de test et vérifier les redirect URLs Supabase. Lien direct : https://supabase.com/dashboard/project/pwfftcsjyeibxxqhwysw/auth/providers. Ne pas toucher au projet Production.
- Après intégration des composants sur l’accueil/recherche/connexion, durée ambulance portée à 1800 ms dans JS et CSS (commits de code de cette branche terminant par `1791ab43d20af32d1e164d8779b9dc00de9d3d02` et `85a00d0c7cd01005bc7ebd9a1624c6e0248bb949`). Aucun changement sur main ni fusion.
- Déploiement Vercel Preview déclenché manuellement depuis le commit exact `85a00d0c7cd01005bc7ebd9a1624c6e0248bb949`, branche `fix/login-page-layout-20261012`: ID `dpl_J4yUoVUDoyYme9H7m3q9woL1P1n2`, URL https://naxa-7sgyumfy1-naxa3.vercel.app. Dernier état observé `INITIALIZING`; build et test mobile non confirmés à cette heure.
- Prochaine action : suivre ce déploiement jusqu’à READY/ERROR; après READY, l’utilisateur peut tester l’accueil et la durée de l’ambulance. Le parcours Google restera bloqué tant que le provider Google du projet de test n’est pas activé avec ses credentials.


### 2026-10-13 — bulle d’erreur vitreuse + cohérence connexion/inscription
- Demande utilisateur : rendre la bulle d’erreur plus transparente, effet eau/verre avec minuscules bulles qui remontent à sa surface, la placer en haut de l’écran, et appliquer la même logique visuelle de connexion à l’inscription.
- Branche existante utilisée : `feat/auth-water-bubbles`. Aucun nouvelle branche, aucune modification de `main`, aucune fusion, aucun déploiement Production, aucune écriture Supabase Production.
- `src/components/BulleErreur.tsx` modifié : position fixe `top-4/right-4` (et variantes mobile), fond vitreux translucide cyan/turquoise, contour clair, flou d’arrière-plan, reflet animé, microbulles qui montent, fermeture au toucher et animation de disparition conservées; réinitialisation du déplacement lors d’un nouveau message.
- `src/app/connexion/page.tsx` modifié : les erreurs de connexion utilisent désormais le même composant `BulleErreur` que l’inscription au lieu d’un paragraphe rouge séparé.
- Contrôle statique de `src/app/creation-compte/page.tsx` : la page utilisait déjà `BullesAuthentification` et `BulleErreur`; elle partage donc le fond animé et maintenant le même style/positionnement de notification que la connexion. Aucune modification fonctionnelle de l’inscription n’a été nécessaire.
- Commits de code confirmés : `cf2a28e07f7b8d4503f4fa474f5ebf1ab994bd65` (bulle d’erreur) puis `a6b6811271eaee4cd60d4d8843ec116d06618a1b` (connexion). Les fichiers ont été relus après écriture.
- État CI observé sur le SHA `a6b6811271eaee4cd60d4d8843ec116d06618a1b` : `ci/circleci: quality = failure`, pipeline 1497 : https://circleci.com/gh/audreymendomo23-netizen/NAXA/1497. Aucune preuve de réussite CI; cause détaillée à examiner.
- Aucun déploiement Vercel n’est encore répertorié pour le SHA `a6b681...`; les previews READY déjà répertoriées concernent des SHA antérieurs. Il faut publier une preview du SHA exact puis contrôler l’état et les logs avant de demander un test visuel.
- Prochaine action : créer une preview Vercel explicitement depuis `feat/auth-water-bubbles` au SHA `a6b681...`, contrôler le build et les logs; puis traiter l’échec CircleCI à partir des logs disponibles, sans déclarer le CI vert prématurément.


### Résultat de la preview — 2026-10-13
- Preview Vercel créée sur le SHA `ad1d48db11aa4985e1c677cfaadbf49380009b85`, déploiement `dpl_FYaHosgx8k82ewMorXMeqH43wdk1`, URL https://naxa-709zlv58i-naxa3.vercel.app.
- État terminal vérifié : `READY`. Le statut Vercel du SHA est `success`; Netlify Deploy Preview est également `success`.
- Le statut CircleCI `ci/circleci: quality` reste `failure` sur le même SHA, pipeline 1499 : https://circleci.com/gh/audreymendomo23-netizen/NAXA/1499. Donc la preview compile/déploie, mais le CI global n’est pas vert. Les logs détaillés du job CircleCI restent nécessaires pour expliquer l’échec.
- Les parcours visuels connexion/inscription et la notification en haut n’ont pas été validés physiquement sur un téléphone; la preview est disponible pour ce contrôle. Aucun merge, aucun déploiement Production, aucune écriture Supabase Production.


## 2026-10-13 — intégration ciblée demandée par « OUI, DÉPLOIE »
- La PR #62 n'a pas été fusionnée : elle contenait 153 commits et 33 fichiers, notamment la fondation hors ligne et des migrations non incluses dans l'autorisation UI. Pour éviter ce déploiement excessif, une PR séparée a été créée depuis `main`, limitée à 5 fichiers : PR #65 https://github.com/audreymendomo23-netizen/NAXA/pull/65.
- PR #65 fusionnée avec succès (squash) dans `main`, merge commit `9d07f415fc37882d79e552c8f0ef19237343e396`. Contrôle après fusion : `src/app/page.tsx` et `src/components/BoutonNAXA.tsx` sur `main` contiennent les animations/bulles attendues; `src/app/connexion/page.tsx` traite `erreur=oauth`.
- Changements intégrés : bouton animé sur l’action de localisation de l’accueil; bulle pour le message de position; animation sur la recherche; erreurs catalogue/connexion rendues dans `BulleErreur`; message lisible au retour OAuth en échec; ambulance JS/CSS synchronisée à 1,8 s.
- Aperçu Vercel du SHA `6774b1658b9486c4ffda2d6c798fc34a63436f82` lancé : `dpl_3m9FENpszy9rb2P5X3etwyHtVpEu`, https://naxa-fccyee44k-naxa3.vercel.app. État encore `BUILDING` lors du dernier contrôle; pas de validation navigateur mobile.
- Après la fusion, Vercel a créé le déploiement Production `dpl_ARwxmC1eioZkHqTX2Pmg94QAMBH1` sur le SHA exact `9d07f415fc37882d79e552c8f0ef19237343e396`, URL https://naxa-5uyb57fpx-naxa3.vercel.app, état `QUEUED` lors du dernier relevé. Le déploiement de production n'est donc pas encore confirmé `READY`.
- Google OAuth : la cause `Unsupported provider: provider is not enabled` est confirmée côté projet Supabase de test. Aucun paramètre Google n'a été changé; cette configuration n'est pas corrigée par le merge et nécessite l'activation du provider et les credentials Google dans le projet de test uniquement. Aucun accès ou changement à Supabase Production.


## Rapport des branches — état vérifié le 2026-10-13

### Source de vérité et production
- `main` contient le merge squash de la PR #65 : commit `9d07f415fc37882d79e552c8f0ef19237343e396`.
- Déploiement Vercel Production lié à ce SHA : `dpl_ARwxmC1eioZkHqTX2Pmg94QAMBH1`, état **READY**, alias `https://naxa-naxa3.vercel.app`. Cela confirme le déploiement technique, pas encore un test fonctionnel mobile.
- PR #65 (`feat/main-ui-water-ambulance-20261013` → `main`) : **fusionnée** le 2026-10-13. Les changements UI ont été intégrés : bouton animé sur l’action de localisation, bulle de message sur l’accueil/recherche/connexion, affichage du retour OAuth en erreur, ambulance portée à 1,8 s.

### PR ouvertes à ne pas confondre avec le lot déployé
- PR #64 — `feat/auth-visual-identity` → `main` : **ouverte, non fusionnée**. Son descriptif indique CircleCI `quality` en échec sur SHA `4d3b475931124b76970d40ab4efa7f9ad6eedf9a` (pipeline 1511). Cause détaillée non récupérée; pas de preuve CI verte.
- PR #63 — `feat/auth-water-bubbles` → `main` : **ouverte, non fusionnée**. Son descriptif indique Vercel Preview READY sur `c4316a3619115f2597828ab8e29ed7fa71b2d4d2`, mais CircleCI `quality` en échec (pipeline 1419); aucun statut vert global.
- PR #62 — `fix/login-page-layout-20261012` → `main` : **ouverte, brouillon**, 153 commits. Vercel Preview signalée READY sur `0e126ef5ae3b7d09610d5392be490ff8f6aed593`; les parcours réels hors ligne et la connexion pharmacie restent à valider. Cette PR n’a pas été fusionnée et ne fait pas partie du déploiement #65.

### Branches de travail concernées
- `feat/main-ui-water-ambulance-20261013` : source de la PR #65 désormais fusionnée; branche encore présente dans l’inventaire GitHub. Le commit de tête utilisé pour la PR était `6774b1658b9486c4ffda2d6c798fc34a63436f82`.
- `feat/auth-water-bubbles` : branche documentaire et visuelle de la PR #63; non fusionnée, CI qualité signalée en échec. Ne pas considérer ses derniers changements comme présents dans `main` au-delà des éléments explicitement intégrés par #65.
- `feat/auth-visual-identity` : branche de la PR #64; non fusionnée, CI qualité signalée en échec.
- `fix/login-page-layout-20261012` : branche de la PR #62; brouillon, non fusionnée.
- Autres branches retournées par l’inventaire GitHub (à classer par PR/commits avant toute suppression ou fusion) : `Test`, `Test-claude`, `docs/juridique-cgu-confidentialite-20261012`, `feat/accueil-entete`, `feat/accueil-etape-a`, `feat/catalogue-medicaments-api-prototype`, `feat/login-session-limit`, `feat/logo-navigation-role`, `feat/naxa-fonctions-validation-distance`, `feat/naxa-messagerie-profil-yaounde`, `feat/session-audit`, `feat/yaounde-garde-crosscheck`, `feat/yaounde-pharmacy-geolocation`, `feat/yaounde-taxi-estimate`, `fix/accueil-footer-signature-verte`, `fix/auth-restore-otp-flow`, `fix/auth-signup-feedback-otp`, `fix/ci-main`, `fix/parcours-rpc-permissions-align-20261011`, `fix/signup-phone-validation`, `fix/signup-trigger-production`, `fix/sql-test-032`, `fix/sql-tests-green`, ainsi que `main`. L’inventaire GitHub a renvoyé 28 branches au total.

### Blocage Google OAuth distinct
- L’erreur fournie par l’utilisateur `400 validation_failed / Unsupported provider: provider is not enabled` confirme que Google n’est pas activé dans le projet Supabase de test. Le merge #65 ne modifie pas cette configuration. Il faut activer le provider Google et renseigner les credentials dans le projet de test uniquement; aucune configuration Supabase Production n’a été changée.

### Garde-fous et prochaines actions
- Aucun changement de code hors périmètre n’est inclus par le présent rapport; aucun secret OAuth consigné.
- Ne pas fusionner les PR #62/#63/#64 sur la seule base d’un aperçu Vercel READY : vérifier d’abord les checks CI sur le SHA courant et réaliser les tests fonctionnels attendus.
- Prochaine vérification : tests visuels mobile sur Production/Preview pour le lot #65; configurer Google uniquement dans Supabase test; récupérer les logs CircleCI détaillés pour #63/#64 avant de déclarer ces lots validés.

## Journal de continuité — correction des rappels de posologie Web Push (2026-10-16)
- Réconciliation effectuée sur `main` avec les composants Web Push déjà présents : `src/app/client/posologie/page.tsx`, `src/app/api/posologie/push-key/route.ts`, `src/app/api/cron/posologie/route.ts` et `public/naxa-push-sw.js`. Aucun de ces composants existants n'a été remplacé par une seconde implémentation.
- Migration `supabase/migration_092_posologie_web_push.sql` corrigée pour refuser les tableaux d'heures vides, les valeurs non conformes à `HH:MM`, les heures nulles et les abonnements Push dont les clés `p256dh`/`auth` manquent. La migration n'a pas été exécutée sur Supabase Production.
- Route cron corrigée : utilise `NAXA_VAPID_SUBJECT` avec repli sur le sujet NAXA, inclut les colonnes `last_notified_key IS NULL` dans la prise atomique (le filtre `neq` seul ignorait les NULL), examine les six dernières minutes pour tolérer un déclencheur gratuit toutes les cinq minutes et libère la clé de déduplication si aucun envoi n'a réussi, afin de permettre une nouvelle tentative.
- Le workflow `.github/workflows/naxa-posologie-reminders.yml` a été retiré car il dépendait de variables/secrets GitHub non prouvés comme configurés et de minutes Actions privées non confirmées disponibles. Aucun déclencheur externe gratuit n'est encore configuré : l'API cron existe, mais les rappels en arrière-plan ne sont pas déclarés fonctionnels.
- Commits appliqués à `main` : migration `0ec7eb5249b67e3d5ad731bcab78e2c45973454c`; retrait workflow `7d17ddc52acbc81faedf6227fc937212f84012d7`; correction route `4dfe2d3c171fdecc196eea3263243ea8e16bba5f`.

## Journal de continuité — reprise hors ligne / LWW (04/11/2026)

**Référence courante :** dépôt GitHub `audreymendomo23-netizen/NAXA`, branche `main`. Appliquer `AGENTS.md` en premier ; les consignes historiques de branche/PR/CI présentes dans les autres documents ne prévalent pas.

### Corrections versionnées
- Protection IndexedDB contre la rotation du PIN/sel de chiffrement lorsqu'un appareil, une file ou un instantané existent ; le contrôle et l'insertion sont atomiques pour éviter les courses entre onglets.
- Déverrouillage local refuse un retour de l'horloge et les appareils qui dépassent la fenêtre locale de sept jours sans synchronisation.
- `/pharmacie` retrouve l'identité locale après rechargement hors ligne, présente le verrou local avant l'instantané chiffré et expose uniquement les corrections de quantité du stock non lotisé dans ce shell.
- La synchronisation des opérations commence dès le montage de `EtatHorsLigne`.
- La migration 269 remplace la réécriture dynamique du texte de fonction par un départage explicite ; la migration 270 revalide le rôle professionnel, le rattachement pharmacie et l'activité de la pharmacie au moment du replay.
- Le PIN appareil est un verrou technique local et ne doit pas être confondu avec le PIN personnel Promoteur F01-PRO ni considéré comme une décision métier.

### Preuves et limites
- Sur Replay `naxa-ci-replay-2`, tests 053, 220, 221, 268, 269 et 270 exécutés et PASS le 04/11/2026. Le test 221 vérifie l'idempotence, l'égalité d'horodatage avec priorité au comptage serveur et le rejet d'un rôle devenu non autorisé ; son jeu d'essai est annulé.
- Migration 270 appliquée sur Replay uniquement. Aucune écriture Supabase Production, aucune migration Production et aucun déploiement.
- Le périmètre hors ligne livré reste limité aux corrections de quantité du stock non lotisé. Ventes, caisse, mouvements autonomes et clôtures ne sont pas couverts.
- Build complet, TypeScript complet, lint et recette navigateur/appareil réel non exécutés. Le miroir GitLab n'est pas à jour : dernier SHA observé `178a655880d75f933a5968e34d3de3f802de5e5c`, avec pipeline du 23/10/2026 en échec `ci_quota_exceeded`. Ne pas présenter cette CI comme preuve sur le HEAD courant.

### Prochaine action autorisée
Vérifier le HEAD actuel, exécuter ou obtenir des contrôles de compilation/lint/CI au SHA exact dès qu'un runner disponible existe, puis compléter une recette navigateur hors ligne ; ne pas étendre le périmètre F07 sans spécification et sans tests.

- Aucun build/test automatisé n'a été exécuté dans cet environnement. Les commits sur `main` ont déclenché automatiquement Vercel malgré l'absence d'une demande de déploiement : le déploiement de la migration `0ec7eb5249b67e3d5ad731bcab78e2c45973454c` a été observé `READY` sur Production; les déploiements des commits `7d17ddc52acbc81faedf6227fc937212f84012d7`, `4dfe2d3c171fdecc196eea3263243ea8e16bba5f` et `ce5ffa1ceebcdc38a1dab5221523f53389c2374c` ont ensuite été annulés dans Vercel. Le changement déjà `READY` n'a pas été annulé et son effet exact sur l'alias actif n'a pas été vérifié. Prochaine étape : confirmer l'état Production sans écrire dans Supabase, obtenir une preuve de build sur le code corrigé, puis configurer un déclencheur gratuit; ne pas relancer un déploiement manuellement sans autorisation explicite.


## Journal de continuité — permissions et RLS stock (04/11/2026)

### Nouveaux correctifs sur `main`
- Migration 271 : les RPC online et appareil exigent le privilège `EDIT_STOCK_QUANTITY`; migration 274 : elles exigent conjointement `VIEW_STOCK` et `EDIT_STOCK_QUANTITY`.
- Migration 272 : helper service-role `naxa_device_permissions_v1` recalcule au serveur l'autorisation du poste et les droits VIEW/EDIT à chaque synchronisation.
- API `/api/sync` : le serveur renvoie un snapshot minimal uniquement si le droit de lecture est actif. Il n'envoie plus les coûts, dépenses ni catalogue dans le snapshot offline.
- Client : chaque réponse valide remplace le snapshot complet ; si le droit `VIEW_STOCK` est révoqué, la copie locale chiffrée est supprimée et la file d'opérations est conservée. Les permissions mises en cache ne peuvent plus réactiver un droit absent.
- Migration 273 : policy UPDATE pour que l'upsert d'import réexistant exige `VIEW_STOCK` + `IMPORT_STOCK`.
- Migration 275 : policies RLS directes de stock, lots, rappels et coûts alignées sur `VIEW_STOCK`, `MANAGE_LOTS`, `VIEW_PURCHASE_COST`, `EDIT_STOCK_PARAMETERS`, `IMPORT_STOCK` et les droits de correction. La policy ALL précédente sur les lots est supprimée et remplacée par INSERT/UPDATE/DELETE séparées.
- Le gestionnaire des lots et coûts vérifie désormais les privilèges serveur avant d'afficher les actions et les coûts. La Caisse ne reçoit pas le contrôle de gestion des lots via l'interface.
- Les opérations IndexedDB sont triées par `modifiedAt`, séquence appareil et identifiant ; la reprise UI superpose les corrections encore en attente sur le snapshot, sans inverser leur ordre.
- L'inactivité verrouille localement l'appareil après 15 minutes. Les stocks lotisés sont explicitement exclus des corrections de quantité offline.

### Preuves Replay consolidées
- Migrations 270 à 275 appliquées exclusivement à `naxa-ci-replay-2`; aucune migration Production.
- Tests 053, 220, 221, 271, 272, 273, 274 et 275 affichent explicitement PASS. Les tests 268, 269 et 270 se sont exécutés sans erreur SQL (leurs blocs de contrôle renvoient un tableau vide).
- Le test 221 vérifie l'affectation multi-pharmacie, l'idempotence, la priorité d'un comptage serveur à milliseconde égale, puis les révocations indépendantes de `VIEW_STOCK`, `EDIT_STOCK_QUANTITY` et du rôle. Toutes les mutations de fixture sont annulées.

### Limites de validation qui demeurent
- L'offline livré reste limité à la correction de quantité du stock non lotisé ; ventes, caisse, mouvements autonomes et clôtures offline ne sont pas couverts.
- Aucun build complet Next.js/TypeScript, lint, CI au SHA courant ou recette navigateur/appareil réel n'a été exécuté dans cette session. Le miroir GitLab reste en retard et échoue avant démarrage des jobs pour quota ; les statuts Vercel consultés correspondent à des déploiements annulés `ignored-build-step`, pas à des builds réussis.
- Aucun déploiement et aucune écriture Supabase Production.

### Suite
Poursuivre uniquement sur les contrôles de compilation/CI et recette navigateur accessibles ; ne pas déclarer F07 entièrement livré tant que le périmètre POS/caisse/clôture hors ligne n'est pas construit et testé.


## Journal de continuité — scopes Caisse et autorisation lots (04/11/2026)

- Migration 277 : les RPC de correction stock, le helper de snapshot et l'activation utilisent `POSTE_CAISSE` pour EDIT lorsque `naxa_business_function()` retourne `caisse` ; `VIEW_STOCK` reste en scope `PHARMACIE`. Test 277 PASS ; test comportemental 221 PASS avec une attribution EDIT en `POSTE_CAISSE`.
- Migration 278 puis 279 : RLS lots interdit la voie `MANAGE_LOTS` à la Caisse ; le comptage de quarantaine reste néanmoins ouvert à l'équipe active, Caisse comprise, car il s'agit d'une observation auditable sans mutation stock/lot. Test 179 PASS (Caisse compte, stock et lot restent inchangés), test 278 PASS.
- Migration 280 : helper `naxa_can_manage_lots` centralise périmètre, affectations, fonctions de gestion et privilège MANAGE_LOTS. Le helper est utilisé par les policies RLS des lots/rappels/traitements, la RPC `lot_rappeler` et le composant `RappelsLotsManager`. La Caisse ne peut pas administrer les lots même si un grant MANAGE_LOTS trop large est présent ; test 280 PASS et test 221 inclut cette vérification.
- Test 275 ajusté pour les nouvelles policies fondées sur le helper et repassé PASS. Test 175, 181 et 221 également PASS après migration280.
- Les tests 053, 175, 177, 179, 181, 220, 221, 271–280 affichent explicitement PASS dans Replay ; tests 268–270, 174, 193, 198, 200, 201, 203, 204, 206, 207 et 219 exécutés sans erreur SQL mais les scripts ne retournent pas tous un libellé PASS explicite.
- Aucune migration ni écriture Supabase Production ; aucun déploiement. Build complet, lint, CI au SHA courant et recette navigateur/appareil réel restent non prouvés. F07 offline complet (POS/ventes, caisse, mouvements autonomes, clôture) reste hors du périmètre livré ; seuls les ajustements de quantité non lotisés sont offline.

## Vérification de livraison — dernier contrôle du 04/11/2026

- HEAD au moment du contrôle : `e91bc8583eee5be6575477418084e2ec6fb16a9b`. Statut Vercel GitHub : `failure`, destination `upgradeToPro=build-rate-limit`; la recherche Vercel filtrée sur ce SHA retourne zéro déploiement. Aucun build ou déploiement n'est confirmé.
- Miroir GitLab NAXA : toujours au SHA `178a655880d75f933a5968e34d3de3f802de5e5c` (21/10/2026). Dernier pipeline consulté : `ci_quota_exceeded` avant le démarrage des jobs. Aucune CI GitLab actuelle sur le SHA de GitHub main.
- Ne pas interpréter le statut CircleCI en échec comme un résultat à corriger : `AGENTS.md` interdit son usage. Aucun déploiement ni aucune écriture Supabase Production.


## Vérification complémentaire — reprise offline et livraison (04/11/2026)

- Correctif `src/lib/offline-db.ts` : comparaison du statut historique `failed` alignée sur la compatibilité IndexedDB existante en castant `row.status as string` avant comparaison. Commit : `1892959c4c9da8aa3839c0c29e3e7d4d6bf755c7`.
- Preuve ciblée : l'ancienne expression déclenche `TS2367` avec TypeScript strict ; la nouvelle expression passe un test isolé `tsc --strict` (TypeScript global 5.8.3). Ce test ne compile pas l'ensemble du dépôt.
- Vercel, commit exact : déploiement `dpl_6USNEXJ2WYQgrSCEsTcqSsnERGRu`, état `CANCELED`, lien d'erreur `ignored-build-step`, aucun événement de build retourné. Le check GitHub Vercel `success` ne doit pas être interprété comme un build réussi.
- GitLab : branche `main` du miroir au SHA `178a655880d75f933a5968e34d3de3f802de5e5c`; pipeline #139 `2980484694`, `ci_quota_exceeded`, jobs non démarrés et aucun runner attribué.
- Restent non prouvés sur le HEAD exact : `npm test`, TypeScript complet, lint, build Next.js et recette navigateur/appareil. La CI disponible est décrite dans `.gitlab-ci.yml` (typecheck, lint, audit dépendances, tests unitaires, build, aucun déploiement) ; le miroir périmé et le quota empêchent actuellement son exécution.
- Aucune écriture Supabase Production et aucun déploiement.

- Contrôle SQL en lecture seule sur Replay `pwfftcsjyeibxxqhwysw` : 10 assertions structurelles PASS. Les fonctions présentes ont été vérifiées par leurs vrais noms/signatures (le helper `naxa_can_manage_lots(uuid)` est dans `public`) ; le RPC de rejeu est SECURITY DEFINER, exécutable uniquement par `service_role` parmi anon/authenticated/service_role ; journal `stock_manager_movement_journal` avec RLS ; colonnes LWW présentes ; policy de lecture `stocks_lots` utilise le helper et aucune policy `ALL` ne subsiste sur cette table. La migration 280 figure dans l'historique Replay. Aucune écriture réalisée par ce contrôle.


---

# Point de continuité — NAXA Security intelligente : périmètre final et prompt d'implémentation (09/11/2026)

## Référence de travail vérifiée

- Dépôt : audreymendomo23-netizen/NAXA.
- Branche active pour cette intervention : qa/e2e-stabilisation-20261106.
- HEAD vérifié avant mise à jour documentaire : b52457d03d01df658238d5c65878942efaf7cc27.
- CI GitHub Actions #1311 : completed / success sur ce SHA exact : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42531445059.
- Logs : 241 tests PASS / 0 FAIL ; test WS-Security UsernameToken n°203 PASS ; npx tsc --noEmit PASS ; next lint PASS ; build Next.js PASS ; pages statiques 129/129 ; audit dépendances 0 vulnérabilité ; scans de secrets de l'historique et du répertoire courant PASS.
- Correctif UsernameToken : commit b52457d03d01df658238d5c65878942efaf7cc27.
- Cette CI valide le logiciel de la branche QA. Elle ne prouve pas un flux caméra physique, MediaMTX déployé, une sauvegarde Drive réelle, des alertes Android en arrière-plan, un enregistrement NVR ou une sirène physique.
- Aucun changement main, aucune écriture Supabase Production, aucune fusion et aucun déploiement Production dans cette intervention.

## Fonctionnalités finales attendues

Le Promoteur surveille les pharmacies actives de son réseau ; le Responsable ne voit que sa pharmacie et les fonctions déléguées. Le périmètre final confirmé comprend :

1. Live multi-caméras et grille 2×2, sélection pharmacie/caméra, état mesuré.
2. Compatibilité multi-marques ONVIF, RTSP/RTSPS, NVR/DVR, encodeur analogique, Wi-Fi et API/SDK officiels ; validation par modèle/firmware, aucune promesse universelle.
3. Enregistrement principal local, timeline, relecture, recherche et clips avant/après événement ; continuité hors Internet.
4. Horodatage permanent sur live et archive : date, heure à la seconde, pharmacie, caméra et fuseau ; UTC en données, Africa/Douala par défaut pour affichage. NTP, dérive et heure non fiable suivis ; original et copie horodatée/intègre distingués.
5. Destinations sélectionnables : stockage local pharmacie/NVR, Google Drive personnel et copie locale du téléphone.
6. Sauvegarde manuelle immédiate et automatique programmée, avec reprise, progression, déduplication, hash et états réels.
7. Google OAuth minimal de préférence drive.file + Google Picker ; jetons chiffrés côté serveur ; upload resumable ; aucun lien public par défaut.
8. Copie Android consultable hors ligne via API de stockage appropriée, sans permission globale inutile.
9. Calendrier haute surveillance par pharmacie/zone, intervalles multiples et exceptions ; 22:00–08:00 et franchissement minuit ; politique signée synchronisée à la passerelle.
10. Niveaux d'alertes personnalisables : son, vibration, répétition, acquittement, destinataires et escalade.
11. Compagnon Android natif si aucun projet existant ; test permissions, verrouillage, Doze et limites OEM.
12. Sirène locale autonome et commande distante confirmée, relais validé, anti-rejeu, accusé matériel, arrêt local/automatique.
13. Moteur IA réellement exécuté et mesuré ; revue humaine ; aucune accusation automatique.
14. Audit de lecture, export, sauvegarde, calendrier, événements, notifications et commandes sirène.

## État construit à distinguer des fonctions restantes

### Fondations déjà présentes dans la branche QA

- Menu Sécurité Promoteur, tableau multi-pharmacies, grille 2×2 et navigation.
- Schéma installations, passerelles, caméras, événements, métadonnées clips, commandes sirène et journal append-only ; RLS forcée, accès backend service_role.
- Enrôlement passerelle par code unique, identité Ed25519 locale et heartbeat signé anti-rejeu.
- Découverte ONVIF locale opt-in, candidats soumis à revue Promoteur.
- Diagnostic ONVIF fabricant/modèle/firmware/capacités.
- Sessions live temporaires WHEP/WebRTC, hash de ticket, vérification périmètre, révocation.
- Tickets de publication RTSPS liés à passerelle/caméra/pharmacie et remontée santé du flux.
- Ingestion événement signée, anti-rejeu, déduplication, gravité serveur et revue humaine.
- Collecteur ONVIF Pull-Point, identifiants chiffrés localement, UsernameToken, parsing limité et normalisation des événements.
- CI #1311 validée sur le SHA exact.

### Non démontré ou non construit à ce checkpoint

- MediaMTX n'est pas déployé ; le chemin caméra physique → passerelle → relais → navigateur n'est pas prouvé.
- Les adaptateurs non testés ne sont pas des drivers opérationnels ; les garder design_only.
- Enregistrement local complet, index temporel, relecture et export NVR non opérationnels.
- Clips effectifs, tampon pré/post et stockage vidéo à construire.
- Horodatage incrusté et contrôlé sur vidéos réelles, NTP, dérive, manifeste/hash à construire.
- OAuth Google Drive, sélection dossier, sauvegarde manuelle/planifiée, upload resumable, reprise et révocation à construire.
- Copie locale sur téléphone avec accès hors ligne à construire.
- Calendrier haute surveillance et synchronisation hors ligne passerelle à construire.
- Moteur IA d'inférence réel à construire. Le libellé edge_ai seul n'est pas une preuve.
- Profils d'alertes sonores personnalisables, acquittement/escalade et compagnon Android natif à construire.
- Contrôleur sirène, commandes matérielles et accusés à construire.
- Aucun E2E complet sur pharmacie pilote prouvé.

Les tables naxa_security_clips et naxa_security_siren_commands sont des métadonnées/fondations de schéma, pas des fonctions opérationnelles. Ne jamais afficher « sauvegardé », « enregistré », « live », « sonnerie activée » ou « sirène activée » sans accusé du service/équipement correspondant.

## Découpage des lots restants

- Lot 12 : relais média sur infrastructure dédiée, premier flux caméra physique.
- Lot 13 : enregistrement local/NVR, index, relecture, clips pré/post.
- Lot 14 : NTP, date/heure visible, fuseau, dérive, original + copie horodatée, hash/manifeste.
- Lot 15 : destinations locale/Drive/téléphone, OAuth minimal, sauvegarde manuelle et programmée, uploads resumable, reprise et intégrité.
- Lot 16 : haute surveillance 22:00–08:00, exceptions, politique signée hors ligne.
- Lot 17 : événements et IA réellement exécutée, calibrée et mesurée.
- Lot 18 : application Android, canaux par niveau, sonnerie, répétition, acquittement et escalade.
- Lot 19 : relais physique, sirène locale, commande distante confirmée, anti-rejeu et arrêt.
- Lot 20 : recette E2E matérielle multi-pharmacies et feu vert pilote.

Chaque lot doit être clôturé individuellement. CI verte obligatoire, mais elle ne remplace pas les essais caméra, NVR, téléphone et relais physiques.

## Références techniques officielles retenues

- Google Drive OAuth scopes : https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Google Drive resumable uploads : https://developers.google.com/workspace/drive/api/guides/manage-uploads
- Android plein écran : https://source.android.com/docs/core/permissions/fsi-limits
- Android 14 : https://developer.android.com/about/versions/14/behavior-changes-14
- FCM priorité Android/Doze : https://firebase.google.com/docs/cloud-messaging/android-message-priority
- Android notification channels : https://developer.android.com/design/ui/mobile/guides/home-screen/notifications
- ONVIF profils et produits conformes : https://www.onvif.org/profiles/ et https://www.onvif.org/conformant-products/

## Prompt d'exécution

Le prompt expert complet incluant l'architecture, les lots 12 à 20, Google OAuth, sauvegardes, Android, horodatage, sirène, sécurité et critères d'acceptation est enregistré dans :

docs/security/PROMPT_IMPLEMENTATION_SECURITE_INTELLIGENTE.md

Ce document est une spécification de travail. Il ne signifie pas que les fonctions restantes sont construites ou que leur mise en œuvre a commencé.

## Actions de cette intervention

- Création du prompt expert dédié.
- Mise à jour de ce document de continuité avec l'état réel, la preuve CI #1311 et le périmètre final.
- Aucun code applicatif, migration SQL, variable ou configuration d'infrastructure modifiés.
- Aucune écriture Supabase Production, aucune fusion et aucun déploiement.

## Prochaine action technique

Commencer le lot 12 par un audit ciblé du chemin MediaMTX/publisher, du contrat de configuration caméras et de l'infrastructure média disponible ; identifier le matériel physique de pilote et les prérequis manquants. Ne jamais annoncer « live opérationnel » avant essai caméra/gateway réel. Ne pas toucher à main, Supabase Production ou Vercel Production.

---

## Exécution du prompt — Lot 12, audit initial et correctifs (09/11/2026)

### État vérifié avant correction

- HEAD de départ : `33af6e672943925241e2b58c86327feaa8763457`, branche `qa/e2e-stabilisation-20261106`.
- CI #1312 : completed / success sur ce SHA exact : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42535966828.
- Configuration MediaMTX présente : image `bluenviron/mediamtx:1.21.3`, RTSPS strict 8322/TCP, WHEP/HTTPS 8889/TCP, WebRTC UDP 8189, authentification HTTP NAXA, API/métriques/PPROF/playback désactivés, conteneur en lecture seule et publisher non remplaçable.
- La route d'authentification accepte `publish/rtsp` via ticket publisher court et `read/webrtc` via ticket live. Les tickets sont liés au gateway, à la caméra, à la pharmacie et au chemin.
- Contradiction prouvée : le README MediaMTX affirmait encore que toute publication RTSPS était refusée jusqu'à la phase 9, alors que le code phase 9 l'autorise déjà avec ticket. README corrigé.
- Défaut logiciel identifié : si l'arrêt du service survenait pendant la demande du ticket publisher, un AbortSignal déjà annulé pouvait ne pas empêcher le spawn FFmpeg. Un garde avant spawn et un test de régression sont ajoutés.
- Lacune WebRTC : MediaMTX ouvre actuellement UDP 8189 mais ne configure ni listener TCP ni `webrtcICEServers2` STUN/TURN. L'accès depuis tous les réseaux mobiles/NAT n'est donc pas démontré ; aucun TURN n'a été inventé.
- Le paquet MediaMTX ne déploie pas un serveur. Aucun hôte, domaine DNS, certificat, firewall, variable Preview, serveur TURN ou endpoint média accessible n'est prouvé configuré.
- Aucun matériel caméra/NVR, passerelle locale, FFmpeg sur site ou réseau pilote n'est accessible dans cette vérification.

### Correctifs appliqués dans le lot 12

- `services/security-gateway/agent.cjs` : ne démarre pas FFmpeg si le signal d'arrêt est déjà annulé ; fonction exportée pour test direct.
- `scripts/test-security-gateway-agent.cjs` : test de régression « arrêt demandé avant spawn ».
- `infra/security/mediamtx/README.md` : contrat phase 9 exact, variables d'environnement attendues, ports/certificats et limites TURN explicités.
- `scripts/test-security-mediamtx-deployment.cjs` : assertions sur publication autorisée par ticket et absence actuelle de TURN.
- Aucun domaine, certificat, secret, compte Google, variable runtime ou endpoint fictif ajouté.

### Statut du lot 12

**PARTIEL — NON VERT MATÉRIEL.** Le correctif logiciel et documentaire a passé la CI #1313 sur son SHA exact (completed / success). La clôture matérielle demande :
1. serveur MediaMTX réellement installé sur un hôte dédié ;
2. DNS, TLS, firewall et variables Preview contrôlés ;
3. caméra réelle → passerelle → RTSPS → MediaMTX → WHEP vérifiés ;
4. connectivité testée sur Wi-Fi et mobile, TURN configuré si requis ;
5. expiration/révocation/reconnexion et cloisonnement inter-pharmacies testés en intégration.

### Prochaine action

CI #1313 vérifiée : PASS sur 17a7d80e7e330e75c9daad51480850f7cebd9729. Le listener WebRTC TCP de secours est ajouté dans le correctif suivant ; la recette réseau et matérielle reste conditionnée à un hôte et un kit caméra/passerelle. Aucun déploiement Vercel/Production ni écriture Supabase Production.

---

## Addendum lot 12 — repli WebRTC TCP (09/11/2026)

### Preuves et correction

- CI #1313 : completed / success sur le commit 17a7d80e7e330e75c9daad51480850f7cebd9729 : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42536457278.
- La référence MediaMTX v1.21.3 confirme que webrtcLocalTCPAddress active un listener ICE TCP lorsque le chemin UDP est bloqué. Documentation : https://mediamtx.org/docs/features/webrtc-specific-features.
- infra/security/mediamtx/mediamtx.yml : listener webrtcLocalTCPAddress: :8189 ajouté, UDP conservé comme transport prioritaire.
- infra/security/mediamtx/docker-compose.yml : publication du port 8189/tcp ajoutée en plus de 8189/udp.
- infra/security/mediamtx/README.md : prérequis firewall/NAT, ordre des transports, limites et besoin éventuel de STUN/TURN documentés.
- scripts/test-security-mediamtx-deployment.cjs : assertions sur les deux transports et la documentation ajoutées.
- Les 20 séquences de backtick littérales échappées dans la section précédente de ce document ont été corrigées.

### État restant

**PARTIEL — NON VERT MATÉRIEL.** CI #1314 a échoué sur une seule assertion documentaire restée sur l'ancien libellé TURN ; 241/242 tests passent. Le correctif remplace cette attente par le libellé actuel STUN/TURN. Le job s'est arrêté sur les tests : TypeScript, ESLint et build ne sont donc pas validés sur ce SHA. La syntaxe YAML des deux configurations a été contrôlée localement ; le binaire officiel MediaMTX n'a pas été exécuté. STUN/TURN n’est pas configuré ; l’accessibilité depuis tous les NAT/FAI n’est pas prouvée. Aucun serveur MediaMTX, domaine/DNS/TLS, pare-feu externe, passerelle ou caméra physique n’a été mis en service ou testé dans ce lot. Ne pas démarrer l’enregistrement local ni déclarer le flux live opérationnel avant la recette physique.


### Analyse CI #1314

- Run : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42537799039 (SHA 6c1118415dcc8c55d21eb3b8fbd4a4e8ef0df047).
- Secret scan, analyse des références, scan dépôt, installation et audit dépendances : PASS.
- Tests : 241 PASS / 1 FAIL sur 242. Test 203 échoue uniquement parce qu'il attendait l'ancien texte « Aucun TURN n'est actuellement configuré » ; le README indique désormais « Aucun STUN/TURN n’est actuellement configuré ».
- TypeScript, ESLint et build : non validés dans cette exécution, arrêtée après l'échec des tests.
- Correction ciblée : aligner l'assertion documentaire sur le README actuel ; aucun changement du comportement réseau n'est nécessaire pour cette panne.

---

## Clôture du correctif logiciel MediaMTX — vérification finale (09/11/2026)

### Raisonnement par contradiction et cause racine

- L'échec CI #1314 (SHA 6c1118415dcc8c55d21eb3b8fbd4a4e8ef0df047) n'était pas une régression applicative : 241 tests PASS et 1 FAIL sur une assertion documentaire qui attendait encore l'ancien libellé TURN. La correction 8c600f5 aligne le test sur le README ; aucun comportement réseau n'a été modifié pour corriger cet échec.
- Le défaut de repli WebRTC était réel : UDP 8189 était configuré, mais aucun listener TCP n'était ouvert. Le listener TCP 8189 et son exposition Docker ont été ajoutés dans le correctif précédent, UDP restant prioritaire.
- Le défaut d'arrêt passerelle était réel : FFmpeg pouvait être lancé après une annulation déjà reçue pendant la demande du ticket. Le garde avant spawn et le test de régression dédié sont présents dans la branche.

### Corrections et preuves exactes

- Commit 17a7d80e7e330e75c9daad51480850f7cebd9729 : garde anti-spawn après abort, test de régression, README MediaMTX corrigé ; CI #1313 PASS.
- Commit 6c1118415dcc8c55d21eb3b8fbd4a4e8ef0df047 : ajout du listener ICE TCP 8189, port TCP publié dans Compose et assertions dédiées ; CI #1314 a révélé uniquement l'assertion documentaire obsolète.
- Commit 8c600f5ec54c99521132b72be01f2d4f6540713e : assertion corrigée ; CI #1315 completed/success, 242 tests PASS / 0 FAIL, TypeScript, ESLint, build Next.js, scans secrets et audit dépendances PASS.
- Commit bce5e3a614c279147265cde8952df5c21faaddeb : workflow qualité renforcé par validation de mediamtx.yml avec le binaire officiel bluenviron/mediamtx:1.21.3 et l'option --validate-conf, sans démarrer le serveur.
- CI #1316 : completed/success sur le SHA exact bce5e3a614c279147265cde8952df5c21faaddeb. Les scans de toutes les références et du répertoire courant passent ; npm audit signale 0 vulnérabilité ; le validateur MediaMTX officiel passe ; 242 tests PASS / 0 FAIL ; la séquence TypeScript et ESLint retourne avec succès ; Next.js compile avec succès et génère 129/129 pages statiques.
- La commande lint produit encore des avertissements non bloquants existants (notamment images HTML et une dépendance React Hook) ainsi qu'un avertissement de dépréciation de next lint ; aucune erreur bloquante n'a échoué la CI.
- Workflow et preuve : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42541347507

### Verdict exact

**VERT — CORRECTIF LOGICIEL ET CONFIGURATION VERSIONNÉE.** Le défaut d'arrêt FFmpeg est corrigé et testé ; UDP/TCP WebRTC sont configurés et le fichier MediaMTX est validé par le binaire officiel ; l'intégralité des contrôles CI passe sur le SHA bce5e3a.

**PARTIEL — MISE EN SERVICE MATÉRIELLE NON VALIDÉE.** Aucun serveur MediaMTX dédié, DNS, certificat TLS, firewall/NAT externe, variable Preview effective, passerelle physique ou caméra n'a été mis en service dans cette intervention. Aucun parcours caméra réelle → passerelle → RTSPS → MediaMTX → WHEP n'a été testé. La connectivité Wi-Fi/mobile reste à mesurer ; aucun STUN/TURN n'est configuré et un TURN pourra être nécessaire sur certains NAT stricts. Ne pas annoncer le live opérationnel et ne pas démarrer le lot enregistrement avant cette recette.

### Périmètre préservé

- Branche active : qa/e2e-stabilisation-20261106.
- Aucun changement de main, aucune écriture Supabase Production, aucun déploiement Vercel/Production.
- Le commit bce5e3a ne modifie que .github/workflows/naxa-quality.yml ; la validation MediaMTX officielle est un contrôle CI, pas un déploiement.

### Reprise exacte

La correction logicielle/configuration MediaMTX est clôturable au vert CI. La suite est la recette d'infrastructure et du kit caméra/passerelle réel ; garder le lot 12 matériel PARTIEL jusqu'à preuve vidéo et réseau de bout en bout.

---

## Recette E2E — Lot 12, tests logiciels et Replay (09/11/2026)

### Environnement et référence exacte

- Branche : qa/e2e-stabilisation-20261106.
- HEAD avant ce rapport : b662aa570a7d66260ae505bba0b6efb35ca3a8d4.
- CI #1317 : completed/success sur ce SHA exact ; scans secrets, audit dépendances, validation MediaMTX officielle, tests, TypeScript, ESLint et build terminés avec succès : https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42541608473.
- Base de recette : Supabase Replay `pwfftcsjyeibxxqhwysw`, projet `naxa-ci-replay-2`, ACTIVE_HEALTHY. Aucun accès en écriture ni déploiement Production.
- Historique Replay : migrations de sécurité jusqu'à 309 présentes (fondation 301, connectivité 302, enrôlement 303, découverte/revue 304–306, session live 307, publisher 308, événements 309).

### Scénarios exécutés et résultats

- CI : 242 tests automatisés PASS / 0 FAIL. Les logs montrent notamment les tests Ed25519/heartbeat, arrêt FFmpeg après abort, découverte ONVIF, ingestion d'événements signée, tickets publisher, autorisation MediaMTX publish/read, session live, lecteur WHEP et révocation ; ces tests vérifient le logiciel/contrat et utilisent des fixtures ou assertions, pas une caméra physique.
- MediaMTX : Docker télécharge `bluenviron/mediamtx:1.21.3`, exécute `--validate-conf=/tmp/mediamtx.yml` et retourne exactement `configuration file is valid`. Aucun serveur relay n'est laissé en marche et aucun port public n'est ouvert par ce contrôle.
- Replay — schéma : 14 tables `naxa_security_*` inspectées, RLS et FORCE RLS activés sur toutes ; aucun privilège direct SELECT/INSERT/UPDATE/DELETE pour anon/authenticated sur les tables sensibles.
- Replay — fonctions : les 6 RPC attendues existent ; émission session live, émission ticket publisher, rapport de santé, ingestion événement et revue événement sont SECURITY INVOKER avec search_path vide ; revue atomique des candidats ONVIF SECURITY DEFINER avec search_path vide, verrouillage `FOR UPDATE`, audit et sans déclarer une connexion `connected`.
- Replay — privilèges : émission session/ticket, ingestion/revue événements et revue atomique des candidats réservées à service_role ; index d'unicité des tickets, de session et de déduplication événements présents ; trigger audit append-only présent ; contraintes revue humaine et confirmation sirène présentes.
- Replay — données pilote : 0 installation, 0 passerelle, 0 caméra, 0 connexion caméra, 0 événement, 0 clip, 0 commande sirène, 0 session live et 0 ticket publisher. Le catalogue contient 15 adaptateurs, tous `design_only` (0 validé).

### Verdict de recette

**PASS — CI, contrats logiciel, validation de configuration MediaMTX et contrôles SQL/RLS sur Replay.**

**NON EXÉCUTABLE / BLOQUÉ — E2E vidéo réel.** Aucun site/installation pilote ni aucune caméra/passerelle ne sont enregistrés dans Replay. Aucun MediaMTX public avec DNS/TLS/firewall vérifiés, aucune variable runtime effective, aucun agent Linux de pharmacie et aucun flux RTSPS réel ne sont disponibles. La base Replay ne peut donc pas délivrer un ticket publish/live valide : installation `pilot_active`, revue légale et avis confidentialité approuvés, passerelle fraîche et connexion `live_view` testée manquent. Il n'existe pas de cible réelle pour tester WHEP, frames, renouvellement/révocation, coupure/reconnexion ou isolation Promoteur A/B.

### Conclusion

La recette E2E logicielle et SQL disponible est exécutée et PASS. La recette E2E du lot 12 selon son critère de sortie (caméra physique d'une pharmacie pilote, flux autorisé et révocable) reste PARTIELLE et non exécutée faute d'environnement/périphériques ; ne pas la noter PASS et ne pas démarrer le lot 13 avant cette preuve.

Aucune donnée de test n'a été insérée dans Replay ; aucune migration n'a été appliquée pendant cette recette ; aucun secret, endpoint fictif, accès Vercel ou déploiement Production utilisé.

---

## Lot 13 — enregistrement local et index (09/11/2026)

Le périmètre livré depuis l'index initial comprend maintenant :
- migrations 310/311 et API signée d'index de métadonnées ;
- worker FFmpeg local opt-in, segments continus, no-overwrite, audio désactivé et secrets absents des arguments de processus ;
- indexeur ffprobe, SHA-256 et outbox AES-256-GCM avec reprise ;
- migration 312 et RPC protect/unprotect transactionnelle, auditée, réservée à service_role ;
- endpoint signé de synchronisation des segments protégés ; purge locale suspendue si l'état distant est inconnu/incomplet ;
- API et UI Promoteur de timeline des métadonnées ; aucun chemin local ou lien de lecture n'est exposé.

La timeline et la protection sont livrées côté logiciel ; le lecteur/export vidéo, l'enregistrement programmé/événementiel, la supervision de disque et la recette caméra/NVR restent ouverts.


## Lot 13 — protection des archives et timeline metadata (09/11/2026)

### Implémentation QA en cours
- Migration 312 `security_recording_protection_lot13` appliquée sur Replay `pwfftcsjyeibxxqhwysw`.
- RPC `naxa_security_set_recording_protection` : transaction + verrou `FOR UPDATE`, rôle acteur, justification 8–500 caractères, changement ready/protected et audit atomique.
- Vérification Replay : `SECURITY INVOKER`, `search_path=''`, exécution accordée à `service_role`, refusée à `anon` et `authenticated`.
- Le lot de code raccorde route Promoteur de protection, endpoint passerelle signé de synchronisation des chemins protégés, purge locale fail-closed (si synchronisation manquante/incomplète : aucune purge), API timeline auditée et interface Promoteur. Les chemins locaux ne sont jamais fournis à l'interface.
- Tests Replay exécutés : RPC 312 présente, invoker + search_path vide, backend-only, verrou/audit transactionnels PASS ; justification courte rejetée. CI #1330 SUCCESS sur ec6f6963a1b94b30f9810730f43e49bb50cffe10 : 276/276 tests, 0 échec, audit npm 0 vulnérabilité, build Next.js et 129/129 pages PASS. Matériel physique et lecture/export vidéo non couverts.


## Lot 14 — mesure de dérive temporelle passerelle (09/11/2026)

### Fondations logicielles ajoutées sur QA
- Module SNTP local `services/security-gateway/time-integrity.cjs` : requête UDP, contrôle mode/version/stratum, originate timestamp, calcul offset et RTT, bornes de sécurité.
- Configuration explicite `NAXA_NTP_SERVER` sur la passerelle ; aucune synchronisation système n'est déclenchée par NAXA.
- Agent : correction de l'horodatage des requêtes signées à partir de la mesure NTP ; heartbeat HTTPS capable d'affiner un décalage si la première requête passe déjà la fenêtre de validation.
- Migration 313 : historique privé `naxa_security_gateway_time_samples`, RLS + FORCE RLS, service_role only, RPC transactionnelle et audit.
- Routes gateway signée et Promoteur scoppée ; affichage dérive/RTT/source/ancienneté dans Sécurité.
- « Mesure dans le seuil » exige offset ≤1 000 ms, RTT ≤1 500 ms et mesure de moins de 10 minutes.

### Limites non vertes
- SNTP non authentifié (NTS non intégré) ; le réseau pourrait fausser la mesure. Une configuration NAXA_NTP_SERVER et une connectivité NTP réelle restent nécessaires.
- L'agent ne change pas l'horloge OS. Il corrige uniquement les timestamps de signature HTTP ; FFmpeg et les caméras/NVR peuvent encore dériver.
- Incrustation date/heure/pharmacie/caméra, fuseau IANA par site, manifeste vidéo signé, PTS/DTS, hash vérifié à l'export et comparaison physique caméra/NVR/passerelle/serveur restent à livrer.
- Le test SNTP simulé valide le calcul protocolaire, pas l'accès réel à un serveur NTP.


## Lot 16 — calendrier de haute surveillance (09/11/2026)

### Implémentation QA en place, CI à confirmer
- Migration 314 : table privée par pharmacie, fuseau IANA, fenêtres hebdomadaires, exceptions datées, version monotone, expiration hors ligne 72 h. RLS + FORCE RLS, accès service_role uniquement.
- RPC transactionnelle : version incrémentée et audit Promoteur.
- UI Promoteur : plusieurs plages, jours, horaires, fuseau local, exceptions armées/désarmées.
- API passerelle : requête Ed25519 authentifiée, périmètre de la pharmacie, réponse HTTPS et empreinte SHA-256.
- Agent : cache local AES-256-GCM, renouvellement 5 min, durée offline 72 h, évaluation des plages traversant minuit et état informatif pour événements ONVIF.
- Trigger SQL : élève à `high` la priorité serveur des mouvements/intrusions/franchissements/présences hors horaires dont l'instant détecté tombe dans une plage active.
- Exemple 22:00–08:00 vérifiable dans le module, fuseau Africa/Douala.

### Limites
- HTTPS + empreinte SHA-256, sans signature Ed25519 serveur indépendante du canal TLS ; clé de signature centrale non provisionnée.
- Sensibilité caméra/zone ONVIF, règles IA, notifications/sonneries, destinataires, escalade, sauvegarde immédiate des clips et file durable d'événements hors ligne non raccordés.
- UI Promoteur uniquement ; délégation Responsable mono-pharmacie non implémentée.
- Pas d'essai sur passerelle/caméra physique.

**Verdict : fondations logicielles validées par CI #1341, lot 16 global PARTIEL faute de recette passerelle et de fonctions aval (alertes, IA, clips, Responsable).**
- Commit QA testé : 909727b13bdd8872baba0450955206c3ed04d252.
- CI #1341 SUCCESS : 290/290 tests, 0 échec, audit npm 0 vulnérabilité, build Next.js et 129/129 pages PASS.


## Contrôle terminal CI et statut transverse — 09/11/2026
- Branche QA : qa/e2e-stabilisation-20261106 ; SHA du lot 16 validé : 909727b13bdd8872baba0450955206c3ed04d252.
- CI #1341 : SUCCESS ; 290 tests PASS / 0 FAIL, audit npm 0 vulnérabilité, validation officielle MediaMTX, TypeScript/ESLint/build PASS et 129/129 pages.
- CI #1333 lot 14 : SUCCESS ; 283/283 tests PASS, audit npm 0 vulnérabilité, TypeScript/ESLint/build PASS et 129/129 pages.
- Replay : zéro installation, passerelle, caméra, connexion, live session, clip, segment, commande sirène et politique de haute surveillance. Les 15 adaptateurs caméra sont design_only.
- Lire docs/security/SUIVI_LOTS12_20_RESTANTS.md pour les raisons lot par lot. Les nombres Replay ne décrivent pas Production.
- Lot 16 : contrats logiciels et CI PASS ; recette physique et fonctions aval non terminées.


## Point de reprise — lots sécurité 13, 14 et 16 (09/11/2026, après demande de mise au vert)

- Demande utilisateur : mettre au vert les trois lots immédiatement clôturables côté logiciel ; reporter les autres lots et leurs recettes Node.js à une phase ultérieure.
- Périmètre retenu : **VERT pour le socle logiciel livré et testé** des lots 13, 14 et 16 ; **PARTIEL pour la clôture globale** tant que les extensions logicielles explicitement listées et les recettes physiques ne sont pas faites. Ne jamais résumer ces lots comme totalement opérationnels.
- Branche contrôlée : `qa/e2e-stabilisation-20261106`, commit parent vérifié `2ccbaf673e5b490688096aa2393ccdd7191fc86d`. Aucune modification de `main`, aucune écriture Supabase Production, aucun déploiement Vercel.
- GitHub Actions #1388 : SUCCESS sur SHA `2ccbaf673e5b490688096aa2393ccdd7191fc86d` — 290/290 tests PASS, 0 échec ; npm audit production 0 vulnérabilité ; TypeScript, ESLint, Next.js build et 129/129 pages PASS.
- Logs CI dédiés : lot 13 27/27 ; lot 14 7/7 ; lot 16 7/7 ; total 41/41 sous-tests explicitement étiquetés.
- Lot 13 : worker FFmpeg opt-in, indexeur/hash/outbox, synchronisation signée, protection transactionnelle et timeline metadata testés. Restent lecteur/export, planification/événementiel, surveillance disque/récupération et caméra/NVR réels.
- Lot 14 : client SNTP, validation des réponses, offset/RTT, ajustement des signatures passerelle, stockage/audit et UI testés. Restent NTP réel, horloge OS/caméra/NVR, incrustation et manifeste/export signé.
- Lot 16 : fuseau IANA, plages et franchissement minuit, exceptions, snapshot chiffré, RPC/audit, API gateway et trigger de priorité testés. Restent signature serveur indépendante, file offline durable, notifications/escalades/clips, délégation Responsable et gateway réel.
- Les 3 fiches de phase et le registre `docs/security/SUIVI_LOTS12_20_RESTANTS.md` sont alignés sur cette qualification. Les lots 12, 15, 17, 18, 19 et 20 restent différés pour les recettes Node.js/SIL et/ou prérequis externes.
- Prochaine action lors de la reprise : construire séparément les recettes Node.js SIL pour les lots différés ; ne pas créer de faux équipements/données Replay et ne pas annoncer de validation matérielle.


## Point de reprise — audit général du code et état Sécurité (09/11/2026)

### Référence et preuves exactes

- Dépôt : `audreymendomo23-netizen/NAXA`.
- Branche contrôlée : `qa/e2e-stabilisation-20261106`, HEAD `1a79b8cc4d7e92b89eb8e79d5cbf5859249f3d8d`.
- Depuis le commit `2ccbaf673e5b490688096aa2393ccdd7191fc86d`, un seul commit documentaire a été ajouté ; aucun fichier applicatif, migration ou configuration n'a changé dans cet intervalle.
- GitHub Actions **#1389** : [run 42578412264](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42578412264), SUCCESS sur le SHA exact `1a79b8cc4d7e92b89eb8e79d5cbf5859249f3d8d`.
- Résultats du run : scan Gitleaks des refs Git et du working tree PASS ; `npm audit --omit=dev --audit-level=high` = **0 vulnérabilité de production** ; suite Node **290/290 PASS, 0 échec, 0 ignoré** ; TypeScript PASS ; ESLint terminé sans erreur bloquante ; compilation Next.js PASS ; génération statique **129/129 pages** ; configuration officielle MediaMTX 1.21.3 validée.
- Le workflow exécute `npm run build`, qui appelle le pré-build qualité défini dans `package.json`. Cette preuve couvre le dépôt QA à ce SHA ; elle ne prouve ni un déploiement, ni un comportement Production, ni une recette navigateur/authentifiée.

### Inventaire du dépôt examiné

Au SHA contrôlé, l'arbre Git contient 1 471 fichiers : 73 routes API, 132 pages Next.js, 136 composants, 46 modules `src/lib`, 148 migrations SQL et 10 fichiers du service Security Gateway. Cet inventaire confirme une base applicative large, mais le nombre de fichiers ne vaut pas validation métier.

### État logiciel déjà construit

- Client/Marketplace : accueil, recherche, catalogue, panier, réservation/retrait, paiement guidé, scan/import d'ordonnance, historique client et interactions WhatsApp sont documentés comme construits ; les statuts historiques de `FONCTIONNALITES_VALIDEES.md` doivent toutefois être relus au regard du HEAD courant avant d'en déduire une certification E2E.
- ERP pharmacie : espaces pharmacie et équipes, import de stock, lots/FEFO, caisse/POS, réservations avec hold de stock, comptabilité et exports disposent de code, migrations et tests de contrat/SQL. Le mode hors ligne ne doit pas être décrit comme ERP complet : le périmètre offline garanti dans les fiches actuelles reste notamment la correction de quantité du stock non lotisé ; les ventes, la caisse et les clôtures exigent une preuve dédiée.
- Rôles professionnels : le modèle d'affectations et de poste actif est construit ; les tests SQL Replay 295–299 donnent 36 assertions PASS. Cela ne prouve pas l'inscription et l'utilisation simultanées par de vrais comptes Promoteur, Pharmacie, Caisse, Pharmacien, Stock, Comptable et Livreur.
- Livreur : workflow applicatif avancé (affectation/invitation, préparation Stock avant publication, acceptation atomique, retrait, arrivée, position au premier plan, suivi Client, performance et export). Les migrations jusqu'à `20261106172700` sont présentes sur Replay et la suite générale passe. Restent le parcours Auth multi-comptes, les accès Promoteur/Pharmacie réels, la recette commande→stock→livraison et Push/appareil. Les anciennes lignes de recette qui le disent « non construit » sont périmées et doivent être traitées comme historique.
- Sécurité intelligente : le tableau Promoteur, les APIs de passerelle, les sessions live temporaires, le lecteur WHEP, la découverte/normalisation ONVIF, l'enregistrement local, la protection des segments, l'historique temporel et le calendrier haute surveillance ont un socle versionné. Le catalogue de 15 familles d'adaptateurs caméra reste `design_only` tant que chaque modèle/firmware n'a pas été réellement testé.

### Lots Sécurité — qualification à conserver

- **Lot 13 — socle logiciel VERT** : 27/27 sous-tests dédiés documentés PASS ; worker FFmpeg opt-in, indexeur/hash/outbox, synchronisation signée, protection transactionnelle et timeline de métadonnées. Le lot complet reste PARTIEL : lecture/export vidéo, planification/événementiel, télémétrie disque/récupération et test caméra/NVR manquent.
- **Lot 14 — socle logiciel VERT** : 7/7 sous-tests dédiés documentés PASS ; SNTP, validation mode/version/stratum/originate, offset/RTT, historique privé, audit et UI. Le lot complet reste PARTIEL : serveur NTP réel, horloge OS/caméra/NVR, incrustation vérifiable, manifeste signé et intégrité après export manquent.
- **Lot 16 — socle logiciel VERT** : 7/7 sous-tests dédiés documentés PASS ; fuseau IANA, plages traversant minuit, exceptions, cache local chiffré, RPC/audit, API passerelle et priorité SQL d'événement. Le lot complet reste PARTIEL : signature serveur indépendante, file offline durable, alertes/escalades/clips, délégation Responsable et passerelle réelle manquent.
- Ces trois lots sont verts **pour leur socle logiciel uniquement**, pas pour l'exploitation complète ou un site réel.

### Lots différés — recette Node.js SIL à construire

| Lot | Socle déjà présent | Recette SIL à construire | Limite non simulable |
|---|---|---|---|
| 12 — Live / MediaMTX | Auth/tickets, API live, proxy et config MediaMTX validée | RTSP local, tickets expirés/révoqués, connexion, reconnexion, réseau coupé, isolation multi-pharmacie, WHEP | Caméra/NVR, réseau, DNS/TLS et serveur média réellement déployés |
| 15 — Drive / sauvegardes | Backup DB quotidien chiffré en artefact GitHub (90 jours), S3 facultatif ; onboarding Google seul | Faux fournisseur OAuth/Drive, state/CSRF, scopes, quota, reprise, checksum et restauration | Projet Google Cloud, consentement OAuth réel, Drive du Promoteur, copie locale native téléphone |
| 17 — IA / détection | ONVIF discovery/events et normalisation | Pull-Point simulé, événements dupliqués/retardés, contrats d'inférence, files, latence, erreurs et revue humaine | Runtime/modèle réel, accélérateur, dataset vidéo autorisé, faux positifs/négatifs terrain |
| 18 — Android | PWA/Web Push et logique serveur de notifications | API/FCM simulé, jetons, retries, déduplication, révocation, file et redémarrage de workers | Projet Android natif, APK signé, FCM réel, Doze, écran verrouillé et téléphones physiques |
| 19 — Sirène | Table de commandes et contraintes SQL | Relais factice local, signatures, nonce, watchdog, durée maximale, ACK, panne et arrêt d'urgence simulé | GPIO/relais/contrôleur, câblage, alimentation/UPS et arrêt matériel réel |
| 20 — E2E pilote | APIs, règles et tests isolés déjà disponibles | Scénario composé caméra simulée→gateway→API→événements→notification→accusé, avec coupures/reprises et isolation | Pharmacie volontaire équipée, consentements, NVR/caméra, gateway, réseau/UPS et mobile réels |

Les recettes SIL devront être explicitement marquées `simulated=true` et s'exécuter en local/CI avec `node:test`, fixtures éphémères et aucun faux équipement persistant dans Replay. Un PASS SIL validera le logiciel simulé, jamais le matériel réel.

### Audit qualité — points à traiter sans bloquer la CI

Le run #1389 passe, mais ses logs montrent des avertissements non bloquants :
- usages répétés de `<img>` au lieu de `next/image` ;
- dépendances manquantes ou expressions complexes dans plusieurs `useEffect` ;
- attribut `aria-expanded` appliqué à des éléments ayant le rôle implicite `textbox` ;
- `next lint` est déprécié et devra être remplacé par l'ESLint CLI avant Next.js 16 ;
- avertissements Node sur `url.parse()` et `punycode`.
Ces points sont corrigeables par le code, sans équipement réel. Le contrôle npm exécuté porte sur les dépendances de production avec seuil `high` ; il ne remplace pas une revue complète des dépendances de développement ou une analyse SAST.

### Risques sécurité transversaux à ne pas marquer verts

Le rapport de faisabilité sécurité du 07/11/2026 conserve des alertes Replay à recontrôler : fonctions `SECURITY DEFINER` exposées à `anon` ou `authenticated` (dont `log_evenement` et `log_recherche`), vues/fonctions sensibles, schéma `private` exposé dans la configuration Data API et protection Supabase Auth contre les mots de passe compromis signalée désactivée. Ces constats ne sont pas revalidés dans le run GitHub #1389 ; ils exigent un audit SQL/ACL/RLS et de configuration sur Replay, fonction par fonction. Ne pas les considérer corrigés parce que npm audit et CI passent.

### Contradictions documentaires repérées

- `STATUT.md` et certaines sections historiques de `FONCTIONNALITES_VALIDEES.md` indiquent encore que build/typecheck/lint/npm test n'ont pas été exécutés ou que le workflow Livreur n'existe pas. Ces mentions précèdent les vérifications récentes et ne doivent plus servir de statut courant.
- `FONCTIONNALITES_VALIDEES.md` contient plusieurs états successifs du même sujet. Garder les historiques, mais faire prévaloir les addenda datés et les preuves sur SHA exact.
- Le présent point de reprise est établi sur la branche QA uniquement. Aucun changement sur `main`, aucune écriture Supabase Production et aucun déploiement Vercel Production.

### Classement opérationnel

- **Déjà verts avec preuve actuelle :** qualité générale CI au SHA `1a79b8cc4d7e92b89eb8e79d5cbf5859249f3d8d` ; socles logiciels des lots 13, 14 et 16.
- **Vert possible par correction/tests logiciels accessibles :** avertissements ESLint/React/ARIA, migration du script lint, vérification ACL/RLS/`SECURITY DEFINER` et réglages Auth sur Replay, et recettes SIL des lots différés une fois leurs interfaces/code manquants construits.
- **À réserver aux recettes SIL Node.js puis aux preuves terrain :** lots 12, 15, 17, 18, 19 et 20. Une recette Node.js peut mettre au vert le contrat logiciel simulé ; elle ne peut pas certifier caméra, Drive OAuth réel, AI sur vidéos réelles, Android/FCM sur téléphone, relais de sirène ni pilote équipé.


## Addendum — audit approfondi, clôtures accessibles et écarts terrain (09/11/2026 — reprise après interruption)

### Preuve qualité la plus récente sur QA

- Branche : `qa/e2e-stabilisation-20261106`.
- SHA applicatif vérifié : `6fec5e0890cfc653f146ff7639a8577b15ef4e8c`.
- GitHub Actions #1414 : SUCCESS — https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42600593801.
- Journaux du job unique : scan Gitleaks sur tous les refs/historiques et le répertoire courant PASS ; audit des dépendances de production = 0 vulnérabilité ; validation de la configuration officielle MediaMTX 1.21.3 PASS ; tests Node `296/296`, 0 échec, 0 skip ; TypeScript PASS ; ESLint terminé sans erreur ; build Next.js PASS ; pages statiques `129/129`.
- Le ratissage du fichier `src/app/resultats/page.tsx` a stabilisé les dépendances de l'effet de recherche (coordonnées dérivées et sélection panier mémorisée). Les deux avertissements `react-hooks/exhaustive-deps` ont disparu. Il reste 28 avertissements ESLint, principalement les usages HTML `<img>` non optimisés ; ils ne bloquent pas le build.
- Le PASS ci-dessus certifie le logiciel de QA au SHA cité. Il ne certifie ni la branche `main`, ni les services externes, ni un parcours navigateur/appareil complet.

### Corrections SQL et tests réalisés — Replay seulement

- Migration source QA `supabase/migrations/20261109101500_replay_duplicate_index_cleanup.sql` et test `supabase/tests/20261109101500_replay_duplicate_index_cleanup.sql` ajoutés. La migration a supprimé sur `naxa-ci-replay-2` quatre index identiques redondants : `abonnements_pharmacie_unique_base`, `commandes_fournisseurs_lignes_order_idx`, `reservation_events_pharmacie_idx` et `stocks_lots_id_uq`. L'index unique `stocks_lots_id_uidx`, adossé à une contrainte, a été conservé et vérifié unique/valide. Test transactionnel PASS ; l'Advisor Replay ne signale plus de doublons d'index. Aucun index Production n'a été modifié.
- Migrations QA déjà présentes et appliquées sur Replay : `20261109060000_fournisseurs_rls_policy_consolidation.sql` et `20261109070000_revoke_execute_favoris_purchase_trigger.sql`. Le test transactionnel fournisseur refuse la lecture, l'insertion, la modification et la suppression pour un sujet sans profil professionnel actif ; le test trigger confirme l'absence d'EXECUTE direct pour `anon`, `authenticated` et `service_role`, tout en vérifiant que le trigger reste attaché. Les deux tests SQL passent. Pas de changement Production.
- Relecture contradictoire des tables d'architecture : les policies de lecture existent bien. Le test corrigé sous le rôle `authenticated` avec le contexte Admin retourne 638 lignes `naxa_architecture_privileges`, 309 `naxa_role_privileges` et 3 `pharmacie_architectures`. Le constat antérieur « tables sans policy / page privilèges cassée » est retiré ; la première mesure à zéro n'était pas valide.
- Les 43 tables Replay signalées `rls_enabled_no_policy` ne sont pas accordées aux rôles `anon` ou `authenticated` : le contrôle SQL retourne 0 table de cette liste ayant un accès applicatif. Elles sont fermées au client et ne constituent pas une fuite RLS sur la base des ACL vérifiées.

### État sécurité Supabase revalidé en lecture seule

- Replay : deux fonctions `SECURITY DEFINER` exécutables par `anon` sont les RPC de télémétrie publique `log_evenement` et `log_recherche`, qui limitent les types/volumes et filtrent les termes ; leur accès public doit rester surveillé.
- Replay : 198 fonctions `SECURITY DEFINER` sont exécutables par `authenticated`. Une recherche de gardes directes trouve 188 fonctions contenant un contrôle explicite d'identité, de rôle ou de scope ; 10 autres sont des wrappers/délégations ou des fonctions de télémétrie qui doivent être suivis individuellement. Ce nombre Advisor n'est pas un décompte de failles confirmées. Aucun retrait global d'EXECUTE n'est justifié.
- Replay : Advisor performance après le nettoyage — 31 policies avec `auth_rls_initplan`, 214 clés étrangères sans index couvrant signalées, 175 index sans utilisation observée, 56 ensembles de policies permissives. Ces alertes sont des pistes de performance/revue, non des preuves d'accès indu. Les politiques multiples sont parfois intentionnelles (Admin + propriétaire + partenaire) ; ne pas les fusionner ou supprimer massivement sans tests d'autorisation par rôle. Les index non utilisés ne doivent pas être supprimés sur un environnement de test sans statistiques de charge représentatives.
- Production, lecture seule : les tables d'architecture sont lisibles selon les policies attendues. En revanche, `fournisseurs` conserve encore les quatre policies héritées `fournisseurs_read_scope`, `fournisseurs_insert_scope`, `fournisseurs_update_scope`, `fournisseurs_delete_scope` en plus des policies `*_staff`. La migration QA de consolidation correspondante n'a pas été appliquée en Production ; son application y demande une autorisation explicite.
- Protection native Supabase Auth contre les mots de passe compromis : l'Advisor la signale toujours désactivée. Le code QA exécute déjà une vérification HIBP serveur, en mode fail-closed, sur les routes de changement Pharmacie, Promoteur et inscription/récupération ; les sous-tests 141–143 passent. Cela ne remplace pas le réglage natif du projet et ne signifie pas que cette correction est présente sur `main`. L'activation native nécessite le réglage Auth du projet ; aucun outil de configuration Auth utilisable dans cette passe n'a permis de l'activer.
- Production est restée en lecture seule : aucune migration, ACL, donnée métier, variable ou déploiement modifié.

### État des lots et du reste de l'application

- Lots 13, 14 et 16 : **VERT pour le socle logiciel testé seulement** ; état de livraison complet reste PARTIEL tant que les lectures vidéo, l'horloge caméra/NVR, les signatures/alertes et passerelles physiques listées dans le tableau ne sont pas validées.
- Lots 12, 15, 17, 18, 19 et 20 restent PARTIELS/BLOQUÉS par les éléments précis déjà listés dans `docs/security/SUIVI_LOTS12_20_RESTANTS.md`. Le périmètre demandé ici n'a pas étendu les travaux en construisant une recette E2E Node.js.
- Corrections encore réalisables par code/SQL/outil disponible : les 28 avertissements d'images ; les 31 policies RLS à initplan (après réécriture et test rôle par rôle) ; les 214 index de clés étrangères (après priorisation par tables et coût d'écriture) ; les policies permissives (revue individuelle) ; les 10 wrappers `SECURITY DEFINER` non classés par inspection de leurs fonctions déléguées ; migration de consolidation fournisseur Production après autorisation ; modernisation des dépendances/outils de lint.
- Dépendances qui ne peuvent pas être certifiées par les outils et environnements actuels seuls : caméra/NVR/flux et réseau pilote ; consentement réel Google Drive/OAuth et compte Drive ; modèle d'inférence/vidéos terrain/accélérateur ; projet Android natif signé + Firebase/FCM et téléphone physique ; contrôleur relais/sirène/câblage/UPS ; pharmacie pilote et consentements opérationnels. Ces éléments exigent des systèmes, appareils, comptes ou décisions externes réels.
- Le dépôt reste désynchronisé : `main` HEAD `2374348e416d4745e19546da1151ea1ad8fefa11` ; QA HEAD au moment de cet addendum `6fec5e0890cfc653f146ff7639a8577b15ef4e8c`, 459 commits devant `main`, aucun commit derrière. Ne pas lire la CI QA comme une validation de `main`.
- Aucun merge/PR, aucun déploiement Vercel et aucune écriture Supabase Production n'ont été effectués.

### Verdict de cette passe

**PASS logiciel QA au SHA 6fec5e0 ; 3 corrections de cohérence/SQL vérifiées sur Replay ; audit global toujours ouvert.** La base n'est pas « au bout de ce qui est corrigeable » : des optimisations de code et de RLS restent réalisables. La clôture complète de l'application demeure impossible tant que les dépendances matérielles, Android natif, Google Drive réel et la pharmacie pilote ne sont pas disponibles.

## Addendum 2026-11-09 — correction des avertissements d’images

### Audit, cause et correction

- Sur `qa/e2e-stabilisation-20261106`, les 28 balises `<img>` identifiées par ESLint ont été remplacées par `next/image` dans 22 fichiers. Les sources, textes alternatifs, classes, gestionnaires d’erreur et comportements existants ont été conservés ; les dimensions intrinsèques ont été explicitées lorsque nécessaire.
- Les sources externes, `blob:` et `data:` utilisent `unoptimized` pour préserver leurs URL sans ajouter de domaines distants arbitraires à la configuration Next.js. Les logos statiques locaux restent optimisables par Next.js.
- Le premier contrôle #1416 a révélé une collision de nom : l’import `Image` masquait le constructeur navigateur `new Image()` employé dans le recadrage du profil et le scanner. La correction a renommé l’import en `NextImage` dans `src/app/client/profil/page.tsx` et `src/components/ScannerShell.tsx`.
- Commit final du code : `935290a593c75fbf36f2fdc5fe8e85ae32b8fdd0`.

### Preuve de validation

- CI #1417 : **SUCCESS** sur le commit ci-dessus — https://github.com/audreymendomo23-netizen/NAXA/actions/runs/42603304077
- Tests Node : 296/296 PASS, 0 échec, 0 ignoré.
- Audit des dépendances de production : 0 vulnérabilité.
- Gitleaks : scan des références Git et de l’arbre courant réussi.
- Configuration MediaMTX 1.21.3 : validation réussie.
- TypeScript et build Next.js : réussis ; 129/129 pages statiques générées.
- Avertissements ESLint `@next/next/no-img-element` : 0 dans le journal du run final.

### Réserves non clôturées par cette correction

- Les avertissements Node `DEP0040` (`punycode`) et `DEP0169` (`url.parse()`) demeurent dans les outils/dépendances exécutés par CI.
- Des dépendances de développement signalent encore des dépréciations, notamment ESLint 8.57.1 et les anciens paquets `@humanwhocodes`. Elles ne sont pas mises à niveau dans cette passe.
- Cette preuve concerne exclusivement le code de la branche QA. Le HEAD `main` reste `2374348e416d4745e19546da1151ea1ad8fefa11`. Aucun merge/PR, aucun déploiement Vercel et aucune écriture Supabase Production n’ont été effectués.
- Les alertes RLS, les index FK, les policies permissives, les fonctions `SECURITY DEFINER` à examiner et les dépendances réelles des lots 12–20 restent ouvertes selon les constats précédents. La correction des images ne constitue pas un verdict vert global de NAXA.


## Addendum 2026-11-09 — optimisation des InitPlans RLS

### Audit et correction

- Replay signalait initialement 31 alertes Supabase `auth_rls_initplan`.
- Précontrôle SQL effectué sur les 31 politiques avec trois contextes JWT : compte Administrateur actif Replay, identifiant authentifié inconnu et contexte anonyme. Les expressions d'origine et les versions encapsulées ont donné les mêmes résultats sur les lignes Replay existantes, dans les clauses USING et WITH CHECK présentes.
- La première migration enregistrée (`20261109115431_rls_auth_initplan_policy_optimization`) a été inefficace : son motif regex était sur-échappé et n'a pas remplacé les appels. Elle est conservée pour la traçabilité de l'historique ; aucune permission n'a été modifiée.
- La migration corrective `20261109115710_rls_auth_initplan_policy_optimization_v2` a remplacé les appels directs `auth.uid()` par `(select auth.uid())` dans exactement 31 politiques, sans changer roles, commandes ni permissive mode.
- Contrôle après application : 31/31 politiques présentes ; 31/31 rôles, commandes et modes permissifs identiques au relevé ; 0 appel direct `auth.uid()` restant ; 31/31 politiques avec InitPlan ; RLS activé sur 24/24 tables concernées.
- Supabase Performance Advisor après rafraîchissement : l'alerte `auth_rls_initplan` a disparu. Les alertes distinctes subsistent : 214 clés étrangères sans index couvrant, 175 index inutilisés et 56 ensembles de politiques permissives. Elles ne sont pas modifiées dans cette passe.
- Test SQL de régression : `supabase/tests/316_rls_auth_initplan_policy_optimization.sql`. Exécution Replay réussie ; transaction annulée après assertions en lecture seule.

### Limite de preuve

Replay ne contient qu'un profil actif d'Administrateur ; les contextes Client, Pharmacien, Promoteur et Partenaire ne sont pas présents comme comptes Auth actifs. La comparaison SQL couvre l'Administrateur disponible, un identifiant authentifié inconnu et le contexte anonyme, mais ne remplace pas une recette de bout en bout avec des comptes réels de chaque rôle.

### Périmètre

Ces deux migrations et leur preuve concernent exclusivement Replay et la branche QA. `main` reste inchangée ; aucune migration, donnée, ACL ou variable Supabase Production n'a été modifiée. Aucun PR, merge ni déploiement Vercel n'a été effectué.


## Addendum 2026-11-09 — indexation ciblée des privilèges

### Audit et correction

- Replay signalait 214 clés étrangères sans index couvrant. Deux tables de privilèges actives ont été priorisées : `naxa_architecture_privileges` (638 lignes) et `naxa_role_privileges` (309 lignes). Sur les deux, la PK composite commence respectivement par `(architecture_code, role_key, privilege_code)` et `(role_key, privilege_code)` ; elle ne fournit pas un index dont `privilege_code` est le premier attribut pour les recherches inversement indexées et la maintenance de la FK.
- Migration Replay enregistrée : `20261109121000_naxa_privilege_fk_indexes`. Elle crée deux index B-tree dédiés sur `privilege_code`, sans modifier les données, contraintes ou règles d'accès.
- Plans Replay validés en forçant temporairement le test à considérer les index : `naxa_architecture_privileges` — Index Only Scan, 10 lignes, 0,166 ms ; `naxa_role_privileges` — Bitmap Index Scan, 4 lignes, 0,099 ms. Ces timings sont propres à Replay, pas une promesse de performance Production.
- Les compteurs `pg_stat_user_indexes` après test : 2 scans / 20 entrées lues pour l'index architecture, 1 scan / 4 entrées lues pour l'index rôles.
- Advisor performance après rafraîchissement : alertes de FK sans index 214 → 212 ; index inutilisés 175 (les deux nouveaux index ont été exercés) ; policies permissives multiples 56, inchangées.
- Test SQL versionné : `supabase/tests/317_naxa_privilege_fk_indexes.sql`. Contrôle des deux index, de leur validité et de l'ordre de la première colonne ; exécuté avec succès sur Replay en transaction annulée.

### Limite et périmètre

- Cette passe ne traite que deux des 214 alertes ; les autres nécessitent priorisation table/charge par table et ne seront pas corrigées en masse.
- Changements appliqués à Replay et versionnés sur QA uniquement. Aucune écriture Supabase Production, aucun merge/PR et aucun déploiement Vercel.


## Addendum 2026-11-09 — façades SECURITY DEFINER et alignement des migrations

### Index FK

- Le fichier migration des deux index FK est aligné sur la version Replay enregistrée : `supabase/migrations/20261109120519_naxa_privilege_fk_indexes.sql`.
- Replay : les plans utilisent les deux nouveaux index et l'Advisor FK est passé de 214 à 212. Le test dédié est `supabase/tests/317_naxa_privilege_fk_indexes.sql`.

### Audit de quatre façades SECURITY DEFINER

- `public.caisse_cloturer(uuid, integer)` ne fait que déléguer à la surcharge à trois arguments qui vérifie la session de caisse, la pharmacie et le titulaire actif.
- `public.naxa_can_approve_marketplace_credit(uuid)` délègue à `private.naxa_actor_can_approve_marketplace_credit(uuid)`, qui impose l'identité, la fonction métier et le privilège Promoteur/Responsable.
- `public.naxa_provision_caisse(uuid, uuid)` délègue à `public.naxa_grant_professional_assignment(...)`, qui vérifie l'acteur, la cible, la pharmacie, le rôle attribuable, le scope, le privilège requis et les quotas.
- `public.accrediter_responsable(uuid, uuid)` délègue à `public.accrediter_profile(...)`, qui vérifie l'identité active, le rôle Promoteur, le scope de pharmacie, le privilège d'accréditation, l'architecture et les quotas.
- Ces quatre façades n'ont pas de logique privilégiée propre : elles passent en `SECURITY INVOKER`. Les implémentations déléguées restent `SECURITY DEFINER`, avec les mêmes ACL et contrôles. Aucun droit EXECUTE n'a été ajouté ou retiré.
- Migrations Replay : `20261109120846_security_definer_guarded_wrapper_invoker` et `20261109121248_accreditation_wrapper_invoker`.
- Test de régression `supabase/tests/318_security_definer_wrapper_delegation.sql` : exécuté en transaction annulée avec rôle `authenticated`, UUID fictif et cas invalides ; les quatre façades délèguent et les implémentations rejettent proprement les arguments invalides.
- Advisor sécurité Replay : les fonctions SECURITY DEFINER exécutables par `authenticated` passent de 198 à 194. Cela ne clôt pas toutes les alertes ; les fonctions restantes ne sont pas automatiquement des failles et doivent être lues individuellement.
- Les deux RPC de télémétrie publique `log_evenement` et `log_recherche` restent accessibles à `anon` ; elles sont volontairement conservées pour la télémétrie publique et doivent rester surveillées. La protection native Supabase Auth contre les mots de passe compromis reste désactivée.

### Limite et périmètre

- Ces changements sont appliqués sur Replay et versionnés sur QA uniquement. `main`, Production et Vercel ne sont pas modifiés.
- Replay ne dispose pas encore de comptes Auth actifs pour chaque rôle Client, Pharmacien, Promoteur, Responsable et Partenaire. Les validations transactionnelles et fonctions gardées ne remplacent pas une recette complète avec ces identités réelles.


## Addendum 2026-11-09 — privilèges de télémétrie publique

- La RPC `public.log_recherche(text[])` avait un grant `EXECUTE` à `PUBLIC`. La migration Replay `20261109121757_revoke_public_execute_log_recherche` retire uniquement ce grant global et accorde explicitement `EXECUTE` à `anon`, `authenticated` et `service_role`.
- Test SQL `supabase/tests/319_log_recherche_public_execute_acl.sql` exécuté avec succès : `anon`, `authenticated`, `service_role` peuvent toujours appeler la RPC ; `authenticator` n'a plus d'accès direct ; la fonction reste `SECURITY DEFINER`.
- Cette correction ne supprime pas l'alerte Advisor de la RPC anonyme : son exposition à `anon` reste voulue pour la télémétrie de recherche. Les limites de 10 termes par appel et de 3 à 80 caractères sont conservées. La migration ne change pas le corps de la fonction.
- CI #1423 sur le commit `7e8e0ed83ade9436b5b021c99e47fe773f0040fc` : succès, 296 tests réussis, 0 vulnérabilité npm, TypeScript/build réussis, 129/129 pages.
- Replay et QA seulement ; aucune modification Production, `main` ou Vercel.

 
## Addendum 2026-11-09 — index FK ciblés sur les parcours métier

### Audit et correction

- Replay signalait 212 clés étrangères sans index couvrant après les deux index de privilèges précédents.
- Revue des définitions d'index et contraintes sur les parcours Réservations, POS, crédits Marketplace, rôles professionnels, événements, alertes, rappels de lots et journal de mouvements. Les colonnes déjà couvertes en tête d'un index composite complet ont été exclues. Les clés nullable couvertes par un index unique partiel IS NOT NULL ont également été exclues pour éviter les doublons.
- Migration Replay enregistrée sous 20261109121909_naxa_core_fk_indexes_batch2 et versionnée sur QA dans supabase/migrations/20261109121909_naxa_core_fk_indexes_batch2.sql. Elle ajoute 22 index B-tree sur les clés étrangères qui n'avaient pas de couverture complète.
- Test versionné supabase/tests/320_naxa_core_fk_indexes_batch2.sql : 22 assertions structurelles vérifient la présence des FK, la validité/l'état ready des index et l'absence de prédicat partiel ; 22 vérifications EXPLAIN confirment que le planificateur choisit chaque index avec enable_seqscan=off. Le test groupé a été exécuté dans une transaction annulée : 44/44 assertions PASS.
- Advisor Performance Replay après la migration : unindexed_foreign_keys passe de 212 à 191 ; aucune des 22 FK ciblées ne reste dans les findings. multiple_permissive_policies reste à 56.
- unused_index passe de 175 à 197. Ce signal est attendu après création des index : Replay n'a pas une charge métier représentative ; certains index FK servent aussi à accélérer les suppressions/mises à jour de lignes parentes et ne doivent pas être supprimés sur la seule base de statistiques de test.

### Limite et périmètre

- Les timings et plans ne sont pas un benchmark de charge réelle : les tables Replay sont petites/vides après les tests transactionnels et le contrôle de sélection d'index force temporairement le planificateur à éviter les scans séquentiels.
- Migration appliquée sur Replay et source/test versionnés sur QA uniquement. Aucun changement Production, main, ACL, donnée métier ou déploiement Vercel.
- Il reste 191 alertes FK dans d'autres tables, plus les 56 ensembles de policies permissives à examiner individuellement. Ne pas les corriger en masse sans examiner les index composites, contraintes métier, charge et sécurité.

## Addendum 2026-11-09 — consolidation RLS du dictionnaire

### Audit et correction

- Replay : la table `public.dictionnaire` avait deux policies permissives de lecture : `dico_admin FOR ALL USING is_admin()` et `dico_lecture FOR SELECT USING true`. L’Advisor la signalait pour plusieurs rôles effectifs.
- Correction : la policy globale Admin a été remplacée par trois policies dédiées `INSERT`, `UPDATE` et `DELETE`, chacune gardant exactement `is_admin()`. La policy `dico_lecture` reste seule pour `SELECT` public ; RLS et les grants de table n’ont pas été modifiés.
- Migration Replay appliquée sous la version `20261109210843`, enregistrée dans `supabase/migrations/20261109210843_dictionnaire_select_policy_consolidation.sql`.
- Test structurel versionné : `supabase/tests/20261109210843_dictionnaire_select_policy_consolidation.sql`.

### Preuves Replay

- Advisor `multiple_permissive_policies` : **56 → 51** ; aucun finding ne cite plus `dictionnaire`.
- Policies relues après migration : une seule SELECT publique (`dico_lecture`), trois policies d’écriture `is_admin()`, RLS toujours activé.
- Test Admin Replay : `is_admin() = true` ; INSERT, UPDATE et DELETE autorisés dans une transaction de test ensuite annulée.
- Test profil authentifié non-Admin : 14 lignes lisibles ; UPDATE/DELETE ne retournent aucune ligne ; INSERT refusé par RLS.
- Test `anon` : 14 lignes lisibles ; UPDATE/DELETE ne retournent aucune ligne ; INSERT refusé par RLS.
- La recette structurelle SQL a été exécutée avec succès. Aucune donnée de test n’a été conservée.

### État restant

- Advisor Replay après correction : 189 FK sans index couvrant, 175 index non utilisés observés et 51 groupes de policies permissives restant à examiner. Ces alertes sont à traiter table par table ; pas de suppression ou fusion automatique.
- La modification est limitée à Replay et à la branche `qa/e2e-stabilisation-20261106`. `main` et Supabase Production sont inchangées ; aucun merge/PR ni déploiement n’a été effectué.

## Addendum 2026-11-09 — consolidation RLS des niveaux d’architecture

- Replay : `naxa_architecture_niveaux` avait `naxa_architecture_niveaux_admin_write FOR ALL` en plus de `naxa_architecture_niveaux_read FOR SELECT`. Les deux policies étaient permissives pour les SELECT authentifiés.
- Correction : la policy Admin globale a été séparée en `INSERT`, `UPDATE` et `DELETE`, chacune conservant `(select is_admin())`. La lecture authentifiée `USING true`, RLS, grants et données restent inchangés.
- Migration Replay : `20261109211700_naxa_architecture_niveaux_select_policy_consolidation`.
- Test SQL structurel versionné : `supabase/tests/20261109211700_naxa_architecture_niveaux_select_policy_consolidation.sql`, exécuté avec succès sur Replay.
- Preuve comportementale : Admin actif reconnu et autorisé à insérer/modifier/supprimer dans une transaction annulée ; authentifié non-Admin lit 10 lignes, ne modifie/supprime aucune ligne et son INSERT est refusé. `anon` n’a pas de grant SQL SELECT sur cette table et n’entre pas dans ce périmètre.
- Advisor `multiple_permissive_policies` : **51 → 50** après retrait des doublons sur `dictionnaire` et `naxa_architecture_niveaux`. Aucun des deux objets ne figure encore dans les findings.
- Les autres 50 ensembles de policies restent à examiner individuellement. Replay affiche toujours 189 FK sans index couvrant et 175 index non utilisés observés ; pas de suppression massive sans mesure de charge et revue des index composites.
- QA/Replay seulement ; Production et `main` restent inchangées, aucun merge/PR ni déploiement.

## Addendum 2026-11-09 — séparation de la lecture publique et Admin des pharmacies

### Cause confirmée en lecture seule sur Production

- Production contient 4 pharmacies : 1 active et 3 inactives.
- La policy de lecture Production `pharmacies_read` utilisait `actif OR private.is_admin()`, alors que `anon` n'a pas le droit `EXECUTE` sur `private.is_admin()`.
- Une requête réelle `anon` exécutée en lecture seule sur Production a échoué avec `42501 permission denied for function is_admin`. Aucune donnée ni policy Production n'a été modifiée.

### Correction Replay / source QA

- Migration Replay `20261109212452_pharmacies_select_policy_consolidation_20261109` : remplacement de la policy Admin `ALL` par trois policies DML Admin.
- Migration Replay `20261109212710_pharmacies_admin_dml_authenticated_only_20261109` : DML limité au rôle `authenticated`, qui porte les sessions Admin NAXA ; aucun appel du helper privé pour `anon`.
- Migration Replay `20261109212829_pharmacies_public_authenticated_read_split_20261109` : séparation explicite des lectures :
  - `anon` lit uniquement les pharmacies actives via `pharmacies_read_anon`, sans appeler `private.is_admin()`.
  - `authenticated` lit les pharmacies actives et, si `private.is_admin()` est vrai, conserve la visibilité des pharmacies inactives.
- Les trois migrations Replay ci-dessus ont été ajoutées au dépôt QA avec le test structurel `supabase/tests/20261109212829_pharmacies_public_authenticated_read_split.sql`.

### Preuves Replay et limites

- Replay : 9 pharmacies visibles pour `anon` et pour un profil `authenticated` non-Admin ; la mise à jour Admin en session authentifiée a fonctionné. Les trois policies DML sont maintenant `TO authenticated`.
- Le test structurel vérifie que la policy `anon` n'appelle jamais `private.is_admin()`, que chaque rôle n'a qu'une policy SELECT et que les trois policies DML restent Admin-only.
- Advisor `multiple_permissive_policies` : **50 → 45** ; aucun finding ne cite plus `pharmacies`. Replay reste à 189 FK sans index couvrant et 175 index non utilisés observés.
- **Production reste inchangée** : le défaut y est établi par la requête de lecture anonyme en lecture seule. Le correctif nécessite une migration Production explicitement autorisée. Aucun merge, PR ni déploiement n'a été effectué.

## Addendum 2026-11-09 — séparation RLS des équivalences de produits

- Replay : `produit_equivalences` avait `produit_equivalences_admin FOR ALL` et `produit_equivalences_lecture FOR SELECT` sur `anon,authenticated`. Le chevauchement concernait les SELECT authentifiés.
- Correction : lecture séparée — `anon` voit les entrées actives sans appeler le helper privé ; `authenticated` voit les entrées actives et Admin conserve la visibilité des inactives via `private.is_admin()`. Les écritures sont réparties en trois policies DML `TO authenticated` gardées par `is_admin()`.
- Migration Replay : `20261109213201_produit_equivalences_read_policy_split_20261109`.
- Test structurel SQL `supabase/tests/20261109213201_produit_equivalences_read_policy_split.sql` exécuté avec succès. La table Replay contenait 0 ligne et aucun trigger ; aucune donnée artificielle n’a été créée. Les droits effectifs d’écriture n’ont donc pas été revendiqués comme testés par des lignes métier.
- Advisor `multiple_permissive_policies` : **45 → 44** ; aucun finding ne cite plus `produit_equivalences`.
- Replay reste à 189 FK sans index couvrant et 175 index non utilisés observés ; les 44 autres groupes de policies demandent une revue spécifique de leurs portées et ne seront pas fusionnés en masse.

## Addendum 2026-11-09 — consolidation des lectures Admin des partenaires

- Replay : `partner_members`, `partner_universes` et `partners` avaient chacune une policy Admin `FOR ALL` plus une policy de lecture propriétaire/membre ; l’Advisor signalait une policy SELECT permissive superposée par table.
- Correction : le chemin Admin a été ajouté à la policy de lecture existante (lecture personnelle, membre d’un partenaire actif, ou Admin), puis les anciennes policies Admin `ALL` ont été remplacées par `INSERT`, `UPDATE` et `DELETE` `TO authenticated`, chacune gardée par `is_admin()`.
- Le garde de phase 1 `guard_medical_devices_partner_universe_phase1` reste attaché à `partner_universes`.
- Migration Replay : `20261109213523_partner_admin_read_policy_consolidation_20261109`. Test structurel `supabase/tests/20261109213523_partner_admin_read_policy_consolidation.sql` exécuté avec succès.
- Replay : les trois tables contiennent 0 ligne ; aucune donnée métier fictive n’a été créée. La preuve de ce lot est structurelle, pas une recette comportementale d’un partenaire réel.
- Advisor `multiple_permissive_policies` : **44 → 41** après cette migration. Les trois tables ne figurent plus dans les findings. Replay conserve 189 FK sans index couvrant et 175 index non utilisés observés.
- Aucun changement Production, `main`, ACL de table ou déploiement ; migration limitée à Replay/QA.
