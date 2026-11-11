# Architecture d’accès aux écosystèmes NAXA

**État : intégration source préparée — recette fonctionnelle et déploiement non réalisés.**

## Parcours d’ouverture

1. L’application affiche l’animation d’ouverture NAXA.
2. À la fin de l’animation, le visiteur déclare être majeur ou l’accès est bloqué.
3. Après validation de majorité, NAXA affiche le sélecteur d’écosystème.
4. Le choix est mémorisé dans le navigateur et dans le cookie `naxa-ecosysteme`.
5. Pharmacie ouvre l’accueil public existant, avec la recherche de médicaments sans authentification.
6. Les autres écosystèmes sont des parcours Client protégés : sans session, le middleware redirige vers l’authentification et conserve la destination demandée.

Le choix mémorisé permet le retour direct vers le dernier écosystème à la prochaine ouverture. Le lien « Changer d’écosystème » de la connexion permet de revenir au sélecteur.

## Écosystèmes et routes Client

| Écosystème | Route Client | Thème |
|---|---|---|
| Pharmacie | `/` (public), puis `/client` si Client connecté | Vert NAXA |
| Parapharmacie | `/parapharmacie` | Turquoise |
| Examens médicaux | `/examens` | Violet |
| Soins à domicile | `/prestations` | Corail |
| Maman & Bébé | `/bebe-maman` | Rose |
| Dispositifs médicaux | `/suivi` | Bleu |

L’identité Client est commune. Les données, historiques, réservations et paniers métier restent cloisonnés selon les modules existants. Le changement d’écosystème ne confère aucun rôle ou droit professionnel.

## Verrouillage administrateur

- Le sélecteur et le menu de changement utilisent `GET /api/universes/status`.
- Cette route lit le registre public `public.universes` avec la clé anon ; elle ne consulte ni n’expose une clé de service.
- Le middleware vérifie également le registre pour les URL directes des parcours Client et des portails Examens/Soins à domicile. La policy publique existante ne renvoie que les lignes actives ; absence de ligne ou impossibilité de vérifier = accès refusé.
- Le refus renvoie au sélecteur avec l’identifiant de l’écosystème verrouillé.
- Pharmacie reste le parcours public de référence et n’est pas contrôlée par ce verrou.

Cette intégration suppose que le registre `public.universes` et sa policy de lecture anon soient présents dans l’environnement Supabase. Aucun changement de base n’est appliqué par cette intégration.

## En-tête et navigation

Le composant `EnTeteClient` est partagé par les routes Client authentifiées des écosystèmes. Le logo, la recherche, les notifications et le menu conservent leur structure. La couleur, l’accroche et une transition courte changent selon l’écosystème. Le menu trois points exclut l’écosystème courant, respecte le verrouillage Admin et mémorise le changement.

Sur les routes communes du Client (`/client`, réservations partagées), le thème conserve l’écosystème sélectionné.

Le panier actuellement branché à `BoutonPanierEntete` reste visible uniquement dans Pharmacie. Parapharmacie et Maman & Bébé utilisent un panier distinct (`naxa-universe-cart-v1`) ; il ne faut pas les connecter au panier Pharmacie tant qu’un accès d’en-tête dédié n’a pas été réalisé.

## Accès professionnel

La connexion Client des autres écosystèmes affiche « Accès professionnel » en haut à droite. Le raccourci conserve l’écosystème et revient vers son portail existant :

- Parapharmacie / Maman & Bébé : `/partenaire/catalogue`
- Examens : `/centre-examens`
- Soins à domicile : `/partenaire/prestations`
- Dispositifs médicaux : `/suivi/professionnel`

Le mode professionnel masque l’auto-inscription Client. L’authentification passe par le contrôle d’identité existant et les portails restent responsables de vérifier les rôles, affectations et périmètres. Aucun privilège n’est ajouté. Le portail professionnel Dispositifs médicaux conserve sa restriction actuelle aux comptes autorisés de test ; ce raccourci ne signifie pas que ce portail est prêt pour une ouverture générale.

La connexion professionnelle Pharmacie reste inchangée.

## Contrôles et limites

- Contrôle statique des fichiers touchés et des routes ciblées effectué pendant cette passe.
- Tests Node, TypeScript, ESLint, build Next.js et recette navigateur non exécutés : aucun environnement local/repo exécutable n’était disponible dans cette passe.
- Aucune migration, écriture Supabase, publication de version ou action Vercel n’a été réalisée.
- L’activation réelle de chaque espace dépend de l’état effectif de `public.universes` dans l’environnement Supabase ciblé.
