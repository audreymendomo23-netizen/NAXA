# NAXA Paiement Android — architecture pilote

La référence métier est [l'architecture de paiement pilote](../../docs/ARCHITECTURE_PAIEMENT_PILOTE.md).

## Variantes privées

Le même code produit deux APK privées, sans Play Store :

| APK | Comptes | Autorisation SMS |
|---|---|---|
| Standard `cm.naxa.paymentcompanion` | Client et Promoteur | Aucune permission `RECEIVE_SMS` |
| Admin `cm.naxa.paymentcompanion.admin` | Administrateur uniquement | `RECEIVE_SMS` avec consentement NAXA + autorisation Android |

La variante Standard reçoit les SMS uniquement lorsque la personne choisit explicitement **Partager → NAXA Paiement**. Elle permet de choisir la commande (Client) ou l'intention d'abonnement préparée (Promoteur), d'extraire les données prises en charge, puis de compléter ou corriger les champs avant transmission.

## Parcours Client → Pharmacie

1. Le Client règle la commande auprès de la pharmacie.
2. Depuis son SMS de débit, il choisit Partager → NAXA Paiement.
3. Le compagnon propose ses commandes de livraison qui attendent le paiement.
4. Il préremplit numéro, montant, date et référence lorsque ces éléments existent dans le SMS. Le montant par défaut est celui de la commande et la date par défaut est l'heure locale `Africa/Douala`.
5. Le Client vérifie et transmet. NAXA conserve les champs déclarés et une empreinte SHA-256 du texte partagé, jamais le corps SMS brut.
6. Pendant le pilote, la pharmacie vérifie le crédit réellement reçu et confirme manuellement dans sa Caisse. La confirmation passe toujours par le ticket POS lié à la commande ; le SMS du Client ne suffit pas à encaisser.

En l'absence de SMS, le Client peut saisir les détails manuellement. Le montant et la date sont préremplis, mais restent modifiables et sont marqués comme générés ou saisis manuellement.

## Parcours Promoteur → NAXA

1. Le Promoteur se connecte dans la variante Standard.
2. Il choisit Orange Money ou MTN MoMo et prépare l'intention d'abonnement sur son téléphone.
3. Après le transfert, il partage son SMS de débit avec NAXA Paiement.
4. Le compagnon extrait les champs disponibles, préremplit le montant de l'abonnement et la date locale si le SMS ne fournit pas l'heure, puis transmet la déclaration.
5. Le téléphone Administrateur capte automatiquement le SMS de crédit si et seulement si le consentement NAXA, la permission Android et l'identifiant opérateur exact sont tous valides.

La confirmation automatique exige deux preuves indépendantes sur la même référence : déclaration de débit Promoteur issue du partage et crédit reçu/capturé par Admin. Une déclaration manuelle, un SMS Admin seul ou une correspondance ambiguë restent en revue Admin.

L'Administrateur peut également partager manuellement son SMS de crédit en secours. Cet événement est toujours classé en revue manuelle et ne déclenche jamais à lui seul l'auto-confirmation.

## Consentement et restriction Android — Admin uniquement

La variante Admin présente une case de consentement explicite, conservée dans le coffre chiffré Android Keystore. Après enrôlement et consentement, elle demande séparément la permission Android `RECEIVE_SMS`. Le récepteur vérifie à nouveau le rôle `admin`, le consentement, la permission et le canal autorisé avant extraction et juste avant l'envoi réseau.

Android classe `RECEIVE_SMS` comme permission dangereuse et *hard-restricted*. L'installateur doit l'autoriser dans l'allowlist de permissions restreintes. Le simple téléchargement APK, le transfert Bluetooth ou le réglage « installer des applications inconnues » ne garantissent pas cette allowlist. Tester les installateurs et appareils cibles ; ne jamais désactiver Play Protect ni contourner Android. Si l'autorisation est refusée, utiliser le partage manuel du SMS Admin ou la confirmation manuelle.

## Configuration technique

- Android Gradle Plugin 9.4.0 ; Gradle CI 9.6.0 ; JDK 17.
- compileSdk 36 ; targetSdk 36 ; minSdk 26.
- Version 1.3.0 (versionCode 4).
- Kotlin intégré à AGP ; JUnit 4.13.2.
- Le workflow compile, teste et assemble `standardDebug` et `adminDebug`. Les APK du workflow sont des APK **Debug** internes, non signés Release et non destinés à la distribution pilote.
- Les essais réels de partage depuis les applications SMS, les autorisations d'installation Admin, et les tests avec de vrais SMS Orange/MTN restent nécessaires avant distribution.

## Endpoints utilisés

- Promoteur : `POST /api/promoteur/paiements/device/register`, `POST /api/promoteur/paiements/intent`, `POST /api/promoteur/paiements/share`.
- Client : `GET /api/client/paiements/livraison/pending`, `POST /api/client/paiements/livraison/share`.
- Admin auto : `POST /api/admin/paiements/device/register`, `POST /api/admin/paiements/capture`.
- Admin secours : `POST /api/admin/paiements/share` (revue manuelle uniquement).

Aucun SMS brut n'est conservé par les nouveaux endpoints de partage. Le serveur conserve les champs extraits/déclarés et, lorsque le message a été partagé, son empreinte SHA-256 afin de détecter une réutilisation identique sans archiver le texte intégral.
