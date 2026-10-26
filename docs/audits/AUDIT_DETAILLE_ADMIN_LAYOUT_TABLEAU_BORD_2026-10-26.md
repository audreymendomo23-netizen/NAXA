# Étape 2 — Audit détaillé Admin NAXA : layout partagé et tableau de bord
Date : 26 octobre 2026
Branche de référence : `main`
Périmètre de cette passe : `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/components/admin/AdminNavigation.tsx`, `src/lib/admin/require-admin-active.ts`, `src/components/admin/CatalogueCreation.tsx` et le début de `src/app/admin/actions.ts`.
Méthode : lecture statique des fichiers sur GitHub. Aucun navigateur, compte utilisateur, parcours d’écriture métier ou test automatisé n’a été exécuté. Aucune migration ni donnée métier n’a été modifiée.

## 1. Contrôle d’accès partagé

Le layout serveur appelle `requireAdminActive("/admin")` avant de rendre l’espace. Le garde récupère l’utilisateur authentifié via `auth.getUser()`, lit `profiles.role, actif`, puis refuse tout compte qui n’a pas exactement `role === "admin"` et `actif === true`. Les erreurs de lecture du profil sont traitées en refus, ce qui est le comportement sûr par défaut. Le garde retourne ensuite le client Supabase serveur et l’utilisateur.

**Évaluation statique : garde d’entrée cohérent et fail-closed.** Cela ne prouve pas encore la sécurité des actions serveur, API, appels RPC ni l’accès direct à chaque page ; ces points doivent être contrôlés individuellement et testés ultérieurement.

## 2. Layout partagé et compteurs

Le layout lit en parallèle :
- les pharmacies (`id, stock_updated_at, actif, visible_recherche`) ;
- la RPC `validites_promoteurs_admin` ;
- les tickets ouverts dans `tickets_support`.

Il signale une disponibilité partielle lorsqu’une de ces sources échoue. C’est préférable à présenter les compteurs comme complets. Les erreurs ne sont toutefois pas détaillées à l’utilisateur, ce qui limite le diagnostic sans exposer les messages internes.

### Constat LAY-01 — calcul des alertes répété dans le dashboard
Le layout calcule un badge d’alertes depuis les pharmacies et la RPC de validité. Le tableau de bord refait des lectures et recalcule des alertes à partir de données proches. Les règles visibles paraissent globalement alignées aujourd’hui, mais deux implémentations distinctes risquent de diverger et les deux pages peuvent observer des instantanés différents.

**Sévérité : moyenne (maintenabilité/cohérence).** Proposition : définir une fonction serveur partagée pour le calcul des signaux, avec état explicite « complet/partiel/indisponible », ou une RPC agrégée si cela correspond à l’architecture existante. Ne pas entreprendre cette refonte avant de vérifier les autres pages d’alertes et les tests de non-régression.

### Constat LAY-02 — chargement non paginé de toutes les pharmacies dans le layout
La requête charge toutes les pharmacies et le code calcule ensuite les signaux en mémoire. Le tableau de bord charge lui aussi la liste complète. À mesure que le réseau grandit, ces lectures dupliquées augmentent le coût serveur et la latence de toutes les pages Admin, car le layout est partagé.

**Sévérité : moyenne, dépend du volume réel.** Proposition : mesurer le volume, puis envisager des agrégats côté base/RPC et des projections limitées. Aucun seuil de performance n’a été mesuré pendant cet audit ; ce n’est pas présenté comme une régression mesurée.

### Constat LAY-03 — états d’erreur partielle
Le layout conserve des compteurs à zéro quand une source échoue, mais active un avertissement global « compteurs partiels ». Le badge de tickets peut donc ne pas apparaître si le décompte échoue ; l’avertissement empêche de prendre le zéro pour une valeur fiable. Le booléen `afficherAlertes` est toujours vrai dans le code consulté : il est inutile, mais sans effet fonctionnel identifié.

**Évaluation : garde-fou de disponibilité présent ; simplification mineure possible.**

## 3. Tableau de bord

Le dashboard gère explicitement les erreurs de lecture des pharmacies, de la validité et du journal. En cas d’erreur, il affiche un message d’indicateurs partiels et évite de présenter le total des alertes comme complet. Il précise qu’une absence de date de stock n’est pas une preuve de rupture, distinction métier correcte.

Les valeurs principales comptent les pharmacies retournées, les stocks horodatés, les pharmacies sans horodatage et les quartiers distincts. Elles sont des indicateurs descriptifs et ne doivent pas être interprétées comme des stocks disponibles, une couverture médicale effective ou un nombre de pharmacies actives.

### Constat DASH-01 — en-tête visuel dupliqué dans la zone de contenu
Le layout affiche déjà une barre supérieure contenant l’identité « NAXA / ADMINISTRATION », les raccourcis alertes/messagerie et le sélecteur d’espace. La page `/admin` rend en plus son propre bandeau vert avec le logo et un deuxième `EspaceNaxaSwitcher`. Il existe donc deux en-têtes/sélecteurs sur le tableau de bord, alors que les autres pages héritent du layout partagé.

**Sévérité : moyenne (cohérence UX).** À confirmer visuellement dans un navigateur avant correction de présentation. Correction candidate : retirer le bandeau local du dashboard si aucune exigence de design contraire n’existe, en conservant le shell partagé. Non modifié dans cette passe.

### Constat DASH-02 — valeurs potentiellement trompeuses en cas d’échec
Si la requête des pharmacies échoue, `pharmacies` devient `null` puis `listePharmacies=[]`, et plusieurs cartes calculées affichent alors zéro. Le bandeau « Indicateurs partiels » et le texte du panneau d’alertes avertissent l’utilisateur, mais les KPI eux-mêmes continuent à montrer des nombres. Il faut vérifier que le contexte visuel ne donne pas à ces zéros l’apparence de valeurs réelles.

**Sévérité : moyenne (interprétation des indicateurs).** Proposition : représenter explicitement les KPI dont la source a échoué comme « Indisponible » plutôt que 0, et ne calculer les dérivés que si la source est disponible. À confirmer avec le contrat visuel du dashboard.

### Constat DASH-03 — liste de pharmacies sans pagination
La page charge toutes les pharmacies et les passe à `CatalogueCreation`, qui filtre les options côté client pour le rattachement Bébé & Maman. Cette approche est simple pour un petit réseau, mais n’est pas bornée et duplique le chargement effectué par le layout.

**Sévérité : moyenne, liée au volume.** Revoir après mesure du volume et audit des autres consommateurs de la liste.

## 4. Création depuis CatalogueCreation et action creerPharmacie

Le composant propose cinq parcours : Pharmacie, Parapharmacie, Bébé & Maman, Examens médicaux et Prestations. Il présente le dossier comme étant en attente de vérification et précise que la création ne publie pas automatiquement le catalogue. Le formulaire transmet la création à des actions serveur ; l’action pharmacie rappelle le garde Admin avant de valider les champs et d’utiliser le client Supabase privilégié. La validation de coordonnées, du téléphone, de l’âge minimum, du tarif entier positif et de l’architecture est effectuée côté serveur, ce qui est nécessaire même si les champs HTML ont leurs propres contraintes.

La création pharmacie est une suite de plusieurs écritures : création Auth, pharmacie inactive/non publiée, informations privées, documents reçus, profil Promoteur inactif, convention, architecture, abonnement et rattachement. En cas d’échec, le code tente une compensation et journalise les échecs de compensation. Cette compensation n’est pas une transaction atomique : les erreurs de suppression peuvent laisser des données résiduelles, malgré les logs. Ne pas annoncer que la création est atomique.

### Constat CAT-01 — case « KYC » visible mais non transmise dans l’écriture des documents reçus
Dans `CatalogueCreation.tsx`, la liste des cases inclut `["kyc", "Know Your Customer (KYC)"]`. Dans `creerPharmacie`, l’insertion dans `pharmacie_documents_recus` enregistre les champs légaux listés, mais ne lit pas `formData.get("kyc")`. La case est donc visible dans le formulaire, mais sa valeur n’est pas enregistrée par cette action.

**Sévérité : élevée pour la fidélité du dossier documentaire ; défaut statique confirmé dans le chemin formulaire/action.** Avant correction, vérifier le schéma live et les migrations pour déterminer si une colonne KYC existe ou si le concept doit être représenté dans un autre modèle. Ne pas ajouter une colonne ou changer le modèle documentaire sans cette vérification.

### Constat CAT-02 — compensation multi-étapes non atomique
Le code appelle plusieurs suppressions en parallèle, puis supprime la pharmacie et le compte Auth. Il journalise les échecs mais ne garantit pas que chaque suppression réussisse. Les références étrangères, triggers ou autres tables liées peuvent également empêcher une compensation complète.

**Sévérité : élevée pour la fiabilité opérationnelle, impact non reproduit.** Proposition : inventorier les contraintes et triggers, puis préférer une RPC transactionnelle pour les écritures relationnelles lorsque possible ; garder la création Auth séparée avec une stratégie de compensation contrôlée et une procédure de reprise. Ne pas refondre sans tests de non-régression et vérification des dépendances.

### Constat CAT-03 — convention et abonnement initialisés « actifs » pour un dossier encore inactif
L’action crée une convention `statut: "active"` et un abonnement `statut: "actif"`, avec dates à 14 jours, alors que la pharmacie, le profil Promoteur, l’architecture et le rattachement sont explicitement créés inactifs/non publiés. La validité effective dépend d’autres conditions (notamment profil et lien actifs), mais les statuts commerciaux isolés peuvent être interprétés comme une activation déjà accordée.

**Sévérité : élevée sur la clarté de la machine à états ; risque à vérifier.** Comparer au contrat métier des dossiers en attente et aux RPC de validation/renouvellement avant de proposer une transition de statut. Aucun statut n’a été modifié par l’audit.

## 5. Navigation Admin

Le composant de navigation compare `usePathname()` à l’URL exacte de chaque entrée. L’entrée active est marquée par `aria-current="page"`. Pour les routes enfants comme `/admin/promoteurs/partenaires/[id]` et `/admin/pilotage/rapports`, seule la correspondance exacte de l’entrée déclarée est considérée active ; les sous-pages qui n’ont pas une entrée propre peuvent donc perdre le repère de section active.

**Constat NAV-01 — état actif strictement exact.** Sévérité faible à moyenne (orientation). Vérifier les pages enfants et choisir une règle de préfixe qui évite que `/admin` soit marqué actif pour toutes les routes sans provoquer de chevauchement entre `/admin/pilotage` et ses enfants.

## 6. Registre des points ouverts de cette passe

| ID | Point | Statut |
|---|---|---|
| LAY-01 | Calcul des alertes dupliqué entre layout et dashboard | Confirmé statiquement ; correction différée |
| LAY-02 | Chargement complet et dupliqué des pharmacies | Confirmé statiquement ; impact performance non mesuré |
| LAY-03 | Compteurs partiels signalés mais non détaillés | Garde-fou présent ; amélioration possible |
| DASH-01 | Bandeau/logo/sélecteur dupliqué sur le dashboard | Confirmé dans le code ; rendu visuel à confirmer |
| DASH-02 | KPI à zéro si source pharmacies indisponible | Confirmé statiquement ; risque d’interprétation atténué par avertissement |
| DASH-03 | Liste complète des pharmacies chargée sans pagination | Confirmé statiquement ; impact dépend du volume |
| CAT-01 | Case KYC visible mais absente de l’insertion documentaire | Défaut statique confirmé ; schéma à vérifier avant correction |
| CAT-02 | Compensation de création non atomique | Confirmé statiquement ; échec réel non reproduit |
| CAT-03 | Convention/abonnement actifs pour dossier initial inactif | Contradiction d’états apparente ; contrat métier à confirmer |
| NAV-01 | Élément de navigation actif seulement sur égalité exacte | Confirmé statiquement ; vérifier les routes enfants |

## 7. Prochaine cible

Poursuivre sans branche ni déploiement avec les pages **Alertes réseau**, **Journal d’administration** et **Messagerie**, puis les dossiers Promoteurs et les pages de pilotage. Pour chaque point de sécurité ou transition commerciale, distinguer la lecture statique d’un test réel et ne pas modifier les migrations ou statuts métier sans vérifier le schéma et les invariants existants.
