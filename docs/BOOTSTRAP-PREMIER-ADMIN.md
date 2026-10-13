# Bootstrap sécurisé du premier administrateur NAXA

Ce mécanisme ne crée pas un compte Auth et ne permet pas l'auto-promotion publique. Il promeut une seule fois le profil déjà inscrit de `naxa.home@gmail.com`, après confirmation de son email, et uniquement si aucun profil `admin` n'existe.

## Prérequis

1. Appliquer les migrations NAXA jusqu'à `migration_080_first_admin_bootstrap.sql`.
2. Laisser la personne créer normalement son compte avec `naxa.home@gmail.com` et confirmer l'adresse email.
3. Définir `NAXA_ADMIN_BOOTSTRAP_SECRET` comme variable d'environnement serveur, avec une valeur aléatoire longue. Ne jamais la préfixer par `NEXT_PUBLIC_`, l'inscrire dans le dépôt ou la journaliser.
4. Redéployer l'application après avoir configuré la variable.

## Exécution unique

Envoyer une requête HTTP POST à `/api/auth/admin-bootstrap`, avec l'en-tête `x-naxa-bootstrap-secret` contenant la valeur de la variable et le corps JSON `{"email":"naxa.home@gmail.com"}`.

Le serveur refuse toute autre adresse, toute clé absente/incorrecte, un compte absent ou non confirmé, et toute tentative après la création d'un premier administrateur. La migration verrouille la transaction afin que deux demandes simultanées ne puissent pas créer deux premiers administrateurs.

Après succès, supprimer la variable `NAXA_ADMIN_BOOTSTRAP_SECRET` de l'environnement de déploiement. Le code ne révèle jamais la valeur de cette clé.

## Limites

- La route ne doit pas être utilisée tant que la migration 080 n'a pas été appliquée.
- Elle ne réalise aucune écriture en Production tant que le code n'est pas fusionné/déployé et que la requête n'est pas appelée.
- Ce document ne prouve pas que l'email OTP est livré : la livraison doit être vérifiée séparément.
