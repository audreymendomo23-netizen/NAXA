-- NAXA — Correctifs de séquence retrait Marketplace et contrôle d'affectation Responsable.
-- Migration cumulative Replay-first : aucun compte ni plafond de démonstration ajouté.
begin;

-- Une affectation Responsable est vérifiée directement sur le contrat canonique
-- d'affectation, afin de respecter les champs fonction/commence_at/expire_at.
create or replace function public.naxa_responsable_credit_limit_configurer(
  p_responsable uuid,
  p_pharmacie uuid,
  p_plafond_fcfa bigint
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_responsable is null or p_pharmacie is null or p_plafond_fcfa is null or p_plafond_fcfa<0 then
    raise exception 'Responsable, pharmacie et plafond valide requis';
  end if;
  if public.is_admin() is not true and not exists (
    select 1 from public.profiles promoter
    where promoter.id=auth.uid()
      and promoter.actif and promoter.role::text='promoteur' and promoter.niveau_interne=1
      and private.naxa_promoteur_valide(promoter.id)
      and exists (
        select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=promoter.id and pp.pharmacie_id=p_pharmacie and pp.actif
      )
  ) then
    raise exception 'Seul le Promoteur propriétaire du réseau ou NAXA peut fixer ce plafond';
  end if;
  if not exists (
    select 1 from public.profiles r
    where r.id=p_responsable and r.actif
      and r.role::text='pharmacie' and r.fonction_interne='responsable' and r.niveau_interne=2
  ) then raise exception 'Le compte cible n’est pas un Responsable actif'; end if;
  if not exists (
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=p_responsable and a.pharmacie_id=p_pharmacie
      and a.fonction='responsable' and a.statut='active'
      and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now())
  ) then
    raise exception 'Le Responsable ne possède pas d’affectation active pour cette pharmacie';
  end if;
  insert into public.naxa_responsable_credit_limits(
    profile_id,pharmacie_id,plafond_fcfa,actif,created_by,updated_by
  ) values(p_responsable,p_pharmacie,p_plafond_fcfa,true,auth.uid(),auth.uid())
  on conflict(profile_id,pharmacie_id) do update
    set plafond_fcfa=excluded.plafond_fcfa,actif=true,updated_by=auth.uid(),updated_at=now()
  returning id into v_id;
  return v_id;
end
$function$;

revoke all on function public.naxa_responsable_credit_limit_configurer(uuid,uuid,bigint) from public,anon;
grant execute on function public.naxa_responsable_credit_limit_configurer(uuid,uuid,bigint) to authenticated;

-- vente_reservation_credit_finaliser décrémente elle-même les lots/le stock
-- (ou réutilise un débit approbation existant). Elle doit marquer le draft POS
-- avant UPDATE statut='payee' pour éviter que le trigger générique ne redébite.
do $migration$
declare v_definition text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.vente_reservation_credit_finaliser(uuid,uuid,text)'::regprocedure)
    into v_definition;
  v_old:=E'  update public.ventes as v set statut=''payee'',mode_paiement=''credit'',\n    paiement_ref=nullif(trim(p_reference),''''),paid_at=now()\n  where v.id=v_vente and v.statut=''brouillon'';';
  v_new:=E'  update public.ventes set stock_decremented_at_draft=true\n  where id=v_vente and statut=''brouillon'';\n  if not found then raise exception ''La vente POS ne peut pas être marquée comme stock déjà traité''; end if;\n\n  update public.ventes as v set statut=''payee'',mode_paiement=''credit'',\n    paiement_ref=nullif(trim(p_reference),''''),paid_at=now()\n  where v.id=v_vente and v.statut=''brouillon'';';
  if position(v_old in v_definition)=0 then
    raise exception 'Contrat de finalisation crédit Marketplace inattendu ; migration interrompue';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;

commit;
