# Contrôle Admin global des univers — 11 novembre 2026

## Périmètre
Depuis `/admin/univers`, l’Admin NAXA peut verrouiller et déverrouiller les cinq espaces gérés :
- Parapharmacie (`parapharmacie`)
- Bébé & Maman (`bebe-maman`)
- Examens médicaux (`examens`)
- Dispositifs médicaux / suivi connecté (`suivi`)
- Prestations à domicile (`prestations`)

L’espace Pharmacie central et Aide NAXA ne sont pas pilotés par ce contrôle.

## Règles de fonctionnement
- L’action serveur exige une session Admin active et n’accepte que les cinq slugs gérés.
- La RPC `admin_set_universe_enabled` est exécutée en SECURITY INVOKER et vérifie elle-même `public.is_admin()`.
- Le registre `universes` et le flag `feature_flags.universe.*` sont modifiés dans une même transaction.
- Pour `suivi`, le flag `suivi_connecte` est synchronisé dans la même transaction.
- La RPC écrit l’événement d’audit ; l’action serveur ne crée pas de doublon.
- L’écran relit la base après l’action et ne confirme pas une modification non persistée.
- Les associations commerciales de partenaires et la publication commerciale de dispositifs médicaux restent interdites.

## Vérification Replay
Projet : `pwfftcsjyeibxxqhwysw` (Replay uniquement).

Contrôles exécutés dans une transaction ensuite annulée :
- activation Admin des cinq univers : PASS ;
- vérification de persistance des cinq lignes `universes` et des cinq flags : PASS ;
- activation de `suivi` et synchronisation de `suivi_connecte` : PASS ;
- désactivation Admin des cinq univers et vérification des flags : PASS ;
- désactivation de `suivi` et synchronisation de `suivi_connecte` : PASS ;
- tentative d’activation par un profil non Admin : refusée (PASS).

## État de livraison
Le code source de l’écran et de l’action serveur, ainsi que la migration SQL idempotente, sont préparés dans un commit Git non rattaché à `main`. Aucun push de branche n’a été effectué, afin de ne pas déclencher une éventuelle mise en Production Vercel.

Le build Next.js, TypeScript, lint et test navigateur de l’écran ne sont pas encore exécutés. La base Production n’a reçu aucune migration.
