-- NAXA 020 — moteur canonique architecture + niveaux + privilèges
-- Additif, non destructif. Responsable reste une fonction/niveau métier : role_type n'est PAS modifié.
-- Source de vérité : NAXA -> convention -> architecture -> niveau/role -> privilèges autorisés -> attribution -> scope.

alter table public.conventions_promoteurs
  add column if not exists architecture_code text;

create table if not exists public.naxa_architectures (
  code text primary key,
  libelle text not null,
  description text not null,
  max_responsables integer,
  max_caisses integer,
  custom_roles boolean not null default false,
  active boolean not null default true
);

insert into public.naxa_architectures(code,libelle,description,max_responsables,max_caisses,custom_roles)
values
 ('ORPHELIN','1 niveau / ORPHELIN','Promoteur avec une seule Caisse maximum',0,1,false),
 ('PARENTS_ENFANTS','2 niveaux / PARENTS → ENFANTS','Promoteur avec jusqu’à 5 Caisses, sans Responsable',0,5,false),
 ('PARENTS_AINES_CADETS','3 niveaux / PARENTS → AÎNÉS → CADETS','Promoteur, jusqu’à 5 Responsables et jusqu’à 5 Caisses',5,5,false),
 ('HYBRIDE','HYBRIDE / plusieurs niveaux','Rôles et utilisateurs composables dans les limites NAXA',null,null,true)
on conflict (code) do update set
 libelle=excluded.libelle, description=excluded.description,
 max_responsables=excluded.max_responsables, max_caisses=excluded.max_caisses,
 custom_roles=excluded.custom_roles, active=true;

create table if not exists public.naxa_architecture_niveaux (
 architecture_code text not null references public.naxa_architectures(code) on delete restrict,
 niveau smallint not null check (niveau between 1 and 3),
 primary key (architecture_code,niveau)
);
insert into public.naxa_architecture_niveaux values
 ('ORPHELIN',1),('ORPHELIN',3),
 ('PARENTS_ENFANTS',1),('PARENTS_ENFANTS',3),
 ('PARENTS_AINES_CADETS',1),('PARENTS_AINES_CADETS',2),('PARENTS_AINES_CADETS',3),
 ('HYBRIDE',1),('HYBRIDE',2),('HYBRIDE',3)
on conflict do nothing;

create table if not exists public.pharmacie_architectures (
  pharmacie_id uuid primary key references public.pharmacies(id) on delete restrict,
  architecture_code text not null references public.naxa_architectures(code) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  active boolean not null default true,
  max_responsables integer not null default 0 check (max_responsables >= 0),
  max_caisses integer,
  check (
    (architecture_code='ORPHELIN' and max_responsables=0 and max_caisses=1)
    or (architecture_code='PARENTS_ENFANTS' and max_responsables=0 and max_caisses=5)
    or (architecture_code='PARENTS_AINES_CADETS' and max_responsables=5 and max_caisses=5)
    or (architecture_code='HYBRIDE' and max_responsables is null)
  )
);

alter table public.pharmacie_architectures enable row level security;

alter table public.profiles
  add column if not exists fonction_interne text;

alter table public.profiles
  add column if not exists niveau_hierarchique smallint;

alter table public.profiles
  add column if not exists architecture_code text;

alter table public.profiles
  add column if not exists niveau_interne smallint not null default 0
  check (niveau_interne between 0 and 3);

update public.profiles set niveau_interne=1 where role='promoteur' and niveau_interne=0;
update public.profiles set niveau_interne=3 where role='caisse' and niveau_interne=0;

create index if not exists profiles_niveau_interne_idx on public.profiles(niveau_interne,actif);

-- Réconciliation avec migration_020 : naxa_privileges existe déjà avec le catalogue canonique
-- (family/description/governance). On l'étend sans recréer ni remplacer cette table.
do $naxa$
begin
  if to_regclass('public.naxa_privileges') is null then
    create table public.naxa_privileges (
      code text primary key,
      family text,
      description text,
      famille text not null,
      libelle text not null,
      niveau_min smallint not null check (niveau_min between 1 and 3),
      niveau_max smallint not null check (niveau_max between 1 and 3),
      delegable boolean not null default true,
      governance boolean not null default false,
      active boolean not null default true,
      check (niveau_min <= niveau_max)
    );
  else
    alter table public.naxa_privileges add column if not exists family text;
    alter table public.naxa_privileges add column if not exists description text;
    alter table public.naxa_privileges add column if not exists famille text;
    alter table public.naxa_privileges add column if not exists libelle text;
    alter table public.naxa_privileges add column if not exists niveau_min smallint;
    alter table public.naxa_privileges add column if not exists niveau_max smallint;
    alter table public.naxa_privileges add column if not exists governance boolean;
    alter table public.naxa_privileges add column if not exists active boolean;

    update public.naxa_privileges
       set famille=coalesce(famille,family),
           libelle=coalesce(libelle,description),
           niveau_min=coalesce(niveau_min,1),
           niveau_max=coalesce(niveau_max,3),
           governance=coalesce(governance,false),
           active=coalesce(active,true);

    alter table public.naxa_privileges alter column famille set not null;
    alter table public.naxa_privileges alter column libelle set not null;
    alter table public.naxa_privileges alter column niveau_min set not null;
    alter table public.naxa_privileges alter column niveau_max set not null;
    alter table public.naxa_privileges alter column governance set not null;
    alter table public.naxa_privileges alter column active set not null;
  end if;
end $naxa$;
create table if not exists public.naxa_role_privileges (
  role_key text not null check (role_key in ('admin','promoteur','responsable','caisse')),
  privilege_code text not null references public.naxa_privileges(code) on delete restrict,
  primary key (role_key,privilege_code)
);

create table if not exists public.naxa_architecture_privileges (
  architecture_code text not null references public.naxa_architectures(code) on delete restrict,
  role_key text not null check (role_key in ('admin','promoteur','responsable','caisse')),
  privilege_code text not null references public.naxa_privileges(code) on delete restrict,
  primary key (architecture_code,role_key,privilege_code)
);

insert into public.naxa_role_privileges(role_key,privilege_code)
select r.role_key,n.code
from (values ('promoteur',1::smallint),('responsable',2::smallint),('caisse',3::smallint)) r(role_key,niveau)
join public.naxa_privileges n on r.niveau between n.niveau_min and n.niveau_max
where n.active
on conflict do nothing;

insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select an.architecture_code,
       case an.niveau when 1 then 'promoteur' when 2 then 'responsable' when 3 then 'caisse' end,
       rp.privilege_code
from public.naxa_architecture_niveaux an
join public.naxa_role_privileges rp
  on rp.role_key=case an.niveau when 1 then 'promoteur' when 2 then 'responsable' when 3 then 'caisse' end
on conflict do nothing;

alter table public.naxa_role_privileges enable row level security;
alter table public.naxa_architecture_privileges enable row level security;
drop policy if exists naxa_role_privileges_read on public.naxa_role_privileges;
create policy naxa_role_privileges_read on public.naxa_role_privileges for select to authenticated using (true);
drop policy if exists naxa_architecture_privileges_read on public.naxa_architecture_privileges;
create policy naxa_architecture_privileges_read on public.naxa_architecture_privileges for select to authenticated using (true);

create index if not exists naxa_privileges_level_idx on public.naxa_privileges(niveau_min,niveau_max,active);

-- Compatibilité additive avec le premier catalogue 020 : ses colonnes historiques
-- family/description/governance sont NOT NULL. On desserre uniquement pendant
-- le seed canonique, puis on les recale et on restaure immédiatement les invariants.
alter table public.naxa_privileges alter column family drop not null;
alter table public.naxa_privileges alter column description drop not null;
alter table public.naxa_privileges alter column active drop not null;

insert into public.naxa_privileges(code,famille,libelle,niveau_min,niveau_max,delegable,governance) values
('CREATE_PROMOTEUR','GOUVERNANCE','Créer un Promoteur',1,1,false,true),
('SUSPEND_PROMOTEUR','GOUVERNANCE','Suspendre un Promoteur',1,1,false,true),
('REACTIVATE_PROMOTEUR','GOUVERNANCE','Réactiver un Promoteur',1,1,false,true),
('MANAGE_CONVENTION','GOUVERNANCE','Gérer les conventions',1,1,false,true),
('CHANGE_CONVENTION','GOUVERNANCE','Modifier une convention',1,1,false,true),
('MANAGE_TARIFF','GOUVERNANCE','Gérer les tarifs',1,1,false,true),
('CHANGE_ARCHITECTURE','GOUVERNANCE','Changer une architecture',1,1,false,true),
('DEFINE_ARCHITECTURE_LIMITS','GOUVERNANCE','Définir les limites d’architecture',1,1,false,true),
('MANAGE_NAXA_PRIVILEGES','GOUVERNANCE','Gérer les privilèges NAXA',1,1,false,true),
('MANAGE_SYSTEM_ROLES','GOUVERNANCE','Gérer les rôles système',1,1,false,true),
('VIEW_GLOBAL_NETWORK','GOUVERNANCE','Voir le réseau global NAXA',1,1,false,true),
('CREATE_RESPONSABLE','ORGANISATION','Créer un Responsable',1,2,true,false),
('MANAGE_RESPONSABLES','ORGANISATION','Gérer les Responsables',1,2,true,false),
('SUSPEND_RESPONSABLE','ORGANISATION','Suspendre un Responsable',1,2,true,false),
('REACTIVATE_RESPONSABLE','ORGANISATION','Réactiver un Responsable',1,2,true,false),
('CREATE_CAISSE','ORGANISATION','Créer une Caisse',1,3,true,false),
('MANAGE_CAISSES','ORGANISATION','Gérer les Caisses',1,3,true,false),
('SUSPEND_CAISSE','ORGANISATION','Suspendre une Caisse',1,3,true,false),
('REACTIVATE_CAISSE','ORGANISATION','Réactiver une Caisse',1,3,true,false),
('VIEW_TEAM','ORGANISATION','Voir son équipe',1,3,true,false),
('ASSIGN_USER_TO_PHARMACY','ORGANISATION','Affecter un utilisateur à une pharmacie',1,2,true,false),
('REMOVE_USER_FROM_PHARMACY','ORGANISATION','Retirer un utilisateur d’une pharmacie',1,2,true,false),
('VIEW_PRIVILEGES','RBAC','Voir les privilèges',1,3,true,false),
('ASSIGN_PRIVILEGE','RBAC','Attribuer un privilège autorisé',1,2,true,false),
('REVOKE_PRIVILEGE','RBAC','Révoquer un privilège autorisé',1,2,true,false),
('VIEW_USER_PRIVILEGES','RBAC','Voir les privilèges d’un utilisateur',1,3,true,false),
('VIEW_ROLE_PRIVILEGES','RBAC','Voir les privilèges d’un niveau',1,2,true,false),
('MANAGE_ROLE_PROFILE','RBAC','Gérer un profil de rôle',1,2,true,false),
('CREATE_CUSTOM_ROLE','RBAC','Créer un rôle personnalisé',1,1,true,false),
('EDIT_CUSTOM_ROLE','RBAC','Modifier un rôle personnalisé',1,1,true,false),
('DELETE_CUSTOM_ROLE','RBAC','Supprimer un rôle personnalisé',1,1,true,false),
('ASSIGN_CUSTOM_ROLE','RBAC','Attribuer un rôle personnalisé',1,2,true,false),
('VIEW_PHARMACY','PHARMACIE','Voir une pharmacie',1,3,true,false),
('EDIT_PHARMACY','PHARMACIE','Modifier une pharmacie',1,2,true,false),
('EDIT_PUBLIC_INFORMATION','PHARMACIE','Modifier les informations publiques',1,2,true,false),
('EDIT_CONTACT_INFORMATION','PHARMACIE','Modifier les contacts',1,2,true,false),
('EDIT_OPENING_HOURS','PHARMACIE','Modifier les horaires',1,2,true,false),
('MANAGE_GUARD_STATUS','PHARMACIE','Gérer la garde',1,2,true,false),
('MANAGE_OPERATIONAL_SETTINGS','PHARMACIE','Gérer la configuration opérationnelle',1,2,true,false),
('ARCHIVE_PHARMACY','PHARMACIE','Archiver une pharmacie',1,1,false,false),
('REACTIVATE_PHARMACY','PHARMACIE','Réactiver une pharmacie',1,1,false,false),
('VIEW_PRODUCTS','PRODUITS','Voir les produits',1,3,true,false),
('CREATE_PRODUCT','PRODUITS','Créer un produit',1,2,true,false),
('EDIT_PRODUCT','PRODUITS','Modifier un produit',1,2,true,false),
('ARCHIVE_PRODUCT','PRODUITS','Archiver un produit',1,2,true,false),
('RESTORE_PRODUCT','PRODUITS','Restaurer un produit',1,2,true,false),
('IMPORT_PRODUCTS','PRODUITS','Importer des produits',1,2,true,false),
('VIEW_STOCK','STOCK','Voir le stock',1,3,true,false),
('EDIT_STOCK_QUANTITY','STOCK','Modifier les quantités',1,3,true,false),
('IMPORT_STOCK','STOCK','Importer le stock',1,2,true,false),
('VIEW_STOCK_MOVEMENTS','STOCK','Voir les mouvements de stock',1,3,true,false),
('VIEW_STOCK_ANOMALIES','STOCK','Voir les anomalies de stock',1,2,true,false),
('MANAGE_STOCK_ANOMALIES','STOCK','Gérer les anomalies de stock',1,2,true,false),
('VIEW_LOTS','STOCK','Voir les lots',1,3,true,false),
('MANAGE_LOTS','STOCK','Gérer les lots',1,2,true,false),
('VIEW_EXPIRATION','STOCK','Voir les péremptions',1,3,true,false),
('MANAGE_EXPIRATION','STOCK','Gérer les péremptions',1,2,true,false),
('VIEW_PURCHASE_COST','STOCK','Voir le coût d’achat',1,2,true,false),
('EDIT_PURCHASE_COST','STOCK','Modifier le coût d’achat',1,2,true,false),
('VIEW_CURRENT_VALUATION','STOCK','Voir la valorisation courante',1,2,true,false),
('VIEW_MARGIN','STOCK','Voir la marge',1,2,true,false),
('VIEW_RESERVATIONS','RESERVATIONS','Voir les réservations',1,3,true,false),
('PROCESS_RESERVATION','RESERVATIONS','Traiter une réservation',1,3,true,false),
('CONFIRM_RESERVATION','RESERVATIONS','Confirmer une réservation',1,2,true,false),
('CHANGE_RESERVATION_STATUS','RESERVATIONS','Changer le statut d’une réservation',1,2,true,false),
('CANCEL_RESERVATION','RESERVATIONS','Annuler une réservation',1,2,true,false),
('EXPIRE_RESERVATION','RESERVATIONS','Faire expirer une réservation',1,2,true,false),
('VIEW_RESERVATION_HISTORY','RESERVATIONS','Voir l’historique des réservations',1,3,true,false),
('VIEW_SALES','VENTES','Voir les ventes',1,3,true,false),
('CREATE_SALE','VENTES','Créer une vente',1,3,true,false),
('CONFIRM_PAYMENT','VENTES','Confirmer un paiement',1,3,true,false),
('CONFIRM_WITHDRAWAL','VENTES','Confirmer un retrait',1,3,true,false),
('VIEW_SALES_HISTORY','VENTES','Voir l’historique des ventes',1,3,true,false),
('CORRECT_SALE','VENTES','Corriger une vente',1,2,true,false),
('CANCEL_SALE','VENTES','Annuler une vente',1,2,true,false),
('VIEW_CA','CA','Voir le chiffre d’affaires',1,3,true,false),
('VIEW_CA_DETAIL','CA','Voir le détail du CA',1,2,true,false),
('VIEW_CA_HISTORY','CA','Voir l’historique du CA',1,3,true,false),
('VIEW_CA_BY_PHARMACY','CA','Voir le CA par pharmacie',1,2,true,false),
('VIEW_CA_BY_RESPONSABLE','CA','Voir le CA par Responsable',1,1,true,false),
('VIEW_CA_BY_CAISSE','CA','Voir le CA par Caisse',1,2,true,false),
('VIEW_PILOTAGE','PILOTAGE','Accéder au Pilotage',1,3,true,false),
('VIEW_NETWORK_PILOTAGE','PILOTAGE','Voir le Pilotage réseau',1,1,true,false),
('VIEW_PHARMACY_PILOTAGE','PILOTAGE','Voir le Pilotage pharmacie',1,2,true,false),
('VIEW_RESPONSABLE_PILOTAGE','PILOTAGE','Voir le Pilotage Responsable',1,2,true,false),
('VIEW_CAISSE_PILOTAGE','PILOTAGE','Voir son Pilotage Caisse',1,3,true,false),
('VIEW_ACTIVITY_KPI','PILOTAGE','Voir les KPI activité',1,3,true,false),
('VIEW_STOCK_KPI','PILOTAGE','Voir les KPI stock',1,2,true,false),
('VIEW_ALERT_KPI','PILOTAGE','Voir les KPI alertes',1,2,true,false),
('VIEW_FUNNEL_KPI','PILOTAGE','Voir le funnel',1,2,true,false),
('VIEW_PERFORMANCE_KPI','PILOTAGE','Voir les KPI performance',1,2,true,false),
('VIEW_OBJECTIVES','PILOTAGE','Voir les objectifs',1,2,true,false),
('VIEW_OBJECTIVES_VS_ACTUAL','PILOTAGE','Comparer objectifs et réalisé',1,2,true,false),
('VIEW_COMPARISON','PILOTAGE','Comparer les entités autorisées',1,2,true,false),
('VIEW_DRILLDOWN','PILOTAGE','Faire un drill-down',1,2,true,false),
('VIEW_NETWORK_HEALTH','PILOTAGE','Voir la santé du réseau',1,1,true,false),
('VIEW_PROFITABILITY','PILOTAGE','Voir la rentabilité',1,2,true,false),
('VIEW_MARGIN_PERFORMANCE','PILOTAGE','Voir la performance de marge',1,2,true,false),
('VIEW_REPORTS','RAPPORTS','Voir les rapports',1,3,true,false),
('CREATE_REPORT','RAPPORTS','Créer un rapport',1,2,true,false),
('VIEW_NETWORK_REPORT','RAPPORTS','Voir les rapports réseau',1,1,true,false),
('VIEW_PHARMACY_REPORT','RAPPORTS','Voir les rapports pharmacie',1,2,true,false),
('VIEW_RESPONSABLE_REPORT','RAPPORTS','Voir les rapports Responsable',1,2,true,false),
('VIEW_CAISSE_REPORT','RAPPORTS','Voir les rapports Caisse',1,3,true,false),
('VIEW_REPORT_HISTORY','RAPPORTS','Voir l’historique des rapports',1,3,true,false),
('EXPORT_REPORT','EXPORT','Exporter un rapport',1,2,true,false),
('EXPORT_STOCK','EXPORT','Exporter le stock autorisé',1,2,true,false),
('EXPORT_SALES','EXPORT','Exporter les ventes autorisées',1,2,true,false),
('EXPORT_CA','EXPORT','Exporter le CA autorisé',1,2,true,false),
('EXPORT_PILOTAGE','EXPORT','Exporter le Pilotage autorisé',1,2,true,false),
('EXPORT_NETWORK','EXPORT','Exporter le réseau autorisé',1,1,true,false),
('VIEW_SECURITY_ALERTS','SECURITE','Voir les alertes de sécurité',1,2,true,false),
('VIEW_SECURITY_EVENTS','SECURITE','Voir les événements de sécurité',1,2,true,false),
('VIEW_ACCESS_HISTORY','SECURITE','Voir l’historique des accès',1,2,true,false),
('VIEW_USER_ACTIVITY','SECURITE','Voir l’activité utilisateur',1,2,true,false),
('VIEW_TEAM_ACTIVITY','SECURITE','Voir l’activité équipe',1,2,true,false),
('VIEW_ACTIVE_SESSIONS','SESSIONS','Voir les sessions actives du scope',1,2,true,false),
('VIEW_LAST_ACTIVITY','SESSIONS','Voir la dernière activité du scope',1,2,true,false),
('VIEW_LOGIN_EVENTS','SESSIONS','Voir les connexions du scope',1,2,true,false),
('VIEW_LOGOUT_EVENTS','SESSIONS','Voir les déconnexions du scope',1,2,true,false),
('VIEW_EXPIRED_SESSIONS','SESSIONS','Voir les sessions expirées du scope',1,2,true,false),
('VIEW_REFUSED_LOGIN_ATTEMPTS','SESSIONS','Voir les tentatives refusées du scope',1,2,true,false),
('VIEW_SESSION_DEVICE','SESSIONS','Voir appareil si disponible',1,2,true,false),
('VIEW_SESSION_BROWSER','SESSIONS','Voir navigateur si disponible',1,2,true,false),
('VIEW_CONFIGURATION','CONFIGURATION','Voir la configuration',1,2,true,false),
('EDIT_OPERATIONAL_CONFIGURATION','CONFIGURATION','Modifier la configuration opérationnelle',1,2,true,false),
('EDIT_STOCK_PARAMETERS','CONFIGURATION','Modifier les paramètres stock',1,2,true,false),
('EDIT_ALERT_PARAMETERS','CONFIGURATION','Modifier les paramètres d’alerte',1,2,true,false),
('EDIT_REPORT_PREFERENCES','CONFIGURATION','Modifier les préférences de rapport',1,2,true,false),
('VIEW_OWN_CONVENTION','COMMERCIAL','Voir sa convention',1,1,true,false),
('VIEW_OWN_SUBSCRIPTION','COMMERCIAL','Voir son abonnement',1,1,true,false),
('VIEW_OWN_PAYMENT_HISTORY','COMMERCIAL','Voir ses paiements',1,1,true,false),
('VIEW_OWN_EXPIRATION','COMMERCIAL','Voir sa date d’échéance',1,1,true,false),
('CREATE_CONVENTION','COMMERCIAL','Créer une convention',1,1,false,true),
('EDIT_CONVENTION','COMMERCIAL','Modifier une convention',1,1,false,true),
('SET_TARIFF','COMMERCIAL','Fixer un tarif',1,1,false,true),
('MANAGE_SUBSCRIPTION','COMMERCIAL','Gérer un abonnement',1,1,false,true),
('RECORD_PAYMENT','COMMERCIAL','Enregistrer un paiement',1,1,false,true),
('SUSPEND_SUBSCRIPTION','COMMERCIAL','Suspendre un abonnement',1,1,false,true),
('REACTIVATE_SUBSCRIPTION','COMMERCIAL','Réactiver un abonnement',1,1,false,true)
on conflict (code) do update set
 famille=excluded.famille,libelle=excluded.libelle,niveau_min=excluded.niveau_min,
 niveau_max=excluded.niveau_max,delegable=excluded.delegable,governance=excluded.governance,active=true;

update public.naxa_privileges
set family=coalesce(family,famille),
    description=coalesce(description,libelle),
    governance=coalesce(governance,false),
    active=coalesce(active,true);

alter table public.naxa_privileges alter column family set not null;
alter table public.naxa_privileges alter column description set not null;
alter table public.naxa_privileges alter column active set not null;

create table if not exists public.naxa_profile_privileges (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 privilege_code text not null references public.naxa_privileges(code) on delete restrict,
 pharmacie_id uuid references public.pharmacies(id) on delete cascade,
 scope_type text not null default 'PHARMACIE' check (scope_type in ('RESEAU','PHARMACIE','POSTE_CAISSE')),
 granted_by uuid references public.profiles(id) on delete restrict,
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 active boolean not null default true,
 unique(profile_id,privilege_code,pharmacie_id,scope_type)
);
create index if not exists naxa_profile_privileges_profile_idx on public.naxa_profile_privileges(profile_id,active);
create index if not exists naxa_profile_privileges_scope_idx on public.naxa_profile_privileges(pharmacie_id,scope_type,active);
alter table public.naxa_profile_privileges enable row level security;

create table if not exists public.naxa_custom_roles (
 id uuid primary key default gen_random_uuid(),
 promoteur_id uuid not null references public.profiles(id) on delete cascade,
 nom text not null,
 description text,
 actif boolean not null default true,
 created_at timestamptz not null default now(),
 unique(promoteur_id,nom)
);
create table if not exists public.naxa_custom_role_privileges (
 role_id uuid not null references public.naxa_custom_roles(id) on delete cascade,
 privilege_code text not null references public.naxa_privileges(code) on delete restrict,
 primary key(role_id,privilege_code)
);
create table if not exists public.naxa_profile_custom_roles (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 role_id uuid not null references public.naxa_custom_roles(id) on delete cascade,
 assigned_by uuid not null references public.profiles(id) on delete restrict,
 active boolean not null default true,
 primary key(profile_id,role_id)
);
alter table public.naxa_custom_roles enable row level security;
alter table public.naxa_custom_role_privileges enable row level security;
alter table public.naxa_profile_custom_roles enable row level security;

create or replace function public.naxa_architecture_for_profile(p_profile uuid)
returns text language sql stable security definer set search_path=''
as $$
  select c.architecture_code
  from public.profiles p
  join public.profiles parent on parent.id = case when p.niveau_interne=1 then p.id else p.parent_profile_id end
  join public.conventions_promoteurs c on c.promoteur_id = parent.id
  where p.id=p_profile and p.actif and parent.actif and c.architecture_code is not null
  limit 1
$$;

create or replace function public.naxa_scope_allows(p_profile uuid,p_pharmacie uuid,p_scope text default 'PHARMACIE')
returns boolean language sql stable security definer set search_path=''
as $$
  select case
    when p_profile is null then false
    when p_scope='RESEAU' then exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='promoteur')
      and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile and pp.actif and (p_pharmacie is null or pp.pharmacie_id=p_pharmacie))
    when p_scope='PHARMACIE' then exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='admin')
      or exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text='promoteur' and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile and pp.pharmacie_id=p_pharmacie and pp.actif))
      or exists(select 1 from public.profiles p where p.id=p_profile and p.actif and p.role::text<>'promoteur' and p.pharmacie_id=p_pharmacie)
    when p_scope='POSTE_CAISSE' then exists(select 1 from public.profiles p where p.id=p_profile and p.actif and (p.role::text='admin' or p.role::text='caisse') and (p.role::text='admin' or p.pharmacie_id=p_pharmacie))
    else false
  end
$$;
revoke all on function public.naxa_scope_allows(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_scope_allows(uuid,uuid,text) to authenticated;

-- Attribution : le Promoteur ne peut déléguer que ce que NAXA autorise pour l'architecture et le niveau cible.
create or replace function public.naxa_grant_privilege(p_target uuid,p_privilege text,p_pharmacie uuid,p_scope text default 'PHARMACIE')
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_level smallint; v_arch text; v_promoteur uuid;
begin
 if not public.is_admin() and not public.naxa_has_privilege('ASSIGN_PRIVILEGE',p_pharmacie,'PHARMACIE') then raise exception 'Attribution non autorisée'; end if;
 select niveau_interne into v_level from public.profiles where id=p_target and actif;
 if v_level is null or v_level=0 then raise exception 'Niveau cible invalide'; end if;
 select architecture_code into v_arch from public.conventions_promoteurs c where c.promoteur_id=
   case when v_level=1 then p_target else (select parent_profile_id from public.profiles where id=p_target) end;
 if v_arch is null then raise exception 'Architecture non définie'; end if;
 if not exists(select 1 from public.naxa_architecture_niveaux where architecture_code=v_arch and niveau=v_level) then raise exception 'Niveau non autorisé'; end if;
 if not exists(select 1 from public.naxa_privileges n where n.code=p_privilege and n.active and n.delegable and v_level between n.niveau_min and n.niveau_max and not n.governance) then
   raise exception 'Privilège non délégable à ce niveau';
 end if;
 if p_scope='RESEAU' and v_level<>1 then raise exception 'Scope réseau réservé au Promoteur'; end if;
 if p_scope='POSTE_CAISSE' and v_level<>3 then raise exception 'Scope poste réservé à la Caisse'; end if;
 if p_scope<>'RESEAU' and p_pharmacie is null then raise exception 'Pharmacie requise pour ce scope'; end if;
 if not public.naxa_scope_allows((select auth.uid()),p_pharmacie,case when p_scope='RESEAU' then 'RESEAU' else 'PHARMACIE' end) and not public.is_admin() then
   raise exception 'Pharmacie hors périmètre';
 end if;
 insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by)
 values(p_target,p_privilege,p_pharmacie,p_scope,(select auth.uid()))
 on conflict(profile_id,privilege_code,pharmacie_id,scope_type) do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now()
 returning id into v_id;
 return v_id;
end
$$;

create or replace function public.naxa_revoke_privilege(p_target uuid,p_privilege text,p_pharmacie uuid,p_scope text default 'PHARMACIE')
returns void language plpgsql security definer set search_path=''
as $$
begin
 if not public.is_admin() and not public.naxa_has_privilege('REVOKE_PRIVILEGE',p_pharmacie,'PHARMACIE') then raise exception 'Révocation non autorisée'; end if;
 update public.naxa_profile_privileges set active=false,revoked_at=now()
 where profile_id=p_target and privilege_code=p_privilege and pharmacie_id is not distinct from p_pharmacie and scope_type=p_scope and active;
 if not found then raise exception 'Privilège introuvable'; end if;
end
$$;

create or replace function public.naxa_create_custom_role(p_nom text,p_description text default null)
returns uuid language plpgsql security definer set search_path=''
as $naxa$
declare v_id uuid; v_arch text;
begin
 if not public.naxa_has_privilege('CREATE_CUSTOM_ROLE',null,'RESEAU') then raise exception 'Création de rôle personnalisé non autorisée'; end if;
 select architecture_code into v_arch from public.conventions_promoteurs where promoteur_id=(select auth.uid());
 if v_arch <> 'HYBRIDE' then raise exception 'Les rôles personnalisés sont réservés à HYBRIDE'; end if;
 insert into public.naxa_custom_roles(promoteur_id,nom,description)
 values((select auth.uid()),trim(p_nom),p_description) returning id into v_id;
 return v_id;
end
$naxa$;

create or replace function public.naxa_add_custom_role_privilege(p_role uuid,p_privilege text)
returns void language plpgsql security definer set search_path=''
as $naxa$
declare v_promoteur uuid;
begin
 select promoteur_id into v_promoteur from public.naxa_custom_roles where id=p_role and actif;
 if v_promoteur is null or v_promoteur<>(select auth.uid()) then raise exception 'Rôle personnalisé non autorisé'; end if;
 if not exists(select 1 from public.naxa_privileges n where n.code=p_privilege and n.active and n.delegable and not n.governance) then
   raise exception 'Privilège non composable';
 end if;
 insert into public.naxa_custom_role_privileges(role_id,privilege_code) values(p_role,p_privilege)
 on conflict do nothing;
end
$naxa$;

create or replace function public.naxa_assign_custom_role(p_target uuid,p_role uuid)
returns void language plpgsql security definer set search_path=''
as $naxa$
declare v_promoteur uuid; v_arch text;
begin
 if not public.naxa_has_privilege('ASSIGN_CUSTOM_ROLE',null,'RESEAU') then raise exception 'Attribution de rôle personnalisé non autorisée'; end if;
 select promoteur_id into v_promoteur from public.naxa_custom_roles where id=p_role and actif;
 if v_promoteur<>(select auth.uid()) then raise exception 'Rôle hors périmètre'; end if;
 select architecture_code into v_arch from public.conventions_promoteurs where promoteur_id=v_promoteur;
 if v_arch <> 'HYBRIDE' then raise exception 'Rôle personnalisé réservé à HYBRIDE'; end if;
 if not exists(select 1 from public.profiles p where p.id=p_target and p.actif and (p.id=v_promoteur or p.parent_profile_id=v_promoteur or exists(select 1 from public.profile_accreditations a where a.target_profile_id=p.id and a.grantor_profile_id=v_promoteur and a.active))) then
   raise exception 'Cible hors réseau';
 end if;
 insert into public.naxa_profile_custom_roles(profile_id,role_id,assigned_by)
 values(p_target,p_role,(select auth.uid()))
 on conflict(profile_id,role_id) do update set active=true,assigned_by=excluded.assigned_by;
end
$naxa$;

create or replace function public.naxa_revoke_custom_role(p_target uuid,p_role uuid)
returns void language plpgsql security definer set search_path=''
as $naxa$
begin
 if not public.naxa_has_privilege('ASSIGN_CUSTOM_ROLE',null,'RESEAU') then raise exception 'Révocation de rôle personnalisé non autorisée'; end if;
 update public.naxa_profile_custom_roles
 set active=false
 where profile_id=p_target and role_id=p_role and active
   and exists(select 1 from public.naxa_custom_roles r where r.id=p_role and r.promoteur_id=(select auth.uid()));
 if not found then raise exception 'Rôle personnalisé introuvable'; end if;
end
$naxa$;

revoke all on function public.naxa_create_custom_role(text,text) from public,anon,authenticated;
revoke all on function public.naxa_add_custom_role_privilege(uuid,text) from public,anon,authenticated;
revoke all on function public.naxa_assign_custom_role(uuid,uuid) from public,anon,authenticated;
revoke all on function public.naxa_revoke_custom_role(uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_create_custom_role(text,text) to authenticated;
grant execute on function public.naxa_add_custom_role_privilege(uuid,text) to authenticated;
grant execute on function public.naxa_assign_custom_role(uuid,uuid) to authenticated;
grant execute on function public.naxa_revoke_custom_role(uuid,uuid) to authenticated;

revoke all on function public.naxa_grant_privilege(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.naxa_revoke_privilege(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_grant_privilege(uuid,text,uuid,text) to authenticated;
grant execute on function public.naxa_revoke_privilege(uuid,text,uuid,text) to authenticated;

-- Lecture contrôlée des rôles personnalisés.
drop policy if exists naxa_custom_roles_read on public.naxa_custom_roles;
create policy naxa_custom_roles_read on public.naxa_custom_roles for select to authenticated
using (promoteur_id=(select auth.uid()) or public.is_admin());

drop policy if exists naxa_custom_role_privileges_read on public.naxa_custom_role_privileges;
create policy naxa_custom_role_privileges_read on public.naxa_custom_role_privileges for select to authenticated
using (exists(select 1 from public.naxa_custom_roles r where r.id=role_id and (r.promoteur_id=(select auth.uid()) or public.is_admin())));

drop policy if exists naxa_profile_custom_roles_read on public.naxa_profile_custom_roles;
create policy naxa_profile_custom_roles_read on public.naxa_profile_custom_roles for select to authenticated
using (
  profile_id=(select auth.uid())
  or public.is_admin()
  or exists(select 1 from public.naxa_custom_roles r where r.id=role_id and r.promoteur_id=(select auth.uid()))
);

revoke all on public.naxa_custom_roles,public.naxa_custom_role_privileges,public.naxa_profile_custom_roles from anon,authenticated;
grant select on public.naxa_custom_roles,public.naxa_custom_role_privileges,public.naxa_profile_custom_roles to authenticated;

-- Accès RLS au catalogue : lecture seulement, attribution par fonctions.
drop policy if exists naxa_privileges_read on public.naxa_privileges;
create policy naxa_privileges_read on public.naxa_privileges for select to authenticated using (active);

drop policy if exists naxa_architectures_read on public.naxa_architectures;
alter table public.naxa_architectures enable row level security;
create policy naxa_architectures_read on public.naxa_architectures for select to authenticated using (active);

drop policy if exists naxa_profile_privileges_read on public.naxa_profile_privileges;
create policy naxa_profile_privileges_read on public.naxa_profile_privileges for select to authenticated
using (profile_id=(select auth.uid()) or granted_by=(select auth.uid()) or public.is_admin());

revoke all on public.naxa_privileges,public.naxa_architectures,public.naxa_profile_privileges from anon,authenticated;
grant select on public.naxa_privileges,public.naxa_architectures,public.naxa_profile_privileges to authenticated;
