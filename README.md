# NAXA : base de l'application

Votre médicament, à 2 minutes. Next.js 14 + Supabase + Tailwind, PWA, 100 % offre gratuite.

## Démarrage
1. npm install
2. Créer un projet Supabase (gratuit). Dans Database > Extensions, activer pg_cron.
3. Dans l'éditeur SQL, exécuter dans cet ordre : supabase/schema.sql, supabase/migration_002_catalogue_panier.sql, supabase/migration_003_security_hardening.sql, supabase/migration_004_corrections.sql, puis (démo seulement) supabase/seed.sql.
4. Planifier l'expiration des réservations avec le job naxa-expire toutes les 5 minutes.
5. Copier .env.example vers .env.local et renseigner les clés. La clé service_role ne doit jamais être exposée.
6. npm run dev, puis ouvrir /admin après avoir configuré un compte administrateur.

## Fonctionnalités
Recherche et scan d'ordonnance (OCR avec choix import téléphone/caméra), accès protégé par connexion pour les actions opérationnelles, traduction des noms de médicaments du bandeau « Les plus recherchés », classement prix/distance/temps, circulation, réservation 3 h, WhatsApp, paiement guidé par code marchand, reçu imprimable, panneau pharmacie, espace admin, fiches produits, panier et PWA.

Aucune photo de médicament n'est fournie : à ajouter par l'équipe NAXA (droits d'usage à vérifier).

## État
### Phase 0 — terminée et validée
- Cahier des charges et prompt maître lus et pris comme sources de vérité.
- Code existant conservé ; aucune réécriture de l'application.
- Aucun déploiement manuel effectué.

### Phase 1 — fondations
- Projet Supabase NAXA connecté et sain.
- Schéma initial + migration catalogue/panier appliqués.
- Migration de durcissement sécurité/performance ajoutée et appliquée sur l'environnement NAXA.
- 9 tables publiques créées avec RLS activé.
- Données de démonstration chargées.
- pg_cron activé et expiration des réservations planifiée toutes les 5 minutes.
- Correction du typage Supabase SSR effectuée, notamment dans le middleware.
- Page panier corrigée pour éliminer l'erreur de syntaxe JSX signalée par Vercel.
- Composant ImportAdmin ajouté pour restaurer la fonctionnalité d'import de stock référencée par /admin.
- Audit par contradiction : validations serveur du panier renforcées (1–10 produits, quantité 1–10, pas de doublon) et écritures de fiches produits limitées à l'administration.
- L'import de stock conserve la création de produits mais n'utilise plus une mise à jour produit générale.
- Les variables Vercel Production/Preview/Development NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont maintenant configurées avec le projet Supabase NAXA.
- Le dernier échec Vercel provenait du prerender /pharmacie sans ces variables Supabase ; une nouvelle construction doit confirmer la correction.

### Règles de gouvernance
- Aucun déploiement manuel n'est effectué sans autorisation explicite.
- Les décisions du cahier des charges et du prompt maître restent prioritaires.

