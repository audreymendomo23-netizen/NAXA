-- NAXA — Un seul Promoteur actif responsable par pharmacie.
-- Un Promoteur reste libre de gérer plusieurs pharmacies distinctes.
begin;

do $migration$
begin
  if exists(
    select 1
    from public.promoteur_pharmacies
    where actif=true
    group by pharmacie_id
    having count(*)>1
  ) then
    raise exception 'Plusieurs Promoteurs actifs sont déjà liés à une même pharmacie ; transfert à régulariser avant contrainte';
  end if;
end
$migration$;

create unique index if not exists promoteur_pharmacies_one_active_promoteur_per_pharmacy_uq
  on public.promoteur_pharmacies(pharmacie_id)
  where actif=true;

commit;
