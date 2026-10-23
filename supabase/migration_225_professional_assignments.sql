-- NAXA 225 — affectations professionnelles multiples, bornées et révocables.
-- Migration additive : fichier uniquement, aucune application distante dans cette intervention.
begin;

create table if not exists public.naxa_professional_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  fonction text not null check (fonction in (
    'caisse','gestionnaire_stock','magasinier','pharmacien','responsable','comptable'
  )),
  statut text not null default 'active' check (statut in ('active','revoked')),
  motif text not null check (length(trim(motif)) between 5 and 500),
  commence_at timestamptz not null,
  expire_at timestamptz not null,
  accorde_par uuid not null references public.profiles(id) on delete restrict,
  accorde_at timestamptz not null default now(),
  revoque_par uuid references public.profiles(id) on delete restrict,
  revoque_at timestamptz,
  motif_revocation text,
  created_at timestamptz not null default now(),
  constraint naxa_professional_assignment_period_ck check (expire_at > commence_at),
  constraint naxa_professional_assignment_revocation_ck check (
    (statut = 'active' and revoque_par is null and revoque_at is null)
    or (statut = 'revoked' and revoque_par is not null and revoque_at is not null)
  )
);

create index if not exists naxa_professional_assignments_profile_active_idx
  on public.naxa_professional_assignments(profile_id, pharmacie_id, fonction, expire_at)
  where statut = 'active';

create index if not exists naxa_professional_assignments_pharmacy_idx
  on public.naxa_professional_assignments(pharmacie_id, statut, expire_at);

alter table public.naxa_professional_assignments enable row level security;
revoke all on public.naxa_professional_assignments from anon, authenticated;
grant select on public.naxa_professional_assignments to authenticated;

drop policy if exists naxa_professional_assignments_participant_read
  on public.naxa_professional_assignments;
create policy naxa_professional_assignments_participant_read
  on public.naxa_professional_assignments
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or accorde_par = (select auth.uid())
    or revoque_par = (select auth.uid())
    or (select public.is_admin())
  );

create or replace function public.naxa_has_active_professional_assignment(
  p_profile uuid,
  p_pharmacie uuid,
  p_fonction text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_profile is not null
    and p_pharmacie is not null
    and p_fonction is not null
    and exists (
      select 1
      from public.naxa_professional_assignments a
      join public.profiles p on p.id = a.profile_id and p.actif = true
      join public.pharmacies ph on ph.id = a.pharmacie_id and ph.actif = true
      where a.profile_id = p_profile
        and a.pharmacie_id = p_pharmacie
        and a.fonction = p_fonction
        and a.statut = 'active'
        and a.commence_at <= now()
        and a.expire_at > now()
    );
$function$;

revoke all on function public.naxa_has_active_professional_assignment(uuid,uuid,text) from public, anon;
grant execute on function public.naxa_has_active_professional_assignment(uuid,uuid,text) to authenticated;

create or replace function public.naxa_grant_professional_assignment(
  p_target uuid,
  p_pharmacie uuid,
  p_fonction text,
  p_commence_at timestamptz,
  p_expire_at timestamptz,
  p_motif text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_profile public.profiles%rowtype;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target = v_actor then
    raise exception 'Cible ou pharmacie invalide';
  end if;
  if p_fonction not in ('caisse','gestionnaire_stock','magasinier','pharmacien','responsable','comptable') then
    raise exception 'Fonction non autorisée';
  end if;
  if p_commence_at is null or p_expire_at is null or p_expire_at <= p_commence_at
     or p_expire_at <= now() then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif)) < 5 or length(trim(p_motif)) > 500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;

  select * into v_profile from public.profiles where id = p_target and actif = true;
  if not found then raise exception 'Le compte cible doit être actif'; end if;

  if not exists (
    select 1 from public.profiles p
    join public.promoteur_pharmacies pp on pp.promoteur_id = p.id
    join public.pharmacies ph on ph.id = pp.pharmacie_id
    where p.id = v_actor and p.role::text = 'promoteur' and p.actif = true
      and pp.pharmacie_id = p_pharmacie and pp.actif = true and ph.actif = true
  ) then raise exception 'Pharmacie hors réseau Promoteur ou inactive'; end if;

  if not public.naxa_can('ASSIGN_USER_TO_PHARMACY', p_pharmacie, p_target) then
    raise exception 'Permission ASSIGN_USER_TO_PHARMACY refusée';
  end if;

  if exists (
    select 1 from public.naxa_professional_assignments a
    where a.profile_id = p_target and a.pharmacie_id = p_pharmacie
      and a.fonction = p_fonction and a.statut = 'active'
      and a.commence_at <= p_expire_at and a.expire_at > p_commence_at
  ) then raise exception 'Une affectation de cette fonction chevauche déjà la période'; end if;

  insert into public.naxa_professional_assignments(
    profile_id, pharmacie_id, fonction, statut, motif, commence_at, expire_at, accorde_par
  ) values (
    p_target, p_pharmacie, p_fonction, 'active', trim(p_motif), p_commence_at, p_expire_at, v_actor
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) from public, anon;
grant execute on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

create or replace function public.naxa_revoke_professional_assignment(
  p_assignment uuid,
  p_motif text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_assignment public.naxa_professional_assignments%rowtype;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_motif is null or length(trim(p_motif)) < 5 or length(trim(p_motif)) > 500 then
    raise exception 'Motif de révocation obligatoire';
  end if;

  select * into v_assignment
  from public.naxa_professional_assignments
  where id = p_assignment and statut = 'active'
  for update;
  if not found then raise exception 'Affectation active introuvable'; end if;

  if not exists (
    select 1 from public.profiles p
    join public.promoteur_pharmacies pp on pp.promoteur_id = p.id
    where p.id = v_actor and p.role::text = 'promoteur' and p.actif = true
      and pp.pharmacie_id = v_assignment.pharmacie_id and pp.actif = true
  ) and not public.is_admin() then
    raise exception 'Révocation hors périmètre autorisé';
  end if;

  update public.naxa_professional_assignments
  set statut = 'revoked', revoque_par = v_actor, revoque_at = now(),
      motif_revocation = trim(p_motif)
  where id = p_assignment;
  return true;
end;
$function$;

revoke all on function public.naxa_revoke_professional_assignment(uuid,text) from public, anon;
grant execute on function public.naxa_revoke_professional_assignment(uuid,text) to authenticated;

commit;
