const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/20261111100000_partner_catalogue_photo_library.sql");
const provenanceMigration = read("supabase/migrations/20261111101500_private_partner_photo_provenance.sql");
const sqlTest = read("supabase/tests/20261111100000_partner_catalogue_photo_library.sql");
const page = read("src/app/partenaire/catalogue/page.tsx");
const actions = read("src/app/partenaire/catalogue/actions.ts");
const uploader = read("src/app/partenaire/catalogue/PartnerCataloguePhoto.tsx");
const e2e = read("scripts/storage-e2e.cjs");
const catalog = read("src/components/universes/UniverseCatalog.tsx");
const productGrid = read("src/components/universes/UniverseProductGrid.tsx");

test("bucket photo public uniquement pour l’affichage catalogue, avec taille et MIME bornés", () => {
  assert.match(migration, /'partner-catalogue-photos'[\s\S]*true[\s\S]*2097152[\s\S]*image\/webp/);
  assert.match(migration, /image\/jpeg/);
  assert.match(migration, /image\/png/);
});

test("la provenance est séparée de partner_products, protégée par RLS et non lisible anonymement", () => {
  assert.match(provenanceMigration, /CREATE TABLE IF NOT EXISTS public\.partner_product_photo_provenance/);
  assert.match(provenanceMigration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(provenanceMigration, /REVOKE ALL ON public\.partner_product_photo_provenance FROM PUBLIC, anon, authenticated/);
  assert.match(provenanceMigration, /partner_product_photo_provenance_member_manage/);
  assert.match(sqlTest, /has_table_privilege\('anon','public\.partner_product_photo_provenance','SELECT'\)/);
  assert.match(provenanceMigration, /source_url text NOT NULL/);
  assert.match(provenanceMigration, /licence text NOT NULL/);
});

test("les RPC lient et retirent atomiquement une photo au produit dans le périmètre partenaire", () => {
  assert.match(provenanceMigration, /partner_link_catalogue_photo/);
  assert.match(provenanceMigration, /partner_unlink_catalogue_photo/);
  assert.match(provenanceMigration, /GRANT EXECUTE ON FUNCTION public\.partner_link_catalogue_photo[\s\S]*TO authenticated/);
  assert.match(actions, /sb\.rpc\("partner_link_catalogue_photo"/);
  assert.match(actions, /sb\.rpc\("partner_unlink_catalogue_photo"/);
});

test("upload et suppression Storage sont bornés au partenaire, à l’univers et au produit exacts", () => {
  assert.match(migration, /partner_catalogue_photo_insert/);
  assert.match(migration, /partner_catalogue_photo_delete/);
  assert.match(migration, /partner_members/);
  assert.match(migration, /partner_universes/);
  assert.match(migration, /pp\.partner_id::text = split_part\(storage\.objects\.name, '\/', 1\)/);
  assert.match(migration, /pp\.id::text = split_part\(storage\.objects\.name, '/', 2\)/);
  assert.match(migration, /pm\.user_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(migration, /pm\.member_role IN \('owner', 'manager', 'operator'\)/);
  assert.doesNotMatch(migration, /CREATE POLICY partner_catalogue_photo_update/);
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
  assert.match(uploader, /MAX_DECODED_PIXELS = 32_000_000/);
  assert.match(uploader, /setSourceUrl\(photoSourceUrl \?\? ""\)/);
});

test("le parcours partenaire charge la provenance via la table protégée", () => {
  assert.match(page, /partner_product_photo_provenance/);
  assert.match(page, /photo_source_url: provenance\?\.source_url/);
  assert.match(page, /photo_licence: provenance\?\.licence/);
  assert.match(actions, /enregistrerPhotoProduitCatalogue/);
  assert.match(actions, /retirerPhotoProduitCatalogue/);
  assert.match(actions, /getPublicUrl\(photoPath\)/);
  assert.match(catalog, /photo_url/);
  assert.match(productGrid, /UniverseProductImage/);
  assert.match(productGrid, /aspect-\[4\/3\]/);
  assert.match(productGrid, /Photo non chargée/);
  assert.match(productGrid, /Prix affiché par le partenaire/);
  assert.match(productGrid, /Présentation neutre/);
  assert.match(productGrid, /Aucun produit sponsorisé, classement publicitaire ni avantage promotionnel/);
  assert.doesNotMatch(productGrid, /prix barré|remise spéciale|sponsorisé par|mise en avant/i);
});

test("le chemin Storage est contrôlé côté serveur et le bucket reste fermé aux comptes non partenaires", () => {
  assert.match(actions, /cheminPhotoAutorise\(photoPath, partnerId, productId\)/);
  const pathValidator = actions.split("\n").find(line => line.includes("WEBP_FILE"));
  assert.ok(pathValidator && pathValidator.includes(String.fromCharCode(92) + ".webp"));
  assert.ok(!pathValidator.includes(String.fromCharCode(92) + String.fromCharCode(92) + ".webp"));
  assert.match(actions, /memberships\.some/);
  assert.match(e2e, /BUCKET_PARTNER_CATALOGUE_PHOTOS/);
  assert.match(e2e, /partner-catalogue-photos/);
});

test("le contrat SQL couvre le bucket, la provenance protégée et les policies partenaire", () => {
  assert.match(sqlTest, /partner-catalogue-photos/);
  assert.match(sqlTest, /partner_product_photo_provenance_member_manage/);
  assert.match(sqlTest, /partner_link_catalogue_photo/);
  assert.match(sqlTest, /has_table_privilege\('anon'/);
});

process.stdout.write("Contrat photos catalogue partenaire vérifié.\n");
