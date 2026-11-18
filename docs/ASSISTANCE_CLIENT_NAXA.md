# Assistance individuelle NAXA — Clients et professionnels

## Objectif

Mettre à disposition de chaque Client et de chaque compte professionnel actif un canal individuel directement adressé à l’équipe NAXA, accessible depuis un widget flottant et depuis la page complète `/assistance`. L’accès ne dépend pas du Promoteur ou du Responsable et ne nécessite aucune médiation hiérarchique. Ce canal est distinct de la conversation Client–pharmacie sur `/aide`.

- **Assistance NAXA** : compte, accès, problème technique, expérience, signalement, confidentialité, gestion d’espace, personnel, stock, caisse, commandes, livraison, abonnement et suggestions. Chaque demande appartient au compte qui l’a créée, même s’il est affecté à une structure.
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

La FAQ est accessible depuis l’en-tête du widget (« FAQ ») pour tous les comptes concernés et depuis le centre d’aide `/faq`. Le raccourci « Besoin d’aide ? » reste dans le menu à trois points de l’en-tête Client. Son action utilise `notifierNAXA()` pour afficher un toast d’accueil avant la navigation vers `/faq`. Le message existant des écosystèmes verrouillés reste intact. Le widget Livechat est masqué sur la FAQ.

## Widget Livechat Client et professionnel

- Bouton flottant jaune canari, en bas à droite, sur les routes du parcours Client des six écosystèmes et sur les espaces professionnels concernés.
- Client : session authentifiée, profil actif de rôle Client et espace métier actif `client`.
- Professionnel : session authentifiée, profil actif non Admin et fonction métier active non nulle, différente de `client` et `admin`, sur les routes professionnelles Pharmacie, Partenaire et Centre d’examens.
- Masqué sur `/faq`, les routes professionnelles, l’administration, les pages d’authentification et l’accueil public.
- Sur les pages avec navigation basse, le bouton et le panneau sont positionnés au-dessus de la barre afin de ne pas masquer les onglets. Le bouton se replie lorsque le panneau est ouvert ; la fermeture reste accessible dans l’en-tête du panneau.
- Le panneau liste les 20 dossiers récents, permet de changer de conversation, d’ouvrir une demande et de répondre dans le fil actif.
- Un professionnel peut contacter NAXA individuellement, sans accord préalable ni transmission au Responsable/Promoteur. Les autres membres de sa structure ne peuvent pas lire ses dossiers.
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

La migration Livechat ajoute `tickets_support` et `messages_support` à la publication `supabase_realtime`. Les abonnements restent soumis aux politiques SELECT RLS. L’accès Admin aux tickets/messages exige le profil Admin actif et l’espace Admin sélectionné. Chaque Client ou professionnel actif ne lit que ses propres dossiers et les messages publics ; les notes internes sont exclues. Un compte professionnel ne peut ni consulter ni répondre aux dossiers d’un collègue, même dans la même pharmacie ou structure. Les droits Client/pharmacie historiques restent couverts.

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

1. Migrations Assistance, Livechat et extension professionnelle appliquées sur Replay.
2. Tests SQL structurels Assistance et Livechat : PASS sur Replay.
3. Exécuter `npm test`, `npx tsc --noEmit`, `npm run lint` et `npm run build`.
4. Réaliser les recettes navigateur Client ↔ Admin et Promoteur/Livreur ↔ Admin : création, confidentialité individuelle, notifications, réponse instantanée, statuts, suivi widget/page et FAQ.
5. Vérifier l’isolation RLS entre deux Clients, le refus pour Admin inactif ou espace Admin non sélectionné, l’absence de fuite de notes internes et le bucket privé.
6. Refaire le parcours historique `/aide` pour garantir la non-régression du chat Client–pharmacie.

Ne pas appliquer ces migrations à Production ni déployer sans autorisation explicite.


## Addendum — Support NAXA multicanal et boîte Gmail officielle — 18/11/2026

Cet addendum est une décision métier postérieure et prioritaire pour le périmètre du support NAXA. Il complète les exigences existantes sans remplacer le Livechat, les appels audio prévus, le support téléphonique ni le fonctionnement WhatsApp actuel.

### Portes d'entrée et canaux

- Profil → Support dans les espaces Client et Professionnel ; Centre d'aide/FAQ ; widget et page complète d'assistance ; points d'entrée liés à une commande ou une réclamation.
- Livechat NAXA : canal natif, dossiers et messages conservés dans NAXA.
- Appels audio intégrés au Livechat : audio uniquement en V1, selon le routage hybride et les exigences du §226 de `docs/E2E_CONTINUITE.md`.
- Gmail NAXA : nouveau canal entrant/sortant intégré à la boîte centrale du support.
- WhatsApp : **fonctionnement externe actuel conservé exactement**, sans synchronisation, lecture ou import automatique des conversations dans NAXA. L'agent peut ouvrir WhatsApp selon le lien existant et consigner manuellement un suivi dans NAXA.
- Téléphone classique : appel vers le numéro officiel ; l'agent peut consigner un compte rendu dans le dossier, sans présenter cet appel comme un appel intégré.
- Les formulaires et réclamations créent ou alimentent un dossier NAXA traçable.

### Décision Gmail validée

- Une **boîte Gmail officielle unique NAXA**, connectée par l'Administrateur depuis les paramètres du support.
- Les Customer Service Assistants ne connectent pas leurs boîtes personnelles. Les agents autorisés accèdent aux emails assignés ou à la file autorisée depuis leur espace NAXA, selon leurs permissions.
- Réception et synchronisation des messages entrants, regroupement par fil Gmail, recherche, attribution, priorité, statut, réponse et réponse à tous selon droits, transfert si autorisé, pièces jointes et historique.
- Les réponses envoyées depuis NAXA partent de l'adresse Gmail officielle ; les réponses ultérieures doivent être rattachées au fil/dossier correspondant.
- Déduplication des messages, reprise après interruption, surveillance de l'état de synchronisation, traitement des erreurs, journalisation et possibilité pour l'Admin de reconnecter/déconnecter la boîte.
- Connexion par OAuth Google ; aucun mot de passe Gmail stocké ou demandé aux agents. Jetons protégés côté serveur, révocables et jamais exposés au navigateur, aux journaux ou au dépôt. Demander uniquement les autorisations Google strictement nécessaires aux fonctions effectivement implémentées ; documenter les scopes et leur justification avant connexion.
- Accès cloisonné : un agent ne consulte que les messages/dossiers autorisés. Les pièces jointes Gmail importées ou mises en cache dans NAXA sont privées, soumises à contrôle serveur/RLS et à des URL temporaires si nécessaire.
- Les emails reçus via Gmail ne doivent pas être confondus avec les notifications email sortantes du système : aucune notification e-mail client n'est réputée implémentée du seul fait de la connexion Gmail.
- Ne pas prétendre que WhatsApp est centralisé ni que les appels téléphoniques classiques sont intégrés.

### Boîte centrale et espace agent

La plateforme Customer Service Assistant regroupe les demandes NAXA, les conversations Livechat, les emails Gmail et les appels audio NAXA dans une interface de travail unifiée, avec indication visible du canal d'origine. Elle fournit file centrale, dossiers personnels, affectation/réaffectation, présence, charge, priorités, délais, notes internes distinctes des messages visibles, pièces jointes, historique, rapports et escalade Admin. Les agents traitent aussi les réclamations Client↔Pharmacie selon le §227 ; l'arbitrage final et la supervision restent à l'Administrateur.

Les canaux externes WhatsApp et téléphone ne sont pas artificiellement transformés en conversations synchronisées : leur suivi éventuel est consigné manuellement par un agent avec le canal, la date, le compte rendu et les éventuelles suites.

### Critères d'acceptation Gmail et multicanal

1. L'Admin connecte une seule boîte Gmail officielle par OAuth, peut vérifier l'état de connexion, renouveler l'autorisation, déconnecter et reconnecter.
2. Les emails entrants apparaissent dans la file centrale ; les doublons sont évités ; les fils sont correctement regroupés.
3. Un agent autorisé peut prendre un email, le lire, répondre depuis NAXA, joindre un fichier autorisé et retrouver la réponse dans le fil Gmail.
4. Un agent non autorisé ne peut lire, rechercher, télécharger, répondre ni obtenir les pièces jointes d'un dossier hors de son périmètre, y compris par API directe.
5. Les erreurs de synchronisation, jetons expirés/révoqués, pièces jointes interdites et indisponibilités sont gérés sans perte silencieuse ; la reprise est vérifiable.
6. Les actions de connexion, lecture sensible, attribution, réponse, transfert, téléchargement, déconnexion et changement de permission sont journalisées.
7. WhatsApp reste externe et inchangé : aucun import ou accès automatique n'est ajouté dans cette version.
8. Non-régression du Livechat, des appels audio, des dossiers/réclamations, de la FAQ, des notifications in-app et des accès Client/professionnels.
9. Tests isolés sur Replay, fixtures nettoyables, contrôles RLS/API/Storage et preuves reproductibles. Aucun compte Gmail personnel de test ne doit être ajouté au dépôt.
10. Aucun changement Production, aucune migration Production et aucun déploiement sans autorisation explicite.

### État

- Organisation Gmail officielle unique connectée par Admin : **DÉCISION VALIDÉE ; NON IMPLÉMENTÉE / NON TESTÉE**.
- WhatsApp externe conservé tel quel : **DÉCISION VALIDÉE ; aucun changement demandé**.
- Boîte unifiée, intégration Gmail, permissions agents et synchronisation : **À AUDITER / CONSTRUIRE / TESTER**.
- Cette décision complète les chantiers appels audio (§226), agents internes et litiges (§227), programme et audit initial (§228).
