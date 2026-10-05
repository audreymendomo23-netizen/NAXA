-- NAXA 020 — architecture, fonctions internes et privilèges canoniques
-- Additif / non destructif.
-- Règle absolue : role_type reste client, pharmacie, admin, promoteur, caisse.
-- Responsable est une fonction interne / niveau hiérarchique, jamais une valeur d'enum.

create table if not exists public.pharmacie_architectures (
  pharmacie_id uuid primary key references public.pharmacies(id) on delete restrict,
  architecture_code text not null check (
    architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE')
  ),
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

create table if not exists public.naxa_privileges (
  code text primary key,
  family text not null,
  description text not null,
  delegable boolean not null default false,
  governance_only boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.naxa_role_privileges (
  role_key text not null check (role_key in ('admin','promoteur','responsable','caisse')),
  privilege_code text not null references public.naxa_privileges(code) on delete restrict,
  primary key (role_key, privilege_code)
);

create table if not exists public.naxa_architecture_privileges (
  architecture_code text not null check (
    architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE')
  ),
  role_key text not null check (role_key in ('admin','promoteur','responsable','caisse')),
  privilege_code text not null references public.naxa_privileges(code) on delete restrict,
  primary key (architecture_code, role_key, privilege_code)
);

create table if not exists public.profile_privileges (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  privilege_code text not null references public.naxa_privileges(code) on delete restrict,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (profile_id, privilege_code)
);

alter table public.profiles
  add column if not exists fonction_interne text;

alter table public.profiles
  add column if not exists niveau_hierarchique smallint;

alter table public.profiles
  add column if not exists architecture_code text;

alter table public.profiles
  drop constraint if exists profiles_fonction_interne_check;
alter table public.profiles
  add constraint profiles_fonction_interne_check
  check (fonction_interne is null or fonction_interne in ('promoteur','responsable','caisse','manager_regional','chef_agence','custom'));

alter table public.profiles
  drop constraint if exists profiles_niveau_hierarchique_check;
alter table public.profiles
  add constraint profiles_niveau_hierarchique_check
  check (niveau_hierarchique is null or niveau_hierarchique between 1 and 3);

alter table public.profiles
  drop constraint if exists profiles_architecture_code_check;
alter table public.profiles
  add constraint profiles_architecture_code_check
  check (architecture_code is null or architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE'));

create index if not exists profiles_fonction_interne_idx on public.profiles(fonction_interne,actif);
create index if not exists profiles_niveau_architecture_idx on public.profiles(niveau_hierarchique,architecture_code,actif);
create index if not exists profile_privileges_profile_idx on public.profile_privileges(profile_id,revoked_at);

alter table public.pharmacie_architectures enable row level security;
alter table public.naxa_privileges enable row level security;
alter table public.naxa_role_privileges enable row level security;
alter table public.naxa_architecture_privileges enable row level security;
alter table public.profile_privileges enable row level security;

drop policy if exists naxa_privileges_read on public.naxa_privileges;
create policy naxa_privileges_read on public.naxa_privileges
for select to authenticated using (true);

drop policy if exists naxa_role_privileges_read on public.naxa_role_privileges;
create policy naxa_role_privileges_read on public.naxa_role_privileges
for select to authenticated using (true);

drop policy if exists naxa_architecture_privileges_read on public.naxa_architecture_privileges;
create policy naxa_architecture_privileges_read on public.naxa_architecture_privileges
for select to authenticated using (true);

drop policy if exists pharmacie_architectures_scope on public.pharmacie_architectures;
create policy pharmacie_architectures_scope on public.pharmacie_architectures
for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists profile_privileges_self_scope on public.profile_privileges;
create policy profile_privileges_self_scope on public.profile_privileges
for select to authenticated
using (profile_id=(select auth.uid()) or granted_by=(select auth.uid()) or public.is_admin());

-- Catalogue canonique : aucune de ces lignes ne crée le privilege Responsable dans role_type.
insert into public.naxa_privileges(code,family,description,delegable,governance_only) values
('CREATE_RESPONSABLE','ORGANISATION','Créer un Responsable dans une architecture qui l autorise',true,false),
('MANAGE_RESPONSABLES','ORGANISATION','Gérer les Responsables de son périmètre',true,false),
('SUSPEND_RESPONSABLE','ORGANISATION','Suspendre un Responsable',true,false),
('REACTIVATE_RESPONSABLE','ORGANISATION','Réactiver un Responsable',true,false),
('CREATE_CAISSE','ORGANISATION','Créer une Caisse dans les limites de l architecture',true,false),
('MANAGE_CAISSES','ORGANISATION','Gérer les Caisses de son périmètre',true,false),
('SUSPEND_CAISSE','ORGANISATION','Suspendre une Caisse',true,false),
('REACTIVATE_CAISSE','ORGANISATION','Réactiver une Caisse',true,false),
('VIEW_TEAM','ORGANISATION','Voir l équipe autorisée',true,false),
('VIEW_TEAM_ACTIVITY','SECURITY','Voir l activité de l équipe autorisée',true,false),
('VIEW_PRIVILEGES','PRIVILEGES','Consulter les privilèges autorisés',true,false),
('ASSIGN_PRIVILEGE','PRIVILEGES','Attribuer un privilège autorisé',true,false),
('REVOKE_PRIVILEGE','PRIVILEGES','Révoquer un privilège attribué',true,false),
('VIEW_USER_PRIVILEGES','PRIVILEGES','Voir les privilèges d un utilisateur autorisé',true,false),
('VIEW_ROLE_PRIVILEGES','PRIVILEGES','Voir la matrice des privilèges par fonction',true,false),
('MANAGE_ROLE_PROFILE','PRIVILEGES','Gérer un profil de fonction dans les limites NAXA',true,false),
('CREATE_CUSTOM_ROLE','PRIVILEGES','Créer une fonction personnalisée en architecture HYBRIDE',true,false),
('EDIT_CUSTOM_ROLE','PRIVILEGES','Modifier une fonction personnalisée autorisée',true,false),
('DELETE_CUSTOM_ROLE','PRIVILEGES','Supprimer une fonction personnalisée autorisée',true,false),
('VIEW_PHARMACY','PHARMACIE','Voir la pharmacie autorisée',true,false),
('EDIT_PHARMACY','PHARMACIE','Modifier la pharmacie autorisée',true,false),
('VIEW_PRODUCTS','PRODUITS','Voir les produits internes autorisés',true,false),
('CREATE_PRODUCT','PRODUITS','Créer un produit',true,false),
('EDIT_PRODUCT','PRODUITS','Modifier un produit',true,false),
('ARCHIVE_PRODUCT','PRODUITS','Archiver un produit',true,false),
('VIEW_STOCK','STOCK','Voir le stock opérationnel autorisé',true,false),
('EDIT_STOCK_QUANTITY','STOCK','Modifier les quantités de stock',true,false),
('IMPORT_STOCK','STOCK','Importer un stock',true,false),
('EXPORT_STOCK','EXPORTS','Exporter le stock déjà autorisé',true,false),
('VIEW_STOCK_MOVEMENTS','STOCK','Voir les mouvements de stock',true,false),
('VIEW_STOCK_ANOMALIES','STOCK','Voir les anomalies de stock',true,false),
('MANAGE_STOCK_ANOMALIES','STOCK','Traiter les anomalies de stock',true,false),
('VIEW_LOTS','STOCK','Voir les lots',true,false),
('MANAGE_LOTS','STOCK','Gérer les lots',true,false),
('VIEW_EXPIRATION','STOCK','Voir les péremptions',true,false),
('MANAGE_EXPIRATION','STOCK','Gérer les péremptions',true,false),
('VIEW_PURCHASE_COST','STOCK_SENSIBLE','Voir les coûts d achat',true,false),
('EDIT_PURCHASE_COST','STOCK_SENSIBLE','Modifier les coûts d achat',true,false),
('VIEW_CURRENT_VALUATION','STOCK_SENSIBLE','Voir la valorisation courante',true,false),
('VIEW_MARGIN','STOCK_SENSIBLE','Voir la marge autorisée',true,false),
('VIEW_RESERVATIONS','VENTES','Voir les réservations',true,false),
('PROCESS_RESERVATION','VENTES','Traiter une réservation',true,false),
('CONFIRM_RESERVATION','VENTES','Confirmer une réservation',true,false),
('CHANGE_RESERVATION_STATUS','VENTES','Changer un statut de réservation',true,false),
('CANCEL_RESERVATION','VENTES','Annuler une réservation',true,false),
('VIEW_RESERVATION_HISTORY','VENTES','Voir l historique des réservations',true,false),
('VIEW_SALES','CA','Voir les ventes',true,false),
('CREATE_SALE','CA','Créer une vente',true,false),
('CONFIRM_PAYMENT','CA','Confirmer un paiement',true,false),
('CONFIRM_WITHDRAWAL','CA','Confirmer un retrait',true,false),
('VIEW_SALES_HISTORY','CA','Voir l historique des ventes',true,false),
('CORRECT_SALE','CA','Corriger une vente',true,false),
('CANCEL_SALE','CA','Annuler une vente',true,false),
('VIEW_CA','PILOTAGE','Voir le chiffre d affaires autorisé',true,false),
('VIEW_CA_DETAIL','PILOTAGE','Voir le détail du chiffre d affaires autorisé',true,false),
('VIEW_CA_BY_PHARMACY','PILOTAGE','Voir le CA par pharmacie autorisée',true,false),
('VIEW_CA_BY_RESPONSABLE','PILOTAGE','Voir le CA par Responsable autorisé',true,false),
('VIEW_CA_BY_CAISSE','PILOTAGE','Voir le CA par Caisse autorisée',true,false),
('VIEW_PILOTAGE','PILOTAGE','Accéder au pilotage autorisé',true,false),
('VIEW_NETWORK_PILOTAGE','PILOTAGE','Voir le pilotage réseau autorisé',true,false),
('VIEW_PHARMACY_PILOTAGE','PILOTAGE','Voir le pilotage pharmacie autorisé',true,false),
('VIEW_RESPONSABLE_PILOTAGE','PILOTAGE','Voir le pilotage Responsable autorisé',true,false),
('VIEW_CAISSE_PILOTAGE','PILOTAGE','Voir le pilotage Caisse autorisé',true,false),
('VIEW_ACTIVITY_KPI','PILOTAGE','Voir les KPI activité',true,false),
('VIEW_STOCK_KPI','PILOTAGE','Voir les KPI stock',true,false),
('VIEW_ALERT_KPI','PILOTAGE','Voir les KPI alertes',true,false),
('VIEW_FUNNEL_KPI','PILOTAGE','Voir les KPI entonnoir',true,false),
('VIEW_PERFORMANCE_KPI','PILOTAGE','Voir les KPI performance',true,false),
('VIEW_OBJECTIVES','PILOTAGE','Voir les objectifs',true,false),
('VIEW_OBJECTIVES_VS_ACTUAL','PILOTAGE','Comparer objectifs et réalisé',true,false),
('VIEW_COMPARISON','PILOTAGE','Comparer les unités autorisées',true,false),
('VIEW_DRILLDOWN','PILOTAGE','Descendre dans le détail autorisé',true,false),
('VIEW_NETWORK_HEALTH','PILOTAGE','Voir la santé du réseau autorisé',true,false),
('VIEW_REPORTS','RAPPORTS','Voir les rapports autorisés',true,false),
('CREATE_REPORT','RAPPORTS','Créer un rapport dans le périmètre autorisé',true,false),
('VIEW_NETWORK_REPORT','RAPPORTS','Voir les rapports réseau autorisés',true,false),
('VIEW_PHARMACY_REPORT','RAPPORTS','Voir les rapports pharmacie autorisés',true,false),
('VIEW_RESPONSABLE_REPORT','RAPPORTS','Voir les rapports Responsable autorisés',true,false),
('VIEW_CAISSE_REPORT','RAPPORTS','Voir les rapports Caisse autorisés',true,false),
('VIEW_REPORT_HISTORY','RAPPORTS','Voir l historique des rapports',true,false),
('EXPORT_REPORT','EXPORTS','Exporter un rapport sans élargir son scope',true,false),
('EXPORT_SALES','EXPORTS','Exporter les ventes déjà autorisées',true,false),
('EXPORT_CA','EXPORTS','Exporter le CA déjà autorisé',true,false),
('EXPORT_PILOTAGE','EXPORTS','Exporter le pilotage déjà autorisé',true,false),
('VIEW_SECURITY_ALERTS','SECURITY','Voir les alertes de sécurité autorisées',true,false),
('VIEW_SECURITY_EVENTS','SECURITY','Voir les événements de sécurité autorisés',true,false),
('VIEW_ACCESS_HISTORY','SECURITY','Voir l historique des accès autorisés',true,false),
('VIEW_USER_ACTIVITY','SECURITY','Voir l activité des utilisateurs autorisés',true,false),
('VIEW_CONFIGURATION','CONFIGURATION','Voir la configuration opérationnelle',true,false),
('EDIT_OPERATIONAL_CONFIGURATION','CONFIGURATION','Modifier la configuration opérationnelle',true,false),
('EDIT_STOCK_PARAMETERS','CONFIGURATION','Modifier les paramètres stock',true,false),
('EDIT_ALERT_PARAMETERS','CONFIGURATION','Modifier les paramètres alertes',true,false),
('EDIT_REPORT_PREFERENCES','CONFIGURATION','Modifier les préférences de rapports',true,false),
('CREATE_PROMOTEUR','GOUVERNANCE','Créer un Promoteur',false,true),
('SUSPEND_PROMOTEUR','GOUVERNANCE','Suspendre un Promoteur',false,true),
('REACTIVATE_PROMOTEUR','GOUVERNANCE','Réactiver un Promoteur',false,true),
('MANAGE_CONVENTION','GOUVERNANCE','Gérer les conventions NAXA',false,true),
('CHANGE_CONVENTION','GOUVERNANCE','Modifier une convention',false,true),
('MANAGE_TARIFF','GOUVERNANCE','Gérer les tarifs NAXA',false,true),
('CHANGE_ARCHITECTURE','GOUVERNANCE','Changer l architecture assignée par NAXA',false,true),
('DEFINE_ARCHITECTURE_LIMITS','GOUVERNANCE','Définir les limites d architecture',false,true),
('MANAGE_NAXA_PRIVILEGES','GOUVERNANCE','Gérer le catalogue des privilèges NAXA',false,true),
('MANAGE_SYSTEM_ROLES','GOUVERNANCE','Gérer les rôles techniques système',false,true),
('VIEW_GLOBAL_NETWORK','GOUVERNANCE','Voir le réseau global NAXA',false,true)
on conflict (code) do update set family=excluded.family,description=excluded.description,delegable=excluded.delegable,governance_only=excluded.governance_only;

-- Matrice de base : Promoteur supervise, Responsable opère/supervise sa pharmacie, Caisse opère son poste.
insert into public.naxa_role_privileges(role_key,privilege_code)
select 'promoteur',code from public.naxa_privileges
where code not in ('CREATE_PROMOTEUR','SUSPEND_PROMOTEUR','REACTIVATE_PROMOTEUR','MANAGE_CONVENTION','CHANGE_CONVENTION','MANAGE_TARIFF','CHANGE_ARCHITECTURE','DEFINE_ARCHITECTURE_LIMITS','MANAGE_NAXA_PRIVILEGES','MANAGE_SYSTEM_ROLES','VIEW_GLOBAL_NETWORK')
on conflict do nothing;

insert into public.naxa_role_privileges(role_key,privilege_code)
select 'responsable',code from public.naxa_privileges
where family in ('ORGANISATION','PRIVILEGES','PHARMACIE','PRODUITS','STOCK','VENTES','CA','PILOTAGE','RAPPORTS','EXPORTS','SECURITY','CONFIGURATION')
  and code not in ('CREATE_CUSTOM_ROLE','EDIT_CUSTOM_ROLE','DELETE_CUSTOM_ROLE','VIEW_PURCHASE_COST','EDIT_PURCHASE_COST','VIEW_MARGIN','VIEW_NETWORK_PILOTAGE','VIEW_NETWORK_REPORT')
on conflict do nothing;

insert into public.naxa_role_privileges(role_key,privilege_code)
select 'caisse',code from public.naxa_privileges
where code in (
'VIEW_PHARMACY','VIEW_PRODUCTS','VIEW_STOCK','EDIT_STOCK_QUANTITY','VIEW_STOCK_MOVEMENTS','VIEW_STOCK_ANOMALIES',
'VIEW_LOTS','MANAGE_LOTS','VIEW_EXPIRATION','MANAGE_EXPIRATION','VIEW_RESERVATIONS','PROCESS_RESERVATION',
'CONFIRM_RESERVATION','CHANGE_RESERVATION_STATUS','CANCEL_RESERVATION','VIEW_RESERVATION_HISTORY',
'VIEW_SALES','CREATE_SALE','CONFIRM_PAYMENT','CONFIRM_WITHDRAWAL','VIEW_SALES_HISTORY','VIEW_CAISSE_PILOTAGE',
'VIEW_ACTIVITY_KPI','VIEW_STOCK_KPI','VIEW_ALERT_KPI','VIEW_CAISSE_REPORT','VIEW_REPORTS'
)
on conflict do nothing;

insert into public.naxa_role_privileges(role_key,privilege_code)
select 'admin',code from public.naxa_privileges
on conflict do nothing;

-- Architecture gates. A1/A2 never expose Responsable; A3 does; A4 allows custom functions but not NAXA governance.
insert into public.naxa_architecture_privileges
select a.architecture_code,r.role_key,rp.privilege_code
from (values
('ORPHELIN'),('PARENTS_ENFANTS'),('PARENTS_AINES_CADETS'),('HYBRIDE')
) a(architecture_code)
cross join (values ('promoteur'),('responsable'),('caisse')) r(role_key)
join public.naxa_role_privileges rp on rp.role_key=r.role_key
where (r.role_key <> 'responsable' or a.architecture_code in ('PARENTS_AINES_CADETS','HYBRIDE'))
on conflict do nothing;

create or replace function public.naxa_business_function(p_profile uuid default (select auth.uid()))
returns text
language sql stable security definer set search_path=''
as $$
  select coalesce(
    p.fonction_interne,
    case p.role::text
      when 'promoteur' then 'promoteur'
      when 'caisse' then 'caisse'
      else null
    end
  )
  from public.profiles p
  where p.id=p_profile and p.actif=true
$$;

create or replace function public.naxa_can(
  p_privilege text,
  p_pharmacie uuid default null,
  p_target uuid default null
)
returns boolean
language plpgsql stable security definer set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  v_fn text;
  v_arch text;
  v_pharmacie uuid;
begin
  if uid is null then return false; end if;
  if p_privilege is null or not exists (select 1 from public.naxa_privileges where code=p_privilege) then return false; end if;

  select public.naxa_business_function(uid) into v_fn;
  if v_fn is null then return false; end if;
  if v_fn='admin' or exists(select 1 from public.profiles where id=uid and role::text='admin' and actif) then
    return true;
  end if;

  v_pharmacie := p_pharmacie;
  if v_pharmacie is null then
    select pharmacie_id into v_pharmacie from public.profiles where id=uid;
  end if;

  select pa.architecture_code into v_arch
  from public.pharmacie_architectures pa
  where pa.pharmacie_id=v_pharmacie and pa.active=true;

  if v_arch is null then return false; end if;

  if not exists (
    select 1
    from public.naxa_role_privileges rp
    where rp.role_key=v_fn and rp.privilege_code=p_privilege
  ) then return false; end if;

  if not exists (
    select 1 from public.naxa_architecture_privileges ap
    where ap.architecture_code=v_arch and ap.role_key=v_fn and ap.privilege_code=p_privilege
  ) then return false; end if;

  if not exists (
    select 1 from public.profile_privileges pp
    where pp.profile_id=uid and pp.privilege_code=p_privilege and pp.revoked_at is null
  ) then
    -- Promoteur reste le détenteur initial de ses privilèges système non encore délégués.
    if v_fn <> 'promoteur' then return false; end if;
  end if;

  if v_fn='promoteur' and v_pharmacie is not null
     and not exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=uid and pp.pharmacie_id=v_pharmacie and pp.actif) then
    return false;
  end if;

  if p_target is not null and v_fn='promoteur' then
    if not exists(select 1 from public.profiles t where t.id=p_target and t.pharmacie_id=v_pharmacie and t.actif) then return false; end if;
  end if;

  return true;
end $$;

create or replace function public.naxa_assign_privilege(p_target uuid,p_privilege text)
returns void
language plpgsql security definer set search_path=''
as $$
declare
  uid uuid := (select auth.uid());
  v_target_fn text;
  v_pharmacie uuid;
  v_arch text;
begin
  if not public.naxa_can('ASSIGN_PRIVILEGE') then raise exception 'Attribution de privilège non autorisée'; end if;
  select pharmacie_id into v_pharmacie from public.profiles where id=p_target and actif=true;
  select pa.architecture_code into v_arch from public.pharmacie_architectures pa where pa.pharmacie_id=v_pharmacie and pa.active=true;
  select public.naxa_business_function(p_target) into v_target_fn;
  if v_target_fn is null then raise exception 'Fonction cible invalide'; end if;
  if not exists(select 1 from public.naxa_architecture_privileges where architecture_code=v_arch and role_key=v_target_fn and privilege_code=p_privilege) then
    raise exception 'Privilège hors architecture ou fonction';
  end if;
  if exists(select 1 from public.naxa_privileges where code=p_privilege and governance_only) then
    raise exception 'Privilège de gouvernance NAXA non délégable';
  end if;
  if not public.naxa_can(p_privilege,v_pharmacie,p_target) then
    raise exception 'Le délégant ne détient pas ce privilège';
  end if;
  insert into public.profile_privileges(profile_id,privilege_code,granted_by)
  values(p_target,p_privilege,uid)
  on conflict(profile_id,privilege_code) do update set granted_by=uid,granted_at=now(),revoked_at=null;
end $$;

create or replace function public.naxa_revoke_privilege(p_target uuid,p_privilege text)
returns void
language plpgsql security definer set search_path=''
as $$
begin
  if not public.naxa_can('REVOKE_PRIVILEGE') then raise exception 'Révocation de privilège non autorisée'; end if;
  update public.profile_privileges
  set revoked_at=now()
  where profile_id=p_target and privilege_code=p_privilege and revoked_at is null;
end $$;

revoke all on function public.naxa_business_function(uuid) from public,anon;
revoke all on function public.naxa_can(text,uuid,uuid) from public,anon;
revoke all on function public.naxa_assign_privilege(uuid,text) from public,anon;
revoke all on function public.naxa_revoke_privilege(uuid,text) from public,anon;
grant execute on function public.naxa_business_function(uuid) to authenticated;
grant execute on function public.naxa_can(text,uuid,uuid) to authenticated;
grant execute on function public.naxa_assign_privilege(uuid,text) to authenticated;
grant execute on function public.naxa_revoke_privilege(uuid,text) to authenticated;

comment on table public.pharmacie_architectures is 'Architecture assignée par NAXA à une pharmacie; le Promoteur ne la choisit pas.';
comment on table public.naxa_privileges is 'Catalogue atomique canonique des privilèges NAXA.';
comment on table public.profile_privileges is 'Attributions explicites de privilèges dans les limites de fonction et architecture.';
