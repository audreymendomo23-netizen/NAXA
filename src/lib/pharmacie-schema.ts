/**
 * BROUILLON Preview — hypothèses basées sur supabase/schema.sql.
 * Après la requête de diagnostic, corriger uniquement ce fichier si nécessaire.
 * Les routes utilisent ces constantes pour les noms de tables/colonnes.
 */
export const PHARMACIE_SCHEMA = {
  pharmaciesTable: "pharmacies",
  pharmacyIdColumn: "id",
  pharmacyNameColumn: "nom",
  pharmacyCodeColumn: "code_pharmacie",
  profilesTable: "profiles",
  profileIdColumn: "id",
  profilePharmacyIdColumn: "pharmacie_id",
  profileUsernameColumn: "username",
  profileEmailColumn: "email",
  profileActiveColumn: "actif",
} as const;
