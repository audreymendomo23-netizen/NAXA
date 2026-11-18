# Recette 09 — Contradictions transversales du profil Client

- Ordre : **PRÉALABLE OBLIGATOIRE**, à exécuter avant les recettes 01 à 08.
- Environnement : Supabase Replay `pwfftcsjyeibxxqhwysw` exclusivement.
- Branche : `main` uniquement.
- Production, migrations Production et déploiement : interdits dans cette recette.
- Nature : audit contradictoire + tests de garde + tests de non-régression. Cette recette n'est pas un scénario métier Client.

## Objectif et règle de sortie

Identifier puis lever les contradictions susceptibles de fausser ou de bloquer les huit recettes Client : registre des univers, routes/en-tête, verrouillage métier, identité/rôle, autorisations serveur et navigation. Les huit recettes restent **bloquées au démarrage** tant que les critères P1 ci-dessous ne sont pas résolus ou explicitement déclarés non bloquants avec preuve.

Ne jamais transformer une hypothèse statique en défaut confirmé sans test. Ne jamais corriger en affaiblissant une permission.

## Préconditions et jeux d'identités

- Client actif complet, rôle racine Client.
- Profil Client incomplet ou non vérifié.
- Identité professionnelle active avec espace Client éventuellement disponible via profil Client complet.
- Profil global suspendu.
- Identité sans affectation/adhésion professionnelle requise.
- Sessions distinctes pour vérifier l'isolation.
- États des univers : Pharmacie autorisée ; Parapharmacie et Bébé & Maman bloqués métier ; Examens et Prestations selon leur activation réelle ; suivi connecté conditionné par `suivi_is_enabled_user`.

Aucun compte ni aucune donnée Production ne doivent être utilisés. Utiliser les fixtures Replay existantes ; ne pas créer d'identités Auth si le dispositif Replay ne le permet pas.

## Scénarios bulk

### R09-01 — Référentiel des univers
1. Comparer les identifiants du type `EcosystemeId`, le tableau `ECOSYSTEMES`, `ECOSYSTEME_PAR_ID`, le menu et la recherche globale.
2. Vérifier que chaque identifiant possède les propriétés consommées par l'en-tête.
3. Vérifier les six univers attendus et leur statut métier réel.
4. Contrôler les valeurs inconnues et les identifiants absents : aucun accès de propriété sur `undefined`, aucune route silencieusement autorisée.
**Attendu :** référentiel unique, exhaustif, typé et cohérent ; aucune assertion forcée ne masque une entrée manquante.

### R09-02 — Routes et enveloppe Client
1. Ouvrir directement `/client`, `/parapharmacie`, `/examens`, `/prestations`, `/bebe-maman` et `/suivi` avec les identités pertinentes.
2. Vérifier chargement, en-tête, menu, navigation retour et absence d'erreur React/runtime.
3. Répéter avec session expirée, profil incomplet, profil suspendu et service conditionnel indisponible.
**Attendu :** chaque route affiche un état cohérent ou un refus explicite ; aucun crash ni fuite de contenu privé.

### R09-03 — Verrouillage métier côté serveur
1. Pour Parapharmacie et Bébé & Maman, tenter l'accès par menu, URL directe, appel API et Server Action/RPC de catalogue/réservation.
2. Tester les identifiants d'univers autorisés, inconnus, désactivés et bloqués.
3. Vérifier qu'une action bloquée ne crée ni réservation, ni hold, ni mouvement de stock, ni paiement déclaré.
4. Refaire avec un utilisateur authentifié et une requête forgée sans passer par l'interface.
**Attendu :** le blocage métier est appliqué côté serveur et base, pas seulement par masquage du menu. Aucune donnée métier créée.

### R09-04 — Cohérence identité / espace / rôle
1. Tester Client complet avec rôle racine Client.
2. Tester identité professionnelle avec profil Client complet et sélection de l'espace Client.
3. Tester profil Client incomplet, non vérifié, inactif et suspendu.
4. Appeler directement les actions de réservation, examen, prestation et autres mutations sensibles.
5. Vérifier les contrôles dans Server Actions, API, RPC et RLS.
**Attendu :** visibilité de l'espace et autorisation d'une mutation obéissent à une règle cohérente ; aucune action ne se contente de vérifier la session si l'identité active ou le rôle requis doit être contrôlé.

### R09-05 — Contrôle spécifique Prestations
1. Vérifier le contrôle de session, profil global actif, rôle/identité Client et périmètre dans l'action de demande.
2. Vérifier les contrôles équivalents dans la RPC appelée et ses privilèges effectifs.
3. Tester identité professionnelle, profil suspendu et utilisateur sans droit Client.
**Attendu :** seul le sujet autorisé crée une demande ; les protections RPC/RLS sont démontrées, pas supposées.

### R09-06 — Navigation basse et destinations
1. Cliquer successivement Achats, Réservations et Commandes.
2. Relever URL, état sélectionné, données et filtres après chaque clic.
3. Vérifier retour arrière, rechargement direct et navigation mobile.
**Attendu :** chaque libellé a une sémantique honnête ; si la destination est commune, l'interface ne prétend pas proposer trois onglets distincts.

### R09-07 — Persistance locale / serveur
1. Inventorier adresses, préférences de paiement, numéros, notifications, langue et thème.
2. Pour chaque donnée, identifier source de vérité (serveur ou stockage local).
3. Tester rechargement, reconnexion, second appareil/session et suppression locale.
**Attendu :** aucune préférence locale n'est présentée comme synchronisée au compte si elle ne l'est pas ; aucune donnée sensible ne fuit entre sessions.

### R09-08 — Routes et liens secondaires
1. Contrôler les routes fiche produit, offre, pharmacies de garde, scanner, suivi et historique.
2. Vérifier les enveloppes de navigation, liens retour, liens morts et états de session.
3. Vérifier que le scanner OCR local n'est pas confondu avec la transmission sécurisée d'ordonnance.
**Attendu :** aucun parcours ne perd ses points de sortie ni ne mélange deux fonctions distinctes.

## Preuves obligatoires

Pour chaque scénario : commit testé, URL/route, identité/claims, action exacte, résultat UI, réponse API/RPC, état DB avant/après, logs/erreurs, nettoyage, capture ou trace Playwright. Séparer explicitement PASS UI, PASS API/RPC/SQL, échec et non exécuté.

## Critères de sortie

- P1 : registre univers complet ; pas de crash sur les routes ; verrouillage des univers bloqués appliqué côté serveur ; contrôles identité/rôle validés par RPC/RLS ; action Prestations sécurisée.
- P2 : navigation non ambiguë ; persistance clairement qualifiée ; routes secondaires cohérentes.
- Nettoyage Replay vérifié et aucun résidu.
- Si un P1 échoue : corriger sur `main`, tester la correction et sa non-régression, documenter, puis rejouer uniquement les scénarios affectés. Ne pas démarrer les recettes 01–08 avant levée des P1.
- Aucun statut AU VERT sur simple lecture du code.

## État initial

NON EXÉCUTÉE. Les contradictions du rapport statique sont des hypothèses à confirmer. Aucune correction ni preuve d'exécution n'est revendiquée.
