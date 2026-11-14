# Dossier de prompts — GrillaD

> Prompts de construction de l'application GrillaD, alignés sur le socle de la Famille NAXA.
> Version 1.0 · 14 novembre 2026.
> Cahier de référence : `../01-cahiers-des-charges/08-grillad.md` (adapter le chemin relatif selon l'emplacement du dépôt).

## Mode d'emploi

- Exécuter les prompts dans l'ordre, en transmettant à chaque étape le fichier de passation précédent.
- Lire le cahier des charges GrillaD et le socle commun Famille NAXA avant toute modification.
- Le périmètre est strict : porc braisé, poulet braisé, poisson braisé, brochettes et omelettes, rien d'autre.
- Les paramètres marqués [O] dans le cahier ne deviennent pas des règles sans décision explicite.
- Réutiliser le socle existant après audit ; ne pas créer de doublons de comptes, organisations, abonnements, appareils, notifications ou journal d'audit.
- Ne jamais appliquer une migration Supabase, déployer, publier une APK ou modifier la Production sans autorisation explicite.

---

## PROMPT GD-0 — Audit du dépôt, du socle et cadrage technique

**RÔLE :** Tu es architecte logiciel senior Android, Kotlin, Supabase/PostgreSQL, sécurité et applications hors connexion. Explique brièvement les décisions, puis fournis des preuves vérifiables.

**PROJET :** GrillaD, application autonome de gestion de vendeurs de grillades en soirée. Le périmètre produit autorisé est exclusivement : porc braisé, poulet braisé, poisson braisé, brochettes et omelettes.

**MISSION :** Auditer le dépôt, le socle Famille NAXA et les applications déjà construites avant de proposer la structure GrillaD.

**À FAIRE :**
1. Lire le cahier des charges GrillaD et le socle commun.
2. Identifier la structure réelle du dépôt, les conventions, les modules Android/Web, les versions et les outils de test.
3. Examiner les entités communes existantes : comptes, organisations, points, rôles, appareils, abonnements, notifications, audit et synchronisation.
4. Comparer les modules métiers existants de Bootik et Zipple ; réutiliser seulement ce qui est réellement compatible.
5. Identifier les risques de couplage, doublons, accès inter-applications et dette technique.
6. Proposer l'architecture GrillaD, les packages, les écrans, les services, les tables manquantes et l'ordre des prompts.
7. Marquer chaque constat : preuve, fichier/chemin, état, risque. Ne jamais déclarer qu'un composant existe sans l'avoir lu.

**CONTRÔLES :** Aucun code métier ni migration créée à cette étape. Aucun appel réseau non nécessaire, aucune CI, aucun déploiement.

**LIVRABLES :** Rapport d'audit, matrice réutiliser/créer/écarter, architecture cible, risques, questions ouvertes et fichier de passation.

## PROMPT GD-1 — Modèle de données et migrations additives

**MISSION :** Concevoir le modèle métier GrillaD à partir du socle réellement audité.

**À FAIRE :**
1. Réutiliser les tables communes lorsqu'elles couvrent déjà le besoin.
2. Modéliser uniquement les entités métier manquantes : catalogue limité aux cinq familles, fournisseurs, achats, réceptions, stocks, lots, sessions, préparations, cuissons, rendements, commandes, ventes, paiements, caisses, dépenses, pertes et inventaires.
3. Définir les unités, conversions et règles de précision sans choisir arbitrairement les unités commerciales encore ouvertes.
4. Garantir l'isolation par organisation et point d'activité.
5. Définir clés, contraintes, index, horodatages, idempotence, audit et suppression logique.
6. Utiliser des types monétaires exacts (BIGINT ou NUMERIC) et jamais FLOAT/REAL.
7. Préparer des migrations additives ordonnées et des scripts de tests SQL ; ne rien appliquer à Supabase.
8. Fournir un dictionnaire de données et un schéma de relations.

**TESTS :** Familles hors périmètre rejetées ; références invalides bloquées ; unicité des opérations ; contraintes de quantités ; séparation entre commandes, ventes, paiements et mouvements de stock.

## PROMPT GD-2 — Sécurité, rôles et RLS

**MISSION :** Implémenter les autorisations métier et prouver l'isolation.

**À FAIRE :**
1. Définir les permissions du propriétaire, responsable, gestionnaire de stock, braiseur, vendeur, caissier et comptable.
2. Autoriser plusieurs fonctions à un même collaborateur sans comptes partagés.
3. Vérifier les plafonds et validations pour remises, achats, dépenses, inventaires et clôtures.
4. Appliquer RLS à toutes les tables exposées et vérifier les RPC.
5. Restreindre les fonctions SECURITY DEFINER, fixer search_path et limiter EXECUTE.
6. Journaliser les actions sensibles avec auteur, contexte, avant/après et motif.
7. Tester l'accès entre organisations, points, rôles et sessions.
8. Vérifier qu'aucune clé service_role n'est intégrée à Android ou Web.

**CONTRÔLES :** Tests positifs et négatifs SQL pour chaque rôle. Une interface masquée ne remplace jamais un contrôle serveur. Migrations non appliquées.

## PROMPT GD-3 — Socle Android, navigation et design GrillaD

**MISSION :** Construire le squelette Android autonome GrillaD en réutilisant les composants transversaux compatibles.

**À FAIRE :**
1. Respecter les conventions techniques réelles du monorepo et les versions déjà retenues.
2. Créer l'identité, le thème et les ressources propres à GrillaD sans modifier les autres applications.
3. Mettre en place navigation, session, verrouillage local, paramètres, langue FR/EN et gestion des erreurs.
4. Créer les écrans vides fonctionnels : tableau de bord, session, catalogue, vente, achats, stock, production, caisse, équipe et rapports.
5. Prévoir gros boutons, lisibilité en plein soleil, faible consommation et parcours de vente très court.
6. Ne pas inventer une charte couleur en l'absence de logo/charte source ; proposer des jetons provisoires et les signaler.
7. Aucun texte visible codé en dur.

**CONTRÔLES :** Compilation locale, navigation sans crash, vérification FR/EN, contrôle de non-régression des autres applications.

## PROMPT GD-4 — Catalogue, fournisseurs, achats et réception

**MISSION :** Construire le catalogue strict et le cycle d'approvisionnement.

**À FAIRE :**
1. Imposer une liste fermée de cinq familles : porc braisé, poulet braisé, poisson braisé, brochettes, omelettes.
2. Interdire les boissons, accompagnements, desserts, repas complets et marchandises génériques.
3. Gérer les fiches produits, variantes, unités et tarifs avec historique.
4. Gérer fournisseurs, achats, réception partielle/complète, justificatifs et règlements si activés.
5. Le stock n'augmente qu'à la réception validée.
6. Toute correction doit créer une écriture d'ajustement motivée.

**TESTS :** Tentative d'ajout d'une sixième famille refusée ; achat non reçu sans effet sur stock ; réception enregistrée une seule fois ; historique de prix conservé.

## PROMPT GD-5 — Stock, préparation, cuisson et rendement

**MISSION :** Construire le cycle de transformation des matières premières en produits prêts à vendre.

**À FAIRE :**
1. Séparer stock reçu, préparé, en cuisson et prêt à vendre.
2. Créer les lots de préparation/cuisson avec intrants, opérateur, horaires et quantités mesurées.
3. Calculer le rendement à partir des quantités réelles saisies.
4. Tracer pertes de préparation, cuisson, détérioration et invendus.
5. Gérer inventaires, seuils, lots et transferts selon le modèle audité.
6. Bloquer les quantités négatives et les doubles consommations.
7. Conserver l'historique des coûts pour calculer les marges.

**TESTS :** Consommation des intrants une seule fois ; rendement exact ; perte traçable ; inventaire sans écrasement silencieux ; concurrence de mouvements sécurisée.

## PROMPT GD-6 — Commandes et ventes rapides

**MISSION :** Construire l'écran de vente adapté à une activité de grillades en soirée.

**À FAIRE :**
1. Accès direct aux produits disponibles des cinq familles.
2. Saisie rapide de quantité, poids ou portion uniquement selon les unités validées.
3. Création d'une commande, confirmation, préparation, disponibilité et remise.
4. Contrôle des remises selon les permissions et plafonds.
5. Numéro unique hors connexion et prévention des doubles validations.
6. Reçu partageable par lien wa.me et impression Bluetooth si le socle le permet.
7. Une vente validée ne se modifie pas : annulation et écritures compensatrices uniquement.
8. Décrémenter le stock selon une règle unique documentée, sans double débit entre préparation et vente.

**TESTS :** Vente simple, vente concurrente, annulation, remise autorisée/refusée, commande hors connexion puis synchronisée, stock débité une seule fois.

## PROMPT GD-7 — Paiements, caisse et dépenses

**MISSION :** Construire les encaissements et le contrôle de caisse.

**À FAIRE :**
1. Gérer espèces, Mobile Money, paiement mixte et paiement différé seulement si cette option est confirmée.
2. Séparer paiement déclaré, en attente de vérification et confirmé.
3. Réutiliser les mécanismes de vérification du socle sans lire ni conserver PIN/OTP.
4. Ouvrir une caisse avec fonds initial, responsable et session.
5. Enregistrer entrées, dépenses, retraits autorisés, remboursements et clôture.
6. Calculer solde théorique, solde compté et écart.
7. Distinguer dépense, prélèvement et perte de stock.
8. Verrouiller les opérations financières validées et journaliser les corrections.

**TESTS :** Pas de double encaissement ; paiement non vérifié non présenté comme reçu ; caisse rapprochée ; écart justifié ; dépense et perte distinctes.

## PROMPT GD-8 — Personnel, sessions et clôture de soirée

**MISSION :** Relier les utilisateurs, rôles, opérations et sessions d'exploitation.

**À FAIRE :**
1. Affecter chaque membre à un point et à une session.
2. Appliquer les permissions réelles côté serveur.
3. Tracer ventes, préparations, achats, pertes, dépenses et mouvements par auteur.
4. Mettre en place la clôture guidée : commandes ouvertes, pertes, invendus, stock restant, caisse et rapprochements.
5. Empêcher la clôture si les contrôles obligatoires échouent ; permettre une dérogation uniquement aux personnes autorisées, avec motif.
6. Préserver l'historique d'une session clôturée.

**TESTS :** Vendeur sans droit de clôture refusé ; responsable autorisé ; session clôturée non modifiable directement ; piste d'audit complète.

## PROMPT GD-9 — Rapports, marge et assistant

**MISSION :** Produire des rapports fiables et une aide à la décision explicable.

**À FAIRE :**
1. Calculer ventes, quantités, achats, coûts consommés, rendements, pertes, dépenses, encaissements, marge et résultat.
2. Distinguer résultats provisoires et clôturés.
3. Conserver les règles de valorisation et les prix historiques.
4. Filtrer par soirée, période, famille, produit, point et collaborateur.
5. Exports autorisés PDF/CSV/XLSX.
6. Suggestions IA : prévision de quantités, risque de rupture, anomalie, synthèse.
7. Afficher données et hypothèses ; aucune action automatique sur paiement, stock, remise ou clôture.

**TESTS :** Recalcul indépendant d'une soirée témoin ; cohérence des totaux ; permissions d'export ; IA sans données suffisantes doit s'abstenir.

## PROMPT GD-10 — Hors connexion, synchronisation et résilience

**MISSION :** Garantir la continuité d'activité sans réseau.

**À FAIRE :**
1. Persister localement commandes, ventes, paiements déclarés, mouvements de stock, achats, production et caisse selon les règles de sécurité.
2. Générer un identifiant stable par opération.
3. Synchroniser par lots, avec reprise, dédoublonnage et journal d'erreurs.
4. Résoudre les conflits sans écraser les écritures financières ou de stock.
5. Gérer plusieurs appareils sur un même point ; verrouillage et réservation serveur au retour réseau.
6. Montrer l'état de synchronisation et les opérations en attente.
7. Ne jamais afficher comme confirmé un paiement dont la vérification est en attente.

**TESTS :** Mode avion pendant une soirée ; fermeture forcée ; reprise ; synchronisation répétée ; deux appareils concurrents ; aucune perte ni duplication.

## PROMPT GD-11 — Recette complète, sécurité et dossier de livraison

**MISSION :** Réaliser l'audit final de GrillaD avant toute décision de publication.

**À FAIRE :**
1. Exécuter les tests unitaires, intégration, SQL/RLS et parcours Android disponibles localement.
2. Tester les cinq familles et rejeter explicitement tout produit hors périmètre.
3. Tester un cycle complet : achat → réception → préparation → cuisson → vente → encaissement → pertes/invendus → clôture → rapport.
4. Tester les rôles, l'isolation multi-points, multi-organisations et les sessions.
5. Auditer les secrets, permissions, journaux, stockage local et synchronisation.
6. Contrôler l'accessibilité, la performance et les traductions.
7. Produire un rapport avec preuve par test, résultat, commit et limites.
8. Établir les points ouverts restants et les critères de publication.
9. Ne pas publier l'APK, ne pas déployer, ne pas appliquer de migration Production sans accord distinct.

**CRITÈRE VERT :** Aucun défaut bloquant de sécurité, de stock, de vente, de paiement, de caisse ou de synchronisation ; tests exigés réussis avec preuves ; aucun point ouvert critique dissimulé.

---

## Contraintes permanentes à rappeler à chaque prompt

- Travailler dans le dépôt et la branche autorisés par le porteur du projet ; ne pas créer de branche ni PR sans demande explicite.
- Ne pas modifier les autres applications pour faire fonctionner GrillaD sans analyse d'impact et accord.
- Ne pas appliquer de migration Supabase, surtout en Production, sans autorisation explicite.
- Ne pas lancer de déploiement Vercel, de release ni de publication APK sans autorisation explicite.
- Ne jamais utiliser service_role côté client.
- Ne jamais inventer de résultats de tests, données, preuves ou décisions métier.
- Faire un audit avant correction, expliquer la cause racine, corriger, tester, documenter puis conclure.
- Si un point métier est ouvert, poser une seule question ciblée ou isoler le point sans bloquer les travaux indépendants.
- Ne pas considérer un build réussi comme une preuve de recette métier.

## Modèle de fichier de passation

**FICHIER DE PASSATION — GrillaD — [prompt] — [date]**

1. **État :** terminé / partiel / bloqué.
2. **Faits établis :** éléments réalisés et preuves.
3. **Fichiers créés ou modifiés :** chemins exacts.
4. **Schéma :** tables, fonctions, politiques, migrations préparées (non appliquées).
5. **Écrans et parcours :** éléments construits et vérifiés.
6. **Tests :** commandes, résultats réels, limites.
7. **Décisions :** décisions confirmées et propositions séparées.
8. **Points ouverts :** questions restantes.
9. **Risques :** sécurité, données, exploitation, synchronisation.
10. **Prochain prompt :** identifiant et objectif.
11. **Accords nécessaires :** migration, Production, déploiement, APK ou autre action externe.

Terminer par un état explicite : « Étape terminée » uniquement si les critères de l'étape sont prouvés ; sinon « Étape partielle » ou « Étape bloquée ».
