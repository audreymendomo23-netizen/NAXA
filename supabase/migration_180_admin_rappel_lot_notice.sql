-- NAXA ERP-011 / F64-ADM — network advisory, no pharmacy stock or sales disclosure.
begin;
create table if not exists public.avis_rappels_lots_reseau (
 id uuid primary key default gen_random_uuid(),
 produit_nom text not null,
 numero_lot text not null,
 reference_avis text,
 motif text not null,
 consigne text not null,
 statut text not null default 'actif' check (statut in ('actif','archive')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.avis_rappels_lots_destinataires (
 id uuid primary key default gen_random_uuid(),
 avis_id uuid not null references public.avis_rappels_lots_reseau(id) on delete cascade,
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 accuse_par uuid references auth.users(id),
 accuse_at timestamptz,
 unique(avis_id,pharmacie_id)
);
alter table public.avis_rappels_lots_reseau enable row level security;
alter table public.avis_rappels_lots_destinataires enable row level security;
drop policy if exists avis_rappels_lots_reseau_read on public.avis_rappels_lots_reseau;
create policy avis_rappels_lots_reseau_read on public.avis_rappels_lots_reseau for select to authenticated
using (
 public.is_admin() or exists (
  select 1 from public.avis_rappels_lots_destinataires d
  join public.promoteur_pharmacies pp on pp.pharmacie_id=d.pharmacie_id and pp.actif=true
  join public.profiles p on p.id=auth.uid() and p.role::text='promoteur' and p.actif=true
  where d.avis_id=avis_rappels_lots_reseau.id and pp.promoteur_id=auth.uid()
 )
);
drop policy if exists avis_rappels_lots_destinataires_read on public.avis_rappels_lots_destinataires;
create policy avis_rappels_lots_destinataires_read on public.avis_rappels_lots_destinataires for select to authenticated
using (
 public.is_admin() or exists (
  select 1 from public.promoteur_pharmacies pp
  join public.profiles p on p.id=auth.uid() and p.role::text='promoteur' and p.actif=true
  where pp.promoteur_id=auth.uid() and pp.pharmacie_id=avis_rappels_lots_destinataires.pharmacie_id and pp.actif=true
 )
);
revoke all on public.avis_rappels_lots_reseau,public.avis_rappels_lots_destinataires from anon,authenticated;
grant select on public.avis_rappels_lots_reseau,public.avis_rappels_lots_destinataires to authenticated;

create or replace function public.admin_avis_rappel_lot_diffuser(
 p_produit_nom text,p_numero_lot text,p_reference_avis text,p_motif text,p_consigne text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_count integer;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Diffusion réservée à l’administration NAXA'; end if;
 if length(trim(coalesce(p_produit_nom,''))) not between 2 and 180 then raise exception 'Produit requis'; end if;
 if length(trim(coalesce(p_numero_lot,''))) not between 1 and 120 then raise exception 'Numéro de lot requis'; end if;
 if p_reference_avis is not null and length(trim(p_reference_avis))>120 then raise exception 'Référence trop longue'; end if;
 if length(trim(coalesce(p_motif,''))) not between 5 and 500 or length(trim(coalesce(p_consigne,''))) not between 5 and 500 then
  raise exception 'Motif et consigne doivent contenir entre 5 et 500 caractères';
 end if;
 insert into public.avis_rappels_lots_reseau(produit_nom,numero_lot,reference_avis,motif,consigne,created_by)
 values(trim(p_produit_nom),trim(p_numero_lot),nullif(trim(p_reference_avis),''),trim(p_motif),trim(p_consigne),auth.uid())
 returning id into v_id;
 insert into public.avis_rappels_lots_destinataires(avis_id,pharmacie_id)
 select v_id,ph.id from public.pharmacies ph where ph.actif=true;
 get diagnostics v_count=row_count;
 if v_count=0 then raise exception 'Aucune pharmacie active à notifier'; end if;
 return v_id;
end; $$;

create or replace function public.promoteur_accuser_avis_rappel_lot(p_destinataire uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_ph uuid; v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or coalesce(v_profile.role::text,'')<>'promoteur' then raise exception 'Accusé de réception réservé au Promoteur actif'; end if;
 select d.pharmacie_id into v_ph from public.avis_rappels_lots_destinataires d where d.id=p_destinataire for update;
 if v_ph is null then raise exception 'Avis destinataire introuvable'; end if;
 if not exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=v_user and pp.pharmacie_id=v_ph and pp.actif=true) then
  raise exception 'Avis hors réseau du Promoteur';
 end if;
 update public.avis_rappels_lots_destinataires set accuse_par=v_user,accuse_at=coalesce(accuse_at,now()) where id=p_destinataire;
end; $$;
revoke all on function public.admin_avis_rappel_lot_diffuser(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_avis_rappel_lot_diffuser(text,text,text,text,text) to authenticated;
revoke all on function public.promoteur_accuser_avis_rappel_lot(uuid) from public,anon,authenticated;
grant execute on function public.promoteur_accuser_avis_rappel_lot(uuid) to authenticated;
comment on table public.avis_rappels_lots_reseau is 'Avis réseau de rappel diffusés par NAXA ; ne contient aucune donnée de stock ou de vente de pharmacie.';
commit;