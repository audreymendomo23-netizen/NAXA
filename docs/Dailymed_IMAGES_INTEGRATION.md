# Intégration DailyMed — images médicaments

## Source et endpoints

NAXA utilise l'API REST officielle DailyMed v2 (NLM/NIH), en HTTPS et sans clé API :
- recherche SPL : `/dailymed/services/v2/spls.json?drug_name=...&name_type=generic&pagesize=20`
- médias d'une notice : `/dailymed/services/v2/spls/{SETID}/media.json`
- notice source : `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={SETID}`

## Règle de sécurité éditoriale

L'API retourne des URLs de médias mais ne retourne pas de licence/copyright par image. DailyMed indique que des images sont soumises par les laboratoires dans les SPL. En conséquence, le script NAXA :
- recherche les SPL par nom générique et substance active ;
- filtre les titres et ne retient que les médias image hébergés par DailyMed ;
- enregistre les URLs et Set ID dans `methode_correspondance` ;
- laisse impérativement `image_url = NULL` et place la ligne en `correspondance_a_verifier` ;
- ne rend donc aucune image DailyMed publiable automatiquement.

Une image n'est publiable qu'après vérification indépendante des droits et de l'identité. Les photos d'une notice américaine ne prouvent pas le conditionnement vendu au Cameroun.

## Exécution

```bash
npm run import:dailymed-images -- --limit=25 --dry-run
npm run import:dailymed-images -- --limit=25
npm run test:dailymed-api
```

Variables serveur requises : `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) et `SUPABASE_SERVICE_ROLE_KEY`. Ne jamais exposer la clé service_role côté navigateur.

## Statuts

- `correspondance_a_verifier` : candidat DailyMed trouvé, droits et identité de présentation non validés.
- `image_stockee` : réservé à une image dont la provenance, les droits et l'identité sont validés.
