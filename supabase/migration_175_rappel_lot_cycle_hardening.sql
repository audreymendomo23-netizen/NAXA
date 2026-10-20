-- NAXA ERP-011 / F64 — hardening du cycle de rappel de lot.
begin;

alter table public.rappels_lots
  add column if not exists lot_bloque_avant boolean not null default false,
  add column if not exists lot_motif_blocage_avant text;

alter table public.rappels_lots
  drop constraint if exists rappels_lots_lot_id_key;
create unique index if not exists rappels_lots_un_actif_par_lot_uidx
  on public.rappels_lots(lot_id) where statut='actif';

create or replace function public.lot_rappeler(
  p_lot uuid,
  p_motif text,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_lot public.stocks_lots%rowtype;
  v_profile public.profiles%rowtype;
  v_id uuid;
  v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if length(trim(coalesce(p_motif,''))) not between 5 and 500 then
    raise exception 'Le motif du rappel doit contenir entre 5 et 500 caractères';
  end if;
  if p_reference is not null and length(trim(p_reference))>120 then
    raise exception 'La référence du rappel ne peut pas dépasser 120 caractères';
  end if;

  select * into v_lot from public.stocks_lots where id=p_lot for update;
  if not found then raise exception 'Lot introuvable'; end if;
  if not public.naxa_scope_allows(v_user,v_lot.pharmacie_id,'PHARMACIE') then
    raise exception 'Lot non autorisé';
  end if;

  select * into v_profile from public.profiles
  where id=v_user and actif=true;
  if not found then raise exception 'Compte inactif'; end if;
  if coalesce(v_profile.role::text,'')='caisse'
     or coalesce(v_profile.fonction_interne,'')='caisse'
     or not (
       coalesce(v_profile.role::text,'')='promoteur'
       or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable')
       or public.naxa_has_privilege('MANAGE_LOTS',v_lot.pharmacie_id,'PHARMACIE')
     ) then
    raise exception 'Déclaration de rappel réservée au Promoteur et aux fonctions de gestion autorisées';
  end if;

  if exists(select 1 from public.rappels_lots where lot_id=p_lot and statut='actif') then
    raise exception 'Ce lot fait déjà l''objet d''un rappel actif';
  end if;

  insert into public.rappels_lots(
    pharmacie_id,lot_id,reference_rappel,motif,created_by,lot_bloque_avant,lot_motif_blocage_avant
  ) values (
    v_lot.pharmacie_id,p_lot,nullif(trim(p_reference),''),trim(p_motif),v_user,v_lot.bloque,v_lot.motif_blocage
  ) returning id into v_id;

  update public.stocks_lots set bloque=true,motif_blocage=trim(p_motif) where id=p_lot;
  return v_id;
end;
$$;

create or replace function public.lot_lever_rappel(p_lot uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_pharmacie uuid;
  v_user uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_rappel public.rappels_lots%rowtype;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  select * into v_profile from public.profiles where id=v_user and actif=true;
  if not found or coalesce(v_profile.role::text,'')<>'promoteur' then
    raise exception 'Seul le Promoteur actif peut clôturer un rappel de lot';
  end if;

  select pharmacie_id into v_pharmacie from public.stocks_lots where id=p_lot for update;
  if v_pharmacie is null then raise exception 'Lot introuvable'; end if;
  if not public.naxa_scope_allows(v_user,v_pharmacie,'PHARMACIE') then raise exception 'Lot hors périmètre du Promoteur'; end if;

  select * into v_rappel from public.rappels_lots
  where lot_id=p_lot and statut='actif' for update;
  if not found then raise exception 'Aucun rappel actif pour ce lot'; end if;

  update public.rappels_lots
  set statut='leve',leve_at=now(),leve_par=v_user
  where id=v_rappel.id and statut='actif';

  -- Ne restaure l'état antérieur que si le blocage courant est bien celui de ce rappel.
  update public.stocks_lots
  set bloque=v_rappel.lot_bloque_avant,
      motif_blocage=v_rappel.lot_motif_blocage_avant
  where id=p_lot and bloque=true and motif_blocage=v_rappel.motif;
end;
$$;

revoke all on function public.lot_rappeler(uuid,text,text) from public,anon,authenticated;
grant execute on function public.lot_rappeler(uuid,text,text) to authenticated;
revoke all on function public.lot_lever_rappel(uuid) from public,anon,authenticated;
grant execute on function public.lot_lever_rappel(uuid) to authenticated;

comment on column public.rappels_lots.lot_bloque_avant is 'État du lot avant le rappel, restauré à la levée.';
comment on column public.rappels_lots.lot_motif_blocage_avant is 'Motif de blocage antérieur au rappel, restauré à la levée.';
commit;