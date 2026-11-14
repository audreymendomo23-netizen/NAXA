FICHIER DE PASSATION — Kit de construction (socle commun + logique de référence) — préparé par Claude — 1 novembre 2026

1. Fait
- Logique de référence en JavaScript (modules ES, Node 22), TESTÉE : 16 tests, 16 réussis (commande : node --test tests/logic.test.mjs).
  money (format et lecture des francs CFA), subscription (grilles de prix des 7 applications, forfaits 3/6/12 mois, montée de palier, prorata, mois offerts et plafond,
  bienvenue 48 h, tolérance hors connexion 7/14 jours avec recul d'horloge, blocage 60 jours), sms (filtre OTP/PIN, validation des messages sortants, parseur par règles,
  cohérence des soldes, doublons, séparation de SMS collés), wallets (effets des natures d'opérations Kiosko, trous de solde, rapprochement manuel/SMS, seuil de float),
  verticals (dépôt de gaz, recettes et rendement, tontine : cotisations, pénalités, tirage vérifiable, prêts internes ; locatif ; hôtel : tarifs, chevauchements,
  conflits hors connexion, compte du séjour, indicateurs).
- Vecteurs de référence : docs/vectors.json (84 prix, offline, tirages, prêts, tarifs hôtel…). Le code Android doit produire exactement les mêmes sorties.
- Migrations SQL (sql/001 à 005) : socle commun, abonnement, sécurité RLS, données initiales, tables Kiosko. NON EXÉCUTÉES.
- Prototype d'espace admin web (web/admin.html, page unique) : testé dans un navigateur (accueil, validation de paiement, création d'accès avec calcul des prix, outil de montée de palier). Données fictives en mémoire.

2. Fichiers créés (chemins)
logic/money.mjs, subscription.mjs, sms.mjs, wallets.mjs, verticals.mjs · tests/logic.test.mjs, tests/make_vectors.mjs · docs/vectors.json ·
sql/001_types_et_comptes.sql, 002_abonnement_et_transversal.sql, 003_securite_rls.sql, 004_donnees_initiales.sql, 005_kiosko_mobile_money.sql ·
web/admin.template.html, web/build_admin.mjs, web/admin.html

3. Tables et fonctions créées (noms exacts)
Tables : organizations, clients, profiles, outlets, user_roles, client_apps, devices, sales_reps, partners, plan_prices, subscriptions, payments (txid UNIQUE), payment_log,
promo_codes, referrals, partner_commissions, notifications, notification_preferences, audit_log, app_versions, known_signatures, parser_rules, support_tickets, app_settings, backups,
networks, wallets, transactions (immuable), balance_gaps, cash_sessions, float_orders, contacts, commission_rules, expenses, customers, credits, device_compat.
Fonctions SQL : current_client(), has_role(), is_admin(), is_owner(), my_outlet_ids(), outlet_sync_allowed(), signature_known(), apply_outlet_rls(table, allow_update),
limit_active_devices() (déclencheur), register_login_result(), admin_kpis().

4. Décisions prises (à confirmer ou corriger par moi)
- Prorata de montée de palier arrondi au franc le plus proche, minimum 100 F ; prorata d'un point supplémentaire idem.
- Offre de bienvenue strictement APRÈS la fin de la période et dans les 48 h (un paiement fait avant la fin n'y donne pas droit).
- Niveaux de relance de loyer : 1 à 7 jours = rappel amical, 8 à 15 = relance, 16 et plus = mise en demeure à valider par le bailleur.
- Prêts de tontine : intérêt « simple » (fixe sur le capital initial) ou « dégressif » (annuité constante) ; taux par période en pour mille ; légalité à faire valider.
- TVA en points de base (taux réel à confirmer) ; remise hôtel : la meilleure remise entre entreprise et longue durée, sans cumul.
- Paliers de Kiosko : « essentiel / services / complet » (grille de la v1.2) ; autres applications : « essentiel / pro / reseau ».
- Délai de grâce côté serveur après l'échéance : 0 jour (réglable dans app_settings.sync_grace_days).
- Le cahier de la v1.2 indiquait 8 000 F pour 3 mois de Complet ; le calcul correct est 8 100 F (corrigé).

5. Points ouverts et questions pour moi
- Les règles de lecture des SMS fournies sont FICTIVES (exemples de test) : les vraies règles exigent le corpus réel de SMS (Orange Money, MTN MoMo, Wave).
- Les SQL n'ont jamais été exécutés sur PostgreSQL : à relire et tester avant toute application.
- Aucune application Android n'a été compilée.
- Définitions de « déstockage » et de « C2C » à confirmer.

6. Prochain prompt recommandé
Prompt 0.1 (cadrage technique et structure du projet), avec ce fichier collé en tête. Ensuite 0.2 et 0.3 : relire, corriger et compléter le SQL fourni plutôt que de le réécrire ;
0.8 : porter subscription.mjs en Kotlin et rejouer docs/vectors.json ; 0.10 : brancher web/admin.html sur Supabase ; 1.1 à 1.4 : porter sms.mjs et wallets.mjs.

7. Actions qui demandent mon accord explicite
Tout push, toute branche ou pull request, toute vérification CI, toute migration appliquée à Supabase, toute publication ou déploiement. Travail uniquement sur main.
