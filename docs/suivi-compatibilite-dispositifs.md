# NAXA — Compatibilité des 21 dispositifs

## Contrat fonctionnel

Les 21 catégories partagent une interface unique avec trois voies d'acquisition : saisie manuelle, scan local (QR/code-barres et OCR photo) et détection Bluetooth. Les mesures sont préremplies pour vérification et ne sont jamais enregistrées automatiquement à partir d'une lecture ambiguë. L'historique, les consentements par famille, les plages personnelles et les rappels restent communs à toutes les catégories.

## Catalogue couvert

1. Tensiomètre
2. Thermomètre
3. Oxymètre de pouls
4. Glucomètre
5. Balance
6. Capteur cardiaque / cardiofréquencemètre
7. Podomètre
8. Électrocardiographe (ECG)
9. Spiromètre
10. Débitmètre de pointe
11. Balance impédancemètre
12. Lecteur de cholestérol
13. Lecteur de cétones
14. Lecteur d'acide urique
15. Montre connectée
16. Bracelet d'activité
17. Suivi du sommeil
18. Thermomètre infrarouge
19. Capteur respiratoire
20. Pilulier connecté
21. Bouteille connectée / hydratation

## Adaptateurs Bluetooth

Le détecteur explore les services GATT médicaux standards et conserve le nom de l'appareil, les profils découverts et l'heure de détection. Les décodeurs de mesures actuellement implémentés couvrent :

- Fréquence cardiaque : `heart_rate / heart_rate_measurement`
- Tension : `blood_pressure / blood_pressure_measurement`
- Température : `health_thermometer / temperature_measurement`
- Oxymétrie : `pulse_oximeter / plx_spot_check_measurement`
- Glycémie : `glucose / glucose_measurement`
- Poids : `weight_scale / weight_measurement`
- Composition corporelle : `body_composition / body_composition_measurement`
- Vélo d’intérieur / ergomètre : `fitness_machine / indoor_bike_data` (vitesse cycliste en km/h, cadence et fréquence cardiaque lorsque les champs sont présents dans la trame).
- Capteur de cadence cycliste : `cycling_speed_cadence / csc_measurement` (cadence calculée à partir des révolutions de pédalier et des horodatages Bluetooth successifs; vitesse non déduite sans circonférence de roue configurée).

Les montres et bracelets qui exposent le profil cardiaque standard peuvent alimenter la fréquence cardiaque. Les vélos d’intérieur exposant le profil Fitness Machine standard peuvent fournir la vitesse, la cadence et la fréquence cardiaque. Les capteurs CSC peuvent fournir la cadence après réception de deux trames successives; la vitesse n’est pas inventée sans dimension de roue connue. Les champs absents, incomplets ou hors plage sont ignorés; les protocoles propriétaires ne sont jamais assimilés à ce profil. Les autres appareils restent détectables, mais leur mesure n'est pas décodée tant qu'un adaptateur de protocole vérifié n'existe pas. Les protocoles propriétaires ne doivent jamais être interprétés comme des valeurs standard par simple heuristique.

## Scan et saisie

- Les images sont traitées dans le navigateur : BarcodeDetector si disponible, puis OCR Tesseract français/anglais en repli.
- Un seul nombre clairement isolé peut préremplir le champ actif; plusieurs nombres exigent une sélection humaine.
- L'image n'est pas téléversée par cette fonction OCR.
- Le scan d'un code d'identification n'est pas considéré comme une mesure clinique.

## Connexion Bluetooth native Android

- L'écran Compose « Suivi connecté » déclenche le scan natif (12 secondes), affiche les appareils découverts et transmet la sélection au service GATT. Les permissions `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` sont demandées au runtime sur Android 12+; localisation fine est demandée sur les versions antérieures.
- Le scan et l'association sont conditionnés au consentement explicite de la famille de mesures, lu et enregistré via `suivi_set_family_consent`. Les événements BLE sont filtrés par propriétaire de compte et les profils GATT par catégorie d'appareil.
- Limite actuelle : les événements de mesure natifs restent dans la file chiffrée; leur décodage et leur insertion dans `suivi_measurements`, ainsi que l'enregistrement de l'appareil dans `suivi_user_devices`, doivent encore être raccordés dans le parcours Compose.
- Le service conserve les connexions GATT, réessaie la reconnexion avec temporisation progressive et conserve les événements de mesure dans une file locale native chiffrée avec AES-GCM et une clé Android Keystore (maximum 300 événements en attente).
- Les métadonnées des sessions persistées (adresse, identifiant logique du dispositif, propriétaire) sont également chiffrées avec AES-GCM et Android Keystore; les anciennes sessions JSON en clair restent lisibles une fois pour permettre leur migration au prochain enregistrement.
- Chaque liaison est associée au compte qui l’a autorisée; une session appartenant à un autre compte est arrêtée plutôt que réattribuée.
- Toute déconnexion purge les sessions Bluetooth persistées avant la révocation locale du compte; les trois parcours de déconnexion Android appliquent cette règle.
- Après redémarrage Android ou reprise du service après arrêt du processus, les sessions ne sont restaurées qu'après revalidation serveur du compte et correspondance exacte de son identifiant propriétaire.
- La reprise au démarrage vérifie aussi l'autorisation Bluetooth Android; en cas d'absence de permission ou d'indisponibilité réseau, aucune liaison n'est relancée sans validation ultérieure.
- La PWA navigateur reprend les événements persistés à son retour et les transmet au parcours web de consentement et d’enregistrement. L’écran Compose Android utilise son propre lecteur d’événements natifs; son décodage et sa persistance des mesures restent à intégrer.
- Android affiche une notification persistante pendant le maintien des connexions. Le retrait d’un appareil arrête sa session de fond.
- Si la file native atteint sa capacité, les événements les plus anciens écartés sont comptabilisés dans un événement `queueOverflow` visible dans l’interface; cette alerte impose de vérifier l’historique et la synchronisation.
- La continuité Bluetooth en arrière-plan n’est pas disponible dans une PWA de navigateur; elle dépend du cycle de vie du navigateur et de ses autorisations.

## Synchronisation hors connexion

- Les mesures Bluetooth reçues mais non envoyées sont conservées dans une file IndexedDB locale, limitée à 500 événements par navigateur.
- La reprise se déclenche au retour du réseau et lorsque l’espace redevient visible; les envois sont regroupés par lots.
- La file est propre à l’utilisateur authentifié. Les mesures dont le consentement familial n’est plus actif sont supprimées avant toute reprise.
- Une mesure n’est retirée de la file qu’après confirmation de l’insertion serveur. Les actions qui exigent le serveur restent indisponibles hors connexion.

## Rappels et sécurité

- Les rappels sont vérifiés par le service planifié Push toutes les cinq minutes.
- Les notifications Push n'incluent pas de mesure, de diagnostic ou de détail médical sur l'écran verrouillé.
- L'échéance est revendiquée par mise à jour conditionnelle pour éviter les envois concurrents.
- Le consentement de la famille est revérifié côté serveur; un consentement retiré désactive le rappel et bloque les enregistrements concernés.
- RLS et la propriété de compte restent obligatoires. Aucune intégration de fabricant ne doit contourner le consentement.

## Notifications mobiles

- La PWA conserve le parcours Web Push et son service worker.
- L’APK utilise les rappels locaux Android et une notification persistante de service Bluetooth.
- Le socle Firebase Cloud Messaging est intégré à l’APK : initialisation Firebase conditionnelle, réception Android des messages data-only, canal de notification dédié, ouverture de la route NAXA, récupération et enregistrement du jeton FCM.
- Les jetons FCM sont liés au compte authentifié dans `naxa_fcm_tokens`; l’API valide le bearer Supabase avant l’écriture serveur. RLS limite les lectures/écritures directes au propriétaire et le service_role est réservé au serveur.
- Le dispatcher de suivi envoie les rappels H-5, rappels personnels et alertes de suivi via FCM en complément de Web Push. Les notifications de messagerie utilisent également FCM.
- Configuration serveur requise : variable Vercel `FIREBASE_SERVICE_ACCOUNT_JSON` contenant le JSON du compte de service Firebase avec le rôle d’envoi FCM. `FIREBASE_PROJECT_ID` est facultative si le projet est déjà renseigné dans ce JSON.
- Configuration de compilation APK requise : `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_PROJECT_ID` et `FIREBASE_SENDER_ID`, fournies comme propriétés Gradle ou variables d’environnement. Aucun secret de compte de service ne doit être embarqué dans l’APK.
- Sans ces identifiants client, FCM reste désactivé sans bloquer les rappels locaux ni le Bluetooth. Sans le compte de service côté serveur, les notifications distantes ne sont pas envoyées.
- L’intégration est codée mais non certifiée : la migration SQL doit être appliquée, la configuration Firebase fournie, puis l’APK compilé et un push réel testé sur appareil.

## Vérifications

- `supabase/tests/148_suivi_21_dispositifs_interoperabilite.sql`
- `supabase/tests/149_suivi_background_reminders_push.sql`
- `supabase/tests/20261112230000_naxa_fcm_android_tokens.sql`
- `supabase/tests/150_suivi_mesures_multidispositifs.sql`
- `npm run test:suivi-interoperabilite`

La présence d'une catégorie dans le catalogue n'est pas une certification universelle de toutes les références commerciales. La compatibilité d'un modèle est prouvée uniquement par un profil effectivement découvert et une mesure décodée et validée.
