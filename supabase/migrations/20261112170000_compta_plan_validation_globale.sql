-- Validation explicite du plan comptable complet.
begin;
create or replace function public.compta_plan_valider_plan(p_pharmacie uuid)
returns integer
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_count integer;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de validation comptable requis' using errcode='42501';
  end if;
  update public.compta_plan_comptable
    set statut='valide',valide_par=v_uid,valide_le=now(),
        source_validation=coalesce(source_validation,'validation_plan_complet')
    where pharmacie_id=p_pharmacie and statut='a_valider';
  get diagnostics v_count=row_count;
  if v_count=0 then raise exception 'Aucun compte en attente : plan inchangé'; end if;
  perform public.compta_auditer(p_pharmacie,v_uid,'plan_comptable_valide','plan_comptable',p_pharmacie::text,'succes',
    format('Validation groupée de %s compte(s)',v_count));
  return v_count;
end $$;
revoke all on function public.compta_plan_valider_plan(uuid) from public,anon;
grant execute on function public.compta_plan_valider_plan(uuid) to authenticated;
commit;