# NAXA : cahier des charges compilé (version validée, mise à jour du 3 octobre 2026 : catalogue, panier, bandeau)

Document de référence. En cas de conflit avec un autre document, **le flyer client et ce document font foi**. Le plan en 5 points et les captures de l'archive ne servent que d'inspiration.

## 1. Identité
- **Nom** : NAXA
- **Slogan** : « Votre médicament, à 2 minutes. »
- **Promesse du flyer** : « Trouvez votre médicament en quelques secondes. »
- **Baseline** : « Une santé plus accessible pour tous au Cameroun »
- **Mission** : donner à chacun la meilleure information possible (disponibilité, prix, distance, temps de trajet) pour faire un choix objectif, qui peut sauver une vie. Réserver ou payer n'est jamais obligatoire.
- **Zone** : Yaoundé d'abord, puis Douala, puis tout le Cameroun.
- **Charte** : vert 50 %, jaune canari 30 %, blanc 20 %. Logo : N jaune sur fond vert. Prévoir une version fond blanc (N vert, texte vert foncé), une version monochrome et une icône d'application. Les codes couleur du projet sont estimés d'après le flyer : à remplacer par les codes exacts de la marque.
- **Langue et monnaie** : français, FCFA.

## 2. Acteurs
| Acteur | Rôle |
|---|---|
| Client | Se connecte, cherche ou scanne son ordonnance, compare, réserve et paie s'il le souhaite, retire en pharmacie. |
| Pharmacie | Compte créé et configuré par l'équipe NAXA, formée, puis **autonome** : stock, prix, réservations, statut « de garde ». |
| Équipe NAXA (admin) | Crée les pharmacies et leurs accès, migre leurs bases (Excel), forme, supervise. |

Les pharmacies ne s'inscrivent jamais seules. Elles ont leurs propres flyers, distincts du flyer client.

## 3. Parcours client
1. **Connexion** par e-mail avec un code reçu.
2. **Recherche** par nom ou par molécule (tolérante aux fautes, aux accents et aux synonymes) **ou scan d'ordonnance** : l'OCR lit la photo dans le navigateur, le client **vérifie et corrige** la liste lue (niveau de fiabilité affiché). En haut des pages, un **bandeau défilant « Les plus recherchés »** mène à la fiche des produits les plus demandés.
2 bis. **Fiche produit** : au clic sur un médicament, le client voit la **photo**, la description, à quoi il sert, les précautions, des « mots utiles » (dictionnaire), le nombre de pharmacies qui l'ont et le prix à partir de. Il peut l'**ajouter à son panier**.
2 ter. **Panier** : le client règle les quantités (1 à 10 par produit, 10 produits au plus) et lance « Trouver les pharmacies qui ont tout ». Le panier reste sur son téléphone.
3. **Résultats** : les pharmacies qui ont le ou les produits en stock **dans la quantité demandée**, avec prix total, distance, temps de trajet, fraîcheur du stock (« mis à jour il y a X min »), badges (Meilleur prix, Plus proche, Plus rapide, De garde).
4. **Classement** prix / distance / temps. Le client choisit sa priorité : Équilibré, Moins cher, Plus proche, Plus rapide. Les pharmacies qui ont **tout** passent avant celles qui n'ont qu'une partie.
5. **Itinéraire et circulation** : durée et distance par la route, et estimation de la circulation.
6. **Réservation (facultative)** : le stock (avec les quantités du panier) est mis de côté, un message WhatsApp prérempli selon le cas est envoyé à la pharmacie, qui valide.
7. **Paiement (facultatif)** par code marchand (MTN MoMo, Orange Money), puis reçu.
8. **Retrait en pharmacie.** Une réservation **non payée est annulée au bout de 3 h** et le stock est remis en vente.

## 4. Règles métier
- Pas de livraison, nulle part (ni fonctionnalité, ni statut, ni texte).
- Statuts de réservation : `en_attente`, `confirmee`, `payee`, `retiree`, `expiree`, `annulee`.
- Le stock diminue à la réservation et est restitué en cas d'annulation ou d'expiration.
- Une réservation non payée (en attente ou confirmée) expire après 3 h. Une réservation payée n'expire pas.
- **Le numéro WhatsApp de la pharmacie n'apparaît jamais dans l'interface ni dans le code client** : il est lu côté serveur, la redirection vers `wa.me` se fait par le serveur. Limite inévitable : une fois WhatsApp ouvert, le numéro est visible dans la conversation.
- La réponse WhatsApp de la pharmacie n'est pas lisible par l'application : la pharmacie **confirme aussi d'un clic** dans son panneau.
- Le code marchand n'est montré qu'au client propriétaire d'une réservation active.
- Aucune substitution de médicament sans validation du pharmacien. Mention permanente : information de disponibilité, pas un avis médical.
- **Fiches produits** : chaque fiche a une source (`aucune`, `bdpm`, `ia`, `admin`, `pharmacien`) et un état « relue » ou « en cours de relecture ». Un texte écrit avec l'IA n'est **jamais** présenté comme relu tant qu'un humain de l'équipe NAXA ne l'a pas validé. Aucune fiche n'indique de dose ni de durée de traitement. Mention permanente : information générale, pas un avis médical.
- **IA** : appelée uniquement côté serveur, uniquement par l'équipe NAXA (admin), uniquement pour rédiger un brouillon. Elle ne reçoit que nom, molécule, dosage et forme : jamais de donnée personnelle, jamais d'ordonnance, jamais de recherche d'un client. Le client n'interroge jamais l'IA en direct.
- **Photos** : ajoutées par l'équipe NAXA seulement (bucket `produits-photos`, 500 Ko max, compressées à 600 px). Uniquement des photos dont NAXA a les droits. Légende : « photo à titre indicatif ».
- **Panier** : stocké sur le téléphone (aucune donnée envoyée). Il ne remplace pas la réservation, qui reste facultative et valable 3 h.
- **Bandeau « Les plus recherchés »** : calculé sur les recherches des 7 derniers jours (sans identité ni position), complété par les produits disponibles dans le plus de pharmacies tant que les données sont rares. Ce n'est **pas** un espace publicitaire vendu : pas de sponsoring ni de produit payé pour apparaître. Si NAXA veut un jour vendre cet espace, c'est une nouvelle décision, avec la mention « Sponsorisé » et une règle d'équité à définir.
- **Accessibilité du bandeau** : bouton Pause, arrêt au survol et au clavier, aucun défilement si le téléphone réduit les animations.
- Le trafic en direct n'existe pas gratuitement au Cameroun : l'application affiche une **estimation selon l'heure**, toujours étiquetée « estimation ».

## 5. Architecture 100 % gratuite
| Besoin | Solution gratuite |
|---|---|
| Application | Next.js 14 (App Router) + TypeScript + Tailwind, PWA installable |
| Base de données, authentification, règles de sécurité | Supabase (Postgres, RLS, Auth par code e-mail) |
| Tâche planifiée (expiration 3 h) | `pg_cron` de Supabase |
| E-mails de connexion | SMTP gratuit (ex. Brevo), car l'envoi intégré de Supabase est très limité |
| Carte, itinéraire, durée | OpenStreetMap + OSRM public (usage léger) |
| Circulation | Estimation selon l'heure (règles locales, sans API) |
| OCR ordonnance | Tesseract.js dans le navigateur (l'image n'est jamais envoyée) |
| IA (brouillons de fiches) | Offre gratuite de Google Gemini (modèle Flash), appelée côté serveur par l'admin. Quotas et conditions à vérifier avant lancement (voir points de vigilance) |
| Photos de médicaments | Supabase Storage (gratuit, 1 Go à vérifier), photos fournies par NAXA |
| Dictionnaire et noms de médicaments | Table `dictionnaire` (mots simples) + import optionnel de la Base de données publique des médicaments (BDPM, Licence ouverte, France) |
| Panier | `localStorage` du navigateur (sur le téléphone) |
| « Les plus recherchés » | Table `recherche_events` + fonction SQL, mise en cache 10 minutes |
| Import du stock | SheetJS (fichiers Excel et CSV des anciens logiciels) |
| WhatsApp | Lien `wa.me` avec message prérempli |
| Paiement | Code marchand : affichage du code, saisie de la référence, confirmation par la pharmacie |
| Reçu | Page imprimable / PDF du navigateur |
| Hébergement | Voir les points de vigilance ci-dessous |

## 6. Données
`pharmacies` (publiques) · `pharmacie_privee` (WhatsApp, code marchand : accès serveur uniquement) · `produits` (catalogue partagé) · `stocks` (prix, quantité, péremption, date de mise à jour) · `reservations` et `reservation_items` · `profiles` (rôle client, pharmacie ou admin).
Ajouts de la migration 002 : colonnes de fiche sur `produits` (`photo_url`, `description`, `indications`, `precautions`, `synonymes`, `source_fiche`, `fiche_validee`, `fiche_maj`, `bdpm_cis`), table `dictionnaire`, table `recherche_events` (aucune lecture directe), fonctions `search_pharmacies_panier`, `log_recherche`, `produits_populaires`, et un déclencheur qui réserve l'écriture des fiches et des photos à l'admin.
Le schéma complet, les règles de sécurité et les fonctions (recherche, réservation, expiration) sont dans `supabase/schema.sql`.

## 7. Écrans du premier livrable
- Accueil client (inspiré du flyer) avec recherche, scan et bandeau « Les plus recherchés »
- Fiche produit (photo, description, panier) et page Panier
- Résultats classés
- Réservation, paiement guidé, reçu
- Connexion
- Panneau pharmacie : réservations, stock modifiable, import Excel, statut de garde
- Espace admin NAXA : création de pharmacie et de son accès, migration du stock, **fiches produits** (photo, textes, brouillon IA, relecture)

## 8. Hors périmètre du premier livrable
Livraison (**exclue définitivement**) · Patient Record et fidélisation · Prescription Tracking complet · Dashboard de données · paiement automatique par API MoMo / Orange Money · modèle économique (abonnements, frais) à trancher plus tard · publicité payante ou produits sponsorisés dans le bandeau · IA en direct pour les clients (diagnostic, conseil de dose).

## 9. Points de vigilance
1. **Hébergement** : vérifier les conditions du plan gratuit choisi. Le plan gratuit de Vercel est réservé à un usage non commercial (à vérifier sur leur page actuelle). Alternatives gratuites à étudier pour un usage commercial : Cloudflare Pages ou Netlify.
2. **Supabase gratuit** : taille de base limitée et mise en pause d'un projet inactif (à vérifier). Prévoir une activité régulière et des sauvegardes.
3. **OCR** : les ordonnances manuscrites sont souvent mal lues. D'où la vérification obligatoire par le client et la validation finale par le pharmacien.
4. **OSRM public** : adapté à un lancement. Au-delà, héberger son propre serveur de routage ou passer à une offre gratuite avec clé.
5. **Données personnelles** : les ordonnances et les achats de médicaments sont des données sensibles. Ne pas stocker les photos d'ordonnance, limiter les accès, et faire vérifier la conformité à la loi camerounaise sur la protection des données par un juriste.
6. **Qualité des stocks** : la confiance du client repose sur la fraîcheur du stock. Afficher la date de mise à jour et relancer les pharmacies qui ne mettent pas à jour.
7. **IA gratuite** : quotas faibles, pouvant changer sans préavis. Certaines conditions de l'offre gratuite excluent l'usage commercial ou autorisent l'usage des données pour l'entraînement (à vérifier sur la page officielle de Google avant le lancement). C'est pourquoi l'IA ne sert qu'à des brouillons, sans donnée personnelle, et que le site fonctionne sans elle.
8. **Exactitude médicale** : une IA peut se tromper ou inventer. Toute fiche doit être relue par un pharmacien avant d'être marquée « relue ». Prévoir un pharmacien relecteur.
9. **Photos** : n'utiliser que des photos prises par NAXA ou avec autorisation (les images trouvées en ligne et les fiches des laboratoires sont protégées). Les captures du dossier `NAXA.zip` sont des maquettes d'écrans, pas des photos de produits.
10. **BDPM** : base française, donc elle ne couvre pas tous les médicaments vendus au Cameroun. Licence ouverte : citer la source et la date de mise à jour, ne pas dénaturer les données.
11. **Bandeau « Les plus recherchés »** : les compteurs peuvent être gonflés par des recherches répétées (volontaires ou non). Surveiller et, si besoin, limiter. Au lancement, très peu de données : le bandeau affiche surtout les produits les plus disponibles.
12. **Hors-ligne du panneau pharmacie** : pas encore implémenté dans la base fournie (file d'attente locale à ajouter).

## 10. Feuille de route
1. **Fondations** : installer, brancher Supabase, lancer le schéma, corriger la compilation.
2. **Pharmacies pilotes** : créer 3 à 5 pharmacies, migrer leurs stocks, les former.
2 bis. **Catalogue** : importer les noms (BDPM ou stocks des pharmacies pilotes), prendre les photos des 50 produits les plus courants, faire relire les fiches par un pharmacien, vérifier les conditions de l'IA gratuite.
3. **Qualité** : hors-ligne du panneau pharmacie, tests, accessibilité, performance sur réseau lent.
4. **Lancement** : flyers client et pharmacie, QR code, suivi de la fraîcheur des stocks.
5. **Ensuite** : paiement automatisé, modules de fidélisation et d'ordonnances, extension à Douala.
