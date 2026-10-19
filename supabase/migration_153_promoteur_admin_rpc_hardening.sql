-- NAXA 153 — durcir les RPC commerciales admin-only restantes.
-- Ces fonctions restent SECURITY DEFINER pour les écritures/lectures transversales,
-- mais ont un search_path vide et une vérification explicite du rôle cible.
alter function public.validites_promoteurs_admin() set search_path = '';

create or replace function public.reactiver_promoteur(
  p_promoteur uuid,
  p_reference text default null
)
returns date
language plpgsql
security definer
set search_path=''
as $function$
declare
  c public.conventions_promoteurs;
  a public.abonnements_promoteurs;
  v_fin date := current_date + interval '1 month' - interval '1 day';
begin
  if not public.is_admin() then
    raise exception 'Accès réservé à NAXA';
  end if;
  if p_promoteur is null or not exists(
    select 1 from public.profiles
    where id=p_promoteur and role::text='promoteur'
  ) then
    raise exception 'Cible Promoteur invalide';
  end if;

  select * into c
  from public.conventions_promoteurs
  where promoteur_id=p_promoteur
  for update;
  if not found then raise exception 'Convention Promoteur introuvable'; end if;
  if c.architecture_code is null then raise exception 'Architecture de convention manquante'; end if;

  update public.conventions_promoteurs
  set date_paiement=current_date,date_expiration=v_fin,statut='active',updated_at=now()
  where id=c.id;

  select * into a
  from public.abonnements_promoteurs
  where promoteur_id=p_promoteur
  for update;

  if not found then
    insert into public.abonnements_promoteurs(
      promoteur_id,convention_id,montant_mensuel,debut,echeance,statut,reactive_le,reactive_par
    ) values(
      p_promoteur,c.id,c.montant_mensuel,current_date,v_fin,'actif',now(),auth.uid()
    ) returning * into a;
  else
    update public.abonnements_promoteurs
    set convention_id=c.id,montant_mensuel=c.montant_mensuel,debut=current_date,
        echeance=v_fin,statut='actif',bloque_le=null,reactive_le=now(),reactive_par=auth.uid()
    where id=a.id
    returning * into a;
  end if;

  insert into public.abonnement_promoteur_paiements(
    abonnement_id,periode_du,periode_au,montant,reference,enregistre_par
  ) values(
    a.id,current_date,v_fin,c.montant_mensuel,
    nullif(trim(coalesce(p_reference,'')),''),auth.uid()
  );

  update public.pharmacies ph
  set actif=true
  where exists(
    select 1 from public.promoteur_pharmacies pp
    where pp.promoteur_id=p_promoteur and pp.pharmacie_id=ph.id
  );
  update public.profiles pr
  set actif=true
  where pr.id=p_promoteur
     or exists(
       select 1 from public.promoteur_pharmacies pp
       where pp.promoteur_id=p_promoteur and pp.pharmacie_id=pr.pharmacie_id
     )
     or exists(
       select 1 from public.profiles owner
       where owner.id=p_promoteur and owner.pharmacie_id=pr.pharmacie_id
     );
  return v_fin;
end
$function$;

revoke all on function public.reactiver_promoteur(uuid,text) from public,anon;
grant execute on function public.reactiver_promoteur(uuid,text) to authenticated;
