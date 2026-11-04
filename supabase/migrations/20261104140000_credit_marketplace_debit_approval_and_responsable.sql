-- NAXA — Crédit Marketplace : débit physique atomique à l'approbation et délégation Responsable.
-- Migration additive, destinée au dépôt. Ne pas appliquer à Production sans autorisation explicite.
begin;

-- 1) Contrat de demande Marketplace : présent dans le code applicatif, absent de certaines bases.
alter table public.client_credit_requests
  add column if not exists origine text not null default 'caisse',
  add column if not exists telephone_demande text,
  add column if not exists date_remboursement date,
  add column if not exists justificatif_path text,
  add column if not exists panier_items jsonb,
  add column if not exists reservation_id uuid references public.reservations(id) on delete restrict;

alter table public.reservations
  add column if not exists credit_request_id uuid references public.client_credit_requests(id) on delete restrict,
  add column if not exists stock_decremented boolean not null default true,
  add column if not exists stock_restored boolean not null default false,
  add column if not exists consumed_by_vente_id uuid,
  add column if not exists consumed_at timestamptz,
  add column if not exists preparation_statut text,
  add column if not exists preparation_demarre_le timestamptz,
  add column if not exists prete_au_retrait_le timestamptz;

alter table public.reservations alter column preparation_statut set default 'non_commencee';
alter table public.reservations drop constraint if exists reservations_preparation_statut_check;
alter table public.reservations add constraint reservations_preparation_statut_check
  check (preparation_statut in ('non_commencee','en_preparation','prete_au_retrait','annulee'));

-- Une commande de crédit approuvée ne doit pas expirer comme un simple hold de réservation.
alter table public.reservations alter column expires_at drop not null;

create unique index if not exists reservations_credit_request_unique
  on public.reservations(credit_request_id) where credit_request_id is not null;
create unique index if not exists client_credit_requests_reservation_unique
  on public.client_credit_requests(reservation_id) where reservation_id is not null;
create index if not exists client_credit_marketplace_pending_idx
  on public.client_credit_requests(client_id,pharmacie_id,statut,created_at desc);

alter table public.client_credit_requests drop constraint if exists client_credit_requests_origine_check;
alter table public.client_credit_requests add constraint client_credit_requests_origine_check
  check (origine in ('caisse','marketplace'));

alter table public.reservations drop constraint if exists reservations_paiement_mode_check;
alter table public.reservations add constraint reservations_paiement_mode_check
  check (
    paiement_mode is null
    or paiement_mode = any(array[
      'mtn_marchand'::text,'orange_money'::text,'especes_retrait'::text,
      'especes_livraison'::text,'a_convenir'::text,'credit'::text
    ])
  );

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('credit-marketplace-justificatifs','credit-marketplace-justificatifs',false,10485760,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists credit_marketplace_proof_insert_own on storage.objects;
create policy credit_marketplace_proof_insert_own on storage.objects
for insert to authenticated with check (
  bucket_id='credit-marketplace-justificatifs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists credit_marketplace_proof_read_own on storage.objects;
create policy credit_marketplace_proof_read_own on storage.objects
for select to authenticated using (
  bucket_id='credit-marketplace-justificatifs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists credit_marketplace_proof_delete_own on storage.objects;
create policy credit_marketplace_proof_delete_own on storage.objects
for delete to authenticated using (
  bucket_id='credit-marketplace-justificatifs'
  and (storage.foldername(name))[1]=(select auth.uid())::text
);

-- 2) Affectations professionnelles : expiration uniquement pour les urgences.
create table if not exists public.naxa_professional_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  fonction text not null check (fonction in (
    'caisse','gestionnaire_stock','magasinier','pharmacien','responsable','comptable'
  )),
  statut text not null default 'active' check (statut in ('active','revoked')),
  nature_affectation text not null default 'ordinaire'
    check (nature_affectation in ('ordinaire','urgence')),
  motif text not null check (length(trim(motif)) between 5 and 500),
  commence_at timestamptz not null default now(),
  expire_at timestamptz,
  accorde_par uuid not null references public.profiles(id) on delete restrict,
  accorde_at timestamptz not null default now(),
  revoque_par uuid references public.profiles(id) on delete restrict,
  revoque_at timestamptz,
  motif_revocation text,
  created_at timestamptz not null default now(),
  constraint naxa_professional_assignment_period_ck check (
    (nature_affectation='ordinaire' and expire_at is null)
    or (nature_affectation='urgence' and expire_at is not null and expire_at>commence_at)
  ),
  constraint naxa_professional_assignment_revocation_ck check (
    (statut='active' and revoque_par is null and revoque_at is null)
    or (statut='revoked' and revoque_par is not null and revoque_at is not null)
  )
);

alter table public.naxa_professional_assignments
  add column if not exists nature_affectation text;
update public.naxa_professional_assignments
set nature_affectation=case when expire_at is null then 'ordinaire' else 'urgence' end
where nature_affectation is null;
alter table public.naxa_professional_assignments
  alter column nature_affectation set default 'ordinaire',
  alter column nature_affectation set not null,
  alter column expire_at drop not null;
alter table public.naxa_professional_assignments
  drop constraint if exists naxa_professional_assignment_period_ck;
alter table public.naxa_professional_assignments
  add constraint naxa_professional_assignment_period_ck check (
    (nature_affectation='ordinaire' and expire_at is null)
    or (nature_affectation='urgence' and expire_at is not null and expire_at>commence_at)
  );

create index if not exists naxa_professional_assignments_profile_active_idx
  on public.naxa_professional_assignments(profile_id,pharmacie_id,fonction,expire_at)
  where statut='active';
create index if not exists naxa_professional_assignments_pharmacy_idx
  on public.naxa_professional_assignments(pharmacie_id,statut,expire_at);
alter table public.naxa_professional_assignments enable row level security;
revoke all on public.naxa_professional_assignments from anon,authenticated;
grant select on public.naxa_professional_assignments to authenticated;
drop policy if exists naxa_professional_assignments_participant_read on public.naxa_professional_assignments;
create policy naxa_professional_assignments_participant_read
on public.naxa_professional_assignments for select to authenticated
using (
  profile_id=(select auth.uid()) or accorde_par=(select auth.uid())
  or revoque_par=(select auth.uid()) or (select public.is_admin())
);

create or replace function public.naxa_has_active_professional_assignment(
  p_profile uuid,p_pharmacie uuid,p_fonction text
) returns boolean
language sql stable security definer set search_path=''
as $function$
  select p_profile is not null and p_pharmacie is not null and p_fonction is not null
    and (p_profile=(select auth.uid()) or (select public.is_admin()))
    and (
      exists (
        select 1 from public.naxa_professional_assignments a
        join public.profiles p on p.id=a.profile_id and p.actif=true
        join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
        where a.profile_id=p_profile and a.pharmacie_id=p_pharmacie
          and a.fonction=p_fonction and a.statut='active'
          and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
      )
      or exists (
        select 1 from public.profiles p
        join public.pharmacies ph on ph.id=p_pharmacie and ph.actif=true
        where p.id=p_profile and p.actif=true and p.pharmacie_id=p_pharmacie
          and coalesce(p.fonction_interne,case p.role::text when 'caisse' then 'caisse' else null end)=p_fonction
      )
    );
$function$;
revoke all on function public.naxa_has_active_professional_assignment(uuid,uuid,text) from public,anon;
grant execute on function public.naxa_has_active_professional_assignment(uuid,uuid,text) to authenticated;

-- Une affectation explicite ouvre uniquement le périmètre de la pharmacie ciblée.
create or replace function private.naxa_scope_allows(
  p_profile uuid,p_pharmacie uuid,p_scope text default 'PHARMACIE'
) returns boolean
language sql stable security definer set search_path=''
as $function$
select case
  when p_profile is null then false
  when p_scope='RESEAU' then private.naxa_promoteur_valide(p_profile)
    and exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='promoteur')
    and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile and pp.actif
      and (p_pharmacie is null or pp.pharmacie_id=p_pharmacie))
  when p_scope='PHARMACIE' then
    exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='admin')
    or (private.naxa_promoteur_valide(p_profile)
      and exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='promoteur')
      and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile
        and pp.pharmacie_id=p_pharmacie and pp.actif))
    or exists(
      select 1 from public.profiles p
      where p.id=p_profile and p.actif and p.role::text<>'promoteur'
        and (
          p.pharmacie_id=p_pharmacie
          or exists(select 1 from public.naxa_professional_assignments a
            where a.profile_id=p.id and a.pharmacie_id=p_pharmacie
              and a.fonction=coalesce(p.fonction_interne,case p.role::text when 'caisse' then 'caisse' else null end)
              and a.statut='active' and a.commence_at<=now()
              and (a.expire_at is null or a.expire_at>now()))
        )
    )
  when p_scope='POSTE_CAISSE' then exists(
    select 1 from public.profiles p where p.id=p_profile and p.actif
      and (p.role::text='admin' or (p.role::text='caisse' and p.pharmacie_id=p_pharmacie))
  )
  else false
end
$function$;

-- Les fonctions publiques historiques doivent déléguer au moteur de périmètre unique.
-- Conserver le nom d'argument p_actor pour compatibilité des appels PostgREST existants.
create or replace function public.naxa_scope_allows(
  p_actor uuid,p_pharmacie uuid,p_scope text default 'PHARMACIE'
) returns boolean
language sql stable security definer set search_path=''
as $function$
  select private.naxa_scope_allows(p_actor,p_pharmacie,p_scope);
$function$;

-- Les politiques RLS historiques appellent can_access_pharmacy; le Responsable
-- affecté doit donc obtenir exactement le même périmètre que le moteur canonique.
create or replace function public.can_access_pharmacy(p_pharmacie uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_pharmacie is not null
    and public.naxa_scope_allows((select auth.uid()),p_pharmacie,'PHARMACIE');
$function$;

create or replace function private.naxa_can_manage_privilege_target(
  p_target uuid,p_pharmacie uuid default null
) returns boolean
language sql stable security definer set search_path=''
as $function$
  select exists (
    select 1 from public.profiles actor
    join public.profiles target on target.id=p_target
    where actor.id=(select auth.uid()) and actor.actif and target.actif
      and p_target<>actor.id
      and (
        target.pharmacie_id=p_pharmacie
        or exists(select 1 from public.naxa_professional_assignments a
          where a.profile_id=target.id and a.pharmacie_id=p_pharmacie
            and a.fonction=public.naxa_business_function(target.id)
            and a.statut='active' and a.commence_at<=now()
            and (a.expire_at is null or a.expire_at>now()))
      )
      and (
        (public.naxa_business_function(actor.id)='promoteur'
          and public.naxa_business_function(target.id) in ('responsable','caisse')
          and target.parent_profile_id=actor.id
          and exists(select 1 from public.promoteur_pharmacies pp
            where pp.promoteur_id=actor.id and pp.pharmacie_id=p_pharmacie and pp.actif))
        or
        (public.naxa_business_function(actor.id)='responsable'
          and public.naxa_business_function(target.id)='caisse'
          and target.parent_profile_id=actor.id)
      )
  )
$function$;

-- Le paramètre expire_at NULL = affectation ordinaire permanente.
-- Une affectation urgente doit obligatoirement porter son échéance explicite.
create or replace function public.naxa_grant_professional_assignment(
  p_target uuid,p_pharmacie uuid,p_fonction text,p_commence_at timestamptz,
  p_expire_at timestamptz,p_motif text
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_id uuid;
  v_target_fn text;
  v_arch text;
  v_nature text;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target=v_actor then
    raise exception 'Cible ou pharmacie invalide';
  end if;
  if p_fonction not in ('caisse','gestionnaire_stock','magasinier','pharmacien','responsable','comptable') then
    raise exception 'Fonction non autorisée';
  end if;
  if p_commence_at is null or p_commence_at>now()+interval '1 minute'
     or (p_expire_at is not null and p_expire_at<=greatest(p_commence_at,now())) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;
  if not exists(select 1 from public.profiles p
    join public.promoteur_pharmacies pp on pp.promoteur_id=p.id
    join public.pharmacies ph on ph.id=pp.pharmacie_id
    where p.id=v_actor and p.role::text='promoteur' and p.actif
      and pp.pharmacie_id=p_pharmacie and pp.actif and ph.actif)
  then raise exception 'Pharmacie hors réseau Promoteur ou inactive'; end if;
  if not public.naxa_has_privilege('ASSIGN_USER_TO_PHARMACY',p_pharmacie,'PHARMACIE') then
    raise exception 'Privilège ASSIGN_USER_TO_PHARMACY absent'; end if;
  select public.naxa_business_function(p_target) into v_target_fn
  from public.profiles where id=p_target and actif=true;
  if v_target_fn is null then raise exception 'Le compte cible doit être actif'; end if;
  if p_fonction='responsable' and v_target_fn<>'responsable' then
    raise exception 'La fonction demandée ne correspond pas au compte cible'; end if;
  if p_fonction<>'responsable' and v_target_fn not in (p_fonction,'client') then
    raise exception 'La fonction demandée ne correspond pas au compte cible'; end if;
  select architecture_code into v_arch from public.pharmacie_architectures
    where pharmacie_id=p_pharmacie and active=true;
  if v_arch is null then raise exception 'Architecture non définie'; end if;
  if p_fonction='responsable' and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then
    raise exception 'Cette architecture ne permet pas de Responsable'; end if;
  v_nature:=case when p_expire_at is null then 'ordinaire' else 'urgence' end;
  if exists(select 1 from public.naxa_professional_assignments a
    where a.profile_id=p_target and a.pharmacie_id=p_pharmacie and a.fonction=p_fonction
      and a.statut='active' and (a.expire_at is null or a.expire_at>p_commence_at)
      and (p_expire_at is null or a.commence_at<p_expire_at))
  then raise exception 'Une affectation active de cette fonction chevauche déjà la période'; end if;
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    p_target,p_pharmacie,p_fonction,'active',v_nature,trim(p_motif),
    p_commence_at,p_expire_at,v_actor
  ) returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

create or replace function public.naxa_revoke_professional_assignment(
  p_assignment uuid,p_motif text
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_assignment public.naxa_professional_assignments%rowtype;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif de révocation obligatoire';
  end if;
  select * into v_assignment from public.naxa_professional_assignments
    where id=p_assignment and statut='active' for update;
  if not found then raise exception 'Affectation active introuvable'; end if;
  if not exists(select 1 from public.profiles p
    join public.promoteur_pharmacies pp on pp.promoteur_id=p.id
    where p.id=v_actor and p.role::text='promoteur' and p.actif
      and pp.pharmacie_id=v_assignment.pharmacie_id and pp.actif)
    and not public.is_admin()
  then raise exception 'Révocation hors périmètre autorisé'; end if;
  update public.naxa_professional_assignments
  set statut='revoked',revoque_par=v_actor,revoque_at=now(),motif_revocation=trim(p_motif)
  where id=p_assignment;
  return true;
end;
$function$;
revoke all on function public.naxa_revoke_professional_assignment(uuid,text) from public,anon;
grant execute on function public.naxa_revoke_professional_assignment(uuid,text) to authenticated;

-- 3) Privilège explicite, délégable par pharmacie, uniquement dans les architectures autorisées.
insert into public.naxa_privileges(
  code,family,description,niveau_min,niveau_max,delegable,governance,active,
  famille,libelle,governance_only
) values(
  'APPROVE_MARKETPLACE_CREDIT','FINANCE',
  'Approuver une demande de crédit Marketplace dans la limite des délégations actives',
  1,2,true,false,true,'FINANCE',
  'Approuver un crédit Marketplace',false
)
on conflict(code) do update set
  family=excluded.family,description=excluded.description,niveau_min=excluded.niveau_min,
  niveau_max=excluded.niveau_max,delegable=true,governance=false,active=true,
  famille=excluded.famille,libelle=excluded.libelle,governance_only=false;

insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.code,r.role_key,'APPROVE_MARKETPLACE_CREDIT'
from (values('PARENTS_AINES_CADETS'),('HYBRIDE')) a(code)
cross join (values('responsable'),('promoteur')) r(role_key)
on conflict do nothing;

-- Garde unique partagée par l'écran Responsable et la RPC de décision.
-- Elle évite qu'un bouton visible et une mutation serveur appliquent deux politiques différentes.
create or replace function private.naxa_actor_can_approve_marketplace_credit(
  p_pharmacie uuid
) returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_function text;
  v_parent_promoteur uuid;
begin
  if v_actor is null or p_pharmacie is null then return false; end if;
  if public.is_admin() then return true; end if;

  v_function := public.naxa_business_function(v_actor);
  if v_function='promoteur' then
    return private.naxa_promoteur_valide(v_actor)
      and exists(
        select 1 from public.profiles p
        where p.id=v_actor and p.actif and p.role::text='promoteur' and p.niveau_interne=1
      )
      and exists(
        select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=v_actor and pp.pharmacie_id=p_pharmacie and pp.actif
      );
  end if;

  if v_function<>'responsable' then return false; end if;

  select p.parent_profile_id into v_parent_promoteur
  from public.profiles p
  where p.id=v_actor and p.actif and p.role::text='pharmacie'
    and p.fonction_interne='responsable' and p.niveau_interne=2;

  if v_parent_promoteur is null
     or not private.naxa_promoteur_valide(v_parent_promoteur)
     or not exists(
       select 1 from public.promoteur_pharmacies pp
       join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif
       where pp.promoteur_id=v_parent_promoteur
         and pp.pharmacie_id=p_pharmacie and pp.actif
     )
     or not public.naxa_has_active_professional_assignment(v_actor,p_pharmacie,'responsable')
     or not public.naxa_has_privilege('APPROVE_MARKETPLACE_CREDIT',p_pharmacie,'PHARMACIE') then
    return false;
  end if;

  return true;
end;
$function$;
revoke all on function private.naxa_actor_can_approve_marketplace_credit(uuid) from public,anon,authenticated;

create or replace function public.naxa_can_approve_marketplace_credit(
  p_pharmacie uuid
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select private.naxa_actor_can_approve_marketplace_credit($1);
$function$;
revoke all on function public.naxa_can_approve_marketplace_credit(uuid) from public,anon;
grant execute on function public.naxa_can_approve_marketplace_credit(uuid) to authenticated;

-- L’attribution d’une affectation professionnelle est une capacité de gestion du réseau
-- du Promoteur et doit être disponible dans les quatre architectures NAXA.
insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.code,'promoteur','ASSIGN_USER_TO_PHARMACY'
from (values
  ('ORPHELIN'),
  ('PARENTS_ENFANTS'),
  ('PARENTS_AINES_CADETS'),
  ('HYBRIDE')
) a(code)
on conflict do nothing;

-- 4) Restaurer exactement les lots et le stock agrégé, une seule fois, avant retrait.
create or replace function public.restore_stock(p_resa uuid)
returns void
language plpgsql security definer set search_path=''
as $function$
declare
  v_res public.reservations%rowtype;
  v_item record;
  v_alloc record;
  v_allocated integer;
  v_has_allocation boolean;
begin
  select r.* into v_res from public.reservations r where r.id=p_resa for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  if v_res.consumed_at is not null or v_res.consumed_by_vente_id is not null then return; end if;
  if not coalesce(v_res.stock_decremented,false) or coalesce(v_res.stock_restored,false) then return; end if;
  if not exists(select 1 from public.reservation_items ri where ri.reservation_id=p_resa) then
    raise exception 'Réservation sans lignes : restitution automatique refusée';
  end if;
  perform pg_catalog.set_config('naxa.stock_motif','Restitution réservation '||p_resa::text,true);

  for v_item in select ri.produit_id,ri.quantite from public.reservation_items ri
    where ri.reservation_id=p_resa order by ri.produit_id
  loop
    perform 1 from public.stocks s
    where s.pharmacie_id=v_res.pharmacie_id and s.produit_id=v_item.produit_id for update;
    if not found then raise exception 'Ligne de stock absente pendant la restitution'; end if;
    select exists(select 1 from public.reservation_item_lots a
      where a.reservation_id=p_resa and a.produit_id=v_item.produit_id and a.restauree_at is null)
      into v_has_allocation;
    if v_has_allocation then
      select coalesce(sum(a.quantite),0)::integer into v_allocated
      from public.reservation_item_lots a
      where a.reservation_id=p_resa and a.produit_id=v_item.produit_id and a.restauree_at is null;
      if v_allocated<>v_item.quantite then
        raise exception 'Allocation de lots incomplète : réconciliation requise avant restitution';
      end if;
      for v_alloc in select a.lot_id,a.quantite from public.reservation_item_lots a
        where a.reservation_id=p_resa and a.produit_id=v_item.produit_id and a.restauree_at is null
        order by a.lot_id for update
      loop
        update public.stocks_lots set quantite=quantite+v_alloc.quantite,updated_at=now()
        where id=v_alloc.lot_id and pharmacie_id=v_res.pharmacie_id and produit_id=v_item.produit_id;
        if not found then raise exception 'Lot d’origine indisponible; restitution annulée'; end if;
      end loop;
      update public.reservation_item_lots set restauree_at=now()
      where reservation_id=p_resa and produit_id=v_item.produit_id and restauree_at is null;
    elsif exists(select 1 from public.stocks_lots sl
      where sl.pharmacie_id=v_res.pharmacie_id and sl.produit_id=v_item.produit_id) then
      raise exception 'Réservation historique sans allocation de lots : réconciliation requise avant restitution';
    end if;
    update public.stocks set quantite=quantite+v_item.quantite,updated_at=now()
    where pharmacie_id=v_res.pharmacie_id and produit_id=v_item.produit_id;
    if not found then raise exception 'Ligne de stock absente pendant la restitution'; end if;
  end loop;
  update public.reservations set stock_restored=true,stock_decremented=false
  where id=p_resa and stock_restored=false and consumed_at is null and consumed_by_vente_id is null;
  if not found then raise exception 'La réservation a changé pendant la restitution'; end if;
end;
$function$;
revoke all on function public.restore_stock(uuid) from public,anon,authenticated;
grant execute on function public.restore_stock(uuid) to service_role;

-- 5) Soumission client : aucun hold ni mouvement physique avant l'approbation.
create or replace function public.client_credit_marketplace_soumettre(
  p_pharmacie uuid,p_items jsonb,p_telephone text,p_date_remboursement date,p_justificatif_path text
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_credit public.client_credits%rowtype;
  v_item jsonb;
  v_produit uuid;
  v_q integer;
  v_prix integer;
  v_disponible integer;
  v_total bigint:=0;
  v_id uuid;
  v_phone text;
  v_mime text;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.actif and p.role::text='client') then
    raise exception 'Cette opération est réservée à un compte client actif'; end if;
  if p_pharmacie is null or not exists(select 1 from public.pharmacies p where p.id=p_pharmacie and p.actif) then
    raise exception 'Pharmacie indisponible'; end if;
  if p_telephone is null or length(trim(p_telephone)) not between 8 and 24
     or trim(p_telephone) !~ '^[+0-9][0-9 ()-]{7,23}$' then raise exception 'Numéro de téléphone invalide'; end if;
  if p_date_remboursement is null or p_date_remboursement<=current_date then
    raise exception 'La date prévue de remboursement doit être future'; end if;
  if p_justificatif_path is null
     or (storage.foldername(p_justificatif_path))[1] is distinct from v_user::text
     or length(p_justificatif_path)>500 then raise exception 'Justificatif invalide'; end if;
  select o.metadata->>'mimetype' into v_mime from storage.objects o
  where o.bucket_id='credit-marketplace-justificatifs' and o.name=p_justificatif_path;
  if not found or v_mime is null or v_mime not in ('application/pdf','image/jpeg','image/png','image/webp') then
    raise exception 'Justificatif absent ou format non autorisé'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then raise exception 'Panier invalide'; end if;
  if exists(select 1 from (select value->>'produit_id' pid,count(*) n
    from jsonb_array_elements(p_items) group by value->>'produit_id') d where d.n>1) then
    raise exception 'Produit dupliqué dans le panier'; end if;

  perform 1 from public.profiles where id=v_user for update;
  if not found then raise exception 'Profil client introuvable'; end if;
  select * into v_credit from public.client_credits
  where client_id=v_user and pharmacie_id=p_pharmacie and actif for update;
  if not found then raise exception 'Crédit client non activé pour cette pharmacie'; end if;
  if exists(select 1 from public.client_credits c where c.client_id=v_user and c.actif and c.solde>0) then
    raise exception 'Un crédit est déjà actif : remboursement requis avant une nouvelle demande'; end if;
  if exists(select 1 from public.client_credit_requests q where q.client_id=v_user
    and q.statut in ('en_attente','approuvee') and q.consumed_at is null) then
    raise exception 'Une demande de crédit est déjà en cours'; end if;

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'produit_id'
  loop
    if coalesce(v_item->>'produit_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Référence produit invalide'; end if;
    v_produit:=(v_item->>'produit_id')::uuid;
    v_q:=coalesce((v_item->>'quantite')::integer,1);
    if v_q<1 or v_q>10 then raise exception 'Quantité invalide'; end if;
    select o.prix,o.quantite into v_prix,v_disponible
    from public.marketplace_offre_stock_disponible(p_pharmacie,v_produit) o;
    if not found or v_disponible<v_q then raise exception 'Stock Marketplace insuffisant pour le produit %',v_produit; end if;
    v_total:=v_total+v_prix::bigint*v_q;
  end loop;
  if v_total<=0 or v_total>2147483647 then raise exception 'Montant de demande invalide'; end if;
  v_phone:=regexp_replace(trim(p_telephone),'[[:space:]()-]','','g');
  insert into public.client_credit_requests(
    credit_id,pharmacie_id,client_id,montant,statut,requested_by,origine,
    telephone_demande,date_remboursement,justificatif_path,panier_items
  ) values(
    v_credit.id,p_pharmacie,v_user,v_total::integer,'en_attente',v_user,'marketplace',
    v_phone,p_date_remboursement,p_justificatif_path,
    (select jsonb_agg(jsonb_build_object('produit_id',(value->>'produit_id')::uuid,
      'quantite',coalesce((value->>'quantite')::integer,1)) order by value->>'produit_id')
     from jsonb_array_elements(p_items))
  ) returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.client_credit_marketplace_soumettre(uuid,jsonb,text,date,text) from public,anon;
grant execute on function public.client_credit_marketplace_soumettre(uuid,jsonb,text,date,text) to authenticated;

-- 6) Approbation : débit physique et affectation FEFO dans une seule transaction.
create or replace function public.client_credit_demande_decider(p_demande uuid,p_approuver boolean)
returns void
language plpgsql security definer set search_path=''
as $function$
declare
  r public.client_credit_requests%rowtype;
  c public.client_credits%rowtype;
  v_reservation uuid;
  v_total integer;
  v_item record;
  v_lot record;
  v_need integer;
  v_take integer;
  v_allocated integer;
  v_unallocated integer;
  v_actor_function text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into r from public.client_credit_requests where id=p_demande for update;
  if not found or r.statut<>'en_attente' then raise exception 'Demande introuvable ou déjà traitée'; end if;

  v_actor_function:=public.naxa_business_function(auth.uid());
  if r.origine='marketplace' then
    if not private.naxa_actor_can_approve_marketplace_credit(r.pharmacie_id) then
      if v_actor_function='responsable' then
        raise exception 'Responsable non affecté ou privilège d’approbation absent pour cette pharmacie';
      end if;
      raise exception 'Décision réservée au Promoteur valide, au Responsable explicitement autorisé ou à NAXA';
    end if;
  else
    if public.is_admin() is not true and not exists(
      select 1 from public.profiles p
      where p.id=auth.uid() and p.actif and p.role::text='promoteur' and p.niveau_interne=1
    ) then raise exception 'Décision réservée au Promoteur ou à NAXA'; end if;
    if not public.is_admin() and not public.can_access_pharmacy(r.pharmacie_id) then
      raise exception 'Pharmacie hors périmètre'; end if;
  end if;

  if not p_approuver then
    update public.client_credit_requests set statut='rejetee',decided_by=auth.uid(),decided_at=now()
    where id=r.id;
    return;
  end if;

  if r.origine='marketplace' then
    if r.panier_items is null or r.reservation_id is not null then
      raise exception 'Panier de crédit absent ou demande déjà réservée'; end if;
    select * into c from public.client_credits where id=r.credit_id for update;
    if not found or not c.actif or c.solde>0 then
      raise exception 'Le crédit client a changé depuis la soumission'; end if;
    if exists(select 1 from public.client_credit_requests q
      where q.client_id=r.client_id and q.id<>r.id
        and q.statut in ('en_attente','approuvee') and q.consumed_at is null) then
      raise exception 'Une autre demande de crédit est déjà active'; end if;

    -- La réservation intermédiaire est créée dans la transaction de décision; elle est convertie en débit réel ci-dessous.
    v_reservation:=private.reserve_stock(r.pharmacie_id,r.panier_items);
    select total into v_total from public.reservations where id=v_reservation for update;
    if v_total is distinct from r.montant then
      raise exception 'Le prix ou le total du panier a changé : la demande doit être réexaminée'; end if;

    for v_item in select ri.produit_id,ri.quantite
      from public.reservation_items ri where ri.reservation_id=v_reservation order by ri.produit_id
    loop
      if exists(select 1 from public.stocks_lots sl
        where sl.pharmacie_id=r.pharmacie_id and sl.produit_id=v_item.produit_id) then
        select greatest(coalesce(sum(ri.quantite),0)-coalesce((
          select sum(a.quantite) from public.reservation_item_lots a
          join public.reservations ar on ar.id=a.reservation_id
          where ar.pharmacie_id=r.pharmacie_id and ar.id<>v_reservation
            and a.produit_id=v_item.produit_id and a.restauree_at is null
            and ar.statut in ('en_attente','confirmee') and ar.expires_at>now()
            and ar.consumed_at is null and ar.stock_restored=false and ar.stock_decremented=false
        ),0),0)::integer into v_unallocated
        from public.reservation_items ri join public.reservations ar on ar.id=ri.reservation_id
        where ar.pharmacie_id=r.pharmacie_id and ar.id<>v_reservation
          and ri.produit_id=v_item.produit_id and ar.statut in ('en_attente','confirmee')
          and ar.expires_at>now() and ar.consumed_at is null
          and ar.stock_restored=false and ar.stock_decremented=false;

        v_need:=v_item.quantite;
        for v_lot in
          select sl.id,greatest(sl.quantite-coalesce((
            select sum(a.quantite)::integer from public.reservation_item_lots a
            join public.reservations active_r on active_r.id=a.reservation_id
            where a.lot_id=sl.id and a.restauree_at is null and active_r.id<>v_reservation
              and active_r.statut in ('en_attente','confirmee') and active_r.expires_at>now()
              and active_r.consumed_at is null and active_r.stock_restored=false
              and active_r.stock_decremented=false
          ),0),0)::integer as disponible
          from public.stocks_lots sl
          where sl.pharmacie_id=r.pharmacie_id and sl.produit_id=v_item.produit_id
            and sl.quantite>0 and not sl.bloque and sl.date_peremption is not null
            and sl.date_peremption>=current_date
          order by sl.date_peremption,sl.numero_lot,sl.id for update
        loop
          exit when v_need=0;
          v_take:=least(v_need,greatest(v_lot.disponible-v_unallocated,0));
          v_unallocated:=greatest(v_unallocated-v_lot.disponible,0);
          if v_take>0 then
            insert into public.reservation_item_lots(reservation_id,produit_id,lot_id,quantite)
            values(v_reservation,v_item.produit_id,v_lot.id,v_take);
            v_need:=v_need-v_take;
          end if;
        end loop;
        if v_need<>0 then raise exception 'Lots FEFO disponibles insuffisants pour la préparation du crédit'; end if;
      end if;
    end loop;

    perform pg_catalog.set_config('naxa.stock_motif','Approbation crédit Marketplace '||r.id::text,true);
    for v_item in select ri.produit_id,ri.quantite
      from public.reservation_items ri where ri.reservation_id=v_reservation order by ri.produit_id
    loop
      select count(*) into v_allocated from public.reservation_item_lots a
      where a.reservation_id=v_reservation and a.produit_id=v_item.produit_id and a.restauree_at is null;
      if v_allocated>0 then
        select coalesce(sum(a.quantite),0)::integer into v_allocated
        from public.reservation_item_lots a
        where a.reservation_id=v_reservation and a.produit_id=v_item.produit_id and a.restauree_at is null;
        if v_allocated<>v_item.quantite then raise exception 'Allocation FEFO incomplète avant débit physique'; end if;
        for v_lot in
          select sl.id,sl.quantite,a.quantite as reserve_qty,sl.bloque,sl.date_peremption
          from public.reservation_item_lots a join public.stocks_lots sl on sl.id=a.lot_id
          where a.reservation_id=v_reservation and a.produit_id=v_item.produit_id
            and a.restauree_at is null order by sl.id for update of sl,a
        loop
          if coalesce(v_lot.bloque,false) or v_lot.date_peremption<current_date then
            raise exception 'Un lot affecté est bloqué ou périmé'; end if;
          if v_lot.quantite<v_lot.reserve_qty then raise exception 'Stock du lot insuffisant au débit'; end if;
          update public.stocks_lots set quantite=quantite-v_lot.reserve_qty,updated_at=now()
          where id=v_lot.id and quantite>=v_lot.reserve_qty;
          if not found then raise exception 'Lot modifié simultanément pendant l’approbation'; end if;
        end loop;
      elsif exists(select 1 from public.stocks_lots sl
        where sl.pharmacie_id=r.pharmacie_id and sl.produit_id=v_item.produit_id) then
        raise exception 'Allocation de lots absente pour un produit lotisé';
      end if;
      update public.stocks set quantite=quantite-v_item.quantite,updated_at=now()
      where pharmacie_id=r.pharmacie_id and produit_id=v_item.produit_id and quantite>=v_item.quantite;
      if not found then raise exception 'Stock agrégé insuffisant au débit de l’approbation'; end if;
    end loop;

    update public.reservations set client_id=r.client_id,credit_request_id=r.id,
      mode='reservation',statut='confirmee'::public.resa_statut,
      preparation_statut='non_commencee',expires_at=null,
      stock_decremented=true,stock_restored=false
    where id=v_reservation;
    update public.client_credit_requests set statut='approuvee',decided_by=auth.uid(),
      decided_at=now(),reservation_id=v_reservation where id=r.id;
    return;
  end if;

  -- Parcours historique des demandes de dépassement issues de la caisse, inchangé.
  select * into c from public.client_credits where id=r.credit_id for update;
  if not found then raise exception 'Crédit client introuvable'; end if;
  update public.client_credits set updated_at=now() where id=c.id;
  update public.client_credit_requests set statut='approuvee',decided_by=auth.uid(),decided_at=now() where id=r.id;
end;
$function$;
revoke all on function public.client_credit_demande_decider(uuid,boolean) from public,anon,authenticated;
grant execute on function public.client_credit_demande_decider(uuid,boolean) to authenticated;

-- 7) Retrait POS : le stock est débité à l'approbation; la caisse ne le débite jamais une seconde fois.
create or replace function public.vente_reservation_credit_finaliser(
  p_reservation uuid,p_session uuid,p_reference text default null
) returns table(vente_id uuid,numero_vente text,total integer)
language plpgsql security definer set search_path=''
as $function$
declare
  r public.reservations%rowtype;
  q public.client_credit_requests%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_vente uuid;
  v_numero text;
  v_total_lignes integer;
  v_item record;
  v_lot record;
  v_lots_count integer;
  v_allocated integer;
  v_remaining integer;
  v_take integer;
  v_already_decremented boolean;
  v_op uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null then raise exception 'Réservation et session de caisse requises'; end if;
  select * into r from public.reservations where id=p_reservation for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  if r.mode<>'reservation' or r.statut<>'confirmee' then raise exception 'La réservation doit être confirmée pour le retrait'; end if;
  if r.expires_at is not null and r.expires_at<=now() then raise exception 'Réservation expirée'; end if;
  if r.paiement_statut='effectue' then raise exception 'Réservation déjà payée'; end if;
  if not public.naxa_caisse_actor_for_pharmacy(r.pharmacie_id) then raise exception 'Opération réservée à la caisse active de cette pharmacie'; end if;
  if exists(select 1 from public.ventes v where v.reservation_id=r.id) then raise exception 'Une vente POS est déjà liée à cette réservation'; end if;
  if r.credit_request_id is null then raise exception 'Cette réservation ne provient pas d’une demande de crédit Marketplace'; end if;

  select * into q from public.client_credit_requests cr where cr.id=r.credit_request_id for update;
  if not found or q.origine<>'marketplace' or q.statut<>'approuvee'
     or q.reservation_id is distinct from r.id or q.consumed_at is not null or q.vente_id is not null then
    raise exception 'Demande de crédit absente, non approuvée ou déjà consommée'; end if;
  if q.client_id is distinct from r.client_id or q.pharmacie_id is distinct from r.pharmacie_id or q.credit_id is null then
    raise exception 'La demande de crédit ne correspond pas à cette réservation'; end if;

  select cs.* into v_session from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and cs.statut='ouverte' and cs.ouvert_par=auth.uid()
    and c.actif=true and c.pharmacie_id=r.pharmacie_id for update of cs;
  if not found then raise exception 'Session ouverte introuvable, inactive ou hors pharmacie'; end if;

  select coalesce(sum(ri.quantite*ri.prix_unitaire),0)::integer into v_total_lignes
  from public.reservation_items ri where ri.reservation_id=r.id;
  if not exists(select 1 from public.reservation_items ri where ri.reservation_id=r.id) then raise exception 'Réservation sans articles'; end if;
  if v_total_lignes<>r.total or q.montant<>r.total then raise exception 'Le total des articles, de la réservation et du crédit doit être identique'; end if;

  insert into public.ventes(pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,created_by,reservation_id)
  values(r.pharmacie_id,p_session,r.client_id,'brouillon',0,r.total,r.total,auth.uid(),r.id)
  returning id into v_vente;

  v_already_decremented:=coalesce(r.stock_decremented,false) and not coalesce(r.stock_restored,false);
  for v_item in select ri.produit_id,ri.quantite,ri.prix_unitaire
    from public.reservation_items ri where ri.reservation_id=r.id order by ri.produit_id
  loop
    perform 1 from public.stocks s where s.pharmacie_id=r.pharmacie_id
      and s.produit_id=v_item.produit_id for update;
    if not found then raise exception 'Produit absent du stock au retrait'; end if;
    select count(*) into v_lots_count from public.stocks_lots l
      where l.pharmacie_id=r.pharmacie_id and l.produit_id=v_item.produit_id;
    if v_lots_count>0 then
      select coalesce(sum(a.quantite),0)::integer into v_allocated
      from public.reservation_item_lots a where a.reservation_id=r.id
        and a.produit_id=v_item.produit_id and a.restauree_at is null;
      if v_allocated<>v_item.quantite then raise exception 'Allocation de lots absente ou incohérente pour la réservation'; end if;
      v_remaining:=v_item.quantite;
      for v_lot in
        select l.id,l.quantite,l.date_peremption,l.bloque,a.quantite as reserve_qty
        from public.reservation_item_lots a join public.stocks_lots l
          on l.id=a.lot_id and l.pharmacie_id=r.pharmacie_id and l.produit_id=v_item.produit_id
        where a.reservation_id=r.id and a.produit_id=v_item.produit_id
          and a.restauree_at is null and a.quantite>0
          and (v_already_decremented or l.quantite>0)
        order by l.date_peremption asc nulls last,l.created_at asc,l.id asc
        for update of l,a
      loop
        exit when v_remaining=0;
        if coalesce(v_lot.bloque,false) or (v_lot.date_peremption is not null and v_lot.date_peremption<current_date) then
          raise exception 'Lot affecté bloqué ou périmé : retrait refusé'; end if;
        v_take:=least(v_remaining,v_lot.reserve_qty);
        if not v_already_decremented then
          if v_lot.quantite<v_take then raise exception 'Quantité insuffisante dans un lot affecté à cette réservation'; end if;
          update public.stocks_lots set quantite=quantite-v_take where id=v_lot.id;
        end if;
        insert into public.vente_lignes(vente_id,produit_id,lot_id,quantite,prix_unitaire)
        values(v_vente,v_item.produit_id,v_lot.id,v_take,v_item.prix_unitaire);
        v_remaining:=v_remaining-v_take;
      end loop;
      if v_remaining>0 then raise exception 'Lots affectés indisponibles au retrait'; end if;
    else
      if exists(select 1 from public.stocks s where s.pharmacie_id=r.pharmacie_id
        and s.produit_id=v_item.produit_id and s.date_peremption is not null and s.date_peremption<current_date)
      then raise exception 'Stock périmé : retrait refusé'; end if;
      insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
      values(v_vente,v_item.produit_id,v_item.quantite,v_item.prix_unitaire);
    end if;
    if not v_already_decremented then
      update public.stocks set quantite=quantite-v_item.quantite,updated_at=now()
      where pharmacie_id=r.pharmacie_id and produit_id=v_item.produit_id and quantite>=v_item.quantite;
      if not found then raise exception 'Stock physique insuffisant au retrait'; end if;
    end if;
  end loop;

  update public.client_credit_requests as cr set vente_id=v_vente
  where cr.id=q.id and cr.statut='approuvee' and cr.consumed_at is null and cr.vente_id is null;
  if not found then raise exception 'La demande de crédit a déjà été liée à une vente'; end if;
  v_op:=public.client_credit_enregistrer_vente(v_vente,r.total,nullif(trim(p_reference),''));
  if v_op is null then raise exception 'Échec de création de l’opération de crédit'; end if;
  update public.vente_paiements as vp set montant_percu=r.total,monnaie_rendue=0
  where vp.vente_id=v_vente and vp.mode='credit';
  if not found then raise exception 'Paiement POS crédit absent ou incomplet'; end if;
  update public.client_credit_operations as op set caisse_session_id=p_session
  where op.id=v_op and op.vente_id=v_vente and op.nature='credit';
  if not found then raise exception 'Opération de crédit non rattachée à la session de caisse'; end if;
  update public.ventes as v set statut='payee',mode_paiement='credit',
    paiement_ref=nullif(trim(p_reference),''),paid_at=now()
  where v.id=v_vente and v.statut='brouillon';
  if not found then raise exception 'La vente crédit n’a pas pu être finalisée'; end if;

  update public.reservations set paiement_mode='credit',paiement_ref=nullif(trim(p_reference),''),
    consumed_by_vente_id=v_vente,consumed_at=now(),stock_decremented=true,stock_restored=false
  where id=r.id;
  perform public.set_reservation_status(r.id,'payee'::public.resa_statut);
  select v.numero_vente into v_numero from public.ventes v where v.id=v_vente;
  return query select v_vente,v_numero,r.total;
end;
$function$;
revoke all on function public.vente_reservation_credit_finaliser(uuid,uuid,text) from public,anon;
grant execute on function public.vente_reservation_credit_finaliser(uuid,uuid,text) to authenticated;

comment on function public.client_credit_demande_decider(uuid,boolean) is
  'Approuve atomiquement une demande Marketplace avec débit du stock agrégé et des lots FEFO; le retrait POS ne débite pas une seconde fois. Le Responsable exige une affectation et le privilège APPPROVE_MARKETPLACE_CREDIT.';
comment on function public.vente_reservation_credit_finaliser(uuid,uuid,text) is
  'Finalise le retrait POS d’un crédit Marketplace déjà débité à l’approbation; conserve les lots d’origine, facture le crédit et ne répète jamais le mouvement de stock.';

commit;
