# Architecture d’accès aux écosystèmes NAXA

**État : code visuel intégré sur main — déploiement Production et recette fonctionnelle à confirmer.**

## Parcours d’ouverture

1. L’application affiche l’animation d’ouverture NAXA.
2. À la fin de l’animation, le visiteur déclare être majeur ou l’accès est bloqué.
3. Après validation de majorité, NAXA affiche le sélecteur d’écosystème.
4. Le choix est mémorisé dans le navigateur et dans le cookie `naxa-ecosysteme`.
5. Pharmacie ouvre l’accueil public existant, avec la recherche de médicaments sans authentification.
6. Les autres écosystèmes sont des parcours Client protégés : sans session, le middleware redirige vers l’authentification et conserve la destination demandée.

Le choix mémorisé permet le retour direct vers le dernier écosystème à la prochaine ouverture. Le lien « Changer d’écosystème » de la connexion permet de revenir au sélecteur.


## Identité visuelle et descriptions

Les six écosystèmes partagent une mosaïque visuelle optimisée issue des images fournies. Chaque vignette est réutilisée sur le sélecteur, l’en-tête Client et les bandeaux des pages métier, avec un voile coloré pour maintenir le contraste des textes.

| Espace | Nature | Description affichée | Illustration |
|---|---|---|---|
| Pharmacie | Autonome | Médicaments et pharmacies | Rayons de pharmacie |
| Parapharmacie | Autonome | Hygiène et bien-être | Produits de parapharmacie |
| Bébé & Maman | Connecté | Offres reliées aux publications Pharmacie et Parapharmacie | Articles bébé et maternité |
| Dispositifs connectés | Connecté | Suivi connecté, non catalogue commercial autonome | Appareils de suivi personnel |
| Examens médicaux | Autonome | Laboratoires et analyses | Laboratoire médical |
| Soins & Prestations à domicile | Autonome | Services et accompagnement | Accompagnement à domicile |

Ressource : `public/images/ecosystemes/ecosystemes.webp` (mosaïque 3 × 2, afin de réduire les requêtes réseau distinctes).

Les illustrations proviennent de l’archive fournie pour cette intégration. La provenance initiale et les licences d’exploitation n’étaient pas jointes au lot ; elles restent à confirmer avant toute diffusion commerciale des visuels.

## Écosystèmes et routes Client

| Espace | Nature | Route Client | Thème |
|---|---|---|---|
| Pharmacie | Autonome | `/` (public), puis `/client` si Client connecté | Vert NAXA |
| Parapharmacie | Autonome | `/parapharmacie` | Turquoise |
| Bébé & Maman | Connecté | `/bebe-maman` | Rose |
| Dispositifs connectés | Connecté | `/suivi` | Bleu |
| Examens médicaux | Autonome | `/examens` | Violet |
| Soins & Prestations à domicile | Autonome | `/prestations` | Corail |

L’identité Client est commune. Les données, historiques, réservations et paniers métier restent cloisonnés selon les modules existants. Bébé & Maman et Dispositifs connectés sont des espaces complémentaires reliés aux parcours principaux, pas des univers commerciaux autonomes : les stocks Bébé & Maman restent chez leur propriétaire Pharmacie ou Parapharmacie, et Dispositifs connectés relève du suivi de santé. Le changement d’espace ne confère aucun rôle ou droit professionnel. Le portail catalogue partagé conserve le slug sélectionné dans l’URL ; le middleware utilise ce contexte pour appliquer le verrou global de l’espace correspondant.

## Verrouillage administrateur

- Le sélecteur et le menu de changement utilisent `GET /api/universes/status`.
- Cette route lit le registre public `public.universes` avec la clé anon ; elle ne consulte ni n’expose une clé de service.
- Le middleware vérifie également le registre pour les URL directes des parcours Client et des portails Examens/Soins à domicile. La policy publique existante ne renvoie que les lignes actives ; absence de ligne ou impossibilité de vérifier = accès refusé.
- Le refus renvoie au sélecteur avec l’identifiant de l’écosystème verrouillé.
- Pharmacie reste le parcours public de référence et n’est pas contrôlée par ce verrou.

Cette intégration suppose que le registre `public.universes` et sa policy de lecture anon soient présents dans l’environnement Supabase. Aucun changement de base n’est appliqué par cette intégration.

## En-tête et navigation

Le composant `EnTeteClient` est partagé par les routes Client authentifiées des six espaces. Le logo, la recherche, les notifications et le menu conservent leur structure. La couleur et l’accroche changent selon l’espace. Le sélecteur initial présente toujours les six choix ; le menu trois points exclut l’espace courant, respecte le verrouillage Admin et mémorise le changement. Les espaces connectés portent une qualification visible distincte.

Sur les routes communes du Client (`/client`, réservations partagées et FAQ `/faq`), le thème conserve l’espace sélectionné. « Besoin d’aide ? » ouvre la FAQ NAXA (`/faq`) et n’est pas un écosystème. Le chat écrit avec une pharmacie reste disponible séparément sur `/aide`.

Le panier actuellement branché à `BoutonPanierEntete` reste visible uniquement dans Pharmacie. Parapharmacie et Maman & Bébé utilisent un panier distinct (`naxa-universe-cart-v1`) ; il ne faut pas les connecter au panier Pharmacie tant qu’un accès d’en-tête dédié n’a pas été réalisé.

## Accès professionnel

La connexion Client des autres écosystèmes affiche « Accès professionnel » en haut à droite. Le raccourci conserve l’écosystème et revient vers son portail existant :

- Parapharmacie : `/partenaire/catalogue?ecosysteme=parapharmacie`
- Maman & Bébé : `/partenaire/catalogue?ecosysteme=bebe-maman`
- Examens : `/centre-examens`
- Soins à domicile : `/partenaire/prestations`
- Dispositifs médicaux : `/suivi/professionnel`

Le mode professionnel masque l’auto-inscription Client. L’authentification passe par le contrôle d’identité existant et les portails restent responsables de vérifier les rôles, affectations et périmètres. Aucun privilège n’est ajouté. Le portail professionnel Dispositifs médicaux conserve sa restriction actuelle aux comptes autorisés de test ; ce raccourci ne signifie pas que ce portail est prêt pour une ouverture générale.

La connexion professionnelle Pharmacie reste inchangée.

## Contrôles et limites

- Contrôle statique des fichiers touchés et des routes ciblées effectué pendant cette passe.
- Pour le lot visuel : contrôle statique des modifications effectué. Tests Node, TypeScript, ESLint, build Next.js et recette navigateur à confirmer sur le commit livré.
- Aucune migration ni écriture Supabase n’est nécessaire pour le lot visuel. Le déploiement Vercel et sa recette runtime restent à confirmer.
- L’activation réelle de chaque espace dépend de l’état effectif de `public.universes` dans l’environnement Supabase ciblé.
