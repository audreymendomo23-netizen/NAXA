-- NAXA — Agrément Pharmacien pharmacie + soumission d'ordonnance Client.
-- La validation Admin est obligatoire avant toute affectation/activation du poste.
-- Les documents restent dans des buckets privés et les accès sont liés au dossier métier.

begin;

create table if not exists public.naxa_pharmacien_accreditations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  proposed_by uuid not null references public.profiles(id) on delete restrict,
  registration_number text not null check (length(trim(registration_number)) between 3 and 100),
  issuing_authority text not null check (length(trim(issuing_authority)) between 2 and 180),
  specialty text,
  credential_storage_path text not null unique,
  valid_until date,
  motif text not null check (length(trim(motif)) between 5 and 500),
  status text not null default 'pending_admin'
    check (status in ('pending_admin','approved','rejected','revoked')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  assignment_id uuid unique references public.naxa_professional_assignments(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= created_at::date),
  check (
    (status='pending_admin' and reviewed_by is null and reviewed_at is null and assignment_id is null)
    or (status='approved' and reviewed_by is not null and reviewed_at is not null and assignment_id is not null)
    or (status in ('rejected','revoked') and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists naxa_pharmacien_accreditations_pharmacy_status_idx
  on public.naxa_pharmacien_accreditations(pharmacie_id,status,created_at desc);
create index if not exists naxa_pharmacien_accreditations_profile_status_idx
  on public.naxa_pharmacien_accreditations(profile_id,status,valid_until);
create unique index if not exists naxa_pharmacien_accreditations_one_pending_idx
  on public.naxa_pharmacien_accreditations(profile_id,pharmacie_id)
  where status='pending_admin';

alter table public.naxa_pharmacien_accreditations enable row level security;
grant select on public.naxa_pharmacien_accreditations to authenticated;
drop policy if exists naxa_pharmacien_accreditations_read_participants on public.naxa_pharmacien_accreditations;
create policy naxa_pharmacien_accreditations_read_participants
  on public.naxa_pharmacien_accreditations
  for select to authenticated
  using (
    profile_id=(select auth.uid())
    or proposed_by=(select auth.uid())
    or (select public.is_admin())
  );

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('naxa-pharmacien-accreditations','naxa-pharmacien-accreditations',false,10485760,
    array['application/pdf','image/jpeg','image/png']),
  ('naxa-client-prescriptions','naxa-client-prescriptions',false,10485760,
    array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists naxa_pharmacien_credential_insert_promoter on storage.objects;
create policy naxa_pharmacien_credential_insert_promoter
  on storage.objects for insert to authenticated
  with check (
    bucket_id='naxa-pharmacien-accreditations'
    and array_length(storage.foldername(name),1)=3
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists (
      select 1
      from public.profiles promoter
      join public.promoteur_pharmacies pp on pp.promoteur_id=promoter.id and pp.actif=true
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
      join public.profiles target on target.id=(storage.foldername(name))[2]::uuid and target.actif=true
      where promoter.id=(select auth.uid())
        and promoter.role::text='promoteur'
        and (storage.foldername(name))[3]=ph.id::text
        and private.naxa_promoteur_valide(promoter.id)
    )
    and coalesce(metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png')
  );

drop policy if exists naxa_pharmacien_credential_read_participants on storage.objects;
create policy naxa_pharmacien_credential_read_participants
  on storage.objects for select to authenticated
  using (
    bucket_id='naxa-pharmacien-accreditations'
    and exists (
      select 1 from public.naxa_pharmacien_accreditations a
      where a.credential_storage_path=objects.name
        and (
          a.profile_id=(select auth.uid())
          or a.proposed_by=(select auth.uid())
          or (select public.is_admin())
        )
    )
  );

drop policy if exists naxa_client_prescription_insert_own on storage.objects;
create policy naxa_client_prescription_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id='naxa-client-prescriptions'
    and array_length(storage.foldername(name),1)=2
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists (
      select 1
      from public.profiles p
      join public.pharmacies ph on ph.id=(storage.foldername(name))[2]::uuid
      where p.id=(select auth.uid())
        and p.actif=true
        and private.naxa_business_function(p.id)='client'
        and ph.actif=true
        and ph.visible_recherche=true
        and ph.archivee_le is null
    )
    and coalesce(metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png')
  );

drop policy if exists naxa_client_prescription_read_linked on storage.objects;
create policy naxa_client_prescription_read_linked
  on storage.objects for select to authenticated
  using (
    bucket_id='naxa-client-prescriptions'
    and exists (
      select 1 from public.prescriptions r
      where r.document_ref=objects.name
        and (
          r.client_id=(select auth.uid())
          or (
            private.naxa_business_function((select auth.uid()))='pharmacien'
            and private.naxa_active_role_pharmacy((select auth.uid()))=r.pharmacie_id
          )
          or (select public.is_admin())
        )
    )
  );

drop policy if exists naxa_client_prescription_delete_orphan on storage.objects;
create policy naxa_client_prescription_delete_orphan
  on storage.objects for delete to authenticated
  using (
    bucket_id='naxa-client-prescriptions'
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and not exists (
      select 1 from public.prescriptions r where r.document_ref=objects.name
    )
  );

create or replace function public.naxa_proposer_accreditation_pharmacien(
  p_target uuid,
  p_pharmacie uuid,
  p_registration_number text,
  p_issuing_authority text,
  p_specialty text,
  p_credential_storage_path text,
  p_valid_until date,
  p_motif text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
begin
  if v_actor is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if private.naxa_business_function(v_actor)<>'promoteur'
     or not private.naxa_promoteur_valide(v_actor) then
    raise exception 'Seul un Promoteur actif et valide peut proposer un Pharmacien' using errcode='42501';
  end if;
  if p_target is null or p_pharmacie is null or p_target=v_actor then
    raise exception 'Compte Pharmacien ou pharmacie invalide' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.profiles p where p.id=p_target and p.actif=true
      and p.role::text not in ('admin','promoteur')
  ) then
    raise exception 'Le compte cible doit exister et être actif' using errcode='23514';
  end if;
  if not exists(
    select 1 from public.pharmacies ph
    join public.promoteur_pharmacies pp on pp.pharmacie_id=ph.id
    where ph.id=p_pharmacie and ph.actif=true and ph.archivee_le is null
      and pp.promoteur_id=v_actor and pp.actif=true
  ) then
    raise exception 'Pharmacie hors réseau actif du Promoteur' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.naxa_roles r
    where r.code='pharmacien' and r.actif=true and r.assignable=true and r.portee='PHARMACIE'
  ) then raise exception 'Le rôle Pharmacien est indisponible'; end if;
  if nullif(trim(coalesce(p_registration_number,'')),'') is null
     or length(trim(p_registration_number))<3 or length(trim(p_registration_number))>100
     or nullif(trim(coalesce(p_issuing_authority,'')),'') is null
     or length(trim(p_issuing_authority))>180 then
    raise exception 'Numéro professionnel et autorité émettrice obligatoires' using errcode='22023';
  end if;
  if p_valid_until is not null and p_valid_until<current_date then
    raise exception 'Le justificatif professionnel est déjà expiré' using errcode='22023';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)' using errcode='22023';
  end if;
  if p_credential_storage_path is null
     or split_part(p_credential_storage_path,'/',1)<>v_actor::text
     or split_part(p_credential_storage_path,'/',2)<>p_target::text
     or split_part(p_credential_storage_path,'/',3)<>p_pharmacie::text
     or not exists(
       select 1 from storage.objects o
       where o.bucket_id='naxa-pharmacien-accreditations'
         and o.name=p_credential_storage_path
         and coalesce(o.metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png')
     ) then
    raise exception 'Justificatif absent, invalide ou hors périmètre' using errcode='23514';
  end if;
  if exists(
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
      and a.role_code='pharmacien' and a.statut='active'
      and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
  ) then raise exception 'Ce compte est déjà Pharmacien actif dans cette pharmacie'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target::text||':'||p_pharmacie::text||':pharmacien-accreditation',0));
  if exists(
    select 1 from public.naxa_pharmacien_accreditations a
    where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
      and a.status='pending_admin'
  ) then raise exception 'Une proposition Pharmacien attend déjà l’Administrateur'; end if;
  if exists(
    select 1 from public.naxa_pharmacien_accreditations a
    where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
      and a.status='approved'
      and (a.valid_until is null or a.valid_until>=current_date)
  ) then raise exception 'Un agrément Pharmacien valide existe déjà dans cette pharmacie'; end if;

  insert into public.naxa_pharmacien_accreditations(
    profile_id,pharmacie_id,proposed_by,registration_number,issuing_authority,
    specialty,credential_storage_path,valid_until,motif,status
  ) values(
    p_target,p_pharmacie,v_actor,trim(p_registration_number),trim(p_issuing_authority),
    nullif(trim(coalesce(p_specialty,'')),''),p_credential_storage_path,p_valid_until,
    trim(p_motif),'pending_admin'
  ) returning id into v_id;
  return v_id;
end
$function$;

revoke all on function public.naxa_proposer_accreditation_pharmacien(uuid,uuid,text,text,text,text,date,text) from public,anon;
grant execute on function public.naxa_proposer_accreditation_pharmacien(uuid,uuid,text,text,text,text,date,text) to authenticated;

create or replace function public.naxa_admin_decider_accreditation_pharmacien(
  p_accreditation uuid,
  p_decision text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_accreditation public.naxa_pharmacien_accreditations%rowtype;
  v_assignment uuid;
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Décision réservée à un Administrateur actif' using errcode='42501';
  end if;
  if p_decision not in ('approved','rejected','revoked') then
    raise exception 'Décision Pharmacien invalide' using errcode='22023';
  end if;
  if p_decision in ('rejected','revoked') and length(trim(coalesce(p_note,'')))<5 then
    raise exception 'Un motif de refus ou de retrait est obligatoire' using errcode='22023';
  end if;

  select * into v_accreditation
  from public.naxa_pharmacien_accreditations
  where id=p_accreditation for update;
  if not found then raise exception 'Dossier d’agrément Pharmacien introuvable' using errcode='P0002'; end if;

  if p_decision='approved' then
    if v_accreditation.status<>'pending_admin' then
      raise exception 'Seule une proposition en attente peut être approuvée' using errcode='23514';
    end if;
    if v_accreditation.valid_until is not null and v_accreditation.valid_until<current_date then
      raise exception 'Le justificatif professionnel a expiré avant décision' using errcode='23514';
    end if;
    if not exists(select 1 from public.profiles p where p.id=v_accreditation.profile_id and p.actif=true)
       or not exists(select 1 from public.pharmacies ph where ph.id=v_accreditation.pharmacie_id and ph.actif=true and ph.archivee_le is null)
       or not exists(select 1 from storage.objects o where o.bucket_id='naxa-pharmacien-accreditations' and o.name=v_accreditation.credential_storage_path) then
      raise exception 'Compte, pharmacie ou justificatif indisponible' using errcode='23514';
    end if;
    if exists(
      select 1 from public.naxa_professional_assignments a
      where a.profile_id=v_accreditation.profile_id and a.pharmacie_id=v_accreditation.pharmacie_id
        and a.role_code='pharmacien' and a.statut='active'
        and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
    ) then raise exception 'Une affectation Pharmacien active existe déjà'; end if;

    insert into public.naxa_professional_assignments(
      profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
      commence_at,expire_at,accorde_par
    ) values(
      v_accreditation.profile_id,v_accreditation.pharmacie_id,'pharmacien','pharmacien',
      'active','ordinaire',v_accreditation.motif,now(),null,v_accreditation.proposed_by
    ) returning id into v_assignment;

    update public.naxa_pharmacien_accreditations
    set status='approved',reviewed_by=v_actor,reviewed_at=now(),
        review_note=nullif(trim(coalesce(p_note,'')),''),assignment_id=v_assignment,updated_at=now()
    where id=p_accreditation;
    return v_assignment;
  end if;

  if p_decision='rejected' then
    if v_accreditation.status<>'pending_admin' then
      raise exception 'Seule une proposition en attente peut être rejetée' using errcode='23514';
    end if;
    update public.naxa_pharmacien_accreditations
    set status='rejected',reviewed_by=v_actor,reviewed_at=now(),
        review_note=trim(p_note),updated_at=now()
    where id=p_accreditation;
    return null;
  end if;

  if v_accreditation.status<>'approved' or v_accreditation.assignment_id is null then
    raise exception 'Seul un agrément actif peut être retiré' using errcode='23514';
  end if;
  update public.naxa_professional_assignments
  set statut='revoked',revoque_par=v_actor,revoque_at=now(),motif_revocation=trim(p_note)
  where id=v_accreditation.assignment_id and statut='active';
  if not found then raise exception 'Affectation Pharmacien déjà retirée ou expirée'; end if;
  update public.naxa_pharmacien_accreditations
  set status='revoked',reviewed_by=v_actor,reviewed_at=now(),
      review_note=trim(p_note),updated_at=now()
  where id=p_accreditation;
  return v_accreditation.assignment_id;
end
$function$;

revoke all on function public.naxa_admin_decider_accreditation_pharmacien(uuid,text,text) from public,anon;
grant execute on function public.naxa_admin_decider_accreditation_pharmacien(uuid,text,text) to authenticated;

-- Un compte pharmacien non agréé ne peut pas rester résolu comme poste actif,
-- même si une ancienne ligne de rôle actif ou une ancienne affectation subsiste.
create or replace function private.naxa_business_function(p_profile uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path=''
as $function$
  with resolved as (
    select coalesce(
      private.naxa_partner_business_function(p_profile),
      private.naxa_business_function_base(p_profile)
    ) as role_code
  )
  select case
    when resolved.role_code='pharmacien'
      and not exists(
        select 1
        from public.naxa_pharmacien_accreditations a
        join public.naxa_professional_assignments assignment
          on assignment.id=a.assignment_id
        where a.profile_id=p_profile
          and a.status='approved'
          and (a.valid_until is null or a.valid_until>=current_date)
          and assignment.profile_id=a.profile_id
          and assignment.pharmacie_id=a.pharmacie_id
          and assignment.role_code='pharmacien'
          and assignment.statut='active'
          and assignment.commence_at<=now()
          and (assignment.expire_at is null or assignment.expire_at>now())
      )
    then (select p.role::text from public.profiles p where p.id=p_profile)
    else resolved.role_code
  end
  from resolved;
$function$;

-- Vérification d'agrément dans le sélecteur universel : aucune activation par l'ancienne ligne seule.
do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.naxa_select_active_role(text,uuid,uuid)'::regprocedure
  ) into v_definition;

  v_old := E'where a.profile_id=v_uid and a.role_code=p_role_code\n        and a.pharmacie_id=p_pharmacie_id and a.statut=''active''\n        and a.commence_at<=now()';
  v_new := v_old || E'\n        and (p_role_code<>''pharmacien'' or exists (\n          select 1 from public.naxa_pharmacien_accreditations accreditation\n          where accreditation.profile_id=v_uid\n            and accreditation.pharmacie_id=p_pharmacie_id\n            and accreditation.status=''approved''\n            and (accreditation.valid_until is null or accreditation.valid_until>=current_date)\n            and accreditation.assignment_id=a.id\n        ))';
  if position(v_old in v_definition)=0 then
    raise exception 'Contrat de sélection du rôle actif inattendu ; migration interrompue';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;

-- Le RPC générique ne doit jamais créer un Pharmacien : le seul chemin est la proposition + décision Admin.
do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure
  ) into v_definition;

  v_old := 'if not exists(select 1 from public.naxa_roles r';
  v_new := 'if p_fonction=''pharmacien'' then raise exception ''Le poste Pharmacien exige une proposition et une validation administrative'' using errcode=''42501''; end if;' || chr(10) || '  ' || v_old;
  if position(v_old in v_definition)=0 then
    raise exception 'Contrat d''affectation professionnelle inattendu ; migration interrompue';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;

create or replace function public.naxa_client_soumettre_ordonnance(
  p_pharmacie uuid,
  p_document_path text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_client uuid:=auth.uid();
  v_prescription uuid;
begin
  if v_client is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if private.naxa_business_function(v_client)<>'client' then
    raise exception 'Repassez sur votre espace Client pour transmettre une ordonnance' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.profiles p
    where p.id=v_client and p.actif=true
  ) then raise exception 'Compte Client inactif' using errcode='42501'; end if;
  if p_pharmacie is null or not exists(
    select 1 from public.pharmacies ph
    where ph.id=p_pharmacie and ph.actif=true
      and ph.visible_recherche=true and ph.archivee_le is null
  ) then raise exception 'Pharmacie indisponible pour les ordonnances Client' using errcode='P0002'; end if;
  if p_document_path is null
     or split_part(p_document_path,'/',1)<>v_client::text
     or split_part(p_document_path,'/',2)<>p_pharmacie::text
     or not exists(
       select 1 from storage.objects o
       where o.bucket_id='naxa-client-prescriptions'
         and o.name=p_document_path
         and coalesce(o.metadata->>'mimetype','') in ('application/pdf','image/jpeg','image/png')
     ) then
    raise exception 'Document d’ordonnance absent ou hors périmètre' using errcode='23514';
  end if;
  if length(trim(coalesce(p_note,'')))>2000 then
    raise exception 'La note dépasse 2 000 caractères' using errcode='22023';
  end if;

  insert into public.prescriptions(
    pharmacie_id,client_id,source,document_ref,statut,validateur_id,validee_at
  ) values(
    p_pharmacie,v_client,'client',p_document_path,'en_attente',null,null
  ) returning id into v_prescription;

  insert into public.prescription_items(
    prescription_id,designation_prescrite,quantite_prescrite,instructions
  ) values(
    v_prescription,'Document original joint — vérification par le Pharmacien',1,
    nullif(trim(coalesce(p_note,'')),'')
  );
  return v_prescription;
end
$function$;

revoke all on function public.naxa_client_soumettre_ordonnance(uuid,text,text) from public,anon;
grant execute on function public.naxa_client_soumettre_ordonnance(uuid,text,text) to authenticated;

create or replace function public.naxa_client_mes_ordonnances()
returns table(
  id uuid,
  pharmacie_id uuid,
  pharmacie_nom text,
  document_ref text,
  statut text,
  motif_rejet text,
  created_at timestamptz,
  preparation_statut text,
  motif_complement text
)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_client uuid:=auth.uid();
begin
  if v_client is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if private.naxa_business_function(v_client)<>'client' then
    raise exception 'Repassez sur votre espace Client pour consulter vos ordonnances' using errcode='42501';
  end if;
  return query
  select r.id,r.pharmacie_id,ph.nom::text,r.document_ref,r.statut::text,r.motif_rejet,
    r.created_at,prep.statut,prep.motif_complement
  from public.prescriptions r
  join public.pharmacies ph on ph.id=r.pharmacie_id
  left join public.prescription_preparations prep on prep.prescription_id=r.id
  where r.client_id=v_client and r.source='client'
  order by r.created_at desc
  limit 100;
end
$function$;

revoke all on function public.naxa_client_mes_ordonnances() from public,anon;
grant execute on function public.naxa_client_mes_ordonnances() to authenticated;

drop policy if exists prescriptions_client_submit on public.prescriptions;
create policy prescriptions_client_submit
  on public.prescriptions for insert to authenticated
  with check (
    (select auth.uid())=client_id
    and source='client'
    and statut='en_attente'
    and validateur_id is null
    and validee_at is null
    and private.naxa_business_function((select auth.uid()))='client'
    and document_ref is not null
    and exists(
      select 1 from storage.objects o
      where o.bucket_id='naxa-client-prescriptions'
        and o.name=document_ref
        and split_part(o.name,'/',1)=(select auth.uid())::text
        and split_part(o.name,'/',2)=pharmacie_id::text
    )
  );

drop policy if exists prescriptions_client_read_own on public.prescriptions;
create policy prescriptions_client_read_own
  on public.prescriptions for select to authenticated
  using (client_id=(select auth.uid()) and source='client');

drop policy if exists prescription_items_client_read_own on public.prescription_items;
create policy prescription_items_client_read_own
  on public.prescription_items for select to authenticated
  using (
    exists(
      select 1 from public.prescriptions r
      where r.id=prescription_items.prescription_id
        and r.client_id=(select auth.uid())
        and r.source='client'
    )
  );

commit;
