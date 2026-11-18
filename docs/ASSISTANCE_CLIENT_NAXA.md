# Assistance Client → NAXA

## Objectif

Fournir au Client un canal écrit directement adressé à l’équipe NAXA. Ce canal est distinct de la conversation Client–pharmacie existante sur \`/aide\`.

- **Assistance NAXA** : compte, accès, problème technique, expérience, signalement, confidentialité et suggestions.
- **Chat pharmacie** : disponibilité, prix, fiches, stock, retrait, livraison ou prestations propres à une pharmacie.
- Aucun message d’assistance NAXA n'est attribué à une pharmacie ; le ticket garde \`pharmacie_id = NULL\`.

## Parcours Client

1. Depuis la FAQ, le Client ouvre « Écrire au support NAXA » sur \`/assistance\`.
2. Il choisit une catégorie : compte, technique, commande/réservation/livraison, signalement, confidentialité, suggestion ou autre.
3. Il ajoute un sujet et décrit le problème (2 000 caractères maximum).
4. Il peut joindre un seul fichier PDF/JPG/PNG/WebP de 4 Mio maximum.
5. À l’enregistrement, NAXA génère un numéro de référence \`NX-YYMM-#######\`.
6. Le Client retrouve ses 20 dossiers récents, ouvre le fil, lit les réponses et répond tant que le dossier n’est pas clôturé.

Le fil est chargé ticket par ticket. Les pièces jointes sont stockées dans le bucket privé \`naxa-support-attachments\`, et sont servies avec des URL signées de courte durée (10 minutes). Les fichiers ne sont pas publiquement accessibles.

## Catégories et précautions

Les catégories ne sont pas des niveaux de priorité. Le formulaire prévient explicitement de ne jamais transmettre de mot de passe, OTP, coordonnées bancaires, pièce d’identité, ordonnance ou document médical. Les captures d'écran doivent être expurgées de toute donnée sensible.

L’assistance NAXA concerne l’utilisation de la plateforme. Elle ne fournit ni diagnostic ni service d’urgence. Aucun délai de réponse n’est garanti.

## Cycle de vie

| Statut | Signification | Évolution |
|---|---|---|
| \`ouvert\` | Demande reçue | L’équipe NAXA peut la prendre en charge |
| \`en_cours\` | Traitement par NAXA | L’équipe peut répondre ou attendre le Client |
| \`en_attente_client\` | Une réponse NAXA est disponible | La réponse du Client remet le dossier en cours |
| \`resolu\` | L’équipe estime la demande résolue | Une réponse du Client rouvre le traitement |
| \`ferme\` | Dossier clôturé | Le Client ne peut plus y répondre ; il peut créer un nouveau dossier |

Les nouvelles demandes créent une notification in-app pour les profils Admin actifs, avec accès à la boîte de réception. Les réponses Admin et changements de statut créent une notification dans l’espace Client. Le statut et la date de dernière activité sont conservés sur le ticket.

## Console Admin

La page Admin \`/admin/messagerie\` reçoit aussi les tickets \`support_naxa\`, sans créer une seconde boîte de réception. L’équipe peut prendre en charge, mettre en attente Client, marquer résolu, rouvrir et clôturer. Les réponses sont écrites dans le fil d'origine. Les pièces jointes sont accessibles côté Admin par URL signée courte durée, générée côté serveur après vérification du rôle Admin actif.

Les conversations de type \`conseil_pharmacien\` gardent leur parcours et leurs règles historiques.

## Données et sécurité

- Tables réutilisées : \`tickets_support\` et \`messages_support\`.
- Type dédié : \`support_naxa\`, différent de \`conseil_pharmacien\`.
- Le ticket conserve le propriétaire Client ; la sélection du dossier est toujours limitée à ce propriétaire côté serveur et via RLS.
- RLS distingue l’insertion des tickets NAXA, les messages de l’auteur, et l’accès Storage par chemin lié au ticket.
- L'Admin passe par une API serveur contrôlant le profil Admin actif ; la clé service ne quitte jamais le serveur.
- Une pièce jointe est limitée par le bucket, par la validation serveur du MIME et de la signature du fichier, puis par la contrainte DB sur le type, le chemin et la taille.
- Les réponses Admin créent une notification in-app. Aucun envoi e-mail ni SMS n'est promis par ce parcours.
- Il n’y a pas de transaction financière, de commission ou de paiement dans ce canal.

## Vérifications restantes avant ouverture générale

La migration doit être appliquée et vérifiée sur Replay avant toute autre utilisation. Exécuter ensuite le test Node, le test SQL structurel, TypeScript, ESLint, build et un parcours navigateur Client/Admin avec compte réel de recette. Tester aussi les refus d’accès croisés, les fichiers invalides/trop volumineux, l’absence de fuite Storage, la reprise après résolution et la clôture.

Ne pas appliquer cette migration à Production ni déployer sans autorisation explicite.
