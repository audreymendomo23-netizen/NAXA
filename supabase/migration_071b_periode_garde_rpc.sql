-- NAXA — RPC additive pour raccorder l'interface aux métadonnées de garde de 070.
-- La migration 070 reste inchangée ; ce RPC conserve le contrôle de périmètre serveur.
create or replace function public.set_garde_periode(
  p_debut timestamptz default null,
  p_fin timestamptz default null,
  p_source_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $garde$
declare
  v_uid uuid := (select auth.uid());
  v_pharmacie uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;

  select p.pharmacie_id
    into v_pharmacie
    from public.profiles p
   where p.id = v_uid
     and p.actif;

  if v_pharmacie is null then
    raise exception 'Aucune pharmacie active associée au compte';
  end if;

  if not (public.is_admin() or public.can_operate_pharmacy(v_pharmacie)) then
    raise exception 'Modification de la garde non autorisée';
  end if;

  if p_debut is null and p_fin is null and nullif(trim(coalesce(p_source_url, '')), '') is null then
    update public.pharmacies
       set de_garde = false,
           garde_debut = null,
           garde_fin = null,
           garde_source_url = null,
           garde_verifiee_le = null
     where id = v_pharmacie;
    return;
  end if;

  if p_debut is null or p_fin is null or p_fin <= p_debut then
    raise exception 'La période de garde doit avoir un début et une fin valides';
  end if;

  if nullif(trim(coalesce(p_source_url, '')), '') is null
     or trim(p_source_url) !~* '^https?://' then
    raise exception 'Une URL source http(s) est obligatoire';
  end if;

  update public.pharmacies
     set de_garde = true,
         garde_debut = p_debut,
         garde_fin = p_fin,
         garde_source_url = trim(p_source_url),
         garde_verifiee_le = now()
   where id = v_pharmacie;
end;
$garde$;

revoke all on function public.set_garde_periode(timestamptz,timestamptz,text) from public, anon;
grant execute on function public.set_garde_periode(timestamptz,timestamptz,text) to authenticated;

comment on function public.set_garde_periode(timestamptz,timestamptz,text) is
  'Enregistre ou retire une période de garde datée avec source ; RPC additive à la migration 070.';
