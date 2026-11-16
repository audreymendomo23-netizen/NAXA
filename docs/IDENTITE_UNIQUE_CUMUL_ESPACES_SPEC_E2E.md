# Identité NAXA unique — cumul des espaces et recette de bout en bout

Date : 16 novembre 2026  
Branche de référence : `main`  
Audit statique de référence : `b21d89927f4f894289f3463162ce342b6f6ec394`

## 1. Décision fonctionnelle à appliquer

Une personne possède une seule identité NAXA / `auth.uid()`. Cette identité conserve son espace Client personnel et peut recevoir plusieurs rattachements professionnels indépendants. Un seul espace est actif à la fois ; le sélecteur ne fait qu'activer une affectation déjà autorisée et ne crée aucun droit.

L'obtention, la suspension ou la révocation d'un rôle professionnel ne doit pas supprimer ni suspendre automatiquement l'espace Client. Une suspension globale de sécurité ou une obligation légale peut toutefois bloquer l'identité entière selon une décision distincte et traçable.

Les données et activités restent cloisonnées : achats, ordonnances et données de santé du Client ne sont pas visibles par l'employeur ; les données et missions SPD ne sont pas visibles par le Promoteur de pharmacie sauf partage explicite, nécessaire et autorisé. Les guards serveur et RLS doivent appliquer ce cloisonnement, pas seulement l'interface.

## 2. Circuit de cumul obligatoire dans les deux sens

### Pharmacie → SPD

1. La personne authentifiée demande l'ouverture de son rattachement professionnel SPD sur son identité existante.
2. Le serveur détermine toutes les affectations pharmacie actives et non expirées de cette identité, quel que soit le rôle (Promoteur, Responsable, Pharmacien, Gestionnaire Stock, Caisse, Comptable, Livreur ou autre rôle assigné).
3. NAXA crée une demande de cumul en attente et une approbation distincte pour chaque pharmacie/Promoteur concerné.
4. Chaque Promoteur reçoit une notification in-app durable. L'échec du push ne supprime jamais la demande.
5. Chaque Promoteur peut accepter ou refuser uniquement pour une pharmacie qu'il gère encore et pour laquelle son autorité est active au moment de la décision.
6. Un seul refus entraîne le refus final. L'absence de réponse reste en attente, sans acceptation implicite.
7. Lorsque toutes les approbations sont positives, le dossier est transmis à l'Administrateur NAXA pour contrôle d'identité, de statut professionnel, d'habilitations et de conformité réglementaire.
8. Le rattachement SPD n'est créé/activé qu'après décision Admin positive et contrôles requis. L'accord Promoteur n'est jamais une dérogation légale ou déontologique.
9. Le candidat qui est lui-même Promoteur ne peut pas s'auto-autoriser ; arbitrage Admin et contrôles renforcés.

### SPD → Pharmacie

1. Lorsqu'une personne ayant déjà un rattachement SPD demande une affectation pharmacie, le système identifie le rattachement SPD actif.
2. La demande d'affectation pharmacie suit le même mécanisme d'approbation : notification et décision du responsable habilité de l'espace SPD, puis contrôles Admin lorsque requis par les règles métier.
3. Aucune affectation pharmacie ne devient active avant la totalité des accords requis.
4. Un refus bloque la demande ; l'absence de réponse maintient l'attente.
5. Les mêmes protections s'appliquent aux changements d'affectation, réactivations et nouvelles pharmacies. Un rôle historique dans `profiles` ne contourne jamais le circuit.

### Révocation / retrait

- La révocation d'une affectation pharmacie déclenche un recalcul transactionnel des autres affectations pharmacie actives de la personne.
- Si aucune affectation pharmacie active ne subsiste, le verrou de cumul pharmacie est levé ; le compte Auth et l'espace Client ne sont pas supprimés.
- La révocation d'un rattachement SPD ne révoque pas les autres espaces professionnels ni l'espace Client.
- Les sessions/contexte professionnel doivent être invalidés ou recalculés immédiatement ; les API et RLS doivent refuser l'ancien contexte.
- Les décisions et motifs sont historisés ; une demande déjà décidée ne peut pas être rejouée par double clic ou concurrence.

## 3. Architecture technique cible

### Source de vérité

Les affectations explicites et leur état effectif constituent la source de vérité. `profiles.role`, `profiles.pharmacie_id` et les rôles historiques peuvent rester des champs de compatibilité pendant migration, mais ne doivent pas être l'autorité unique pour décider du cumul ou des permissions.

Le sélecteur doit lire les espaces réellement accessibles depuis les affectations actives, non expirées et validées. Il doit présenter Client comme espace disponible dès que le dossier Client est complet et autorisé, même si le profil racine historique porte un rôle professionnel. Les espaces SPD, centres d'examens, parapharmacie et autres univers doivent être typés explicitement, pas rabattus sur une catégorie générique.

### Modèle de données à confirmer avant migration

Auditer d'abord les tables, contraintes, index, triggers, RPC et notifications existants. Ne pas créer de doublon si une structure d'approbation équivalente existe déjà.

Le modèle logique requis comporte :
- une demande de cumul : identité cible, univers source/destination, type d'opération, état, demandeur, dates, motif et décision finale ;
- des approbations enfant : organisation concernée, décideur attendu, état pending/approved/rejected, dates et motif ;
- une clé d'idempotence ou contrainte unique empêchant plusieurs demandes actives équivalentes ;
- une trace d'audit des transitions.

Les transitions doivent être atomiques dans des RPC `SECURITY DEFINER` avec `search_path='' `, validation de `auth.uid()`, contrôle de l'autorité courante, verrouillage des lignes concernées (`FOR UPDATE`) et refus des décisions obsolètes. Les clients ne doivent jamais pouvoir écrire directement les états d'approbation.

### Notifications

Réutiliser la table et la chaîne de notifications NAXA déjà présentes (in-app, outbox/distribution, FCM). Écrire la notification durablement dans la même transaction que la création de la demande ; la livraison push est asynchrone et ne conditionne pas la validité de la demande.

### Sélecteur et activation

Le composant existant `src/components/EspaceNaxaSwitcher.tsx` doit devenir un sélecteur universel :
- Client permanent et indépendant des affectations pro ;
- une entrée par organisation/espace pro autorisé ;
- SPD comme espace distinct ;
- libellé d'organisation et fonction active ;
- sélection via RPC serveur qui vérifie à nouveau l'affectation et son état ;
- redirection vers la destination de l'univers ;
- aucune création ou élévation de droit depuis le menu.

La sélection doit être atomique et révoquer le contexte précédent. Un seul espace actif à la fois, y compris entre onglets/appareils selon la stratégie de session retenue.

## 4. Contradictions constatées dans le code actuel (audit statique)

Au HEAD audité :
1. `src/components/EspaceNaxaSwitcher.tsx` déclare des espaces Client, pharmacie et parapharmacie, mais aucun espace SPD. Le Client est ajouté seulement si `profile.role === "client"` et `profile.actif === true`, ce qui ne garantit pas la conservation de l'espace Client pour une identité dont le rôle historique est professionnel.
2. `src/app/api/auth/login/route.ts` refuse globalement `profile.actif !== true` avant de distinguer l'espace demandé. Cette règle doit être séparée entre statut de l'identité, statut Client et statut des affectations professionnelles ; une révocation pro ne doit pas bloquer le Client.
3. `src/app/admin/creation-univers-actions.ts` appelle `auth.admin.createUser()` pour créer un dossier d'univers. Cela crée une nouvelle identité Auth au lieu de rattacher la personne existante, contrairement à l'identité unique.
4. `src/app/pharmacie/affectations/actions.ts` appelle directement `naxa_grant_professional_assignment` ou `naxa_grant_livreur_assignment` après recherche de profil ; le flux ne vérifie pas un cumul SPD existant avant activation.
5. `src/app/partenaire/affectations/actions.ts` appelle directement `naxa_grant_partner_professional_assignment` ; le flux ne vérifie pas le cumul pharmacie existant ni les approbations de Promoteurs.
6. L'avant-projet `docs/AVANT_PROJET_IDENTITE_UNIQUE_ESPACES_NAXA.md` reconnaît déjà que le modèle livré ne supporte pas encore plusieurs rôles/affectations arbitraires par personne.

Ces constats sont des lectures de code, pas des tests d'exécution. Aucun correctif applicatif, migration SQL, appel Supabase ou parcours navigateur n'a été exécuté dans le cadre de cet audit statique.

## 5. Séquence d'implémentation et critères de sortie

### Lot A — audit de schéma (bloquant avant migration)
- inventorier les migrations et tables liées aux affectations pharmacie, affectations partenaires, membres partenaires, dossiers univers, notifications et audit ;
- relever les définitions exactes des RPC `naxa_select_active_role`, `naxa_business_function`, `naxa_active_role_pharmacy`, `naxa_active_role_partner`, des RPC grant/revoke et des policies RLS ;
- vérifier le statut global du profil et les usages de `profiles.actif` ;
- décider du modèle canonique sans dupliquer les tables existantes.

### Lot B — modèle cumul et RPC
- migration additive et réversible autant que possible ;
- RPC demande, liste des approbations, décision Promoteur/organisation, décision Admin, refus final, recalcul et révocation ;
- idempotence, concurrence, expiration et révocation d'un Promoteur en cours de demande ;
- grants minimaux et RLS deny-by-default.

### Lot C — parcours utilisateurs
- création de dossier SPD sur identité Auth existante ; aucune création Auth silencieuse ;
- parcours inverse d'affectation pharmacie ;
- notifications in-app et push ;
- écrans de demandes en attente et décisions Promoteur ;
- console Admin pour les dossiers entièrement approuvés ;
- sélecteur universel et maintien de l'espace Client.

### Lot D — sécurité et non-régression
- guards serveur sur pages/actions/API ;
- RLS séparée pour SELECT/INSERT/UPDATE/DELETE ;
- accès direct par URL et API après révocation ;
- cloisonnement Client/pharmacie/SPD ;
- invalidation de contexte et multi-appareils ;
- aucune donnée Client personnelle visible par l'employeur.

### Lot E — recette E2E Replay
Utiliser exclusivement le projet Replay `pwfftcsjyeibxxqhwysw`. Ne jamais utiliser Production, ne créer aucun compte temporaire en Production et ne lancer aucun déploiement.

Scénarios obligatoires :
1. Un même `auth.uid()` possède Client + rôle Gestionnaire Stock pharmacie + SPD après approbations : connexion et bascule dans les trois espaces.
2. Pharmacie → SPD : notification de chaque Promoteur et demande persistante.
3. Deux pharmacies : acceptation du premier et attente du second ; aucun accès SPD avant le dernier accord.
4. Refus d'un Promoteur : refus global, aucune affectation SPD.
5. Promoteur silencieux : état pending, aucune activation implicite.
6. Promoteur révoqué/perte du réseau pendant la demande : décision refusée comme obsolète, réévaluation des approbations attendues.
7. SPD → pharmacie : affectation bloquée jusqu'à approbation SPD.
8. Révocation d'une seule pharmacie parmi plusieurs : autres affectations conservées ; cumul toujours verrouillé tant qu'une pharmacie reste active.
9. Révocation de la dernière affectation pharmacie : espace Client conservé et demande SPD possible.
10. Révocation SPD : Client et pharmacie conservés.
11. Utilisateur Promoteur candidat : aucune auto-approbation.
12. Deux décisions concurrentes / double clic : une seule transition réussie.
13. Utilisateur non autorisé tente d'approuver, lire les demandes d'une autre organisation ou modifier directement les tables : refus DB/RLS.
14. Session ancienne, onglet ouvert et API directe après révocation : refus.
15. Confidentialité : employeur ne lit ni achats, ni ordonnances, ni données de santé Client ; Promoteur ne lit pas les missions SPD non partagées.
16. Régression Client : accueil, recherche, favoris, panier, scanner/ordonnance, achats/réservations, profil et notifications restent accessibles après ajout/retrait d'un rôle professionnel.

Pour chaque scénario, conserver la preuve du run, l'identité Auth (sans secret), les états SQL avant/après, les assertions HTTP/JWT et le nettoyage Replay. Les identités de test doivent être des fixtures explicitement marquées Replay, jamais des identités de Production.

## 6. État et point de reprise

- Audit de code statique : **effectué partiellement** sur le HEAD `b21d89927f4f894289f3463162ce342b6f6ec394`.
- Architecture et règles métier : **spécifiées** dans ce document.
- Migration / RPC cumul : **non implémentées**.
- Sélecteur universel / login : **non corrigés**.
- Parcours pharmacie↔SPD : **non implémentés**.
- Tests unitaires dédiés cumul : **non ajoutés**.
- E2E Replay de ce chantier : **non exécutée**.
- Production et déploiement : **non touchés**.

**Point exact de reprise : Lot A.** Inspecter les migrations et définitions SQL réellement présentes sur `main` pour les tables d'affectation, les notifications et les RPC de sélection/grant/revoke. Ne pas écrire de migration avant cet inventaire, ne pas activer de dossier SPD, et ne pas déclarer le chantier vert.


## 7. Audit SQL Replay — constat de cause racine (16 novembre 2026)

Lecture en base Replay `pwfftcsjyeibxxqhwysw` en lecture seule ; aucune ligne métier modifiée.

### Schéma observé
- `naxa_profile_active_roles` possède une clé par profil : le principe « un espace actif à la fois » est déjà matérialisé.
- La contrainte de cette table permet les scopes `pharmacie_id` ou `partner_id`, mais le résolveur partenaire reste spécialisé.
- `naxa_professional_account_domains.domain_code` est limité par CHECK à `PHARMACIE` et `PARAPHARMACIE`.
- `naxa_roles` ne contient actuellement que les rôles système et les fonctions professionnelles Pharmacie ; aucun rôle SPD n'est déclaré.
- `naxa_partner_professional_assignments` existe et référence `naxa_roles`.
- `notifications` possède un destinataire `user_id`, un périmètre pharmacie et des outbox e-mail/push ; les alertes Promoteur peuvent donc être persistées par destinataire, sous réserve d'un événement métier et d'une politique d'accès adaptés.

### Fonctions SQL vérifiées
- `private.naxa_partner_business_function` joint explicitement `partners.partner_type='parapharmacie'`, le domaine `PARAPHARMACIE` et `naxa_partner_architectures`. Il ne résout aucun espace SPD.
- `public.naxa_select_active_role` n'autorise `partner_id` que si le partenaire est de type Parapharmacie, avec architecture active et domaine `PARAPHARMACIE`.
- `private.naxa_partner_scope_allows` applique la même restriction.
- `public.naxa_grant_partner_professional_assignment` n'accepte que les partenaires de type Parapharmacie et appelle `naxa_ensure_professional_account_domain(...,'PARAPHARMACIE')`.
- `public.admin_create_partner_dossier` exige une identité Client complète et confirmée. Pour un abonnement initial non courant, cette fonction exécute `update profiles set actif=false` : le verrou commercial peut ainsi rendre indisponibles tous les espaces de cette identité. Cette mutation doit être retirée du statut global d'identité et remplacée par des gardes d'accès propres au partenaire.
- `public.naxa_grant_professional_assignment` crée directement l'affectation Pharmacie après les contrôles de périmètre et de privilège ; aucune orchestration transversale de cumul SPD n'est présente dans cette fonction.

### Conclusion SQL
Le sélecteur mono-espace est une base réutilisable, mais le modèle de domaine et les fonctions partenaires doivent être généralisés. La séparation identité active / abonnement partenaire est un prérequis de sécurité et de continuité Client. Aucun RPC de demande/approbation de cumul n'a été trouvé dans les fonctions inspectées.

**Aucun test E2E de cumul n'a été lancé.** Les requêtes ci-dessus sont des lectures de catalogue SQL et de définitions de fonctions ; elles ne prouvent pas encore le comportement par des utilisateurs Replay.


## 8. Précision du modèle SPD existant

Le SPD ne s'appuie pas actuellement sur `naxa_partner_professional_assignments` comme la Parapharmacie. Les espaces Soins à domicile sont construits autour de :
- `partners.partner_type='professionnel_domicile'` ;
- `partner_members` avec les rôles `owner`, `manager`, `operator` ;
- `partner_independent_agreements` pour l'accord indépendant personnel du titulaire ;
- `home_service_offers`, `home_service_requests`, `home_service_reminder_preferences` et leurs politiques RLS.

La page `src/app/partenaire/prestations/page.tsx` retrouve les espaces par `partner_members` et le type de partenaire ; elle n'utilise pas le sélecteur actif NAXA pour déterminer ses membres. Les politiques RLS des offres et demandes vérifient le membership, le type `professionnel_domicile`, le statut du partenaire et `profiles.actif`.

Conséquences :
- le cumul pharmacie↔SPD doit considérer les memberships SPD (owner/manager/operator) en plus des affectations pharmacie ;
- le rôle SPD actif doit être ajouté au résolveur universel sans confondre l'accord indépendant du titulaire et les droits opérationnels des membres ;
- la validation Admin d'une convention indépendante reste distincte de l'accord Promoteur pharmacie ;
- l'invalidation de l'identité globale `profiles.actif` est particulièrement dangereuse : elle coupe aussi les policies SPD et l'accès Client.

