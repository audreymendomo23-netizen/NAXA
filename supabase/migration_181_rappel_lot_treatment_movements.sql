-- NAXA ERP-011 / F64-PRO — traceable return/destruction, no second stock ledger.
begin;
create table if not exists public.rappels_lots_traitements (
 id uuid primary key default gen_random_uuid(),
 rappel_id uuid not null references public.rappels_lots(id) on delete restrict,
 lot_id uuid not null references public.stocks_lots(id) on delete restrict,
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 type text not null check(type in ('retour_fournisseur','destruction')),
 quantite integer not null check(quantite>0),
 reference text,
 motif text not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.rappels_lots_traitements enable row level security;
drop policy if exists rappels_lots_traitements_read on public.rappels_lots_traitements;
create policy rappels_lots_traitements_read on public.rappels_lots_traitements for select to authenticated
using (
 public.can_access_pharmacy(pharmacie_id)
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.actif=true
   and p.role::text not in ('client','admin','caisse') and coalesce(p.fonction_interne,'')<>'caisse')
);
revoke all on public.rappels_lots_traitements from public,anon,authenticated;
grant select on public.rappels_lots_traitements to authenticated;

create or replace function public.lot_rappel_traiter_sortie(
 p_rappel uuid,p_type text,p_quantite integer,p_reference text,p_motif text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_rappel public.rappels_lots%rowtype; v_lot public.stocks_lots%rowtype; v_stock public.stocks%rowtype;
 v_profile public.profiles%rowtype; v_id uuid; v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_type not in ('retour_fournisseur','destruction') then raise exception 'Type de sortie invalide'; end if;
 if p_quantite is null or p_quantite<=0 then raise exception 'Quantité invalide'; end if;
 if length(trim(coalesce(p_motif,''))) not between 5 and 500 then raise exception 'Motif obligatoire (5 à 500 caractères)'; end if;
 if p_reference is not null and length(trim(p_reference))>120 then raise exception 'Référence trop longue'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or coalesce(v_profile.role::text,'')<>'promoteur' then raise exception 'Traitement du rappel réservé au Promoteur actif'; end if;
 select * into v_rappel from public.rappels_lots where id=p_rappel and statut='actif' for update;
 if not found then raise exception 'Rappel actif introuvable'; end if;
 if not public.can_access_pharmacy(v_rappel.pharmacie_id) then raise exception 'Rappel hors périmètre'; end if;
 select * into v_lot from public.stocks_lots where id=v_rappel.lot_id for update;
 if not found or v_lot.quantite<p_quantite then raise exception 'Quantité supérieure au stock restant du lot'; end if;
 select * into v_stock from public.stocks where pharmacie_id=v_lot.pharmacie_id and produit_id=v_lot.produit_id for update;
 if not found or v_stock.quantite<p_quantite then raise exception 'Stock agrégé insuffisant pour la sortie'; end if;
 update public.stocks_lots set quantite=quantite-p_quantite where id=v_lot.id;
 update public.stocks set quantite=quantite-p_quantite,updated_at=now() where pharmacie_id=v_lot.pharmacie_id and produit_id=v_lot.produit_id;
 insert into public.rappels_lots_traitements(rappel_id,lot_id,pharmacie_id,type,quantite,reference,motif,created_by)
 values(v_rappel.id,v_lot.id,v_lot.pharmacie_id,p_type,p_quantite,nullif(trim(p_reference),''),trim(p_motif),v_user)
 returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.lot_rappel_traiter_sortie(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.lot_rappel_traiter_sortie(uuid,text,integer,text,text) to authenticated;
comment on table public.rappels_lots_traitements is 'Journal append-only des sorties de lots rappelés (retour fournisseur/destruction) ; les quantités opérationnelles restent dans stocks_lots et stocks.';
commit;