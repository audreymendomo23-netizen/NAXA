-- Évite les conventions actives sans règle tarifaire initiale.
create or replace function public.assurance_configurer_convention(
  p_pharmacie uuid,p_assureur uuid,p_reference text,p_debut date,p_fin date,
  p_taux numeric,p_plafond bigint,p_franchise bigint
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_convention uuid;
begin
  if p_taux is null or p_taux not between 0 and 100
    or coalesce(p_franchise,0)<0 or (p_plafond is not null and p_plafond<0) then
    raise exception 'Paramètres de convention invalides';
  end if;
  v_convention:=public.assurance_enregistrer_convention(
    p_pharmacie,p_assureur,p_reference,p_debut,p_fin
  );
  perform public.assurance_enregistrer_regle(
    v_convention,'tout',null,null,p_taux,p_plafond,coalesce(p_franchise,0),
    '[]'::jsonb,'[]'::jsonb,p_debut,p_fin
  );
  return v_convention;
end
$$;
revoke all on function public.assurance_configurer_convention(uuid,uuid,text,date,date,numeric,bigint,bigint) from public,anon;
grant execute on function public.assurance_configurer_convention(uuid,uuid,text,date,date,numeric,bigint,bigint) to authenticated;
