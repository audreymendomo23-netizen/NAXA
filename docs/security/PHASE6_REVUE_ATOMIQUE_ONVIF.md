# Phase 6 — Revue Promoteur ONVIF atomique

Date : 8 novembre 2026  
Branche : \`qa/e2e-stabilisation-20261106\`  
Objectif : empêcher tout état partiel lorsqu'un Promoteur accepte ou écarte un candidat caméra.

## Contradiction corrigée

Avant cette phase, l'action Promoteur réalisait plusieurs écritures indépendantes : création/récupération de caméra, création du connecteur primaire, mise à jour du candidat puis insertion du journal append-only. Une erreur entre deux requêtes pouvait laisser une caméra ou un candidat accepté sans journal complet.

## Correction

La revue est maintenant regroupée dans le RPC backend \`naxa_security_review_discovery_candidate\` :

- verrouille le candidat \`pending\` et refuse les décisions concurrentes ou répétées ;
- revalide l'état de la pharmacie, de la passerelle et de l'installation ;
- pour un rejet, écrit le statut \`dismissed\` et son audit dans la même transaction ;
- pour une acceptation, vérifie à nouveau l'endpoint local, crée/récupère la caméra de façon idempotente, crée le connecteur primaire en état \`discovered\`, lie le candidat en \`accepted\` et écrit l'audit append-only ;
- toute erreur SQL, y compris l'insertion d'audit, annule l'ensemble de la transaction ;
- n'annonce jamais \`connected\`, n'ouvre aucun endpoint et ne récupère aucun flux vidéo.

La fonction est \`SECURITY DEFINER\`, utilise un \`search_path\` vide et son exécution est révoquée pour \`public\`, \`anon\` et \`authenticated\`. Seul \`service_role\` peut l'appeler. L'action serveur conserve en plus le contrôle du rôle Promoteur et du périmètre pharmacie autorisé.

## Tests ajoutés

- contrat SQL : existence de la fonction, contexte SECURITY DEFINER/search_path, droits backend uniquement, verrouillage du candidat, audit dans la fonction et absence de statut \`connected\` ;
- test d'architecture Node : l'action Promoteur appelle le RPC et ne réalise plus séparément les écritures caméra/connecteur/audit ;
- replay complet et test SQL sur Supabase Replay requis avant clôture finale.

## Limites qui restent hors de cette phase

Aucun essai physique de passerelle ou caméra n'est simulé. Les flux ONVIF/RTSP, identifiants réels, vidéos, multiview temps réel, événements IA et sirène restent non validés sur équipement réel.  
Aucune migration Supabase Production et aucun déploiement ne sont inclus.
