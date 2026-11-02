/**
 * Mirrors supabase/migration_244_hide_demo_pharmacies.sql.
 * Demo records are retained for audit but excluded from operational Admin KPIs.
 */
const DEMO_PHARMACY_NAME_PATTERN =
  /(^|[^\\p{L}\\p{N}])(?:démo|demo|test|mock|exemple|fictif)(?=$|[^\\p{L}\\p{N}])/iu;

export function isDemoPharmacy(name: string | null | undefined): boolean {
  return DEMO_PHARMACY_NAME_PATTERN.test(name ?? "");
}
