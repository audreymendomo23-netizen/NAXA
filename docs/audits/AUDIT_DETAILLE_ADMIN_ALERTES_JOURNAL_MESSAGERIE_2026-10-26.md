# Étape 2 — Audit détaillé Admin NAXA : alertes, journal et messagerie
Date : 26 octobre 2026. Référence : `main`.
Méthode : lecture statique des pages, du composant de messagerie et de l’API. Aucun ticket n’a été modifié, aucun message envoyé, aucun test HTTP ou navigateur exécuté.

## Alertes réseau
La page lit les pharmacies et `validites_promoteurs_admin`, puis calcule les stocks sans date, les pharmacies inactives/masquées et les échéances impayées/dépassées. Elle avertit quand une source échoue.

- **ALT-01 — compteurs ambigus en cas d’erreur.** Les données en erreur sont remplacées par des listes vides ; les cartes affichent donc zéro malgré l’avertissement global. Afficher « Indisponible » pour les sources défaillantes et éviter un message d’absence d’alertes si la RPC a échoué. Confirmé statiquement ; pas de correction.
- **ALT-02 — liste non paginée.** Toutes les pharmacies sont chargées sans limite. Impact de performance non mesuré ; envisager agrégation ou pagination après mesure.

## Journal d’administration
Le journal limite la lecture aux 200 événements les plus récents et masque le contenu brut de `metadata`, en affichant seulement le nombre de champs. Les erreurs de lecture et l’état vide sont différenciés.

- **JOUR-01 — acteur affiché sous forme d’UUID.** C’est peu lisible pour l’exploitation ; amélioration ergonomique possible, sans joindre inutilement des données personnelles.
- **JOUR-02 — filtres absents.** La limite de 200 est annoncée clairement. Des filtres par période/action/entité peuvent être ajoutés si le besoin opérationnel est confirmé.

## Messagerie
La page charge jusqu’à 100 tickets, puis tous les messages liés à ces tickets, dans l’ordre chronologique. Les réponses passent par l’API serveur. Le composant marque les messages internes visuellement.

- **MSG-01 — historique potentiellement volumineux.** Tous les messages des tickets chargés sont envoyés au client sans pagination visible. Impact non mesuré ; envisager le chargement du fil sélectionné à la demande.
- **MSG-02 — limites contradictoires.** Le textarea autorise 5 000 caractères, mais l’API refuse au-delà de 2 000. L’utilisateur peut soumettre un message que l’interface autorise mais que le serveur rejette. Aligner les limites, sans retirer la validation serveur.
- **SEC-MSG-01 — contrôle d’activation incohérent.** Le garde canonique `requireAdminActive` exige `profile.actif === true`. L’API messagerie refuse seulement `profile.actif === false`; un profil Admin avec `actif = null` ne serait donc pas refusé par cette condition. La condition est confirmée dans le code ; la possibilité de ce cas dépend du schéma et des données. Correction candidate : appliquer le contrat strict du garde commun, en conservant des réponses HTTP 401/403 adaptées à l’API.
- **SEC-MSG-02 — client privilégié.** L’API utilise `supabaseAdmin()` pour lire le ticket et insérer le message ; elle dépend donc fortement de la garde serveur. Le point précédent doit être traité avant de considérer ce parcours comme cohérent.
- **SEC-MSG-03 — tickets fermés.** L’API refuse explicitement de répondre à un ticket dont le statut n’est pas `ouvert` (409). Le statut n’est pas modifié après réponse ; vérifier si cela correspond au contrat métier, sans présumer d’un défaut.

## Registre
| ID | Constat | Statut |
|---|---|---|
| ALT-01 | Zéro affiché si source indisponible | Confirmé statiquement |
| ALT-02 | Chargement non paginé | Confirmé ; impact non mesuré |
| JOUR-01 | UUID acteur peu lisible | Amélioration possible |
| JOUR-02 | Pas de filtres de recherche | Limitation actuelle |
| MSG-01 | Tous les messages chargés en une fois | Confirmé ; impact non mesuré |
| MSG-02 | UI 5 000 / API 2 000 caractères | Incohérence confirmée |
| SEC-MSG-01 | `null` actif non refusé par la condition API | Divergence confirmée |
| SEC-MSG-02 | Opérations privilégiées tributaires de la garde | Priorité de contrôle |
| SEC-MSG-03 | Ticket non fermé après réponse | Contrat métier à confirmer |

## Suite
Priorités proposées : (1) aligner la garde d’activation de l’API messagerie et vérifier le cas `actif=null`, (2) aligner les limites de longueur, (3) vérifier le modèle documentaire KYC de la création pharmacie, (4) auditer les dossiers Promoteurs et les actions de validation/réactivation.

Aucune modification de code, écriture métier ou migration n’a été effectuée dans cette passe. Ce rapport est une analyse statique, pas une certification fonctionnelle ou de sécurité.
