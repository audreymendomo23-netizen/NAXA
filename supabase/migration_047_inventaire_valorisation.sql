-- NAXA ERP-006 — Inventaire / valorisation
create type public.inventaire_statut as enum ('brouillon','en_cours','cloture','annule');
create type public.inventaire_type as enum ('complet','cible');
create table if not exists public.inventaires (
 id uuid primary key default gen_random_uuid(), pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 type public.inventaire_type not null default 'complet', statut public.inventaire_statut not null default 'brouillon',
 reference text, started_at timestamptz, closed_at timestamptz, created_by uuid not null references auth.users(id),
 closed_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(pharmacie_id,reference));
create table if not exists public.inventaire_lignes (
 id uuid primary key default gen_random_uuid(), inventaire_id uuid not null references public.inventaires(id) on delete cascade,
 produit_id uuid not null references public.produits(id), lot_id uuid references public.stocks_lots(id) on delete set null,
 quantite_theorique integer not null default 0 check(quantite_theorique>=0),
 quantite_comptee integer check(quantite_comptee is null or quantite_comptee>=0),
 cout_unitaire integer not null default 0 check(cout_unitaire>=0),
 ecart integer generated always as (coalesce(quantite_comptee,0)-quantite_theorique) stored,
 valeur_theorique integer generated always as (quantite_theorique*cout_unitaire) stored,
 valeur_comptee integer generated always as (coalesce(quantite_comptee,0)*cout_unitaire) stored,
 created_at timestamptz not null default now(), unique(inventaire_id,produit_id,lot_id));
create index if not exists inventaires_pharmacie_statut_idx on public.inventaires(pharmacie_id,statut);
create index if not exists inventaire_lignes_inventaire_idx on public.inventaire_lignes(inventaire_id);
alter table public.inventaires enable row level security;
alter table public.inventaire_lignes enable row level security;
drop policy if exists inventaires_scope on public.inventaires;
create policy inventaires_scope on public.inventaires for all to authenticated
using(public.is_admin() or public.can_access_pharmacy(pharmacie_id))
with check(public.is_admin() or public.can_access_pharmacy(pharmacie_id));
drop policy if exists inventaire_lignes_scope on public.inventaire_lignes;
create policy inventaire_lignes_scope on public.inventaire_lignes for all to authenticated
using(exists(select 1 from public.inventaires i where i.id=inventaire_id and (public.is_admin() or public.can_access_pharmacy(i.pharmacie_id))))
with check(exists(select 1 from public.inventaires i where i.id=inventaire_id and (public.is_admin() or public.can_access_pharmacy(i.pharmacie_id))));
revoke all on public.inventaires,public.inventaire_lignes from anon;
grant select,insert,update,delete on public.inventaires,public.inventaire_lignes to authenticated;
create or replace function public.inventaire_preparer_ligne(p_inventaire uuid,p_produit uuid,p_lot uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_pharmacie uuid; v_q integer:=0; v_cout integer:=0; v_id uuid;
begin
 select pharmacie_id into v_pharmacie from inventaires where id=p_inventaire and statut in('brouillon','en_cours');
 if v_pharmacie is null or not(is_admin() or can_access_pharmacy(v_pharmacie)) then raise exception 'Inventaire non autorisé'; end if;
 if p_lot is null then
   select coalesce(s.quantite,0),coalesce(sc.cout_unitaire,0) into v_q,v_cout from stocks s
   left join stocks_couts sc on sc.pharmacie_id=s.pharmacie_id and sc.produit_id=s.produit_id
   where s.pharmacie_id=v_pharmacie and s.produit_id=p_produit;
 else
   select coalesce(sl.quantite,0),coalesce(sc.cout_unitaire,0) into v_q,v_cout from stocks_lots sl
   left join stocks_couts sc on sc.pharmacie_id=sl.pharmacie_id and sc.produit_id=sl.produit_id
   where sl.id=p_lot and sl.pharmacie_id=v_pharmacie and sl.produit_id=p_produit;
   if not found then raise exception 'Lot introuvable'; end if;
 end if;
 insert into inventaire_lignes(inventaire_id,produit_id,lot_id,quantite_theorique,cout_unitaire)
 values(p_inventaire,p_produit,p_lot,v_q,v_cout)
 on conflict(inventaire_id,produit_id,lot_id) do update set quantite_theorique=excluded.quantite_theorique,cout_unitaire=excluded.cout_unitaire
 returning id into v_id;
 return v_id;
end $$;
revoke all on function public.inventaire_preparer_ligne(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.inventaire_preparer_ligne(uuid,uuid,uuid) to authenticated;
create or replace function public.inventaire_cloturer(p_inventaire uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_pharmacie uuid;
begin
 select pharmacie_id into v_pharmacie from inventaires where id=p_inventaire and statut in('brouillon','en_cours') for update;
 if v_pharmacie is null or not(is_admin() or can_access_pharmacy(v_pharmacie)) then raise exception 'Inventaire non autorisé'; end if;
 if exists(select 1 from inventaire_lignes where inventaire_id=p_inventaire and quantite_comptee is null) then raise exception 'Toutes les lignes doivent être comptées avant clôture'; end if;
 update inventaires set statut='cloture',closed_at=now(),closed_by=auth.uid(),updated_at=now() where id=p_inventaire;
end $$;
revoke all on function public.inventaire_cloturer(uuid) from public,anon,authenticated;
grant execute on function public.inventaire_cloturer(uuid) to authenticated;
alter table public.vente_lignes add column if not exists cout_unitaire_fige integer check(cout_unitaire_fige is null or cout_unitaire_fige>=0);
alter table public.vente_lignes add column if not exists cout_total integer generated always as (quantite*coalesce(cout_unitaire_fige,0)) stored;
alter table public.vente_lignes add column if not exists marge_ligne integer generated always as ((quantite*prix_unitaire)-(quantite*coalesce(cout_unitaire_fige,0))) stored;
create or replace function public.vente_ligne_figer_cout() returns trigger language plpgsql security definer set search_path=public as $$
declare v_pharmacie uuid; v_cout integer;
begin
 select pharmacie_id into v_pharmacie from ventes where id=new.vente_id;
 if v_pharmacie is null then raise exception 'Vente introuvable'; end if;
 if new.cout_unitaire_fige is null then
   select cout_unitaire into v_cout from stocks_couts where pharmacie_id=v_pharmacie and produit_id=new.produit_id;
   if v_cout is null then raise exception 'Coût d''achat introuvable : coût requis avant vente'; end if;
   new.cout_unitaire_fige:=v_cout;
 end if;
 return new;
end $$;
drop trigger if exists trg_vente_ligne_figer_cout on public.vente_lignes;
create trigger trg_vente_ligne_figer_cout before insert on public.vente_lignes for each row execute function public.vente_ligne_figer_cout();
comment on column public.vente_lignes.cout_unitaire_fige is 'Coût d''achat interne figé au moment de la création de la ligne; jamais exposé au client.';
comment on column public.vente_lignes.marge_ligne is 'Marge interne après gel du coût d''achat.';
