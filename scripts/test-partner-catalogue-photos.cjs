const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20261111100000_partner_catalogue_photo_library.sql");
const sqlTest = read("supabase/tests/20261111100000_partner_catalogue_photo_library.sql");
const page = read("src/app/partenaire/catalogue/page.tsx");
const actions = read("src/app/partenaire/catalogue/actions.ts");
const uploader = read("src/app/partenaire/catalogue/PartnerCataloguePhoto.tsx");
const e2e = read("scripts/storage-e2e.cjs");
const catalog = read("src/components/universes/UniverseCatalog.tsx");

test("bucket photo public uniquement pour l’affichage catalogue, avec taille et MIME bornés", () => {
  assert.match(migration, /'partner-catalogue-photos'[\s\S]*true[\s\S]*2097152[\s\S]*image\/webp/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /image\/png/);
});

test("provenance et déclaration de droits sont conservées sans présenter cela comme une certification NAXA", () => {
  for (const column of ["photo_path", "photo_source_url", "photo_licence", "photo_rights_confirmed_at", "photo_rights_confirmed_by", "photo_uploaded_by"]) {
    assert.match(migration, new RegExp("ADD COLUMN IF NOT EXISTS " + column));
  }
  assert.match(migration, /ne constitue pas une certification juridique NAXA/);
  assert.match(migration, /partner_products_photo_provenance_complete/);
});

test("upload et suppression Storage sont bornés au partenaire, à l’univers et au produit exacts", () => {
  assert.match(migration, /partner_catalogue_photo_insert/);
  assert.match(migration, /partner_catalogue_photo_delete/);
  assert.match(migration, /partner_members/);
  assert.match(migration, /partner_universes/);
  assert.match(migration, /pp\.partner_id::text = split_part\(name, '/', 1\)/);
  assert.match(migration, /pp\.id::text = split_part\(name, '/', 2\)/);
  assert.match(migration, /pm\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /pm\.member_role IN \('owner', 'manager', 'operator'\)/);
  assert.doesNotMatch(migration, /CREATE POLICY partner_catalogue_photo_update/);
  const deletePolicy = migration.split("CREATE POLICY partner_catalogue_photo_delete")[1].split("END IF;")[0];
  assert.doesNotMatch(deletePolicy, /pp\.photo_path = name/);
});

test("le formulaire photo compresse en WebP, refuse les formats non admis et exige source/licence/droits", () => {
  assert.match(uploader, /createImageBitmap/);
  assert.match(uploader, /canvas\.toBlob/);
  assert.match(uploader, /"image\/webp"/);
  assert.match(uploader, /MAX_STORED_BYTES = 2 \* 1024 \* 1024/);
  assert.match(uploader, /sourceHttps\(sourceUrl\.trim\(\)\)/);
  assert.match(uploader, /licence\.trim\(\)\.length < 5/);
  assert.match(uploader, /rightsConfirmed/);
  assert.match(uploader, /upsert: false/);
});

test("la fiche partenaire relie l’image au produit et la vitrine publique continue d’utiliser photo_url", () => {
  assert.match(page, /PartnerCataloguePhoto/);
  assert.match(page, /photo_url,photo_path,photo_source_url,photo_licence/);
  assert.match(actions, /enregistrerPhotoProduitCatalogue/);
  assert.match(actions, /retirerPhotoProduitCatalogue/);
  assert.match(actions, /getPublicUrl\(photoPath\)/);
  assert.match(actions, /photo_rights_confirmed_by: userId/);
  assert.match(catalog, /photo_url/);
});

test("le chemin Storage est contrôlé côté serveur et le bucket reste fermé aux comptes non partenaires", () => {
  assert.match(actions, /cheminPhotoAutorise\(photoPath, partnerId, productId\)/);
  assert.match(actions, /memberships\.some/);
  assert.match(e2e, /BUCKET_PARTNER_CATALOGUE_PHOTOS/);
  assert.match(e2e, /partner-catalogue-photos/);
});

test("le contrat SQL couvre le bucket, la provenance et les policies partenaire", () => {
  assert.match(sqlTest, /partner-catalogue-photos/);
  assert.match(sqlTest, /partner_catalogue_photo_insert/);
  assert.match(sqlTest, /partner_catalogue_photo_delete/);
  assert.match(sqlTest, /partner_products_photo_provenance_complete/);
});

process.stdout.write("Contrat photos catalogue partenaire vérifié.\n");
