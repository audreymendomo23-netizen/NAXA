# Intégration DailyMed — images médicaments

## Sources et endpoints

NAXA utilise les API publiques officielles de la NLM en HTTPS :
- RxNorm/RxNav : `/REST/approximateTerm.json?term=...&maxEntries=...&option=1` et, dans le script, résolution normalisée `/REST/rxcui.json?name=...&search=2&allsrc=0`.
- DailyMed v2 par nom : `/dailymed/services/v2/spls.json?drug_name=...&name_type=both&pagesize=20`.
- DailyMed v2 par RxCUI : `/dailymed/services/v2/spls.json?rxcui=...&pagesize=20`.
- XML de la notice : `/dailymed/services/v2/spls/{SETID}.xml`.
- Médias d'une notice : `/dailymed/services/v2/spls/{SETID}/media.json`.
- Notice source : `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={SETID}`.

## Chaîne de rapprochement

1. NAXA recherche le nom du médicament et ses substances actives dans RxNorm.
2. Les RxCUI dont le score de rapprochement est retenu servent à interroger DailyMed.
3. Une deuxième recherche DailyMed directe par nom (générique ou marque) complète RxNorm lorsque le nom n'a pas de RxCUI exploitable.
4. Les SET ID sont dédupliqués.
5. Pour chaque notice, NAXA lit le XML SPL et recherche explicitement le code `SPLIMAGE`.
6. NAXA récupère, dans `media.json`, le fichier dont le nom correspond exactement à la référence XML. Aucun autre schéma ou média de notice n'est utilisé comme photo du comprimé.

Les scores RxNorm ne sont pas des probabilités et ne prouvent pas l'équivalence d'un médicament, de son dosage, de sa forme ou de son conditionnement. Le rapprochement est une aide à l'identification ; aucune substitution de CIS/CIP n'en découle.

## Nature de l'image

`SPLIMAGE` désigne une image d'une forme orale solide (comprimé ou gélule), généralement avec vue avant et arrière. Ce n'est pas une photo de boîte, ni une preuve que le conditionnement est celui vendu au Cameroun.

Références techniques :
- Guide DailyMed SPL Image : https://dailymed.nlm.nih.gov/dailymed/splimage-guidelines.cfm
- Validation FDA du champ `SPLIMAGE` : https://www.fda.gov/media/84201/download

## Droits et affichage

L'API DailyMed fournit des URLs de médias, mais ne fournit pas une licence individuelle de réutilisation pour chaque image. Des médias SPL peuvent être déposés par les titulaires/laboratoires.

En conséquence :
- L'image SPLIMAGE peut être conservée en `image_url` comme aperçu de candidat réservé à l'administration.
- La ligne reste impérativement en `correspondance_a_verifier`.
- Le champ `licence` indique que les droits de reproduction doivent être confirmés auprès du titulaire.
- Le catalogue public NAXA affiche uniquement les lignes `image_stockee` ; un candidat DailyMed n'est donc pas exposé automatiquement aux clients.
- Le passage à `image_stockee` exige une validation distincte de l'identité et des droits. Une notice américaine ne prouve ni l'AMM camerounaise, ni l'emballage local.

## Interfaces et exécution

- Recherche en direct et aperçu Admin : `/admin/medicaments-images`.
- API Admin : `/api/admin/medicaments-images/dailymed?q=...` (session Admin active obligatoire).
- Import contrôlé : `naxa-images-import-temp` (JWT obligatoire, lot maximal de 10 lignes).
- Script local : `scripts/dailymed-images-candidates.mjs` et `scripts/medicaments-images-cameroun.mjs`.

Variables serveur requises par les scripts : `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) et `SUPABASE_SERVICE_ROLE_KEY`. Ne jamais exposer la clé service_role côté navigateur.

Aucun import de lot ni changement des lignes de médicaments en Production n'est déclenché par la recherche Admin en direct.
