begin;

do $test$
declare
  v_def text;
  v_secdef boolean;
begin
  if to_regclass('public.admin_partner_dossiers') is null then
    raise exception 'Étape 1 : registre transversal des dossiers partenaires absent';
  end if;
  if to_regclass('public.pharmacie_services') is null then
    raise exception 'Étape 2 : rattachement des services à la pharmacie absent';
  end if;
  if not exists(select 1 from pg_class where oid='public.admin_partner_dossiers'::regclass and relrowsecurity)
     or not exists(select 1 from pg_class where oid='public.pharmacie_services'::regclass and relrowsecurity) then
    raise exception 'RLS obligatoire sur les deux registres administratifs';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='pharmacie_services'
      and policyname='pharmacie_services_admin_all' and qual like '%is_admin%') then
    raise exception 'Lecture/écriture du service non limitée à l’administration';
  end if;
  select pg_get_functiondef(p.oid), p.prosecdef into v_def,v_secdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='admin_create_partner_dossier';
  if v_def is null or v_secdef is distinct from true
     or position('public.is_admin()' in v_def)=0
     or position('public.admin_partner_dossiers' in v_def)=0
     or position('public.partner_members' in v_def)=0
     or position('update public.profiles set actif=false' in v_def)=0 then
    raise exception 'RPC de création atomique du dossier partenaire absente ou insuffisamment protégée';
  end if;
  if has_function_privilege('anon','public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb)','EXECUTE') then
    raise exception 'Le rôle anon ne doit pas exécuter la création de dossiers';
  end if;
  select pg_get_functiondef(p.oid),p.prosecdef into v_def,v_secdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='admin_set_pharmacie_bebe_maman_service';
  if v_def is null or v_secdef is distinct from true
     or position('public.is_admin()' in v_def)=0
     or position('public.pharmacie_services' in v_def)=0 then
    raise exception 'RPC de rattachement Bébé & Maman absente ou insuffisamment protégée';
  end if;
  if has_function_privilege('anon','public.admin_set_pharmacie_bebe_maman_service(uuid,boolean)','EXECUTE') then
    raise exception 'Le rôle anon ne doit pas activer les services pharmacie';
  end if;
  if position('public.partners' in v_def) > 0 or position('public.partner_universes' in v_def) > 0 then
    raise exception 'Bébé & Maman doit être un service de pharmacie, jamais un partenaire autonome';
  end if;
  select pg_get_functiondef(p.oid),p.prosecdef into v_def,v_secdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='admin_valider_dossier_partenaire';
  if v_def is null or v_secdef is distinct from true
     or position('public.is_admin()' in v_def)=0
     or position('public.admin_partner_dossiers' in v_def)=0
     or position('update public.profiles set actif=true' in v_def)=0 then
    raise exception 'Validation du dossier partenaire absente ou insuffisamment protégée';
  end if;
  if has_function_privilege('anon','public.admin_valider_dossier_partenaire(uuid)','EXECUTE') then
    raise exception 'Le rôle anon ne doit pas valider les dossiers partenaires';
  end if;
end
$test$;

rollback;
select 'Contrat 20261026100000 — dossiers transversaux et service Bébé & Maman : PASS structurel' as resultat;
