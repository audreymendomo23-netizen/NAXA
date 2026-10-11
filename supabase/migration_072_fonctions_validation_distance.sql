-- NAXA 072 — fonctions métier et validation pharmaceutique à distance
-- Additif : aucune modification de role_type, aucune écriture Production.
begin;

-- Les postes métier restent des fonctions internes, pas des niveaux hiérarchiques.
alter table public.profiles drop constraint if exists profiles_fonction_interne_check;
alter table public.profiles drop constraint if exists profiles_fonction_interne_ck;
alter table public.profiles add constraint profiles_fonction_interne_check
  check (fonction_interne is null or fonction_interne in (
    'promoteur','responsable','caisse','manager_regional','chef_agence','custom',
    'pharmacien','preparateur','agent_accueil','comptable','gestionnaire_stock','magasinier'
  ));

-- Les tables de mapping utilisent des clés de fonction, pas des valeurs role_type.
alter table public.naxa_role_privileges drop constraint if exists naxa_role_privileges_role_key_check;
alter table public.naxa_role_privileges add constraint naxa_role_privileges_role_key_check
  check (role_key in ('admin','promoteur','responsable','caisse','pharmacien','preparateur','agent_accueil','comptable','gestionnaire_stock','magasinier'));

alter table public.naxa_architecture_privileges drop constraint if exists naxa_architecture_privileges_role_key_check;
alter table public.naxa_architecture_privileges add constraint naxa_architecture_privileges_role_key_check
  check (role_key in ('admin','promoteur','responsable','caisse','pharmacien','preparateur','agent_accueil','comptable','gestionnaire_stock','magasinier'));

-- Schéma Production et branches de test ont divergé : certaines bases n'ont
-- que family/description, d'autres exposent aussi famille/libelle/governance_only.
-- Écrire uniquement les colonnes existantes, tout en synchronisant les alias présents.
do $naxa072_privileges$
declare
  v_priv record;
  v_row jsonb;
  v_cols text;
  v_select text;
  v_updates text;
begin
  for v_priv in
    select * from (values
      ('SUBMIT_PHARMACEUTICAL_VALIDATION','PHARMACIE','Soumettre un dossier au pharmacien habilité',true,false,1,3,true),
      ('VIEW_PHARMACEUTICAL_VALIDATIONS','PHARMACIE','Voir les dossiers pharmaceutiques autorisés dans le périmètre',true,false,1,3,true),
      ('VALIDATE_PHARMACEUTICAL_DOCUMENT','PHARMACIE','Valider ou refuser un dossier pharmaceutique en qualité de pharmacien',false,false,1,3,true),
      ('REQUEST_PHARMACEUTICAL_INFO','PHARMACIE','Demander un complément au dossier pharmaceutique',false,false,1,3,true),
      ('VIEW_PHARMACEUTICAL_AUDIT','SECURITY','Consulter les décisions pharmaceutiques et leur piste d’audit',false,false,1,3,true),
      ('MANAGE_ACCOUNTING','FINANCE','Gérer les opérations financières autorisées avec audit',true,false,1,3,true),
      ('MANAGE_STOCK_OPERATIONS','STOCK','Gérer les mouvements et inventaires autorisés',true,false,1,3,true),
      ('RECEIVE_STOCK','STOCK','Enregistrer une réception physique de stock',true,false,1,3,true)
    ) as p(code,family,description,delegable,governance,niveau_min,niveau_max,active)
  loop
    v_row := jsonb_build_object(
      'code',v_priv.code,'family',v_priv.family,'famille',v_priv.family,
      'description',v_priv.description,'libelle',v_priv.description,
      'delegable',v_priv.delegable,'governance_only',false,'governance',v_priv.governance,
      'niveau_min',v_priv.niveau_min,'niveau_max',v_priv.niveau_max,'active',v_priv.active
    );
    select string_agg(format('%I',a.attname),', ' order by a.attnum),
           string_agg(format('r.%I',a.attname),', ' order by a.attnum)
      into v_cols,v_select
    from pg_attribute a
    where a.attrelid='public.naxa_privileges'::regclass
      and a.attnum > 0 and not a.attisdropped
      and a.attname in ('code','family','famille','description','libelle','delegable',
                        'governance_only','governance','niveau_min','niveau_max','active');
    select string_agg(format('%I = excluded.%I',a.attname,a.attname),', ' order by a.attnum)
      into v_updates
    from pg_attribute a
    where a.attrelid='public.naxa_privileges'::regclass
      and a.attnum > 0 and not a.attisdropped and a.attname <> 'code'
      and a.attname in ('family','famille','description','libelle','delegable',
                        'governance_only','governance','niveau_min','niveau_max','active');
    execute format(
      'insert into public.naxa_privileges (%s) select %s from jsonb_populate_record(null::public.naxa_privileges, $1) r on conflict (code) do update set %s',
      v_cols,v_select,v_updates
    ) using v_row;
  end loop;
end;
$naxa072_privileges$;

-- Droits atomiques attribués explicitement par fonction.
insert into public.naxa_role_privileges(role_key,privilege_code) values
('pharmacien','SUBMIT_PHARMACEUTICAL_VALIDATION'),
('pharmacien','VIEW_PHARMACEUTICAL_VALIDATIONS'),
('pharmacien','VALIDATE_PHARMACEUTICAL_DOCUMENT'),
('pharmacien','REQUEST_PHARMACEUTICAL_INFO'),
('pharmacien','VIEW_PHARMACEUTICAL_AUDIT'),
('preparateur','SUBMIT_PHARMACEUTICAL_VALIDATION'),
('agent_accueil','SUBMIT_PHARMACEUTICAL_VALIDATION'),
('comptable','MANAGE_ACCOUNTING'),
('gestionnaire_stock','MANAGE_STOCK_OPERATIONS'),
('magasinier','RECEIVE_STOCK')
on conflict do nothing;

insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.architecture_code,r.role_key,rp.privilege_code
from (values ('ORPHELIN'),('PARENTS_ENFANTS'),('PARENTS_AINES_CADETS'),('HYBRIDE')) a(architecture_code)
join (values ('pharmacien'),('preparateur'),('agent_accueil'),('comptable'),('gestionnaire_stock'),('magasinier')) r(role_key) on true
join public.naxa_role_privileges rp on rp.role_key=r.role_key
where rp.privilege_code in (
  'SUBMIT_PHARMACEUTICAL_VALIDATION','VIEW_PHARMACEUTICAL_VALIDATIONS',
  'VALIDATE_PHARMACEUTICAL_DOCUMENT','REQUEST_PHARMACEUTICAL_INFO','VIEW_PHARMACEUTICAL_AUDIT',
  'MANAGE_ACCOUNTING','MANAGE_STOCK_OPERATIONS','RECEIVE_STOCK'
)
on conflict do nothing;

create table if not exists public.naxa_validations_pharmaceutiques (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  type_document text not null check (type_document in ('prescription','ordonnance','consultation')),
  objet text not null check (length(trim(objet)) between 3 and 500),
  soumis_par uuid not null references public.profiles(id) on delete restrict,
  document_storage_path text not null,
  statut text not null default 'brouillon' check (statut in ('brouillon','en_attente','approuvee','refusee','complement_requis')),
  decide_par uuid references public.profiles(id) on delete restrict,
  decision_commentaire text,
  cree_le timestamptz not null default now(),
  soumis_le timestamptz,
  decide_le timestamptz,
  updated_at timestamptz not null default now(),
  constraint naxa_validation_document_path_format
    check (document_storage_path like (pharmacie_id::text || '/' || id::text || '/%'))
);

create index if not exists naxa_validations_pharmacie_statut_idx
  on public.naxa_validations_pharmaceutiques(pharmacie_id,statut,cree_le desc);
create index if not exists naxa_validations_soumis_par_idx
  on public.naxa_validations_pharmaceutiques(soumis_par,cree_le desc);

alter table public.naxa_validations_pharmaceutiques enable row level security;
drop policy if exists naxa_validations_pharmaceutiques_read on public.naxa_validations_pharmaceutiques;
create policy naxa_validations_pharmaceutiques_read
on public.naxa_validations_pharmaceutiques for select to authenticated
using (
  (public.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE') or public.is_admin())
  and (
    soumis_par=auth.uid()
    or public.naxa_can('VIEW_PHARMACEUTICAL_VALIDATIONS',pharmacie_id,null)
    or public.is_admin()
  )
);
revoke insert,update,delete on public.naxa_validations_pharmaceutiques from anon,authenticated;
grant select on public.naxa_validations_pharmaceutiques to authenticated;

-- Stockage privé : pharmacie/dossier/nom-du-fichier. Aucun document médical public.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('naxa-validations-pharmaceutiques','naxa-validations-pharmaceutiques',false,10485760,
  array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=array['application/pdf','image/jpeg','image/png'];

drop policy if exists naxa_validation_documents_insert on storage.objects;
create policy naxa_validation_documents_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='naxa-validations-pharmaceutiques'
  and split_part(name,'/',1) ~* '^[0-9a-f-]{36}$'
  and split_part(name,'/',2) ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.naxa_validations_pharmaceutiques v
    where v.id=case when split_part(name,'/',2) ~* '^[0-9a-f-]{36}$' then split_part(name,'/',2)::uuid end
      and v.pharmacie_id=case when split_part(name,'/',1) ~* '^[0-9a-f-]{36}$' then split_part(name,'/',1)::uuid end
      and v.soumis_par=auth.uid()
      and v.statut='brouillon'
      and public.naxa_scope_allows(auth.uid(),v.pharmacie_id,'PHARMACIE')
  )
);
drop policy if exists naxa_validation_documents_read on storage.objects;
create policy naxa_validation_documents_read on storage.objects
for select to authenticated
using (
  bucket_id='naxa-validations-pharmaceutiques'
  and split_part(name,'/',1) ~* '^[0-9a-f-]{36}$'
  and split_part(name,'/',2) ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.naxa_validations_pharmaceutiques v
    where v.id=case when split_part(name,'/',2) ~* '^[0-9a-f-]{36}$' then split_part(name,'/',2)::uuid end
      and v.pharmacie_id=case when split_part(name,'/',1) ~* '^[0-9a-f-]{36}$' then split_part(name,'/',1)::uuid end
      and (public.naxa_scope_allows(auth.uid(),v.pharmacie_id,'PHARMACIE') or public.is_admin())
      and (
        v.soumis_par=auth.uid()
        or public.naxa_can('VIEW_PHARMACEUTICAL_VALIDATIONS',v.pharmacie_id,null)
        or public.is_admin()
      )
  )
);
drop policy if exists naxa_validation_documents_update on storage.objects;

create table if not exists public.naxa_validations_pharmaceutiques_audit (
  id bigint generated always as identity primary key,
  validation_id uuid not null references public.naxa_validations_pharmaceutiques(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  acteur_id uuid references public.profiles(id) on delete restrict,
  action text not null,
  ancien_statut text,
  nouveau_statut text not null,
  commentaire text,
  cree_le timestamptz not null default now()
);
create index if not exists naxa_validations_audit_dossier_idx
  on public.naxa_validations_pharmaceutiques_audit(validation_id,cree_le desc);
alter table public.naxa_validations_pharmaceutiques_audit enable row level security;
drop policy if exists naxa_validations_audit_read on public.naxa_validations_pharmaceutiques_audit;
create policy naxa_validations_audit_read on public.naxa_validations_pharmaceutiques_audit
for select to authenticated
using (
  (public.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE') or public.is_admin())
  and (public.naxa_can('VIEW_PHARMACEUTICAL_AUDIT',pharmacie_id,null) or public.is_admin())
);
revoke insert,update,delete on public.naxa_validations_pharmaceutiques_audit from anon,authenticated;
grant select on public.naxa_validations_pharmaceutiques_audit to authenticated;

create table if not exists public.naxa_validations_pharmaceutiques_notifications (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null references public.naxa_validations_pharmaceutiques(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  destinataire_id uuid not null references public.profiles(id) on delete restrict,
  type text not null check (type in ('nouveau_dossier','decision','complement')),
  message text not null,
  cree_le timestamptz not null default now(),
  lu_le timestamptz
);
create index if not exists naxa_validations_notifications_recipient_idx
  on public.naxa_validations_pharmaceutiques_notifications(destinataire_id,lu_le,cree_le desc);
alter table public.naxa_validations_pharmaceutiques_notifications enable row level security;
drop policy if exists naxa_validations_notifications_read on public.naxa_validations_pharmaceutiques_notifications;
create policy naxa_validations_notifications_read on public.naxa_validations_pharmaceutiques_notifications
for select to authenticated using (destinataire_id=auth.uid());
revoke insert,update,delete on public.naxa_validations_pharmaceutiques_notifications from anon,authenticated;
grant select on public.naxa_validations_pharmaceutiques_notifications to authenticated;

create or replace function public.naxa_auditer_validation_pharmaceutique()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_action text;
begin
  if tg_op='INSERT' then
    insert into public.naxa_validations_pharmaceutiques_audit(validation_id,pharmacie_id,acteur_id,action,nouveau_statut,commentaire)
    values(new.id,new.pharmacie_id,new.soumis_par,'creation',new.statut,new.objet);
    return new;
  end if;
  if old.statut is distinct from new.statut then
    v_action := case
      when new.statut='en_attente' then 'soumission'
      when new.statut='approuvee' then 'validation'
      when new.statut='refusee' then 'refus'
      when new.statut='complement_requis' then 'complement_demande'
      else 'changement_statut'
    end;
    insert into public.naxa_validations_pharmaceutiques_audit(validation_id,pharmacie_id,acteur_id,action,ancien_statut,nouveau_statut,commentaire)
    values(new.id,new.pharmacie_id,coalesce(new.decide_par,new.soumis_par),v_action,old.statut,new.statut,new.decision_commentaire);
    if new.statut='en_attente' then
      insert into public.naxa_validations_pharmaceutiques_notifications(validation_id,pharmacie_id,destinataire_id,type,message)
      select new.id,new.pharmacie_id,p.id,'nouveau_dossier','Un dossier pharmaceutique attend votre décision.'
      from public.profiles p
      where p.actif=true and p.fonction_interne='pharmacien' and p.pharmacie_id=new.pharmacie_id;
    elsif new.statut in ('approuvee','refusee','complement_requis') then
      insert into public.naxa_validations_pharmaceutiques_notifications(validation_id,pharmacie_id,destinataire_id,type,message)
      values(new.id,new.pharmacie_id,new.soumis_par,
        case when new.statut='complement_requis' then 'complement' else 'decision' end,
        case new.statut when 'approuvee' then 'Le dossier a été validé par le pharmacien.'
          when 'refusee' then 'Le dossier a été refusé par le pharmacien.'
          else 'Le pharmacien demande un complément au dossier.' end);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.naxa_auditer_validation_pharmaceutique() from public,anon,authenticated;
drop trigger if exists trg_naxa_auditer_validation_pharmaceutique on public.naxa_validations_pharmaceutiques;
create trigger trg_naxa_auditer_validation_pharmaceutique
after insert or update on public.naxa_validations_pharmaceutiques
for each row execute function public.naxa_auditer_validation_pharmaceutique();

create or replace function public.naxa_creer_dossier_validation_pharmaceutique(
  p_pharmacie uuid,p_type_document text,p_objet text,p_nom_fichier text
) returns table(validation_id uuid,storage_path text)
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := gen_random_uuid();
  v_fn text;
  v_path text;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  v_fn := public.naxa_business_function(v_uid);
  if v_fn not in ('pharmacien','preparateur','agent_accueil','responsable') then
    raise exception 'Fonction non autorisée à soumettre ce dossier';
  end if;
  if not public.naxa_can('SUBMIT_PHARMACEUTICAL_VALIDATION',p_pharmacie,null)
     or not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then
    raise exception 'Pharmacie hors périmètre ou privilège absent';
  end if;
  if p_type_document not in ('prescription','ordonnance','consultation') then
    raise exception 'Type de document invalide';
  end if;
  if p_objet is null or length(trim(p_objet)) not between 3 and 500 then
    raise exception 'Objet invalide';
  end if;
  if p_nom_fichier is null or p_nom_fichier !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$' then
    raise exception 'Nom de fichier invalide';
  end if;
  v_path := p_pharmacie::text || '/' || v_id::text || '/' || p_nom_fichier;
  insert into public.naxa_validations_pharmaceutiques(id,pharmacie_id,type_document,objet,soumis_par,document_storage_path)
  values(v_id,p_pharmacie,p_type_document,trim(p_objet),v_uid,v_path);
  return query select v_id,v_path;
end;
$$;

create or replace function public.naxa_soumettre_dossier_validation_pharmaceutique(p_validation_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  v public.naxa_validations_pharmaceutiques%rowtype;
begin
  select * into v from public.naxa_validations_pharmaceutiques
  where id=p_validation_id and soumis_par=auth.uid() and statut='brouillon'
  for update;
  if not found then raise exception 'Brouillon introuvable ou non autorisé'; end if;
  if not public.naxa_scope_allows(auth.uid(),v.pharmacie_id,'PHARMACIE') then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id='naxa-validations-pharmaceutiques' and o.name=v.document_storage_path
  ) then raise exception 'Document privé manquant'; end if;
  update public.naxa_validations_pharmaceutiques
    set statut='en_attente',soumis_le=now(),updated_at=now()
    where id=v.id;
  return true;
end;
$$;

create or replace function public.naxa_decider_validation_pharmaceutique(
  p_validation_id uuid,p_decision text,p_commentaire text default null
) returns boolean language plpgsql security definer set search_path='' as $$
declare
  v public.naxa_validations_pharmaceutiques%rowtype;
  v_uid uuid := auth.uid();
  v_fn text;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  v_fn := public.naxa_business_function(v_uid);
  if v_fn <> 'pharmacien' then raise exception 'Décision réservée au pharmacien habilité'; end if;
  select * into v from public.naxa_validations_pharmaceutiques
  where id=p_validation_id and statut='en_attente'
  for update;
  if not found then raise exception 'Dossier absent ou déjà traité'; end if;
  if v.soumis_par=v_uid then raise exception 'Auto-validation interdite'; end if;
  if not public.naxa_can('VALIDATE_PHARMACEUTICAL_DOCUMENT',v.pharmacie_id,null)
     or not public.naxa_scope_allows(v_uid,v.pharmacie_id,'PHARMACIE') then
    raise exception 'Pharmacien non autorisé pour cette pharmacie';
  end if;
  if p_decision not in ('approuvee','refusee','complement_requis') then
    raise exception 'Décision invalide';
  end if;
  if p_decision='complement_requis' then
    if not public.naxa_can('REQUEST_PHARMACEUTICAL_INFO',v.pharmacie_id,null) then
      raise exception 'Privilège de demande de complément absent';
    end if;
    if p_commentaire is null or length(trim(p_commentaire))<3 then
      raise exception 'Un motif est requis pour demander un complément';
    end if;
  end if;
  update public.naxa_validations_pharmaceutiques
    set statut=p_decision,decide_par=v_uid,decision_commentaire=nullif(trim(p_commentaire),''),decide_le=now(),updated_at=now()
    where id=v.id;
  return true;
end;
$$;

revoke all on function public.naxa_creer_dossier_validation_pharmaceutique(uuid,text,text,text) from public,anon;
revoke all on function public.naxa_soumettre_dossier_validation_pharmaceutique(uuid) from public,anon;
revoke all on function public.naxa_decider_validation_pharmaceutique(uuid,text,text) from public,anon;
grant execute on function public.naxa_creer_dossier_validation_pharmaceutique(uuid,text,text,text) to authenticated;
grant execute on function public.naxa_soumettre_dossier_validation_pharmaceutique(uuid) to authenticated;
grant execute on function public.naxa_decider_validation_pharmaceutique(uuid,text,text) to authenticated;


-- Résolution canonique des fonctions internes dans le moteur de privilèges.
-- Les fonctions métier restent distinctes de role_type et ne reçoivent aucun
-- droit implicite : scope, architecture et délégation par profil restent exigés.
create or replace function private.naxa_business_function(p_profile uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when p.actif is not true then null
    when p.role::text='admin' then 'admin'
    when p.fonction_interne='responsable' then 'responsable'
    when p.role::text='promoteur' then 'promoteur'
    when p.role::text='caisse' then 'caisse'
    when p.fonction_interne in (
      'pharmacien','preparateur','agent_accueil','comptable','gestionnaire_stock','magasinier',
      'manager_regional','chef_agence','custom'
    ) then p.fonction_interne
    else null
  end
  from public.profiles p
  where p.id=p_profile
$function$;

create or replace function private.naxa_has_privilege(
  p_privilege text,
  p_pharmacie uuid default null,
  p_scope text default 'PHARMACIE'
)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  fn text;
  v_role_key text;
  arch text;
  target_pharmacy uuid := p_pharmacie;
begin
  if uid is null or p_privilege is null then return false; end if;
  if not exists (
    select 1 from public.naxa_privileges n
    where n.code=p_privilege and n.active
  ) then return false; end if;

  select public.naxa_business_function(uid) into fn;
  if fn is null then return false; end if;
  if fn='admin' then return true; end if;
  if fn='promoteur' and not private.naxa_promoteur_valide(uid) then return false; end if;
  if p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then return false; end if;

  if target_pharmacy is null then
    select pharmacie_id into target_pharmacy from public.profiles where id=uid;
  end if;

  if p_scope='RESEAU' then
    if fn<>'promoteur' then return false; end if;
    -- Un privilège RESEAU sans cible porte sur le réseau propre du Promoteur.
    -- Si une pharmacie est explicitement ciblée, elle doit appartenir à ce réseau.
    if p_pharmacie is not null
       and not public.naxa_scope_allows(uid, p_pharmacie, 'RESEAU') then
      return false;
    end if;
    return exists (
      select 1 from public.naxa_profile_privileges pp
      where pp.profile_id=uid and pp.privilege_code=p_privilege
        and pp.scope_type='RESEAU' and pp.pharmacie_id is null and pp.active
    );
  end if;

  if target_pharmacy is null then return false; end if;
  if not public.naxa_scope_allows(uid,target_pharmacy,p_scope) then return false; end if;

  select pa.architecture_code into arch
  from public.pharmacie_architectures pa
  where pa.pharmacie_id=target_pharmacy and pa.active;
  if arch is null then return false; end if;

  v_role_key := case
    when fn in (
      'promoteur','responsable','caisse','pharmacien','preparateur',
      'agent_accueil','comptable','gestionnaire_stock','magasinier'
    ) then fn
    else null
  end;

  if v_role_key is not null then
    if not exists (
      select 1 from public.naxa_architecture_privileges ap
      where ap.architecture_code=arch
        and ap.role_key=v_role_key
        and ap.privilege_code=p_privilege
    ) then return false; end if;
  else
    if not exists (
      select 1
      from public.profiles p
      join public.naxa_custom_roles cr
        on cr.pharmacie_id=target_pharmacy
       and cr.code=p.custom_role_code and cr.actif
      join public.naxa_custom_role_privileges cp
        on cp.custom_role_id=cr.id
      where p.id=uid and cp.privilege_code=p_privilege
    ) then return false; end if;
  end if;

  -- L'appartenance au catalogue ne suffit pas : la délégation effective reste requise.
  return exists (
    select 1 from public.naxa_profile_privileges pp
    where pp.profile_id=uid and pp.privilege_code=p_privilege
      and pp.pharmacie_id=target_pharmacy
      and pp.scope_type=p_scope and pp.active
  );
end
$function$;

commit;
