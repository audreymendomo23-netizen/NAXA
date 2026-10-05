-- NAXA — validité commerciale des pharmacies
-- Additif 010 : ne remplace aucune migration existante.

alter table public.abonnements
  add column if not exists echeance date,
  add column if not exists rappel_5j_envoye_at timestamptz,
  add column if not exists rappel_5j_en_cours_at timestamptz,
  add column if not exists dernier_paiement_le timestamptz,
  add column if not exists dernier_paiement_ref text,
  add column if not exists bloque_le timestamptz,
  add column if not exists reactive_le timestamptz,
  add column if not exists reactive_par uuid references public.profiles(id) on delete set null;

alter table public.abonnements
  alter column montant_mensuel set default 30000;

update public.abonnements
set montant_mensuel=30000
where montant_mensuel=0;

update public.abonnements
set echeance=coalesce(echeance,fin,debut+interval '1 month'-interval '1 day'), montant_mensuel=30000
where echeance is null;

create index if not exists abonnements_echeance_idx on public.abonnements(echeance);
create unique index if not exists abonnements_pharmacie_unique on public.abonnements(pharmacie_id);

create table if not exists public.abonnement_paiements(
 id uuid primary key default gen_random_uuid(),
 abonnement_id uuid not null references public.abonnements(id) on delete cascade,
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 periode_du date not null,
 periode_au date not null,
 montant integer not null check(montant>0),
 reference text,
 paye_le timestamptz not null default now(),
 enregistre_par uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 constraint abonnement_paiement_periode_ck check(periode_au>=periode_du)
);
alter table public.abonnement_paiements enable row level security;
drop policy if exists abonnement_paiements_admin on public.abonnement_paiements;
create policy abonnement_paiements_admin on public.abonnement_paiements
for all using((select public.is_admin())) with check((select public.is_admin()));
revoke all on public.abonnement_paiements from anon,authenticated;
grant select,insert,update on public.abonnement_paiements to authenticated;

create or replace function public.synchroniser_validite_pharmacies()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare n integer:=0;
begin
  update public.abonnements a
  set statut='impaye', bloque_le=coalesce(bloque_le,now())
  where a.echeance is not null
    and a.echeance < current_date
    and a.statut='actif';

  update public.pharmacies ph
  set actif=false
  where exists(select 1 from public.abonnements a where a.pharmacie_id=ph.id and a.statut='impaye')
    and ph.actif=true;
  get diagnostics n=row_count;

  update public.profiles p
  set actif=false
  where p.role in('promoteur','caisse','pharmacie')
    and p.actif=true
    and exists(select 1 from public.abonnements a where a.pharmacie_id=p.pharmacie_id and a.statut='impaye');
  return n;
end;
$$;
revoke all on function public.synchroniser_validite_pharmacies() from public,anon,authenticated;
grant execute on function public.synchroniser_validite_pharmacies() to service_role;

create or replace function public.validites_pharmacies_admin()
returns table(
 pharmacie_id uuid, pharmacie_nom text, ville text, pharmacie_active boolean,
 abonnement_id uuid, montant_mensuel integer, echeance date, statut text,
 promoteur_id uuid, promoteur_actif boolean, jours_restants integer
)
language sql
security definer
set search_path=public
as $$
 select ph.id,ph.nom,ph.ville,ph.actif,a.id,a.montant_mensuel,a.echeance,a.statut,
        p.id,p.actif,(a.echeance-current_date)::int
 from public.pharmacies ph
 left join public.abonnements a on a.pharmacie_id=ph.id
 left join lateral(
   select id,actif from public.profiles
   where pharmacie_id=ph.id and role='promoteur'
   order by created_at asc limit 1
 ) p on true
 where public.is_admin()
 order by (a.statut='impaye') desc, a.echeance asc nulls last, ph.nom;
$$;
revoke all on function public.validites_pharmacies_admin() from public,anon;
grant execute on function public.validites_pharmacies_admin() to authenticated;

create or replace function public.reactiver_pharmacie(
 p_pharmacie uuid,
 p_reference text default null
)
returns date
language plpgsql
security definer
set search_path=public
as $$
declare
 a public.abonnements;
 v_fin date;
begin
 if not public.is_admin() then raise exception 'Accès réservé à NAXA'; end if;
 select * into a from public.abonnements where pharmacie_id=p_pharmacie for update;
 if not found then
   insert into public.abonnements(pharmacie_id,formule,montant_mensuel,debut,echeance,statut)
   values(p_pharmacie,'essentiel',30000,current_date,current_date+interval '1 month'-interval '1 day','actif')
   returning * into a;
   insert into public.abonnement_paiements(abonnement_id,pharmacie_id,periode_du,periode_au,montant,reference,enregistre_par)
   values(a.id,p_pharmacie,current_date,a.echeance,30000,nullif(trim(coalesce(p_reference,'')),''),auth.uid());
 else
   v_fin:=current_date+interval '1 month'-interval '1 day';
   update public.abonnements
   set statut='actif',montant_mensuel=30000,debut=current_date,echeance=v_fin,
       fin=v_fin,rappel_5j_envoye_at=null,dernier_paiement_le=now(),
       dernier_paiement_ref=nullif(trim(coalesce(p_reference,'')),''),
       bloque_le=null,reactive_le=now(),reactive_par=auth.uid()
   where id=a.id;
   insert into public.abonnement_paiements(abonnement_id,pharmacie_id,periode_du,periode_au,montant,reference,enregistre_par)
   values(a.id,p_pharmacie,current_date,v_fin,30000,nullif(trim(coalesce(p_reference,'')),''),auth.uid());
 end if;
 update public.pharmacies set actif=true where id=p_pharmacie;
 update public.profiles set actif=true
 where pharmacie_id=p_pharmacie and role in('promoteur','caisse','pharmacie');
 return coalesce(v_fin,a.echeance);
end;
$$;
revoke all on function public.reactiver_pharmacie(uuid,text) from public,anon;
grant execute on function public.reactiver_pharmacie(uuid,text) to authenticated;

create or replace function public.claim_validite_rappels_5j()
returns table(pharmacie_id uuid,pharmacie_nom text,promoteur_email text,promoteur_prenom text,montant_mensuel integer,echeance date)
language sql
security definer
set search_path=public
as $$
 update public.abonnements a
 set rappel_5j_en_cours_at=now()
 where a.statut='actif'
   and a.echeance=current_date+5
   and a.rappel_5j_envoye_at is null
   and (a.rappel_5j_en_cours_at is null or a.rappel_5j_en_cours_at < now()-interval '15 minutes')
 returning a.pharmacie_id,
   (select ph.nom from public.pharmacies ph where ph.id=a.pharmacie_id),
   (select u.email from public.profiles p join auth.users u on u.id=p.id where p.pharmacie_id=a.pharmacie_id and p.role='promoteur' and p.actif order by p.created_at asc limit 1),
   (select p.first_name from public.profiles p where p.pharmacie_id=a.pharmacie_id and p.role='promoteur' and p.actif order by p.created_at asc limit 1),
   a.montant_mensuel,a.echeance;
$$;
revoke all on function public.claim_validite_rappels_5j() from public,anon,authenticated;
grant execute on function public.claim_validite_rappels_5j() to service_role;

create or replace function public.marquer_rappel_validite(p_pharmacie uuid)
returns void
language sql
security definer
set search_path=public
as $$
 update public.abonnements
 set rappel_5j_envoye_at=now(), rappel_5j_en_cours_at=null
 where pharmacie_id=p_pharmacie and echeance=current_date+5 and rappel_5j_envoye_at is null;
$$;
revoke all on function public.marquer_rappel_validite(uuid) from public,anon,authenticated;
grant execute on function public.marquer_rappel_validite(uuid) to service_role;

-- Les données client ne voient plus le stock des pharmacies désactivées.
drop policy if exists stocks_read on public.stocks;
create policy stocks_read on public.stocks for select using(
  exists(select 1 from public.pharmacies ph where ph.id=stocks.pharmacie_id and ph.actif)
  or stocks.pharmacie_id=public.my_pharmacie()
  or public.is_admin()
);

-- Toute nouvelle pharmacie créée après cette migration reçoit son abonnement standard.
create or replace function public.initialiser_abonnement_pharmacie()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.abonnements(pharmacie_id,formule,montant_mensuel,debut,echeance,fin,statut)
  values(new.id,'essentiel',30000,current_date,current_date+interval '1 month'-interval '1 day',current_date+interval '1 month'-interval '1 day','actif')
  on conflict(pharmacie_id) do nothing;
  return new;
end;
$$;
drop trigger if exists trg_initialiser_abonnement_pharmacie on public.pharmacies;
create trigger trg_initialiser_abonnement_pharmacie
after insert on public.pharmacies
for each row execute function public.initialiser_abonnement_pharmacie();

-- Une pharmacie impayée ne peut pas être réservée, même si un ancien chemin appelait la table directement.
create or replace function public.reserve_stock(p_pharmacie uuid,p_items jsonb)
returns uuid language plpgsql security definer set search_path=public
as $function$ declare v_id uuid;it jsonb;v_total int:=0;v_prix int;v_q int;begin
 if auth.uid() is null then raise exception 'Connexion requise';end if;
 if not exists(select 1 from public.pharmacies where id=p_pharmacie and actif) then raise exception 'Pharmacie indisponible';end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then raise exception 'Panier invalide';end if;
 if exists(select 1 from(select value->>'produit_id' pid,count(*) n from jsonb_array_elements(p_items) group by value->>'produit_id' having count(*)>1)x) then raise exception 'Produit dupliqué dans le panier';end if;
 insert into public.reservations(client_id,pharmacie_id,expires_at) values(auth.uid(),p_pharmacie,now()+interval '3 hours') returning id into v_id;
 for it in select * from jsonb_array_elements(p_items) loop
   v_q:=coalesce((it->>'quantite')::int,1);
   if v_q<1 or v_q>10 then raise exception 'Quantité invalide';end if;
   update public.stocks set quantite=quantite-v_q where pharmacie_id=p_pharmacie and produit_id=(it->>'produit_id')::uuid and quantite>=v_q returning prix into v_prix;
   if not found then raise exception 'Stock insuffisant pour un des produits';end if;
   insert into public.reservation_items values(v_id,(it->>'produit_id')::uuid,v_q,v_prix);
   v_total:=v_total+v_prix*v_q;
 end loop;
 update public.reservations set total=v_total where id=v_id;
 return v_id;
end$function$;
revoke all on function public.reserve_stock(uuid,jsonb) from public,anon;
grant execute on function public.reserve_stock(uuid,jsonb) to authenticated;

create or replace function public.search_pharmacies(
 p_terms text[],p_lat float8,p_lng float8,p_rayon_km float8 default 20
) returns table(pharmacie_id uuid,nom text,quartier text,adresse text,lat float8,lng float8,de_garde boolean,stock_updated_at timestamptz,distance_km float8,total_prix int,items jsonb,trouves int,demandes int)
language sql stable as $$
 with termes as(select row_number() over() n,lower(unaccent(trim(t))) q from unnest(p_terms)t where length(trim(t))>1),
 nb as(select count(*)::int c from termes),
 cand as(select t.n,s.pharmacie_id,pr.id produit_id,pr.nom,pr.dosage,s.prix,s.quantite,row_number() over(partition by t.n,s.pharmacie_id order by similarity(pr.nom_norm,t.q) desc,s.prix) rk
   from termes t join public.produits pr on pr.nom_norm % t.q or pr.nom_norm ilike '%'||t.q||'%' join public.stocks s on s.produit_id=pr.id and s.quantite>0
   join public.pharmacies ph on ph.id=s.pharmacie_id and ph.actif),
 best as(select * from cand where rk=1),
 agg as(select pharmacie_id,count(distinct n)::int trouves,sum(prix)::int total,jsonb_agg(jsonb_build_object('produit_id',produit_id,'nom',nom,'dosage',dosage,'prix',prix,'quantite',quantite) order by n) items from best group by pharmacie_id)
 select ph.id,ph.nom,ph.quartier,ph.adresse,ph.lat,ph.lng,ph.de_garde,ph.stock_updated_at,d.km,a.total,a.items,a.trouves,nb.c
 from agg a join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif cross join nb
 cross join lateral(select 6371*2*asin(sqrt(power(sin(radians(ph.lat-p_lat)/2),2)+cos(radians(p_lat))*cos(radians(ph.lat))*power(sin(radians(ph.lng-p_lng)/2),2))) km)d
 where d.km<=p_rayon_km order by(a.trouves=nb.c)desc,d.km
$$;
