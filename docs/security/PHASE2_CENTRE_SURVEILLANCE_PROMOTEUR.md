# Phase 2 — Centre de surveillance Promoteur

Date : 7 novembre 2026  
Branche : `qa/e2e-stabilisation-20261106`  
État : interface multi-caméras construite ; flux réels non activés.

## Accès latéral

Le menu latéral de l’espace Promoteur expose l’entrée **Sécurité**, avec l’icône caméra, vers `/pharmacie/promoteur/securite`. L’ancienne route et le contrôle d’accès Promoteur sont conservés.

## Parcours utilisateur construit

- Sélecteur **Toutes mes pharmacies** ou une pharmacie du réseau actif.
- Grille de surveillance de quatre emplacements (2 × 2), lisible sur téléphone.
- Pagination par groupes de quatre lorsque le réseau comporte plus de caméras.
- Appui sur une vignette pour ouvrir la vue détaillée de la caméra.
- Navigation précédente/suivante dans les caméras du périmètre sélectionné.
- Affichage des états de connexion, du registre d’installation et des événements enregistrés.
- Les listes proviennent des équipements et événements déjà enregistrés ; aucune caméra ou alerte de démonstration n’est inventée.

## Sécurité et limites explicites

Les données restent filtrées côté serveur par les identifiants des pharmacies actives rattachées au Promoteur. Le composant client ne reçoit pas d’URL de flux, d’identifiant de secret ou d’identifiant de connexion sensible.

Les tuiles sont des emplacements d’interface et non des images vidéo. Le statut « connexion testée » décrit uniquement l’état du connecteur enregistré ; il ne signifie pas que le lecteur vidéo fonctionne. Aucun faux flux n’est rendu.

## Non livré dans cette phase

- Découverte réseau réelle et drivers ONVIF / RTSP / SDK fabricant.
- Passerelle locale et gestion sécurisée des identifiants.
- Création de sessions de lecture signées et diffusion live.
- Relecture, clips, transcodage adaptatif et économie de bande passante.
- Détection IA réellement exécutée, notifications Android et commandes de sirène.
- Recette navigateur, Android et matériel physique.

Les adaptateurs du registre conservent leur état `design_only` tant qu’un modèle, un firmware et ses fonctions n’ont pas été testés sur un appareil réel.

## Test de contrat

Le test `scripts/test-promoteur-security-multiview.cjs` vérifie le menu latéral, la route, le filtre pharmacie, la grille 2 × 2, la pagination, la navigation caméra et l’absence de balise vidéo simulée. Il est inclus automatiquement dans `npm test` via le glob `scripts/test-*.cjs`.

Ce test statique ne remplace ni la compilation Next.js, ni le test navigateur, ni la validation du flux avec caméra réelle.

## Déclaration d'inventaire — complément

Le Promoteur peut désormais déclarer une caméra depuis le module Sécurité :
- sélection d'une pharmacie de son réseau actif ;
- sélection d'une passerelle déjà déclarée ou création d'une fiche de passerelle à configurer ;
- marque, modèle, firmware, zone et canal/identifiant de recorder ;
- création automatique du dossier d'installation au statut `inventory` s'il n'existe pas ;
- nouvelle passerelle au statut `not_configured` et caméra au statut `registered` ;
- journal append-only de l'action `device_update`.

L'action serveur vérifie l'identité Promoteur, l'état du compte, le statut contractuel, le rattachement actif et l'activité/visibilité de la pharmacie. Elle vérifie aussi que la passerelle sélectionnée appartient à la pharmacie. Les statuts de connexion et les capacités ne sont jamais renseignés par l'utilisateur.

Aucun mot de passe, token, URI RTSP, URL, secret de coffre ou hôte réseau n'est accepté dans ce formulaire. La déclaration ne configure pas les pilotes et ne connecte pas le matériel. Si le journal ne peut pas confirmer l'opération après création, l'écran signale explicitement cet état au lieu d'afficher une réussite complète.
