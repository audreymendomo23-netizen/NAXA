-- NAXA 144 — empêcher les abonnements Promoteur incohérents.
create or replace function public.verifier_abonnement_promoteur_coherence()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if not exists (
    select 1 from public.conventions_promoteurs c
    where c.id=new.convention_id and c.promoteur_id=new.promoteur_id
  ) then
    raise exception 'Convention Promoteur incohérente avec l''abonnement';
  end if;

  if new.statut='actif' and new.echeance < current_date then
    raise exception 'Un abonnement Promoteur actif ne peut pas être échu';
  end if;
  return new;
end
$function$;

revoke all on function public.verifier_abonnement_promoteur_coherence() from public,anon,authenticated;

drop trigger if exists trg_verifier_abonnement_promoteur_coherence on public.abonnements_promoteurs;
create trigger trg_verifier_abonnement_promoteur_coherence
before insert or update of promoteur_id,convention_id,statut,echeance
on public.abonnements_promoteurs
for each row execute function public.verifier_abonnement_promoteur_coherence();
