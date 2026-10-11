-- NAXA 071 — fonctions métier et validation pharmaceutique à distance
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

insert into public.naxa_privileges(code,family,description,delegable,governance_only) values
('SUBMIT_PHARMACEUTICAL_VALIDATION','PHARMACIE','Soumettre un dossier au pharmacien habilité',true,false),
('VIEW_PHARMACEUTICAL_VALIDATIONS','PHARMACIE','Voir les dossiers pharmaceutiques autorisés dans le périmètre',true,false),
('VALIDATE_PHARMACEUTICAL_DOCUMENT','PHARMACIE','Valider ou refuser un dossier pharmaceutique en qualité de pharmacien',false,false),
('REQUEST_PHARMACEUTICAL_INFO','PHARMACIE','Demander un complément au dossier pharmaceutique',false,false),
('VIEW_PHARMACEUTICAL_AUDIT','SECURITY','Consulter les décisions pharmaceutiques et leur piste d’audit',false,false),
('MANAGE_ACCOUNTING','FINANCE','Gérer les opérations financières autorisées avec audit',true,false),
('MANAGE_STOCK_OPERATIONS','STOCK','Gérer les mouvements et inventaires autorisés',true,false),
('RECEIVE_STOCK','STOCK','Enregistrer une réception physique de stock',true,false)
on conflict (code) do update set family=excluded.family,description=excluded.description,delegable=excluded.delegable,governance_only=excluded.governance_only;

-- Les droits sont attribués explicitement par fonction ; aucun héritage global Responsable/Promoteur.
insert into public.naxa_role_privileges(role_key,privilege_code) values
('pharmacien','SUBMIT_PHARMACEUTICAL_VALIDATION'),
('pharmacien','VIEW_PHARMACEUTICAL_VALIDATIONS'),
('pharmacien','VALIDATE_PHARMACEUTICAL_DOCUMENT'),
('pharmacien','REQUEST_PHARMACEUTICAL_INFO'),
('pharmacien','VIEW_PHARMACEUTICAL_AUDIT'),
('preparateur','SUBMIT_PHARMACEUTICAL_VALIDATION'),
('preparateur','VIEW_PHARMACEUTICAL_VALIDATIONS'),
('agent_accueil','SUBMIT_PHARMACEUTICAL_VALIDATION'),
('agent_accueil','VIEW_PHARMACEUTICAL_VALIDATIONS'),
('responsable','VIEW_PHARMACEUTICAL_VALIDATIONS'),
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
  constraint naxa_validation_document_path_format check (document_storage_path like pharmacie_id::text || '/' || id::text || '/%')
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
  public.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE')
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
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[2] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.naxa_validations_pharmaceutiques v
    where v.id=(storage.foldername(name))[2]::uuid
      and v.pharmacie_id=(storage.foldername(name))[1]::uuid
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
  and exists (
    select 1 from public.naxa_validations_pharmaceutiques v
    where v.id=(storage.foldername(name))[2]::uuid
      and v.pharmacie_id=(storage.foldername(name))[1]::uuid
      and public.naxa_scope_allows(auth.uid(),v.pharmacie_id,'PHARMACIE')
      and (
        v.soumis_par=auth.uid()
        or public.naxa_can('VIEW_PHARMACEUTICAL_VALIDATIONS',v.pharmacie_id,null)
        or public.is_admin()
      )
  )
);
drop policy if exists naxa_validation_documents_update on storage.objects;
create policy naxa_validation_documents_update on storage.objects
for update to authenticated
using (
  bucket_id='naxa-validations-pharmaceutiques'
  and exists (
    select 1 from public.naxa_validations_pharmaceutiques v
    where v.id=(storage.foldername(name))[2]::uuid
      and v.soumis_par=auth.uid() and v.statut='brouillon'
  )
)
with check (bucket_id='naxa-validations-pharmaceutiques');

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

commit;
