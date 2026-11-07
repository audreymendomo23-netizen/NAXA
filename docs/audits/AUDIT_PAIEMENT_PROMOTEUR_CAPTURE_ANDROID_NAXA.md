# Audit — capture Android du paiement Promoteur NAXA

Date : 7 novembre 2026  
Branche : `qa/e2e-stabilisation-20261106`  
Environnement de données autorisé : Supabase Replay `pwfftcsjyeibxxqhwysw`.

## Architecture livrée sur QA

- Le Promoteur déjà authentifié crée un paiement de 30 minutes avant de payer. Le montant est relu depuis son abonnement, le canal est choisi parmi les canaux mobile money actifs et la destination marchande est figée dans le paiement préparé.
- Un appareil Android doit s'enrôler au moyen d'une session Supabase du même compte Promoteur. Le serveur ne stocke que le hash d'un jeton d'appareil.
- Le compagnon transmet un événement de notification normalisé avec le même compte et le jeton lié au téléphone.
- Le serveur rapproche le canal, le montant FCFA et le bénéficiaire de la destination enregistrée. Une correspondance crée seulement une déclaration de règlement existante, avec statut `en_attente`, et déclenche la notification Admin déjà en place.
- Tout écart est conservé comme capture `mismatch` et envoyé vers `manual_review`; aucun règlement n'est soumis.
- Une notification Android n'est jamais une preuve d'encaissement. Seule la vérification indépendante par NAXA peut déclencher l'activation et le reçu.

## Endpoints

- `POST /api/promoteur/paiements/device/register` : enrôlement de l'appareil Android par le Promoteur connecté.
- `POST /api/promoteur/paiements/intent` : préparation avant paiement, liée à l'appareil actif.
- `POST /api/promoteur/paiements/capture` : réception des données normalisées d'une notification depuis le compagnon Android.

Contrat de capture : Bearer token de session Supabase du Promoteur, `deviceId`, jeton d'appareil, canal, référence de transaction, montant, devise `FCFA`, bénéficiaire normalisé, compte payeur masqué éventuel et date de transaction. Le compagnon ne doit jamais envoyer PIN, OTP ni le texte intégral de la notification.

## Limites constatées

- Le dépôt NAXA audité ne contient aucun projet Android/Kotlin/Java/Gradle ni service `NotificationListenerService`. Les endpoints et le contrat backend sont prêts, mais la capture réelle sur le téléphone ne sera activée qu'après intégration de ce contrat dans le compagnon Android natif.
- Aucune clé marchande MTN/Orange ou autorisation d'API opérateur n'est configurée dans le dépôt audité. La détection locale est donc un signal client à rapprocher, pas un callback opérateur authentifié.
- Le parcours manuel antérieur demeure disponible en secours.
- Aucun statut de paiement, abonnement ou pharmacie n'est confirmé par la capture Android.
- Les migrations sont destinées au Replay. Production n'est pas modifiée et aucun déploiement Vercel n'est lancé.

## Vérifications à exécuter

- Appliquer la migration sur Replay et vérifier les ACL/RLS.
- Exécuter les tests statiques du contrat et la CI groupée.
- Terminer le module Android natif puis tester sur un téléphone réel les notifications MTN et Orange, les cas montant/destination incorrects, les doublons et l'absence de notification.
- Tester ensuite le rapprochement d'un paiement réel via API opérateur ou compte marchand avant d'autoriser une automatisation plus forte.
