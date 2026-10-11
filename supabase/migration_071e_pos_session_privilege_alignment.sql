-- NAXA — aligner ouverture de session et création de vente sur le privilège CREATE_SALE.
-- Additif : ne modifie pas la migration historique 044.
create or replace function public.caisse_ouvrir(
  p_caisse uuid,
  p_fond_initial integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $open$
declare
  v_id uuid;
  v_pharmacie uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if p_fond_initial is null or p_fond_initial < 0 then
    raise exception 'Fond initial invalide';
  end if;

  select c.pharmacie_id
    into v_pharmacie
    from public.caisses c
   where c.id = p_caisse
     and c.actif;
  if v_pharmacie is null then
    raise exception 'Caisse inactive ou introuvable';
  end if;

  if not (
    public.authorize('CREATE_SALE', v_pharmacie, 'POSTE_CAISSE')
    or public.authorize('CREATE_SALE', v_pharmacie, 'PHARMACIE')
  ) then
    raise exception 'Privilège de création de vente insuffisant';
  end if;

  if exists (
    select 1 from public.caisses_sessions cs
     where cs.caisse_id = p_caisse and cs.statut = 'ouverte'
  ) then
    raise exception 'Une session caisse est déjà ouverte';
  end if;

  insert into public.caisses_sessions(caisse_id,ouvert_par,fond_initial)
  values(p_caisse,auth.uid(),p_fond_initial)
  returning id into v_id;
  return v_id;
end;
$open$;

create or replace function public.vente_creer(
  p_session uuid,
  p_client uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $sale$
declare
  v_id uuid;
  v_pharmacie uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  select c.pharmacie_id
    into v_pharmacie
    from public.caisses_sessions cs
    join public.caisses c on c.id = cs.caisse_id
   where cs.id = p_session
     and cs.statut = 'ouverte'
     and c.actif;
  if v_pharmacie is null then
    raise exception 'Session caisse non autorisée, inactive ou fermée';
  end if;

  if not (
    public.authorize('CREATE_SALE', v_pharmacie, 'POSTE_CAISSE')
    or public.authorize('CREATE_SALE', v_pharmacie, 'PHARMACIE')
  ) then
    raise exception 'Privilège de création de vente insuffisant';
  end if;

  insert into public.ventes(pharmacie_id,caisse_session_id,client_id,created_by)
  values(v_pharmacie,p_session,p_client,auth.uid())
  returning id into v_id;
  return v_id;
end;
$sale$;

revoke all on function public.caisse_ouvrir(uuid,integer) from public, anon, authenticated;
revoke all on function public.vente_creer(uuid,uuid) from public, anon, authenticated;
grant execute on function public.caisse_ouvrir(uuid,integer) to authenticated;
grant execute on function public.vente_creer(uuid,uuid) to authenticated;
