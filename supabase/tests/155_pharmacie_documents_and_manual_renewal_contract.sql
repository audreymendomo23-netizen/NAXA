-- NAXA 155 — tests ciblés de contrat pour le dossier documentaire et le renouvellement manuel.
-- À exécuter sur une base de test après application des migrations 20261022143000 et 20261022150000.
-- Test sans données métier persistantes : la transaction est annulée à la fin.
begin;

do $test$
declare
  v_def text;
  v_secdef boolean;
  v_rls boolean;
  v_public boolean;
  v_bucket record;
begin
  if to_regclass('public.pharmacie_documents') is null
     or to_regclass('public.pharmacie_document_historique') is null
     or to_regclass('public.admin_pharmacie_audit') is null then
    raise exception '155.1 : une table documentaire ou d’audit manque (migrations non appliquées)';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c where c.oid='public.pharmacie_documents'::regclass;
  if v_rls is distinct from true then
    raise exception '155.2 : RLS absente sur pharmacie_documents';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pharmacie_documents'
      and policyname='pharmacie_documents_admin_select'
      and qual like '%is_admin%'
  ) then
    raise exception '155.3 : politique SELECT administrateur absente';
  end if;

  select b.public into v_public
  from storage.buckets b where b.id='pharmacie-documents';
  if v_public is distinct from false then
    raise exception '155.4 : le bucket documentaire doit rester privé';
  end if;

  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='pharmacie_documents'
      and t.tgname='trg_journaliser_pharmacie_document' and not t.tgisinternal
  ) then
    raise exception '155.5 : déclencheur d’historique absent';
  end if;

  select pg_get_functiondef(p.oid), p.prosecdef
    into v_def, v_secdef
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='admin_renouveler_promoteur'
    and pg_get_function_identity_arguments(p.oid)='p_promoteur uuid, p_nouvelle_echeance date, p_motif text, p_admin uuid';
  if v_def is null or v_secdef is distinct from true then
    raise exception '155.6 : RPC de renouvellement manuel absente ou non SECURITY DEFINER';
  end if;
  if position('Une convention et un abonnement uniques sont requis' in v_def)=0
     or position('Un lien promoteur-pharmacie unique est requis' in v_def)=0
     or position('admin_pharmacie_audit' in v_def)=0
     or position('date_paiement' in v_def)=0 then
    raise exception '155.7 : garde-fous, audit ou distinction avec le paiement manquants';
  end if;

  if has_function_privilege('anon','public.admin_renouveler_promoteur(uuid, date, text, uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_renouveler_promoteur(uuid, date, text, uuid)','EXECUTE') then
    raise exception '155.8 : RPC de renouvellement manuel accessible à anon/authenticated';
  end if;
  if not has_function_privilege('service_role','public.admin_renouveler_promoteur(uuid, date, text, uuid)','EXECUTE') then
    raise exception '155.9 : service_role ne peut pas appeler la RPC de renouvellement manuel';
  end if;
end
$test$;

rollback;
select 'Vérification 155 — documents privés, RLS, historique et renouvellement manuel : PASS contrat' as resultat;
