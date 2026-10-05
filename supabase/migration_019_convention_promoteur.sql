-- NAXA 019 — convention + abonnement au niveau Promoteur
-- Additif non destructif. La tarification/validité ne sont plus portées par pharmacie.
-- Les anciennes tables abonnements/abonnement_paiements restent conservées pour compatibilité historique.

create table if not exists public.conventions_promoteurs (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  montant_mensuel integer not null check (montant_mensuel > 0),
  date_paiement date,
  date_expiration date not null,
  statut text not null default 'active' check (statut in ('active','expiree','resiliee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists conventions_promoteur_unique
  on public.conventions_promoteurs(promoteur_id);
alter table public.conventions_promoteurs enable row level security;
drop policy if exists conventions_promoteurs_admin on public.conventions_promoteurs;
create policy conventions_promoteurs_admin on public.conventions_promoteurs
  for all using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.conventions_promoteurs from anon,authenticated;
grant select,insert,update on public.conventions_promoteurs to authenticated;

create table if not exists public.abonnements_promoteurs (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  convention_id uuid not null references public.conventions_promoteurs(id) on delete restrict,
  montant_mensuel integer not null check (montant_mensuel > 0),
  debut date not null default current_date,
  echeance date not null,
  statut text not null default 'actif' check (statut in ('actif','impaye','resilie')),
  created_at timestamptz not null default now(),
  bloque_le timestamptz,
  reactive_le timestamptz,
  reactive_par uuid references public.profiles(id) on delete set null
);
create unique index if not exists abonnements_promoteur_unique
  on public.abonnements_promoteurs(promoteur_id);
alter table public.abonnements_promoteurs enable row level security;
drop policy if exists abonnements_promoteurs_admin on public.abonnements_promoteurs;
create policy abonnements_promoteurs_admin on public.abonnements_promoteurs
  for all using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.abonnements_promoteurs from anon,authenticated;
grant select,insert,update on public.abonnements_promoteurs to authenticated;

create table if not exists public.abonnement_promoteur_paiements (
  id uuid primary key default gen_random_uuid(),
  abonnement_id uuid not null references public.abonnements_promoteurs(id) on delete cascade,
  periode_du date not null,
  periode_au date not null,
  montant integer not null check (montant > 0),
  reference text,
  paye_le timestamptz not null default now(),
  enregistre_par uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint abonnement_promoteur_paiement_periode_ck check (periode_au >= periode_du)
);
alter table public.abonnement_promoteur_paiements enable row level security;
drop policy if exists abonnement_promoteur_paiements_admin on public.abonnement_promoteur_paiements;
create policy abonnement_promoteur_paiements_admin on public.abonnement_promoteur_paiements
  for all using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.abonnement_promoteur_paiements from anon,authenticated;
grant select,insert,update on public.abonnement_promoteur_paiements to authenticated;

-- Reprise additive des Promoteurs existants : une seule convention + un seul abonnement canonique par Promoteur.
-- La valeur reprise est celle du premier abonnement historique disponible ; NAXA/Admin reste libre de la corriger.
insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_paiement,date_expiration)
select p.id, coalesce(a.montant_mensuel,30000), a.dernier_paiement_le::date,
       coalesce(a.echeance, current_date + interval '1 month' - interval '1 day')
from public.profiles p
left join lateral (
  select a.montant_mensuel,a.dernier_paiement_le,a.echeance
  from public.abonnements a
  join public.pharmacies ph on ph.id=a.pharmacie_id
  where p.role='promoteur'
    and (a.pharmacie_id=p.pharmacie_id or exists (
      select 1 from public.promoteur_pharmacies pp
      where pp.promoteur_id=p.id and pp.pharmacie_id=a.pharmacie_id
    ))
  order by a.created_at asc
  limit 1
) a on true
where p.role='promoteur'
on conflict (promoteur_id) do nothing;

insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut)
select c.promoteur_id,c.id,c.montant_mensuel,
       coalesce(c.date_paiement,current_date),
       c.date_expiration,
       case when c.date_expiration < current_date then 'impaye' else 'actif' end
from public.conventions_promoteurs c
on conflict (promoteur_id) do nothing;

-- Une nouvelle pharmacie ne crée plus un abonnement distinct.
create or replace function public.initialiser_abonnement_pharmacie()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  return new;
end;
$$;

-- La validité est désormais calculée au niveau Promoteur.
create or replace function public.synchroniser_validite_pharmacies()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare n integer := 0;
begin
  update public.abonnements_promoteurs ap
  set statut='impaye', bloque_le=coalesce(ap.bloque_le,now())
  where ap.echeance < current_date and ap.statut='actif';

  update public.conventions_promoteurs c
  set statut='expiree', updated_at=now()
  where c.date_expiration < current_date and c.statut='active';

  update public.pharmacies ph
  set actif=false
  where ph.actif
    and exists (
      select 1
      from public.abonnements_promoteurs ap
      join public.promoteur_pharmacies pp on pp.promoteur_id=ap.promoteur_id
      where pp.pharmacie_id=ph.id and ap.statut='impaye'
    );

  get diagnostics n=row_count;

  update public.profiles p
  set actif=false
  where p.actif
    and (
      exists (
        select 1 from public.abonnements_promoteurs ap
        join public.promoteur_pharmacies pp on pp.promoteur_id=ap.promoteur_id
        where pp.pharmacie_id=p.pharmacie_id and ap.statut='impaye'
      )
      or exists (
        select 1 from public.abonnements_promoteurs ap
        where ap.promoteur_id=p.id and ap.statut='impaye'
      )
    );
  return n;
end;
$$;
revoke all on function public.synchroniser_validite_pharmacies() from public,anon,authenticated;
grant execute on function public.synchroniser_validite_pharmacies() to service_role;

-- Vue RPC Admin : une ligne par Promoteur, même sans pharmacie.
create or replace function public.validites_pharmacies_admin()
returns table(
 promoteur_id uuid,
 promoteur_nom text,
 promoteur_actif boolean,
 pharmacies_count integer,
 pharmacies_noms text,
 abonnement_id uuid,
 convention_id uuid,
 montant_mensuel integer,
 date_paiement date,
 echeance date,
 statut text,
 jours_restants integer
)
language sql
security definer
set search_path=public
as $$
 select
   p.id,
   trim(concat_ws(' ',p.first_name,p.last_name)),
   p.actif,
   coalesce((select count(*)::int from public.promoteur_pharmacies pp where pp.promoteur_id=p.id),0),
   coalesce((select string_agg(ph.nom, ', ' order by ph.nom)
             from public.promoteur_pharmacies pp join public.pharmacies ph on ph.id=pp.pharmacie_id
             where pp.promoteur_id=p.id),'Aucune'),
   ap.id,c.id,ap.montant_mensuel,c.date_paiement,ap.echeance,ap.statut,
   (ap.echeance-current_date)::int
 from public.profiles p
 left join public.abonnements_promoteurs ap on ap.promoteur_id=p.id
 left join public.conventions_promoteurs c on c.id=ap.convention_id
 where p.role='promoteur' and public.is_admin()
 order by (ap.statut='impaye') desc, ap.echeance asc nulls last, promoteur_nom;
$$;
revoke all on function public.validites_pharmacies_admin() from public,anon;
grant execute on function public.validites_pharmacies_admin() to authenticated;

create or replace function public.reactiver_promoteur(
 p_promoteur uuid,
 p_reference text default null
)
returns date
language plpgsql
security definer
set search_path=public
as $$
declare
 c public.conventions_promoteurs;
 a public.abonnements_promoteurs;
 v_fin date := current_date + interval '1 month' - interval '1 day';
begin
 if not public.is_admin() then raise exception 'Accès réservé à NAXA'; end if;
 select * into c from public.conventions_promoteurs where promoteur_id=p_promoteur for update;
 if not found then raise exception 'Convention Promoteur introuvable'; end if;

 update public.conventions_promoteurs
 set date_paiement=current_date,date_expiration=v_fin,statut='active',updated_at=now()
 where id=c.id;

 select * into a from public.abonnements_promoteurs where promoteur_id=p_promoteur for update;
 if not found then
   insert into public.abonnements_promoteurs(promoteur_id,convention_id,montant_mensuel,debut,echeance,statut,reactive_le,reactive_par)
   values(p_promoteur,c.id,c.montant_mensuel,current_date,v_fin,'actif',now(),auth.uid())
   returning * into a;
 else
   update public.abonnements_promoteurs
   set convention_id=c.id,montant_mensuel=c.montant_mensuel,debut=current_date,echeance=v_fin,
       statut='actif',bloque_le=null,reactive_le=now(),reactive_par=auth.uid()
   where id=a.id;
 end if;

 insert into public.abonnement_promoteur_paiements(abonnement_id,periode_du,periode_au,montant,reference,enregistre_par)
 values(a.id,current_date,v_fin,c.montant_mensuel,
        nullif(trim(coalesce(p_reference,'')),''),auth.uid());

 update public.pharmacies ph
 set actif=true
 where exists(select 1 from public.promoteur_pharmacies pp
              where pp.promoteur_id=p_promoteur and pp.pharmacie_id=ph.id);
 update public.profiles pr
 set actif=true
 where pr.id=p_promoteur
    or exists(select 1 from public.promoteur_pharmacies pp
              where pp.promoteur_id=p_promoteur and pp.pharmacie_id=pr.pharmacie_id);
 return v_fin;
end;
$$;
revoke all on function public.reactiver_promoteur(uuid,text) from public,anon;
grant execute on function public.reactiver_promoteur(uuid,text) to authenticated;

-- Plus de création implicite d'un abonnement par pharmacie.
drop trigger if exists trg_initialiser_abonnement_pharmacie on public.pharmacies;
create trigger trg_initialiser_abonnement_pharmacie
after insert on public.pharmacies
for each row execute function public.initialiser_abonnement_pharmacie();
