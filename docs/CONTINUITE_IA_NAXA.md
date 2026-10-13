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
