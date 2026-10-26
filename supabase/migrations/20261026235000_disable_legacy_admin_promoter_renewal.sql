-- Désactive l’ancienne voie de renouvellement qui modifiait l’échéance sans confirmer un encaissement.
do $$
begin
 if to_regprocedure('public.admin_renouveler_promoteur(uuid,date,text,uuid)') is not null then
  execute 'revoke all on function public.admin_renouveler_promoteur(uuid,date,text,uuid) from public, anon, authenticated, service_role';
 end if;
end $$;