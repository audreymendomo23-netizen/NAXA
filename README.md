# NAXA : base de l'application

Votre médicament, à 2 minutes. Next.js 14 + Supabase + Tailwind, PWA, 100 % offre gratuite.

## Démarrage
1. `npm install`
2. Créer un projet Supabase (gratuit). Dans **Database > Extensions**, activer `pg_cron`.
3. Dans l'éditeur SQL, exécuter dans cet ordre : `supabase/schema.sql`, puis `supabase/migration_002_catalogue_panier.sql`, puis (démo seulement) `supabase/seed.sql`.
4. Planifier l'expiration des réservations : `select cron.schedule('naxa-expire', '*/5 * * * *', $$select public.expire_reservations()$$);`
5. Copier `.env.example` vers `.env.local` et renseigner les clés. La clé `service_role` ne doit jamais être exposée.
6. `npm run dev`, puis ouvrir `/admin` après avoir configuré un compte administrateur.

## Fonctionnalités
Recherche et scan d'ordonnance (OCR), classement prix/distance/temps, circulation, réservation 3 h, WhatsApp, paiement guidé par code marchand, reçu imprimable, panneau pharmacie, espace admin, fiches produits, panier et PWA.

Aucune photo de médicament n'est fournie : à ajouter par l'équipe NAXA (droits d'usage à vérifier).

## État
Le dépôt contient le code source fourni dans l'archive NAXA. Avant mise en production, exécuter `npm install && npm run build`, puis configurer Supabase et les variables d'environnement.
