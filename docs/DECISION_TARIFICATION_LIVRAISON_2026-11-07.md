# Décision métier — Tarification progressive des livraisons NAXA

**Décision confirmée : 7 novembre 2026**  
**Périmètre :** livraison nationale, devis client, géorepérage, commission et grand livre.

## 1. Distance routière : barème progressif

Le calcul se fait côté serveur à partir de la distance routière réelle entre la pharmacie et les coordonnées GPS de destination. Le prix marginal au kilomètre augmente à mesure que le trajet s’allonge.

| Tranche de distance | Tarif marginal |
|---|---:|
| De 0 à 2,5 km inclus | Forfait de 1 500 FCFA |
| Au-delà de 2,5 km à 5 km | 100 FCFA/km |
| Au-delà de 5 km à 10 km | 150 FCFA/km |
| Au-delà de 10 km à 20 km | 200 FCFA/km |
| Au-delà de 20 km à 50 km | 250 FCFA/km |

Les kilomètres sont calculés au prorata de chaque tranche et le résultat est arrondi au FCFA le plus proche.

### Exemples du tarif progressif avant majoration de zone

| Distance routière | Tarif progressif |
|---:|---:|
| 1,5 km | 1 500 FCFA |
| 2,5 km | 1 500 FCFA |
| 3 km | 1 550 FCFA |
| 5 km | 1 750 FCFA |
| 7 km | 2 050 FCFA |
| 10 km | 2 500 FCFA |
| 15 km | 3 500 FCFA |
| 20 km | 4 500 FCFA |
| 25 km | 5 750 FCFA |
| 50 km | 12 000 FCFA |

## 2. Catégorie géographique et majoration

La destination GPS du Client est comparée à des cercles géographiques configurés et activés par l’Administration. Le Client ne sélectionne pas sa catégorie tarifaire.

| Zone | Majoration initiale proposée | Règle de plafond |
|---|---:|---|
| Standard | 0 FCFA | Plafond de 3 500 FCFA |
| Périurbaine | +300 FCFA | Plafond de 3 500 FCFA |
| Éloignée | +700 FCFA | Dépassement des 3 500 FCFA autorisé |
| Accès difficile | +1 200 FCFA | Dépassement des 3 500 FCFA autorisé |

Les majorations sont configurables par l’Administration, entre 0 et 5 000 FCFA. Les montants de ce tableau sont les valeurs initiales proposées par NAXA, modifiables selon les observations terrain.

En cas de chevauchement de géofences, la catégorie la plus contraignante est appliquée dans l’ordre : accès difficile, éloignée, périurbaine. Les devis déjà créés conservent le tarif et la catégorie enregistrés au moment du calcul.

**Une destination qui n’appartient à aucun cercle configuré reste en zone standard.** Elle ne reçoit pas automatiquement une majoration sur la seule base d’un nom de localité approximatif. La couverture des zones spéciales dépend donc de leur configuration et de leur vérification par l’Administration.

### Exemples après majoration

| Trajet | Calcul | Prix Client |
|---|---|---:|
| 3 km · standard | 1 550 + 0 | 1 550 FCFA |
| 10 km · périurbaine | 2 500 + 300, plafonné | 2 800 FCFA |
| 20 km · standard | 4 500, plafonné | 3 500 FCFA |
| 20 km · éloignée | 4 500 + 700 | 5 200 FCFA |
| 20 km · accès difficile | 4 500 + 1 200 | 5 700 FCFA |

## 3. Commission NAXA

Pour chaque livraison effectivement terminée et confirmée par le Client et le Livreur :

- Commission NAXA fixe : **500 FCFA**.
- Solde affecté au service de livraison : tarif Client − 500 FCFA.
- La commission est incluse dans le tarif affiché au Client ; elle n’est jamais ajoutée une seconde fois.

Exemple : une livraison en zone éloignée à 20 km coûte 5 200 FCFA. NAXA reçoit 500 FCFA et le solde livraison est de 4 700 FCFA.

## 4. Visibilité et sécurité

- **Client :** seul le prix total de livraison apparaît dans le devis et le paiement.
- **Promoteur :** consulte ses commissions acquises, réglées et à régler dans son périmètre.
- **Administration :** consulte les commissions et configure les zones géographiques.
- La zone, la distance routière, la majoration et la version de formule sont figées dans le devis serveur et recopiées dans le grand livre lors de la livraison terminée.
- Le devis est lié au Client authentifié, à la pharmacie, aux coordonnées GPS et expire après dix minutes.
- Les prix et distances transmis par le navigateur ne peuvent pas remplacer le devis serveur.
- Le rayon opérationnel maximal reste celui configuré pour chaque pharmacie (1 à 50 km). Le contrôle financier technique accepte les nouveaux tarifs jusqu’à 20 000 FCFA ; le barème actuel reste inférieur à cette limite.

## 5. État de construction

- Barème progressif implémenté dans `src/lib/delivery-pricing.ts`.
- Détection de zone par géorepérage GPS implémentée côté serveur.
- Interface Admin de création, activation et désactivation des zones intégrée à `/admin/livraisons`.
- Migration des règles, des devis et du grand livre appliquée sur Supabase Replay.
- Aucune migration Supabase Production et aucun déploiement Production n’ont été effectués.
- Le barème est opérationnel dans les zones configurées ; les zones non encore géorepérées restent en tarif standard jusqu'à vérification et paramétrage Admin.

**Branche de travail :** `qa/e2e-stabilisation-20261106`.


## 6. Décision de lancement — barème gelé au 7 novembre 2026

Le barème progressif et les suppléments de zone ci-dessus sont **gelés pour le lancement QA**. Pas de tarification dynamique liée à la demande, à la pluie ou à l'heure. Les suppléments restent paramétrables par l'Administration dans le cadre du modèle déjà défini ; une destination sans géorepérage spécifique demeure standard.

### Règle d'affichage opposable

La carte de proximité ne calcule ni ne présente plus de prix de livraison indicatif. Elle informe que le tarif sera déterminé par le devis officiel. Le seul montant présenté au Client provient de `/api/livraison/devis`, calculé côté serveur avec distance routière et règle de zone. Un échec du calcul routier bloque le devis : il ne déclenche aucun ancien tarif de secours.

### Contrôle de cohérence et recette

- La recherche nationale et le devis doivent utiliser une seule source de vérité tarifaire : `src/lib/delivery-pricing.ts` et le devis serveur.
- La commission NAXA reste fixe à 500 FCFA, incluse dans le prix total, comptabilisée seulement après livraison finalisée et paiement confirmé.
- Le GPS du Client sert à calculer le trajet ; le GPS de la pharmacie doit être stocké sur la fiche de cette pharmacie. Ces coordonnées ne remplacent pas les géorepérages de classification tarifaire.
- Une zone non configurée reste standard ; elle n'empêche ni la recherche nationale ni l'itinéraire.
- La validation E2E d'un trajet réel reste conditionnée à l'existence d'une pharmacie partenaire active, publiée et géolocalisée, ainsi qu'à un trajet routier disponible. Les données de démonstration ne constituent pas une preuve terrain.

**État attendu après correction QA :** aucun champ `fraisLivraisonIndicatifs`, aucun calcul `1000 + distanceKm * 200`, aucun affichage « Livraison estimée » dans la recherche de pharmacies. Le devis officiel reste l'unique source du prix.
