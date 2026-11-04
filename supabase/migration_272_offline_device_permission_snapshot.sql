-- NAXA 272 — recalculer les permissions du poste à chaque synchronisation.
begin;

create or replace function public.naxa_device_permissions_v1(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_device public.appareils%rowtype;
  v_profile public.profiles%rowtype;
  v_previous_claim_sub text;
  v_can_view_stock boolean:=false;
  v_can_edit_stock boolean:=false;
begin
  if p_device_id is null then
    return jsonb_build_object('authorized',false,'canViewStock',false,'canEditStock',false,'reason','missing_device');
  end if;

  select * into v_device from public.appareils where id=p_device_id;
  if not found or v_device.actif is distinct from true then
    return jsonb_build_object('authorized',false,'canViewStock',false,'canEditStock',false,'reason','device_inactive');
  end if;
  if now()-coalesce(v_device.derniere_synchro,v_device.cree_le)>interval '7 days' then
    return jsonb_build_object('authorized',false,'canViewStock',false,'canEditStock',false,'reason','device_expired');
  end if;

  select * into v_profile from public.profiles where id=v_device.utilisateur_id;
  if not found
    or v_profile.actif is distinct from true
    or v_profile.role::text not in ('pharmacie','caisse')
    or (v_profile.role::text='pharmacie' and nullif(btrim(v_profile.fonction_interne),'') is null)
    or not exists(select 1 from public.pharmacies ph where ph.id=v_device.pharmacie_id and ph.actif is true) then
    return jsonb_build_object('authorized',false,'canViewStock',false,'canEditStock',false,'reason','professional_or_pharmacy_inactive');
  end if;

  v_previous_claim_sub:=current_setting('request.jwt.claim.sub',true);
  perform pg_catalog.set_config('request.jwt.claim.sub',v_device.utilisateur_id::text,true);
  v_can_view_stock:=public.naxa_has_privilege('VIEW_STOCK',v_device.pharmacie_id,'PHARMACIE');
  v_can_edit_stock:=public.naxa_has_privilege('EDIT_STOCK_QUANTITY',v_device.pharmacie_id,'PHARMACIE');
  perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);

  return jsonb_build_object(
    'authorized',true,
    'canViewStock',v_can_view_stock,
    'canEditStock',v_can_edit_stock
  );
end;
$function$;

revoke all on function public.naxa_device_permissions_v1(uuid) from public,anon,authenticated;
grant execute on function public.naxa_device_permissions_v1(uuid) to service_role;

commit;
