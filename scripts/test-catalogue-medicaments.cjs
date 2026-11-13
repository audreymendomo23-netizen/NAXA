const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const catalogue = fs.readFileSync(path.join(root, "src/lib/medicaments/catalogue-pilote.ts"), "utf8");
const route = fs.readFileSync(path.join(root, "src/app/api/medicaments/recherche/route.ts"), "utf8");
const recherche = fs.readFileSync(path.join(root, "src/components/Recherche.tsx"), "utf8");
const upload = fs.readFileSync(path.join(root, "src/components/PhotoUpload.tsx"), "utf8");
const resultats = fs.readFileSync(path.join(root, "src/app/resultats/page.tsx"), "utf8");
const produit = fs.readFileSync(path.join(root, "src/app/produit/[id]/page.tsx"), "utf8");
const panier = fs.readFileSync(path.join(root, "src/app/panier/page.tsx"), "utf8");
const photos = fs.readFileSync(path.join(root, "supabase/migration_221_medicament_photo_provenance_storage.sql"), "utf8");

test("prototype : dix termes fréquents à valider avec les pharmacies camerounaises", () => {
  const rows = [...catalogue.matchAll(/\{ nomFr: "[^"]+", substanceFr: "[^"]+", alias: \[[^\]]+\] \}/g)];
  assert.equal(rows.length, 10);
});

test("API : trois sources attendues et aucune dépendance à RxImage", () => {
  assert.match(route, /rxnav\.nlm\.nih\.gov\/REST\/drugs\.json/);
  assert.match(route, /api\.fda\.gov\/drug\/label\.json/);
  assert.match(route, /dailymed\.nlm\.nih\.gov\/dailymed\/services\/v2/);
  assert.doesNotMatch(route, /rximage\.nlm\.nih\.gov/);
});

test("images : aucune photo n'est publiée tant que la provenance et les droits ne sont pas matérialisés", () => {
  assert.match(route, /const storagePhotoUrl = null/);
  assert.match(route, /Photo masquée jusqu’à validation de sa provenance et de ses droits/);
  assert.doesNotMatch(route, /dailyMedImage\(/);
  assert.match(recherche, /PHOTO_MEDICAMENT_PAR_DEFAUT/);
});;

test("upload photo : licence, URL HTTPS et confirmation des droits obligatoires", () => {
  assert.match(upload, /sourceUrl\.trim\(\)\.startsWith\("https:\/\/"\)/);
  assert.match(upload, /licence\.trim\(\)\.length < 5/);
  assert.match(upload, /!droitsConfirmes/);
  assert.match(upload, /from\("medicaments"\)\.upload/);
  assert.match(upload, /photo_verifiee_le/);
});

test("storage : bucket médicaments et écriture réservée aux administrateurs", () => {
  assert.match(photos, /values \('medicaments', 'medicaments', true/);
  assert.match(photos, /medicaments_admin_insert/);
  assert.match(photos, /p\.role = 'admin'/);
  assert.match(photos, /photo_source_url/);
  assert.match(photos, /photo_licence/);
});

test("recherche : résultats instantanés et disponibilité partenaire séparée", () => {
  assert.match(recherche, /\/api\/medicaments\/recherche\?q=/);
  assert.match(recherche, /Vérifier le stock des pharmacies partenaires/);
  assert.match(route, /const availability = !localProduct/);
  assert.match(route, /from\("stocks"\)/);
  assert.match(route, /\.eq\("pharmacies\.actif", true\)/);
  assert.match(route, /\.eq\("pharmacies\.visible_recherche", true\)/);
  assert.match(route, /\.eq\("pharmacies\.est_demo", false\)/);
  assert.match(route, /db\.rpc\("marketplace_offre_stock_disponible"/);
  assert.match(route, /const quantity = Number\(offer\.quantite\)/);
  assert.match(route, /quantity <= 0/);
});;

test("réglementation : le catalogue renvoie vers le répertoire officiel DPML", () => {
  assert.ok(route.includes("https://dpml.cm/repertoireDesAmm/index.php"));
  assert.match(recherche, /Vérifier l’autorisation au Cameroun/);
});

test("stock : la recherche affiche les statuts réels du réseau partenaire", () => {
  assert.match(recherche, /Disponible chez nos partenaires/);
  assert.match(recherche, /Indisponible dans le réseau partenaire/);
  assert.match(recherche, /Stock non vérifié/);
  assert.match(recherche, /partnerPharmacyCount/);
});

test("images : la photo locale est prioritaire et le placeholder reste disponible", () => {
  assert.ok(route.includes("imageUrl: storagePhotoUrl,"));
  assert.match(route, /Photo masquée jusqu’à validation/);
  assert.match(recherche, /PHOTO_MEDICAMENT_PAR_DEFAUT/);
});

test("fiche publique : les photos sans licence validée ne sont pas affichées", () => {
  assert.match(produit, /p\.photo_path&&p\.photo_licence&&p\.photo_verifiee_le/);
  assert.doesNotMatch(produit, /src=\{p\.photo_url\}/);
});

test("dosage : aucun dosage n'est rendu dans les vues client principales", () => {
  assert.doesNotMatch(resultats, /\{i\.nom\}\s*\{i\.dosage\}/);
  assert.doesNotMatch(produit, /\{p\.nom\}\s*\{p\.dosage\}/);
  assert.doesNotMatch(panier, /\{l\.nom\}\s*\{l\.dosage\}/);
  assert.doesNotMatch(recherche, /medicament\.dosage/);
});

test("sécurité : recherche courte refusée et appels externes limités dans le temps", () => {
  assert.match(route, /query\.length < 2/);
  assert.match(route, /AbortSignal\.timeout\(4500\)/);
});

const photoResolver = fs.readFileSync(path.join(root, "src/lib/medicaments/photos-externes.ts"), "utf8");
const photoRoute = fs.readFileSync(path.join(root, "src/app/api/medicaments/photo/route.ts"), "utf8");

test("photos : recherche séparée de boîtes et de comprimés avec licence commerciale", () => {
  assert.match(photoRoute, /rechercherPhotosMedicament/);
  assert.match(photoRoute, /photos\.boite/);
  assert.match(photoRoute, /photos\.comprime/);
  assert.match(photoResolver, /kind: "boite" \| "comprime"/);
  assert.match(photoResolver, /item\.coverage >= 0\.75/);
  assert.match(photoResolver, /searchVariants/);
  assert.match(photoResolver, /likelyCombinationMismatch/);
  assert.match(photoResolver, /allowedCommercialLicense/);
  assert.match(photoResolver, /sourceUrl: info\.descriptionurl/);
});

test("photos : aucune API RxImage arrêtée ni image non licenciée injectée automatiquement", () => {
  assert.doesNotMatch(photoResolver, /rximage\.nlm\.nih\.gov/);
  assert.match(photoResolver, /sources d\x27images libres par défaut/);
  assert.match(recherche, /imageVariants\?\.comprime/);
  assert.match(recherche, /imageVariants\?\.boite/);
  assert.match(recherche, /Wikimedia Commons/);
});


test("provenance et notices de sécurité : champs contrôlés et visibles", () => {
  assert.match(route, /OPENFDA_API_KEY/);
  assert.match(route, /adverse_reactions/);
  assert.match(route, /contraindications/);
  assert.match(route, /sourceDetails/);
  assert.match(recherche, /Informations de sécurité disponibles/);
  assert.match(recherche, /Provenance et vérification/);
  assert.match(recherche, /Notice de référence étrangère/);
});

test("DailyMed : ne pas réutiliser arbitrairement le premier résultat sans correspondance", () => {
  assert.match(route, /const matchedDaily = dailyRecords\.find/);
  assert.doesNotMatch(route, /\?\? dailyRecords\[0\]/);
});

test("BDPM : référentiel séparé, source publique, RLS et script d’import officiel", () => {
  const migration = fs.readFileSync(path.join(root, "supabase/migration_222_medicaments_referentiel_bdpm.sql"), "utf8");
  const importer = fs.readFileSync(path.join(root, "scripts/import-bdpm.cjs"), "utf8");
  assert.match(migration, /create table if not exists public\.medicaments_referentiel_sources/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /medicaments_referentiel_sources_public_read/);
  assert.match(importer, /CIS_bdpm\.txt/);
  assert.match(importer, /CIS_COMPO_bdpm\.txt/);
  assert.match(importer, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(importer, /source_dataset_updated_at/);
  assert.match(importer, /upsert\(batch, \{ onConflict: "cis" \}\)/);
  assert.match(route, /bdpmProductsFor\(query\)/);
  assert.match(route, /référentiel français importé dans NAXA/);
  assert.match(recherche, /Sources des informations/);
  assert.match(recherche, /Provenance et vérification/);
});


test("photos : les photos locales exigent une correspondance, une licence et une source vérifiées", () => {
  assert.match(photoRoute, /verifiedLocalPhoto/);
  assert.match(photoRoute, /from\("medicaments_images"\)/);
  assert.match(photoRoute, /eq\("statut", "image_stockee"\)/);
  assert.match(photoRoute, /unrequestedCombination/);
  assert.match(photoRoute, /exactIdentityMatch\(query, identity\)/);
  assert.match(photoRoute, /exactIdentityMatch\(query, row\.nom\)/);
  assert.match(photoRoute, /photo_licence/);
  assert.match(photoRoute, /photo_verifiee_le/);
});

test("interface : source/licence visibles et image cassée remplacée sans garder son URL", () => {
  assert.match(resultats, /source et licence/);
  assert.match(resultats, /\/medicaments\/placeholder\.svg/);
  assert.match(resultats, /imageSourceUrl:null/);
  assert.match(resultats, /imageLicense:null/);
});

test("photos : sources gratuites CIMA, Wikimedia et Open Products Facts sont intégrées avec garde-fous", () => {
  assert.ok(photoResolver.includes("https://cima.aemps.es/cima/rest"));
  assert.match(photoResolver, /allowedCimaImageRights/);
  assert.match(photoResolver, /function cimaPhotoUpdateDate/);
  assert.match(photoResolver, /photo\.fecha/);
  assert.match(photoResolver, /for \(const entry of medicine\.fotos \?\? \[\]\)/);
  assert.match(photoResolver, /safeCimaImageUrl\(entry\.url, registration, wantedType\)/);
  assert.match(photoResolver, /parts\[4\] !== registration/);
  assert.match(photoResolver, /detail\.nregistro === candidate\.nregistro/);
  assert.match(photoResolver, /Données ouvertes AEMPS\/CIMA/);
  assert.match(photoResolver, /derechos\\s\+reservados/);
  assert.match(photoResolver, /for \(const record of matching\)/);
  assert.match(photoResolver, /if \(!updatedAt\) return null/);
  assert.match(recherche, /AEMPS \/ CIMA \(Espagne\)/);
  assert.match(recherche, /non preuve d’AMM ou de présentation camerounaise/);
  assert.ok(photoResolver.includes("if (!url || !rights) return null"));
  assert.ok(!photoResolver.includes("CIMA_LICENSE ="));
  assert.match(photoResolver, /materialas/);
  assert.match(photoResolver, /formafarmac/);
  assert.match(photoResolver, /cimaNameMatches/);
  assert.match(photoResolver, /strictImageIdentityTokens/);
  assert.match(photoResolver, /singleTokenIdentityMismatch/);
  assert.match(photoResolver, /if \(wanted.length !== 1\) return true/);
  assert.ok(photoResolver.includes("if (!url || !rights) return null"));
  assert.match(photoResolver, /provider: "cima_aemps"/);
  assert.ok(photoResolver.includes("https://world.openproductsfacts.org/api/v2/product/"));
  assert.ok(photoResolver.includes("product?.code ?? json.code"));
  assert.match(photoResolver, /CC BY-SA/);
  assert.match(photoResolver, /provider: "open_products_facts"/);
  assert.match(photoResolver, /revalidate: 604800/);
  assert.match(photoResolver, /Deux variantes séquentielles/);
  assert.match(photoResolver, /provider: "wikimedia_commons"/);
  assert.match(photoRoute, /provider: "catalogue_local_verifie"/);
  assert.ok(photoRoute.includes("selected?.provider"));
});


const cimaPhotoProjection = fs.readFileSync(path.join(root, "supabase/migration_310_cima_photo_public_projection.sql"), "utf8");

test("CIMA pré-calculé : projection publique strictement filtrée et reliée au CIS exact", () => {
  assert.match(cimaPhotoProjection, /private\.medicaments_cima_bdpm_jobs/);
  assert.doesNotMatch(cimaPhotoProjection, /private\.medicamentos_cima_bdpm_jobs/);
  assert.match(cimaPhotoProjection, /create or replace view public\.medicaments_cima_photos_public/);
  assert.match(cimaPhotoProjection, /security_barrier = true/);
  assert.match(cimaPhotoProjection, /j\.statut = 'correspondance_forte'/);
  assert.match(cimaPhotoProjection, /j\.dose_concordante is true/);
  assert.match(cimaPhotoProjection, /j\.score >= 0\.78/);
  assert.match(cimaPhotoProjection, /forme_cima/);
  assert.match(cimaPhotoProjection, /extensions\.unaccent/);
  assert.match(cimaPhotoProjection, /perfusion/);
  assert.match(cimaPhotoProjection, /suspension buvable/);
  assert.match(cimaPhotoProjection, /fotos/);
  assert.match(cimaPhotoProjection, /fecha/);
  assert.match(cimaPhotoProjection, /cima\[\.]aemps\[\.]es/);
  assert.match(cimaPhotoProjection, /revoke all on public\.medicaments_cima_photos_public from public/);
  assert.match(cimaPhotoProjection, /grant select on public\.medicaments_cima_photos_public to anon, authenticated, service_role/);
  assert.doesNotMatch(cimaPhotoProjection, /select\s+j\.donnees_cima\s*,/i);
  assert.match(route, /from\("medicaments_cima_photos_public"\)/);
  assert.match(route, /\.in\("cis", cisList\)/);
  assert.match(route, /function construirePhotoCima/);
  assert.match(route, /photo mise à jour le/);
  assert.match(recherche, /provider === "cima_aemps" \? "Forme pharmaceutique"/);

  assert.match(route, /marque et présentation pouvant différer/);
  assert.match(route, /matchExactNom/);
  assert.match(route, /normaliserTerme\(match\.nom\) === normaliserTerme\(item\.name\)/);
  assert.match(route, /parts\[4\] !== row\.nregistro/);
  assert.match(route, /provider: "cima_aemps",\s+updatedAt\s*\n\s*};/);
});

test("photos : le chargement client borne la concurrence et conserve la provenance réelle", () => {
  assert.ok(recherche.includes("Math.min(2, ciblesPhoto.length)"));
  assert.ok(!recherche.includes("Promise.all(ciblesPhoto.map"));
  assert.ok(recherche.includes("AEMPS / CIMA"));
  assert.ok(recherche.includes("Open Products Facts"));
  assert.ok(recherche.includes("Wikimedia Commons"));
  assert.ok(recherche.includes("Recherche directe par EAN/GTIN"));
  assert.ok(recherche.includes('photo?.provider === "open_products_facts"'));
  assert.ok(resultats.includes('photo?.provider==="open_products_facts"'));
  assert.ok(route.includes("id,nom,dci,code_barre,forme"));
  assert.ok(route.includes("barcode: localProduct?.code_barre"));
  assert.ok(route.includes("barcodeLookup: true"));
  assert.ok(recherche.includes("item.barcode"));
  assert.ok(resultats.includes("item.barcode"));
  assert.ok(photoResolver.includes("Un code-barres est un identifiant"));
  assert.ok(resultats.includes("Math.min(2,ciblesPhoto.length)"));
  assert.ok(resultats.includes("AEMPS / CIMA"));
  assert.ok(photoRoute.includes("aucune_source_gratuite_trouvee"));
});
