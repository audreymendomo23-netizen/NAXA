# NAXA — Continuité opérationnelle IA
Dernière mise à jour : 2026-10-13

## Règles impératives
- Déclencheur « Rappel » : relire ce document, vérifier l'état réel GitHub/CI, comparer avec le dernier point, puis reprendre sans refaire inutilement le travail.
- Aucune nouvelle branche. Aucun brouillon de PR. Ne jamais contourner un refus d'outil.
- Les seuls commits autorisés par défaut sont ceux qui créent ou mettent à jour ce document de continuité. Aucun commit de code, configuration, migration ou fonctionnalité sous cette autorisation.
- Travailler une branche existante à la fois. Vérifier les preuves réelles avant d'annoncer un résultat. Ne jamais déclarer CI verte sans logs correspondant au SHA exact.
- Ne pas modifier directement main, ne pas fusionner et ne pas déployer sans autorisation explicite. Production Supabase reste en lecture seule.
- Après chaque réponse concernant NAXA, mettre à jour ce document sur les branches du périmètre actif, avec état vérifié, preuves, blocages et prochaine action autorisée.
- Méthode : audit → contradictions → cause racine → correction ciblée (uniquement après autorisation) → tests/preuves → documentation → CI verte → validation utilisateur → intégration autorisée → vérification → suppression de la branche terminée.

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
- Preview Vercel et Netlify ont précédemment été signalées comme réussies sur le SHA `c4316a3619115f2597828ab8e29ed7fa71b2d4d2`; liens : https://naxa-git-feat-auth-water-bubbles-naxa3.vercel.app/connexion et https://deploy-preview-63--naxxa.netlify.app/connexion. Ces résultats ne prouvent pas le succès CircleCI.
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
- Plateforme exacte et projet/build concerné non identifiés avec certitude dans le message. Ne pas attribuer ce blocage à Vercel, Netlify ou CircleCI sans vérification.
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
- Feedback Netlify : Deploy Preview success sur le SHA `be866cbd...`, déploiement `6acd7f50df53d88bf5631364`, URL https://deploy-preview-63--naxxa.netlify.app. Commentaire GitHub : https://github.com/audreymendomo23-netizen/NAXA/pull/63#issuecomment-6135372009.
- Vérification du statut GitHub sur ce SHA : `ci/circleci: quality = failure`, pipeline 1425 https://circleci.com/gh/audreymendomo23-netizen/NAXA/1425 ; `netlify/naxxa/deploy-preview = success`. Aucune exécution GitHub Actions n'est retournée pour ce SHA. Aucun contrôle CircleCI vert.
- État public de GitHub Status consulté : services actuellement « All Systems Operational ». L'historique mentionne un incident Actions / Pull Requests / Issues le 12 octobre 2026, avec mitigations et surveillance; cet incident passé ne suffit pas à expliquer l'échec CircleCI actuel. Source : https://www.githubstatus.com/.
- La page Billing et le feedback exact du quota privé ne sont pas accessibles via les outils disponibles. Le quota ne peut donc pas être confirmé à distance; il faut consulter la page de facturation de l'utilisateur.
- Aucun code applicatif modifié, aucune action de facturation, aucune modification de visibilité, aucune fusion ni aucun déploiement Production. La mise à jour de continuité précédente est le seul commit récent sur la branche.
- Prochaine action : obtenir les logs détaillés de CircleCI pipeline 1425 ou la cause exacte du message de quota dans GitHub Billing; ne pas traiter les succès de preview comme preuve de CI complète.


## Journal de continuité — nouvelle vérification CI GitHub (2026-10-13, reprise utilisateur)
- Relecture directe de la PR #63 : https://github.com/audreymendomo23-netizen/NAXA/pull/63. Elle est toujours ouverte. La tête de branche actuelle retournée par GitHub est désormais `e8db412820cd963281d48628ece3cbd5f417801f` (la vérification précédente avait relevé `be866cbd...`; l'état de tête a avancé depuis).
- Statuts exacts du SHA de tête `e8db412820cd963281d48628ece3cbd5f417801f` : `ci/circleci: quality = failure`, pipeline 1427 : https://circleci.com/gh/audreymendomo23-netizen/NAXA/1427 ; `netlify/naxxa/deploy-preview = success`, https://deploy-preview-63--naxxa.netlify.app.
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
