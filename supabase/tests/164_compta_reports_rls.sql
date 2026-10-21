-- Vérification de base des droits du poste comptable.
-- Exécuter après migration_20261020_compta_socle.sql sur une base isolée.
do $$
declare t text;
begin
  foreach t in array array[
    'compta_periodes','compta_parametre','compta_plan_comptable',
    'compta_mapping_compte','compta_evenement','compta_ecriture',
    'compta_ligne','compta_audit_tete','compta_audit'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=t and c.relrowsecurity
    ) then raise exception 'RLS absent sur public.%',t; end if;
  end loop;
  if has_table_privilege('authenticated','public.compta_ecriture','INSERT')
    or has_table_privilege('authenticated','public.compta_ecriture','UPDATE')
    or has_table_privilege('authenticated','public.compta_ecriture','DELETE') then
    raise exception 'Le rôle authenticated possède un droit d’écriture comptable direct';
  end if;
  if has_table_privilege('authenticated','public.compta_audit','INSERT')
    or has_table_privilege('authenticated','public.compta_audit','UPDATE')
    or has_table_privilege('authenticated','public.compta_audit','DELETE') then
    raise exception 'Le rôle authenticated peut modifier le journal d’audit';
  end if;
  if not has_function_privilege('service_role','public.compta_generer_rapport_mensuel()','EXECUTE') then
    raise exception 'service_role ne peut pas lancer le générateur planifié';
  end if;
end $$;
select '164_compta_reports_rls PASS' as resultat;
