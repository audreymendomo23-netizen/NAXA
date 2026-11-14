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

const photoRoute = fs.readFileSync(path.join(root, "src/app/api/medicaments/photo/route.ts"), "utf8");

test("photos : endpoint local strictement lié au catalogue et aux droits vérifiés", () => {
  assert.match(photoRoute, /async function verifiedLocalPhoto/);
  assert.match(photoRoute, /from\("produits"\)/);
  assert.match(photoRoute, /from\("medicaments_referentiel_sources"\)/);
  assert.match(photoRoute, /from\("medicaments_images"\)/);
  assert.match(photoRoute, /eq\("statut", "image_stockee"\)/);
  assert.match(photoRoute, /not\("licence", "is", null\)/);
  assert.match(photoRoute, /not\("source_url", "is", null\)/);
  assert.match(photoRoute, /exactIdentityMatch/);
  assert.match(photoRoute, /unrequestedCombination/);
});

test("photos : aucune source photographique externe n'est appelée à la demande", () => {
  assert.doesNotMatch(photoRoute, /\bfetch\s*\(/);
  assert.doesNotMatch(photoRoute, /axios\.|got\(/);
  assert.match(photoRoute, /photo_source_url/);
  assert.match(photoRoute, /photo_licence/);
  assert.match(photoRoute, /photo_verifiee_le/);
  assert.match(recherche, /Catalogue local NAXA/);
  assert.match(recherche, /PHOTO_MEDICAMENT_PAR_DEFAUT/);
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


test("photos : les deux emplacements ne reçoivent que des variantes locales vérifiées", () => {
  assert.match(photoRoute, /const photos = \{/);
  assert.match(photoRoute, /boite: localPhoto\?\.kind === "boite" \? localPhoto : null/);
  assert.match(photoRoute, /comprime: localPhoto\?\.kind === "comprime" \? localPhoto : null/);
  assert.match(photoRoute, /selected\?\.provider/);
  assert.match(photoRoute, /aucune_source_gratuite_trouvee/);
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

test("photos : le résolveur de photos reste limité aux lignes locales validées", () => {
  assert.match(photoRoute, /verifiedLocalPhoto/);
  assert.match(photoRoute, /image_path/);
  assert.match(photoRoute, /image_url/);
  assert.match(photoRoute, /source_url/);
  assert.match(photoRoute, /licence/);
  assert.match(photoRoute, /statut/);
  assert.doesNotMatch(photoRoute, /rechercherPhotosMedicament|allowedCommercialLicense|searchVariants/);
});

const cimaPhotoProjection = fs.readFileSync(path.join(root, "supabase/migration_310_cima_photo_public_projection.sql"), "utf8");

test("CIMA pré-calculé : projection SQL filtrée et séparée du résolveur photo local", () => {
  assert.match(cimaPhotoProjection, /private\.medicaments_cima_bdpm_jobs/);
  assert.match(cimaPhotoProjection, /create or replace view public\.medicaments_cima_photos_public/);
  assert.match(cimaPhotoProjection, /security_barrier = true/);
  assert.match(cimaPhotoProjection, /j\.statut = 'correspondance_forte'/);
  assert.match(cimaPhotoProjection, /j\.dose_concordante is true/);
  assert.match(cimaPhotoProjection, /j\.score >= 0\.78/);
  assert.match(cimaPhotoProjection, /fotos/);
  assert.match(cimaPhotoProjection, /cima\[\.\]aemps\[\.\]es/);
  assert.match(cimaPhotoProjection, /revoke all on public\.medicaments_cima_photos_public from public/);
  assert.match(cimaPhotoProjection, /grant select on public\.medicaments_cima_photos_public to anon, authenticated, service_role/);
  assert.doesNotMatch(cimaPhotoProjection, /select\s+j\.donnees_cima\s*,/i);
  assert.doesNotMatch(photoRoute, /medicaments_cima_photos_public/);
});

test("photos : recherche client bornée et appels limités au catalogue local", () => {
  assert.ok(recherche.includes("Math.min(2, ciblesPhoto.length)"));
  assert.ok(recherche.includes('fetch("/api/medicaments/photo?q="'));
  assert.ok(recherche.includes("!item.imageVariants?.boite || !item.imageVariants?.comprime"));
  assert.ok(recherche.includes("imageVariants.boite = imageVariants.boite ?? payload.photos?.boite ?? null"));
  assert.ok(recherche.includes("imageVariants.comprime = imageVariants.comprime ?? payload.photos?.comprime ?? null"));
  assert.ok(recherche.includes('const providerLabel = (_provider: MedicamentPhotoItem["provider"]) => "Catalogue local NAXA";'));
  assert.ok(!recherche.includes("Promise.all(ciblesPhoto.map"));
  assert.ok(resultats.includes("Math.min(2, ciblesPhoto.length)"));
  assert.ok(resultats.includes("photoPayload.photos?.comprime"));
  assert.ok(resultats.includes("imageVariants.comprime.url"));
  assert.ok(route.includes("barcode: localProduct?.code_barre"));
  assert.ok(route.includes("barcodeLookup: true"));
});

const cimaPhotoInvokerMigration = fs.readFileSync(path.join(root, "supabase/migration_311_cima_photo_invoker_projection.sql"), "utf8");

test("sécurité CIMA : vue publique invoker et fonction interne sans paramètre limitée à la projection filtrée", () => {
  assert.match(cimaPhotoInvokerMigration, /alter view public\.medicaments_cima_photos_public set schema private/);
  assert.match(cimaPhotoInvokerMigration, /alter view private\.cima_photo_projection_internal set \(security_invoker = true\)/);
  assert.match(cimaPhotoInvokerMigration, /create function private\.read_cima_photo_projection\(\)/);
  assert.match(cimaPhotoInvokerMigration, /returns setof private\.cima_photo_projection_internal/);
  assert.match(cimaPhotoInvokerMigration, /security definer\s+set search_path = ''/);
  assert.match(cimaPhotoInvokerMigration, /grant execute on function private\.read_cima_photo_projection\(\) to anon, authenticated, service_role/);
  assert.match(cimaPhotoInvokerMigration, /with \(security_barrier = true, security_invoker = true\)/);
  assert.match(cimaPhotoInvokerMigration, /revoke all on private\.cima_photo_projection_internal from public, anon, authenticated, service_role/);
});
