-- Une demande d'annulation Caisse ne peut viser que la vente créée par le compte demandeur.
-- La décision d'annulation reste soumise au workflow d'approbation existant.
create or replace function public.vente_annulation_demander(p_vente uuid,p_motif text)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_vente public.ventes%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if length(trim(coalesce(p_motif,''))) < 3 then
    raise exception 'Motif d''annulation obligatoire';
  end if;

  select * into v_vente
  from public.ventes
  where id=p_vente
  for update;
  if not found then raise exception 'Vente introuvable'; end if;

  if v_vente.created_by is distinct from auth.uid() then
    raise exception 'Une caissière ne peut demander l''annulation que de ses propres ventes';
  end if;
  if v_vente.statut <> 'payee' then
    raise exception 'Seule une vente payée peut être annulée';
  end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  insert into public.vente_annulation_demandes(vente_id,pharmacie_id,motif,demandee_par)
  values(p_vente,v_vente.pharmacie_id,trim(p_motif),auth.uid())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Une demande d''annulation est déjà en attente pour cette vente';
end;
$function$;

revoke all on function public.vente_annulation_demander(uuid,text) from public,anon;
grant execute on function public.vente_annulation_demander(uuid,text) to authenticated;
