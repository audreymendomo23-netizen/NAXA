-- NAXA 217 — reconcile ERP inventory valuation with the already-created stock-service tables.
begin;

alter table public.inventaires
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists closed_at timestamptz,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists closed_by uuid references auth.users(id);
create unique index if not exists inventaires_pharmacie_reference_uq
  on public.inventaires(pharmacie_id,reference) where reference is not null;

alter table public.inventaire_lignes
  add column if not exists cout_unitaire integer not null default 0 check(cout_unitaire>=0),
  add column if not exists valeur_theorique integer generated always as (quantite_theorique*cout_unitaire) stored,
  add column if not exists valeur_comptee integer generated always as (quantite_comptee*cout_unitaire) stored;

alter table public.vente_lignes
  add column if not exists cout_unitaire_fige integer check(cout_unitaire_fige is null or cout_unitaire_fige>=0),
  add column if not exists cout_total integer generated always as (quantite*cout_unitaire_fige) stored,
  add column if not exists marge_ligne integer generated always as ((quantite*prix_unitaire)-(quantite*cout_unitaire_fige)) stored;

create or replace function public.inventaire_preparer_ligne(
  p_inventaire uuid,p_produit uuid,p_lot uuid default null
)
returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_pharmacie uuid;
  v_q integer:=0;
  v_cout integer;
  v_id uuid;
begin
  select pharmacie_id into v_pharmacie
  from public.inventaires
  where id=p_inventaire and statut in('brouillon','en_cours')
  for update;
  if v_pharmacie is null or not(public.is_admin() or public.can_access_pharmacy(v_pharmacie)) then
    raise exception 'Inventaire non autorisé';
  end if;

  if p_lot is null then
    select coalesce(s.quantite,0),sc.cout_unitaire into v_q,v_cout
    from public.stocks s
    left join public.stocks_couts sc on sc.pharmacie_id=s.pharmacie_id and sc.produit_id=s.produit_id
    where s.pharmacie_id=v_pharmacie and s.produit_id=p_produit;
    if not found then raise exception 'Produit absent du stock'; end if;
  else
    select coalesce(sl.quantite,0),sc.cout_unitaire into v_q,v_cout
    from public.stocks_lots sl
    left join public.stocks_couts sc on sc.pharmacie_id=sl.pharmacie_id and sc.produit_id=sl.produit_id
    where sl.id=p_lot and sl.pharmacie_id=v_pharmacie and sl.produit_id=p_produit;
    if not found then raise exception 'Lot introuvable'; end if;
  end if;

  select id into v_id from public.inventaire_lignes
  where inventaire_id=p_inventaire and produit_id=p_produit and lot_id is not distinct from p_lot
  for update;
  if found then
    update public.inventaire_lignes
    set quantite_theorique=v_q,cout_unitaire=coalesce(v_cout,0)
    where id=v_id;
  else
    insert into public.inventaire_lignes(inventaire_id,produit_id,lot_id,quantite_theorique,cout_unitaire)
    values(p_inventaire,p_produit,p_lot,v_q,coalesce(v_cout,0))
    returning id into v_id;
  end if;
  return v_id;
end;
$function$;
revoke all on function public.inventaire_preparer_ligne(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.inventaire_preparer_ligne(uuid,uuid,uuid) to authenticated;

create or replace function public.inventaire_cloturer(p_inventaire uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_pharmacie uuid;
begin
  select pharmacie_id into v_pharmacie from public.inventaires
  where id=p_inventaire and statut in('brouillon','en_cours') for update;
  if v_pharmacie is null or not(public.is_admin() or public.can_access_pharmacy(v_pharmacie)) then
    raise exception 'Inventaire non autorisé';
  end if;
  if exists(select 1 from public.inventaire_lignes where inventaire_id=p_inventaire and quantite_comptee is null) then
    raise exception 'Toutes les lignes doivent être comptées avant clôture';
  end if;
  update public.inventaires set statut='cloture',closed_at=now(),closed_by=auth.uid(),updated_at=now()
  where id=p_inventaire;
end;
$function$;
revoke all on function public.inventaire_cloturer(uuid) from public,anon,authenticated;
grant execute on function public.inventaire_cloturer(uuid) to authenticated;

-- Cost is frozen when known; unknown cost remains NULL rather than fabricating zero cost/margin.
create or replace function public.vente_ligne_figer_cout()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_pharmacie uuid; v_cout integer;
begin
  select pharmacie_id into v_pharmacie from public.ventes where id=new.vente_id;
  if v_pharmacie is null then raise exception 'Vente introuvable'; end if;
  if new.cout_unitaire_fige is null then
    select cout_unitaire into v_cout from public.stocks_couts
    where pharmacie_id=v_pharmacie and produit_id=new.produit_id;
    new.cout_unitaire_fige:=v_cout;
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_vente_ligne_figer_cout on public.vente_lignes;
create trigger trg_vente_ligne_figer_cout before insert on public.vente_lignes
for each row execute function public.vente_ligne_figer_cout();
revoke all on function public.vente_ligne_figer_cout() from public,anon,authenticated;

comment on column public.vente_lignes.cout_unitaire_fige is
  'Coût interne figé au moment de la ligne si disponible; NULL signifie coût non renseigné et marge non calculable.';
comment on column public.vente_lignes.marge_ligne is
  'Marge interne uniquement lorsque le coût d’achat historique est connu.';
commit;