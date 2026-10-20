-- NAXA ERP-003 — harmonisation des parcours Pharmacien / Assistant pharmacien.
-- Migration additive : aucune donnée métier existante n'est supprimée.
begin;

-- La migration 045 autorisait l'assistant à valider toute ordonnance et omettait
-- la fonction 'pharmacien' attendue par l'interface. Autorisations explicites.
alter table public.profiles drop constraint if exists profiles_fonction_interne_check;
alter table public.profiles drop constraint if exists profiles_fonction_interne_ck;
alter table public.profiles
  add constraint profiles_fonction_interne_check
  check (fonction_interne is null or fonction_interne in (
    'promoteur','responsable','caisse','pharmacien','pharmacien_assistant',
    'magasinier','gestionnaire_stock','comptable','manager_regional',
    'chef_agence','custom'
  ));

-- Suivi de préparation séparé du statut pharmaceutique : un assistant ne peut
-- jamais faire passer une ordonnance de en_attente à validee/rejetee par cette table.
create table if not exists public.prescription_preparations (
  prescription_id uuid primary key references public.prescriptions(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  assistant_id uuid not null references auth.users(id) on delete restrict,
  statut text not null default 'soumise'
    check (statut in ('soumise','complement_requis','revue')),
  notes_preparation text,
  motif_complement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prescription_preparations_scope_idx
  on public.prescription_preparations(pharmacie_id, statut, updated_at desc);

alter table public.prescription_preparations enable row level security;
revoke all on public.prescription_preparations from anon, authenticated;
grant select on public.prescription_preparations to authenticated;

drop policy if exists prescription_preparations_staff_read on public.prescription_preparations;
create policy prescription_preparations_staff_read
on public.prescription_preparations for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.actif
      and p.pharmacie_id=prescription_preparations.pharmacie_id
      and p.fonction_interne in ('pharmacien','pharmacien_assistant')
  )
);

create or replace function public.assistant_soumettre_preparation(
  p_prescription uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  u uuid := (select auth.uid());
  v public.prescriptions%rowtype;
  p uuid;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select pharmacie_id into p from public.profiles
   where id=u and actif and fonction_interne='pharmacien_assistant';
  if p is null then raise exception 'Accès Assistant pharmacien non autorisé'; end if;

  select * into v from public.prescriptions
   where id=p_prescription and pharmacie_id=p and source='client'
   for update;
  if not found then raise exception 'Ordonnance introuvable ou hors périmètre'; end if;
  if v.statut <> 'en_attente' then raise exception 'Cette ordonnance n''est plus en attente'; end if;

  insert into public.prescription_preparations(
    prescription_id,pharmacie_id,assistant_id,statut,notes_preparation,motif_complement,updated_at
  ) values (p_prescription,p,u,'soumise',nullif(trim(coalesce(p_notes,'')),''),null,now())
  on conflict (prescription_id) do update set
    assistant_id=excluded.assistant_id,
    statut='soumise',
    notes_preparation=excluded.notes_preparation,
    motif_complement=null,
    updated_at=now();
end;
$$;
revoke all on function public.assistant_soumettre_preparation(uuid,text) from public,anon,authenticated;
grant execute on function public.assistant_soumettre_preparation(uuid,text) to authenticated;

create or replace function public.pharmacien_demander_complement(
  p_prescription uuid,
  p_motif text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  u uuid := (select auth.uid());
  v public.prescriptions%rowtype;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select * into v from public.prescriptions where id=p_prescription for update;
  if not found then raise exception 'Ordonnance introuvable'; end if;
  if not exists (
    select 1 from public.profiles p where p.id=u and p.actif
      and p.pharmacie_id=v.pharmacie_id and p.fonction_interne='pharmacien'
  ) then raise exception 'Seul le Pharmacien peut demander un complément'; end if;
  if v.statut <> 'en_attente' then raise exception 'Ordonnance déjà traitée'; end if;
  if nullif(trim(coalesce(p_motif,'')),'') is null then raise exception 'Motif du complément obligatoire'; end if;
  update public.prescription_preparations
    set statut='complement_requis',motif_complement=trim(p_motif),updated_at=now()
    where prescription_id=p_prescription and pharmacie_id=v.pharmacie_id;
  if not found then
    raise exception 'Aucune préparation soumise pour cette ordonnance';
  end if;
end;
$$;
revoke all on function public.pharmacien_demander_complement(uuid,text) from public,anon,authenticated;
grant execute on function public.pharmacien_demander_complement(uuid,text) to authenticated;

-- Validation/rejet : Pharmacien dans sa pharmacie, ou Assistant uniquement si
-- le moteur de privilèges lui accorde explicitement VALIDATE_PRESCRIPTION.
create or replace function public.prescription_valider(
  p_prescription uuid,
  p_accepter boolean,
  p_motif text default null
)
returns public.prescription_statut
language plpgsql
security definer
set search_path=''
as $$
declare
  v public.prescriptions%rowtype;
  u uuid := (select auth.uid());
  v_role text;
  v_fn text;
  v_allowed boolean := false;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select * into v from public.prescriptions where id=p_prescription for update;
  if not found then raise exception 'Ordonnance introuvable'; end if;

  select p.role::text,p.fonction_interne into v_role,v_fn
  from public.profiles p
  where p.id=u and p.actif and p.pharmacie_id=v.pharmacie_id;

  if v_role is null then raise exception 'Validation ordonnance hors périmètre'; end if;

  if v_fn='pharmacien' then
    v_allowed := true;
  elsif v_fn='pharmacien_assistant' then
    v_allowed := coalesce(public.naxa_has_privilege('VALIDATE_PRESCRIPTION',v.pharmacie_id,'PHARMACIE'),false);
  end if;

  if not v_allowed then raise exception 'Validation ordonnance non autorisée : privilège Pharmacien requis'; end if;
  if v.statut <> 'en_attente' then raise exception 'Ordonnance déjà traitée'; end if;

  if p_accepter then
    update public.prescriptions set statut='validee',validateur_id=u,validee_at=now(),
      motif_rejet=null,updated_at=now() where id=p_prescription;
    update public.prescription_preparations set statut='revue',updated_at=now()
      where prescription_id=p_prescription;
    return 'validee';
  end if;

  if nullif(trim(coalesce(p_motif,'')),'') is null then raise exception 'Motif de rejet obligatoire'; end if;
  update public.prescriptions set statut='rejetee',validateur_id=u,validee_at=null,
    motif_rejet=trim(p_motif),updated_at=now() where id=p_prescription;
  update public.prescription_preparations set statut='revue',updated_at=now()
    where prescription_id=p_prescription;
  return 'rejetee';
end;
$$;
revoke all on function public.prescription_valider(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.prescription_valider(uuid,boolean,text) to authenticated;

comment on table public.prescription_preparations is
  'Suivi de préparation des ordonnances par l’assistant ; distinct du statut et de la décision pharmaceutique.';
commit;
