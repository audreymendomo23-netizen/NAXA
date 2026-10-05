-- NAXA 009 — Pilotage commercial 360° et BI
-- Additive/idempotente. Ne remplace aucune migration existante.
create table if not exists public.evenements (
 id bigserial primary key,
 type text not null check (type in ('recherche','fiche_vue','panier_ajout','scan_ordonnance')),
 produit_id uuid references public.produits(id) on delete set null,
 pharmacie_id uuid references public.pharmacies(id) on delete set null,
 terme text, resultats int, zone_lat double precision, zone_lng double precision,
 created_at timestamptz not null default now()
);
create index if not exists evenements_type_date on public.evenements(type,created_at desc);
alter table public.evenements enable row level security;
drop policy if exists evenements_admin_lecture on public.evenements;
create policy evenements_admin_lecture on public.evenements for select using ((select public.is_admin()));
revoke all on public.evenements from anon, authenticated;
grant select on public.evenements to authenticated;

create or replace function public.log_evenement(p_type text,p_produit uuid default null,p_pharmacie uuid default null,p_terme text default null,p_resultats int default null,p_lat float8 default null,p_lng float8 default null)
returns void language plpgsql security definer set search_path=public,extensions as $$
declare pid uuid:=p_produit; t text; zl float8; zg float8; res int;
begin
 if p_type not in ('recherche','fiche_vue','panier_ajout','scan_ordonnance') then return; end if;
 res:=case when p_resultats is null then null else least(greatest(p_resultats,0),1000) end;
 if p_type='recherche' and p_terme is not null then
   t:=left(lower(unaccent(trim(p_terme))),60);
   if pid is null and length(t)>=3 then
     select id into pid from public.produits where nom_norm ilike '%'||t||'%' order by nom limit 1;
   end if;
   if res=0 and length(t)>=3 and t !~ '[0-9]{5,}' and t !~ '@' then p_terme:=t; else p_terme:=null; end if;
 end if;
 if p_lat between -5 and 15 and p_lng between 5 and 20 then
   zl:=(round(p_lat::numeric/0.02)*0.02)::float8; zg:=(round(p_lng::numeric/0.02)*0.02)::float8;
 end if;
 insert into public.evenements(type,produit_id,pharmacie_id,terme,resultats,zone_lat,zone_lng)
 values(p_type,pid,p_pharmacie,p_terme,res,zl,zg);
end $$;
revoke execute on function public.log_evenement(text,uuid,uuid,text,int,float8,float8) from public;
grant execute on function public.log_evenement(text,uuid,uuid,text,int,float8,float8) to anon,authenticated;

create table if not exists public.abonnements (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 formule text not null check(formule in ('pilote','essentiel','pro')),
 montant_mensuel integer not null default 0 check(montant_mensuel>=0),
 debut date not null default current_date, fin date,
 statut text not null default 'actif' check(statut in ('actif','resilie','impaye')),
 created_at timestamptz not null default now()
);
alter table public.abonnements enable row level security;
drop policy if exists abonnements_admin on public.abonnements;
create policy abonnements_admin on public.abonnements for all using((select public.is_admin())) with check((select public.is_admin()));
revoke all on public.abonnements from anon,authenticated;
grant select,insert,update,delete on public.abonnements to authenticated;

create table if not exists public.alertes (
 id bigserial primary key, pharmacie_id uuid references public.pharmacies(id) on delete cascade,
 type text not null, message text not null, lue boolean not null default false, created_at timestamptz not null default now()
);
alter table public.alertes enable row level security;
drop policy if exists alertes_lecture on public.alertes;
drop policy if exists alertes_maj on public.alertes;
create policy alertes_lecture on public.alertes for select using((select public.is_admin()) or pharmacie_id=(select public.my_pharmacie()));
create policy alertes_maj on public.alertes for update using((select public.is_admin()) or pharmacie_id=(select public.my_pharmacie())) with check((select public.is_admin()) or pharmacie_id=(select public.my_pharmacie()));
revoke all on public.alertes from anon,authenticated;
grant select on public.alertes to authenticated;
grant update(lue) on public.alertes to authenticated;

create table if not exists public.rapports (
 id bigserial primary key, portee text not null check(portee in ('pharmacie','admin')),
 pharmacie_id uuid references public.pharmacies(id) on delete cascade,
 periode text not null check(periode in ('quotidien','hebdo','mensuel')),
 du date not null, au date not null, contenu jsonb not null, texte text not null,
 envoye_le timestamptz, created_at timestamptz not null default now()
);
alter table public.rapports enable row level security;
drop policy if exists rapports_lecture on public.rapports;
create policy rapports_lecture on public.rapports for select using((select public.is_admin()) or (portee='pharmacie' and pharmacie_id=(select public.my_pharmacie())));
revoke all on public.rapports from anon,authenticated;
grant select on public.rapports to authenticated;

alter table public.pharmacies add column if not exists slug text;
alter table public.pharmacies add column if not exists horaires text;
alter table public.pharmacies add column if not exists visible_recherche boolean not null default true;
alter table public.pharmacies add column if not exists archivee_le timestamptz;
create unique index if not exists pharmacies_slug_unique on public.pharmacies(slug) where slug is not null;
alter table public.produits add column if not exists categorie text;
create table if not exists public.preferences_rapports(
 pharmacie_id uuid primary key references public.pharmacies(id) on delete cascade,
 actif boolean not null default false, destinataire text, updated_at timestamptz not null default now()
);
alter table public.preferences_rapports enable row level security;
drop policy if exists preferences_rapports_lecture on public.preferences_rapports;
create policy preferences_rapports_lecture on public.preferences_rapports for all using((select public.is_admin()) or pharmacie_id=(select public.my_pharmacie())) with check((select public.is_admin()) or pharmacie_id=(select public.my_pharmacie()));
revoke all on public.preferences_rapports from anon,authenticated;
grant select,insert,update on public.preferences_rapports to authenticated;

create table if not exists public.stocks_lots(
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 produit_id uuid not null references public.produits(id) on delete cascade,
 lot text not null, peremption date, quantite integer not null default 0 check(quantite>=0),
 updated_at timestamptz not null default now(),
 primary key(pharmacie_id,produit_id,lot)
);
alter table public.stocks_lots enable row level security;
drop policy if exists stocks_lots_equipe on public.stocks_lots;
create policy stocks_lots_equipe on public.stocks_lots for all using((select public.is_admin()) or pharmacie_id=(select public.my_pharmacie())) with check((select public.is_admin()) or pharmacie_id=(select public.my_pharmacie()));
revoke all on public.stocks_lots from anon,authenticated;
grant select,insert,update,delete on public.stocks_lots to authenticated;

create table if not exists public.journal_admin(
 id bigserial primary key, admin_profile_id uuid, action text not null, cible_type text, cible_id text,
 motif text not null, detail jsonb, created_at timestamptz not null default now()
);
alter table public.journal_admin enable row level security;
drop policy if exists journal_admin_naxa on public.journal_admin;
create policy journal_admin_naxa on public.journal_admin for select using((select public.is_admin()));
revoke all on public.journal_admin from anon,authenticated;
grant select on public.journal_admin to authenticated;

create table if not exists public.tickets_support(
 id uuid primary key default gen_random_uuid(), auteur_profile_id uuid, pharmacie_id uuid references public.pharmacies(id) on delete set null,
 sujet text not null, type text not null default 'general', statut text not null default 'ouvert',
 created_at timestamptz not null default now(), first_response_at timestamptz, resolved_at timestamptz
);
create table if not exists public.messages_support(
 id bigserial primary key, ticket_id uuid not null references public.tickets_support(id) on delete cascade,
 auteur_profile_id uuid, contenu text not null, interne boolean not null default false, created_at timestamptz not null default now()
);
alter table public.tickets_support enable row level security;
alter table public.messages_support enable row level security;
drop policy if exists tickets_support_acces on public.tickets_support;
create policy tickets_support_acces on public.tickets_support for select using((select public.is_admin()) or auteur_profile_id=auth.uid() or pharmacie_id=(select public.my_pharmacie()));
drop policy if exists messages_support_acces on public.messages_support;
create policy messages_support_acces on public.messages_support for select using((select public.is_admin()) or exists(select 1 from public.tickets_support t where t.id=ticket_id and (t.auteur_profile_id=auth.uid() or t.pharmacie_id=(select public.my_pharmacie()))));
revoke all on public.tickets_support,public.messages_support from anon,authenticated;
grant select,insert on public.tickets_support to authenticated;
grant select,insert on public.messages_support to authenticated;

create or replace function public._stats_pharmacie(p_ph uuid,p_jours int) returns jsonb language sql stable security definer set search_path=public as $$
with fen as(select now()-make_interval(days=>greatest(1,least(p_jours,365))) debut),
resa as(select r.* from public.reservations r,fen where r.pharmacie_id=p_ph and r.created_at>=fen.debut),
ra as(select count(*)::int total,count(*) filter(where statut='en_attente')::int en_attente,count(*) filter(where statut='retiree')::int retirees,count(*) filter(where statut in('expiree','annulee'))::int perdues,coalesce(sum(total) filter(where statut in('retiree','payee')),0)::int ca from resa),
serie as(select g::date jour,count(r.id)::int n from generate_series(current_date-(greatest(1,least(p_jours,30))-1),current_date,interval '1 day') g left join public.reservations r on r.pharmacie_id=p_ph and r.created_at::date=g::date group by 1 order by 1),
ruptures as(select p.nom,p.dosage,s.quantite from public.stocks s join public.produits p on p.id=s.produit_id where s.pharmacie_id=p_ph and s.quantite<=3 order by s.quantite,p.nom limit 20),
mes as(select produit_id from public.stocks where pharmacie_id=p_ph and quantite>0),
demande as(select p.id produit_id,p.nom,p.dosage,count(*)::int n from public.evenements e join public.produits p on p.id=e.produit_id where e.type='recherche' and e.created_at>now()-make_interval(days=>least(p_jours,365)) and e.produit_id not in(select produit_id from mes) group by p.id,p.nom,p.dosage having count(*)>=3 order by n desc limit 10)
select jsonb_build_object('jours',greatest(1,least(p_jours,365)),'reservations',(select to_jsonb(ra) from ra),'taux_retrait',(select round(100.0*retirees/nullif(retirees+perdues,0))::int from ra),'ca_estime',(select ca from ra),'ruptures',coalesce((select jsonb_agg(to_jsonb(x)) from ruptures x),'[]'::jsonb),'demande_non_servie',coalesce((select jsonb_agg(to_jsonb(x)) from demande x),'[]'::jsonb),'serie',coalesce((select jsonb_agg(to_jsonb(x)) from serie x),'[]'::jsonb),'stock_age_heures',(select round(extract(epoch from now()-stock_updated_at)/3600)::int from public.pharmacies where id=p_ph),'fiches_vues',(select count(*)::int from public.evenements where pharmacie_id=p_ph and type='fiche_vue' and created_at>now()-make_interval(days=>least(p_jours,365))));
$$;
create or replace function public.stats_pharmacie(p_ph uuid,p_jours int default 7) returns jsonb language plpgsql stable security definer set search_path=public as $$begin if auth.uid() is null or not(public.is_admin() or p_ph=(select public.my_pharmacie())) then raise exception 'Accès refusé'; end if; return public._stats_pharmacie(p_ph,p_jours); end$$;
revoke execute on function public._stats_pharmacie(uuid,int) from public,anon,authenticated;
revoke execute on function public.stats_pharmacie(uuid,int) from public,anon;
grant execute on function public.stats_pharmacie(uuid,int) to authenticated;

create or replace function public._stats_admin(p_jours int) returns jsonb language sql stable security definer set search_path=public as $$
with fen as(select now()-make_interval(days=>greatest(1,least(p_jours,365))) debut),
ph as(select count(*) filter(where actif and coalesce(archivee_le is null,true))::int actives,count(*) filter(where actif and (stock_updated_at is null or stock_updated_at<now()-interval '7 days'))::int a_risque from public.pharmacies),
rech as(select count(*)::int total,count(*) filter(where resultats=0)::int sans_resultat from public.evenements e,fen where type='recherche' and created_at>=fen.debut),
ent as(select (select count(*) from public.evenements e,fen where type='recherche' and created_at>=fen.debut)::int recherches,(select count(*) from public.evenements e,fen where type='fiche_vue' and created_at>=fen.debut)::int fiches_vues,(select count(*) from public.evenements e,fen where type='panier_ajout' and created_at>=fen.debut)::int paniers,(select count(*) from public.reservations r,fen where created_at>=fen.debut)::int reservations,(select count(*) from public.reservations r,fen where created_at>=fen.debut and statut='retiree')::int retirees),
top as(select p.nom,p.dosage,count(*)::int n from public.evenements e join public.produits p on p.id=e.produit_id,fen where e.type='recherche' and e.created_at>=fen.debut group by p.nom,p.dosage order by n desc limit 10),
sans as(select terme,count(*)::int n from public.evenements e,fen where e.type='recherche' and resultats=0 and terme is not null and created_at>=fen.debut group by terme having count(*)>=3 order by n desc limit 15),
abo as(select coalesce(sum(montant_mensuel) filter(where statut='actif'),0)::int mrr,count(*) filter(where statut='actif')::int actifs,count(*) filter(where statut='impaye')::int impayes from public.abonnements),
serie as(select g::date jour,(select count(*) from public.evenements e where e.type='recherche' and e.created_at::date=g::date)::int recherches,(select count(*) from public.reservations r where r.created_at::date=g::date)::int reservations from generate_series(current_date-(greatest(1,least(p_jours,30))-1),current_date,interval '1 day') g)
select jsonb_build_object('jours',p_jours,'pharmacies',(select to_jsonb(ph) from ph),'recherches',(select to_jsonb(rech) from rech),'entonnoir',(select to_jsonb(ent) from ent),'top_recherches',coalesce((select jsonb_agg(to_jsonb(x)) from top x),'[]'::jsonb),'sans_resultat',coalesce((select jsonb_agg(to_jsonb(x)) from sans x),'[]'::jsonb),'abonnements',(select to_jsonb(abo) from abo),'serie',coalesce((select jsonb_agg(to_jsonb(x)) from serie x),'[]'::jsonb));
$$;
create or replace function public.stats_admin(p_jours int default 7) returns jsonb language plpgsql stable security definer set search_path=public as $$begin if auth.uid() is null or not public.is_admin() then raise exception 'Accès refusé'; end if; return public._stats_admin(p_jours); end$$;
revoke execute on function public._stats_admin(int) from public,anon,authenticated;
revoke execute on function public.stats_admin(int) from public,anon;
grant execute on function public.stats_admin(int) to authenticated;

create or replace function public.generer_alertes() returns int language plpgsql security definer set search_path=public as $$declare n int:=0;r record;begin
 for r in select id,nom from public.pharmacies where actif and (stock_updated_at is null or stock_updated_at<now()-interval '7 days') loop
  if not exists(select 1 from public.alertes where pharmacie_id=r.id and type='stock_obsolete' and created_at>now()-interval '24 hours') then
   insert into public.alertes(pharmacie_id,type,message) values(r.id,'stock_obsolete','Stock non mis à jour depuis plus de 7 jours.'); insert into public.alertes(pharmacie_id,type,message) values(null,'pharmacie_a_risque',r.nom||' est à risque : stock non actualisé.'); n:=n+1;
  end if;
 end loop; return n;end$$;
revoke execute on function public.generer_alertes() from public,anon,authenticated;

create or replace function public.generer_rapports(p_periode text) returns int language plpgsql security definer set search_path=public as $$declare j int:=case when p_periode='quotidien' then 1 when p_periode='mensuel' then 30 else 7 end;r record;s jsonb;t text;n int:=0;begin
 for r in select id,nom from public.pharmacies where actif loop
  if not exists(select 1 from public.rapports where portee='pharmacie' and pharmacie_id=r.id and periode=p_periode and au=current_date) then
   s:=public._stats_pharmacie(r.id,j); t:=format('NAXA — %s : %s réservation(s), %s retrait(s), chiffre d’affaires estimé %s FCFA.',r.nom,s->'reservations'->>'total',s->'reservations'->>'retirees',s->>'ca_estime');
   insert into public.rapports(portee,pharmacie_id,periode,du,au,contenu,texte) values('pharmacie',r.id,p_periode,current_date-j,current_date,s,t); n:=n+1;
  end if;
 end loop;
 if not exists(select 1 from public.rapports where portee='admin' and periode=p_periode and au=current_date) then
  s:=public._stats_admin(j); t:=format('NAXA — réseau : %s recherche(s), %s réservation(s), %s pharmacie(s) active(s).',s->'recherches'->>'total',s->'entonnoir'->>'reservations',s->'pharmacies'->>'actives');
  insert into public.rapports(portee,periode,du,au,contenu,texte) values('admin',p_periode,current_date-j,current_date,s,t);n:=n+1;
 end if; return n;end$$;
revoke execute on function public.generer_rapports(text) from public,anon,authenticated;

create or replace function public.rapports_non_envoyes() returns table(rapport_id bigint,email text,portee text,pharmacie_nom text,periode text,du date,au date,texte text,contenu jsonb)
language sql stable security definer set search_path=public as $$
select r.id,u.email::text,r.portee,ph.nom,r.periode,r.du,r.au,r.texte,r.contenu from public.rapports r left join public.pharmacies ph on ph.id=r.pharmacie_id join public.profiles p on ((r.portee='pharmacie' and p.pharmacie_id=r.pharmacie_id and p.role='promoteur' and p.actif) or (r.portee='admin' and p.role='admin')) join auth.users u on u.id=p.id where r.envoye_le is null and u.email is not null;
$$;
create or replace function public.marquer_rapport_envoye(p_id bigint) returns void language sql security definer set search_path=public as $$update public.rapports set envoye_le=now() where id=p_id$$;
revoke execute on function public.rapports_non_envoyes() from public,anon,authenticated;
revoke execute on function public.marquer_rapport_envoye(bigint) from public,anon,authenticated;
grant execute on function public.rapports_non_envoyes() to service_role;
grant execute on function public.marquer_rapport_envoye(bigint) to service_role;

do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  begin perform cron.schedule('naxa-alertes-360','*/15 * * * *','select public.generer_alertes()'); exception when others then null; end;
  begin perform cron.schedule('naxa-rapports-quotidiens','15 6 * * *','select public.generer_rapports(''quotidien'')'); exception when others then null; end;
  begin perform cron.schedule('naxa-rapports-hebdo-360','0 6 * * 1','select public.generer_rapports(''hebdo'')'); exception when others then null; end;
  begin perform cron.schedule('naxa-rapports-mensuel-360','0 6 1 * *','select public.generer_rapports(''mensuel'')'); exception when others then null; end;
 end if;
end$$;

create or replace view public.v_ventes_journalieres as
select r.pharmacie_id,r.created_at::date jour,count(*) filter(where r.statut in('retiree','payee'))::int ventes,coalesce(sum(r.total) filter(where r.statut in('retiree','payee')),0)::int ca,coalesce(avg(r.total) filter(where r.statut in('retiree','payee')),0)::numeric panier_moyen
from public.reservations r group by r.pharmacie_id,r.created_at::date;

create schema if not exists bi;
revoke all on schema bi from public,anon,authenticated;
create or replace view bi.activite_mensuelle as
select date_trunc('month',r.created_at)::date mois,ph.nom pharmacie,ph.quartier,ph.ville,count(*)::int reservations,count(*) filter(where r.statut in('retiree','payee'))::int ventes,coalesce(sum(r.total) filter(where r.statut in('retiree','payee')),0)::int ca
from public.reservations r join public.pharmacies ph on ph.id=r.pharmacie_id where ph.est_demo is not true group by 1,2,3,4;
create or replace view bi.stock_pharmacies as
select ph.nom pharmacie,ph.quartier,ph.ville,ph.actif,ph.stock_updated_at,count(s.produit_id) filter(where s.quantite>0)::int produits_en_stock,count(s.produit_id) filter(where s.quantite=0)::int produits_en_rupture
from public.pharmacies ph left join public.stocks s on s.pharmacie_id=ph.id where ph.est_demo is not true group by ph.id,ph.nom,ph.quartier,ph.ville,ph.actif,ph.stock_updated_at;
do $$begin if exists(select 1 from pg_roles where rolname='naxa_bi_lecture') then grant usage on schema bi to naxa_bi_lecture; grant select on all tables in schema bi to naxa_bi_lecture; end if;end$$;
