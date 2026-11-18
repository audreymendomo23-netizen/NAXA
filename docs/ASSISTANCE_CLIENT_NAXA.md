# Assistance Client → NAXA et Livechat

## Objectif

Mettre à disposition du Client un canal de conversation directement adressé à l’équipe NAXA, accessible depuis un widget flottant et depuis la page complète `/assistance`. Ce canal est distinct de la conversation Client–pharmacie sur `/aide`.

- **Assistance NAXA** : compte, accès, problème technique, expérience, signalement, confidentialité et suggestions.
- **Chat pharmacie** : disponibilité, prix, fiches, stock, retrait, livraison ou prestations propres à une pharmacie.
- Aucun ticket de type `support_naxa` n'est attribué à une pharmacie ; son champ `pharmacie_id` reste `NULL`.

## FAQ et accès

La page `/faq` est un centre d’aide interactif :
- recherche textuelle sur les questions et réponses ;
- filtres par catégories ;
- compteurs de réponses ;
- questions dépliables ;
- informations sur les six espaces NAXA, les responsabilités des établissements, les commandes, la sécurité et l’assistance ;
- accès distinct au support NAXA et au chat pharmacie.

Le raccourci « Besoin d’aide ? » reste exclusivement dans le menu à trois points de l’en-tête Client. Son action utilise `notifierNAXA()` pour afficher un toast d’accueil avant la navigation vers `/faq`. Le message existant des écosystèmes verrouillés reste intact. Le widget Livechat est masqué sur la FAQ.

## Widget Livechat Client

- Bouton flottant jaune canari, en bas à droite, sur les routes du parcours Client des six écosystèmes.
- Visible uniquement pour une session authentifiée dont le profil est actif, de rôle Client et dont l’espace métier actif renvoie `client`.
- Masqué sur `/faq`, les routes professionnelles, l’administration, les pages d’authentification et l’accueil public.
- Sur les pages avec navigation basse, le bouton et le panneau sont positionnés au-dessus de la barre afin de ne pas masquer les onglets. Le bouton se replie lorsque le panneau est ouvert ; la fermeture reste accessible dans l’en-tête du panneau.
- Le panneau liste les 20 dossiers récents, permet de changer de conversation, d’ouvrir une demande et de répondre dans le fil actif.
- Le widget ne prétend pas qu’un agent est en ligne. Il indique uniquement si l’abonnement Supabase Realtime est connecté.
- Les messages restent conservés si le Client ferme le panneau ou perd temporairement la connexion. À la prochaine ouverture, le fil est relu depuis la base.
- Les pièces jointes sont gérées depuis la page complète `/assistance`, qui offre les mêmes dossiers et conversations ainsi que le dépôt de fichiers privés.

## Parcours et catégories

1. Le Client ouvre le widget ou `/assistance`.
2. Il sélectionne une catégorie : compte, technique, commande/réservation/livraison, signalement, confidentialité, suggestion ou autre.
3. Il indique un sujet (5 à 100 caractères) et un premier message (2 000 caractères maximum).
4. La base crée atomiquement le ticket et son premier message par `open_naxa_support_ticket` (SECURITY INVOKER, RLS appliquée).
5. Un numéro unique `NX-YYMM-#######` est attribué au dossier.
6. Le Client peut reprendre ses conversations, envoyer des réponses et consulter l’historique dans le widget ou dans `/assistance`.

## Pièces jointes

La page complète permet un fichier PDF/JPG/PNG/WebP de 4 Mio maximum. La signature du fichier est vérifiée côté serveur ; le bucket `naxa-support-attachments` est privé. Les liens d’accès sont signés pour 10 minutes. Les pièces jointes ne sont pas publiquement accessibles.

Le formulaire prévient explicitement de ne jamais transmettre de mot de passe, code OTP, coordonnées bancaires, pièce d’identité, ordonnance ou document médical. Les captures d'écran doivent être expurgées de toute donnée sensible.

## Cycle de vie

| Statut | Signification | Évolution |
|---|---|---|
| `ouvert` | Demande reçue | L’équipe NAXA peut la prendre en charge |
| `en_cours` | Traitement par NAXA | L’équipe peut répondre ou attendre le Client |
| `en_attente_client` | Une réponse NAXA est disponible | La réponse du Client remet le dossier en cours |
| `resolu` | L’équipe estime la demande résolue | Une réponse du Client rouvre le traitement |
| `ferme` | Dossier clôturé | Le Client ne peut plus y répondre ; il peut créer un nouveau dossier |

Les nouveaux dossiers et les réponses ultérieures du Client créent une notification in-app pour les Admins actifs. Les réponses Admin et changements de statut créent une notification Client avec accès direct au dossier. Aucune présence Admin ni aucun délai de réponse garanti ne sont simulés.

## Console Admin et Realtime

La page Admin `/admin/messagerie` est la boîte de réception commune :
- reçoit les dossiers `support_naxa` et les conversations historiques ;
- actualise sa liste lors de l’arrivée ou de la modification d’un dossier ;
- reçoit les nouveaux messages du fil sélectionné en temps réel ;
- permet prise en charge, attente Client, résolution, réouverture et clôture ;
- expose les pièces jointes via des URL signées générées côté serveur après vérification Admin actif.

La migration Livechat ajoute `tickets_support` et `messages_support` à la publication `supabase_realtime`. Les abonnements restent soumis aux politiques SELECT RLS. L’accès Admin aux tickets/messages exige le profil Admin actif et l’espace Admin sélectionné. Les Clients ne lisent que leurs dossiers et les messages publics ; les notes internes sont exclues. Les droits Client/pharmacie historiques restent couverts.

Les conversations de type `conseil_pharmacien` gardent leur parcours et leurs règles historiques.

## Données et sécurité

- Tables réutilisées : `tickets_support` et `messages_support`.
- Type dédié : `support_naxa`, différent de `conseil_pharmacien`.
- La création ticket + premier message est atomique dans une RPC SECURITY INVOKER ; les policies RLS client s'appliquent.
- Le ticket conserve le propriétaire Client et aucune pharmacie liée.
- Les réponses Client/Pharmacie restent contrôlées par RLS ; les notes internes ne sont pas visibles au Client.
- L’Admin passe par une API serveur vérifiant la session, le profil Admin actif et la fonction métier sélectionnée ; la clé service ne quitte jamais le serveur.
- Les pièces jointes sont conservées dans un bucket privé et limitées en taille, format, signature et chemin propriétaire.
- Les notifications de création/réponse Admin sont produites côté base ; les notifications Client de réponse/statut sont produites par l'API Admin.
- Il n’y a pas de transaction financière, de commission ou de paiement dans ce canal.
- Aucune notification e-mail ou SMS n'est promise par ce parcours.

## Validation avant ouverture générale

1. Migrations Assistance et Livechat appliquées sur Replay.
2. Tests SQL structurels Assistance et Livechat : PASS sur Replay.
3. Exécuter `npm test`, `npx tsc --noEmit`, `npm run lint` et `npm run build`.
4. Réaliser une recette navigateur Client ↔ Admin : création, notifications Admin, réponse instantanée, réponse Client, statuts, reconnexion et suivi widget/page.
5. Vérifier l’isolation RLS entre deux Clients, le refus pour Admin inactif ou espace Admin non sélectionné, l’absence de fuite de notes internes et le bucket privé.
6. Refaire le parcours historique `/aide` pour garantir la non-régression du chat Client–pharmacie.

Ne pas appliquer ces migrations à Production ni déployer sans autorisation explicite.
