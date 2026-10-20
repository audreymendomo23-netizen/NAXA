-- NAXA 167 — autorisation forte des décaissements (PIN ou biométrie WebAuthn).
begin;

create table if not exists public.caisse_security_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_salt text,
  pin_hash text,
  webauthn_credential_id text unique,
  webauthn_public_key text,
  webauthn_counter bigint not null default 0,
  webauthn_transports text[] not null default '{}',
  webauthn_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint caisse_security_pin_pair_ck check ((pin_salt is null) = (pin_hash is null)),
  constraint caisse_security_webauthn_pair_ck check (
    (webauthn_credential_id is null and webauthn_public_key is null and not webauthn_enabled)
    or (webauthn_credential_id is not null and webauthn_public_key is not null)
  )
);
alter table public.caisse_security_credentials enable row level security;
revoke all on public.caisse_security_credentials from public, anon, authenticated;

create table if not exists public.caisse_security_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  challenge text not null,
  purpose text not null check (purpose in ('registration','authentication')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.caisse_security_challenges enable row level security;
revoke all on public.caisse_security_challenges from public, anon, authenticated;

create table if not exists public.caisse_decaissement_auth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.caisses_sessions(id) on delete cascade,
  method text not null check (method in ('pin','biometric')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists caisse_dec_auth_grants_live_idx
  on public.caisse_decaissement_auth_grants(user_id,session_id,expires_at)
  where consumed_at is null;
alter table public.caisse_decaissement_auth_grants enable row level security;
revoke all on public.caisse_decaissement_auth_grants from public, anon, authenticated;

drop function if exists public.caisse_decaisser(uuid,integer,text,text,text);
create function public.caisse_decaisser(
  p_session uuid,
  p_montant integer,
  p_categorie text,
  p_motif text,
  p_justificatif_ref text,
  p_auth_grant uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $decaisser$
declare
  v_session public.caisses_sessions%rowtype;
  v_pharmacie uuid;
  v_id uuid;
  v_profile public.profiles%rowtype;
  v_grant public.caisse_decaissement_auth_grants%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_session is null then raise exception 'Session de caisse requise'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Le montant du décaissement doit être supérieur à zéro'; end if;
  if p_categorie not in ('depense', 'remise_coffre', 'appoint', 'autre') then raise exception 'Catégorie de décaissement invalide'; end if;
  if p_motif is null or length(trim(p_motif)) < 5 or length(trim(p_motif)) > 500 then raise exception 'Motif invalide'; end if;
  if p_justificatif_ref is not null and length(trim(p_justificatif_ref)) > 200 then raise exception 'Référence de justificatif trop longue'; end if;

  select * into v_grant
  from public.caisse_decaissement_auth_grants g
  where g.id=p_auth_grant and g.user_id=auth.uid() and g.session_id=p_session
    and g.consumed_at is null and g.expires_at > now()
  for update;
  if not found then raise exception 'Autorisation de décaissement absente, expirée ou déjà utilisée'; end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and cs.statut='ouverte'
    and cs.ouvert_par=auth.uid() and c.actif=true
  for update of cs;
  if not found then raise exception 'Session ouverte introuvable, inactive ou non détenue par ce compte'; end if;

  select c.pharmacie_id into v_pharmacie from public.caisses c
  where c.id=v_session.caisse_id and c.actif=true;
  select * into v_profile from public.profiles p
  where p.id=auth.uid() and p.actif=true and p.pharmacie_id=v_pharmacie
    and (coalesce(p.role::text,'')='caisse' or coalesce(p.fonction_interne,'')='caisse');
  if not found then raise exception 'Décaissement réservé à un compte Caisse actif de cette pharmacie'; end if;

  update public.caisse_decaissement_auth_grants set consumed_at=now()
  where id=v_grant.id and consumed_at is null;
  if not found then raise exception 'Autorisation déjà consommée'; end if;

  insert into public.caisse_decaissements(
    pharmacie_id,caisse_session_id,montant,categorie,motif,justificatif_ref,created_by
  ) values (
    v_pharmacie,p_session,p_montant,p_categorie,trim(p_motif),nullif(trim(p_justificatif_ref),''),auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$decaisser$;
revoke all on function public.caisse_decaisser(uuid,integer,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.caisse_decaisser(uuid,integer,text,text,text,uuid) to authenticated;

comment on table public.caisse_security_credentials is
  'Secrets de validation des décaissements. Accès service-role uniquement ; aucun PIN ou secret biométrique en clair.';
comment on table public.caisse_decaissement_auth_grants is
  'Autorisations temporaires à usage unique liées à un utilisateur et à une session de caisse.';
commit;
