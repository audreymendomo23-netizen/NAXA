-- Renouvellement administratif à échéance manuelle et audit. Aucun paiement n'est présumé vérifié.
-- Dépendances de schéma explicites pour les environnements Supabase Preview.
-- Les scripts historiques migration_019/migration_024 sont conservés à la racine
-- pour reprise manuelle ; les migrations CLI doivent rester autonomes.

alter table public.profiles add column if not exists architecture_code text;

create table if not exists public.conventions_promoteurs (
 id uuid primary key default gen_random_uuid(),
 promoteur_id uuid not null references public.profiles(id) on delete restrict,
 montant_mensuel integer not null check (montant_mensuel > 0),
 date_paiement date,
 date_expiration date not null,
 statut text not null default 'active' check (statut in ('active','expiree','resiliee')),
 architecture_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists conventions_promoteur_unique on public.conventions_promoteurs(promoteur_id);
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
 reactive_par uuid references public.profiles(id) on delete set null,
 rappel_5j_envoye_at timestamptz,
 rappel_5j_en_cours_at timestamptz
);
create unique index if not exists abonnements_promoteur_unique on public.abonnements_promoteurs(promoteur_id);
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

create table if not exists public.promoteur_pharmacies (
 promoteur_id uuid not null references public.profiles(id) on delete restrict,
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 actif boolean not null default true,
 created_at timestamptz not null default now(),
 primary key (promoteur_id,pharmacie_id)
);
create index if not exists promoteur_pharmacies_promoteur_idx on public.promoteur_pharmacies(promoteur_id,actif);
create index if not exists promoteur_pharmacies_pharmacie_idx on public.promoteur_pharmacies(pharmacie_id,actif);
alter table public.promoteur_pharmacies enable row level security;
drop policy if exists promoteur_pharmacies_read_scope on public.promoteur_pharmacies;
create policy promoteur_pharmacies_read_scope on public.promoteur_pharmacies
 for select to authenticated
 using (
   public.is_admin()
   or promoteur_id=(select auth.uid())
   or exists (
     select 1 from public.profiles p
     where p.id=(select auth.uid())
       and p.pharmacie_id=promoteur_pharmacies.pharmacie_id
       and p.actif
       and p.niveau_interne in (2,3)
   )
 );
revoke all on public.promoteur_pharmacies from anon,authenticated;
grant select on public.promoteur_pharmacies to authenticated;

create table if not exists public.admin_pharmacie_audit (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid references public.pharmacies(id) on delete set null,
 promoteur_id uuid references public.profiles(id) on delete set null,
 acteur_id uuid not null references public.profiles(id),
 action text not null, motif text not null,
 avant jsonb not null default '{}'::jsonb, apres jsonb not null default '{}'::jsonb,
 cree_le timestamptz not null default now()
);
alter table public.admin_pharmacie_audit enable row level security;
revoke all on public.admin_pharmacie_audit from anon, authenticated;
grant select,insert on public.admin_pharmacie_audit to service_role;

create or replace function public.admin_renouveler_promoteur(p_promoteur uuid,p_nouvelle_echeance date,p_motif text,p_admin uuid)
returns date language plpgsql security definer set search_path='' as $$
declare c public.conventions_promoteurs%rowtype; a public.abonnements_promoteurs%rowtype;
 nc int; na int; nl int; ph uuid; v_architecture text; avant jsonb; apres jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin' and actif=true) then raise exception 'Accès réservé à un administrateur actif'; end if;
 if p_nouvelle_echeance is null or p_nouvelle_echeance<=current_date or length(trim(coalesce(p_motif,'')))<5 then raise exception 'Échéance future et motif (5 caractères minimum) obligatoires'; end if;
 if not exists(select 1 from public.profiles where id=p_promoteur and role='promoteur') then raise exception 'Promoteur introuvable'; end if;
 select count(*) into nc from public.conventions_promoteurs where promoteur_id=p_promoteur;
 select count(*) into na from public.abonnements_promoteurs where promoteur_id=p_promoteur;
 select count(*) into nl from public.promoteur_pharmacies where promoteur_id=p_promoteur;
 if nc<>1 or na<>1 then raise exception 'Une convention et un abonnement uniques sont requis'; end if;
 if nl<>1 then raise exception 'Un lien promoteur-pharmacie unique est requis'; end if;
 select architecture_code into v_architecture from public.profiles where id=p_promoteur;
 select * into c from public.conventions_promoteurs where promoteur_id=p_promoteur for update;
 select * into a from public.abonnements_promoteurs where promoteur_id=p_promoteur for update;
 if c.architecture_code is null or c.architecture_code is distinct from v_architecture or a.convention_id is distinct from c.id or a.montant_mensuel is distinct from c.montant_mensuel then raise exception 'Convention, abonnement et architecture incohérents'; end if;
 if a.statut='resilie' or c.statut='resiliee' then raise exception 'Abonnement ou convention résilié : examen administratif distinct requis'; end if;
 select pharmacie_id into ph from public.promoteur_pharmacies where promoteur_id=p_promoteur for update;
 avant:=jsonb_build_object('convention_statut',c.statut,'convention_echeance',c.date_expiration,'abonnement_statut',a.statut,'abonnement_echeance',a.echeance,'profil_actif',(select actif from public.profiles where id=p_promoteur),'pharmacie_id',ph);
 update public.conventions_promoteurs set date_expiration=p_nouvelle_echeance,statut='active' where id=c.id;
 update public.abonnements_promoteurs set echeance=p_nouvelle_echeance,statut='actif',bloque_le=null,reactive_le=now(),reactive_par=p_admin where id=a.id;
 -- Ne touche ni date_paiement ni au registre de paiements : renouvellement administratif ≠ preuve de règlement.
 -- Le renouvellement administratif ne vaut ni preuve de paiement ni levée
 -- d'une suspension indépendante sur le profil, le lien ou la pharmacie.
 apres:=jsonb_build_object(
  'convention_statut','active','convention_echeance',p_nouvelle_echeance,
  'abonnement_statut','actif','abonnement_echeance',p_nouvelle_echeance,
  'profil_actif',(select actif from public.profiles where id=p_promoteur),
  'pharmacie_id',ph
 );
 insert into public.admin_pharmacie_audit(pharmacie_id,promoteur_id,acteur_id,action,motif,avant,apres) values(ph,p_promoteur,p_admin,'renouvellement_manuel',trim(p_motif),avant,apres);
 return p_nouvelle_echeance;
end $$;
revoke all on function public.admin_renouveler_promoteur(uuid,date,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_renouveler_promoteur(uuid,date,text,uuid) to service_role;
