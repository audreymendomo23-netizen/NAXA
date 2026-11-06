# Politique de sécurité NAXA

## Signaler une vulnérabilité

Ne publiez pas une vulnérabilité, un jeton, une clé API, un mot de passe, une donnée client ou une capture contenant des informations personnelles dans une issue publique.

Envoyez un signalement privé à **naxa.home@gmail.com** avec :
- la zone ou fonctionnalité concernée ;
- les étapes minimales pour reproduire le problème ;
- l'impact observé et, si possible, une preuve expurgée de toute donnée personnelle ou valeur secrète.

N'envoyez jamais un secret actif dans un rapport. Indiquez seulement son type, son environnement et l'endroit où il pourrait avoir été exposé.

## Principes de traitement

- Les identifiants Production et Replay sont distincts.
- Les clés serveur et clés de service ne doivent jamais être présentes dans le code client, les commits ou les logs.
- Les tests automatiques doivent utiliser des secrets dédiés à Replay, avec le privilège minimal requis.
- Une vulnérabilité confirmée bloque la mise en production jusqu'à correction, rotation des secrets concernés et vérification.
- Les corrections de sécurité sont testées sur l'environnement isolé avant toute migration ou publication Production.

## Périmètre

Cette politique couvre le dépôt NAXA, ses workflows d'intégration continue et les applications qui utilisent ses services.
