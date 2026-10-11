-- NAXA — parcours POS atomique : encaissement + finalisation dans une seule transaction RPC.
-- Additif : conserve vente_encaisser, vente_finaliser et vente_ticket comme moteurs existants.
create or replace function public.vente_encaisser_finaliser(
  p_vente uuid,
  p_mode public.mode_paiement_caisse,
  p_montant_percu integer,
  p_reference text default null
)
returns table(paiement_id uuid, montant_a_payer integer, monnaie_rendue integer)
language plpgsql
security definer
set search_path = ''
as $pos$
declare
  v_vente public.ventes%rowtype;
  v_paye integer;
  v_rendu integer;
  v_paiement record;
  v_existing_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  select * into v_vente
    from public.ventes
   where id = p_vente
   for update;
  if not found then
    raise exception 'Vente introuvable';
  end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  select coalesce(sum(montant),0), coalesce(sum(monnaie_rendue),0)
    into v_paye, v_rendu
    from public.vente_paiements
   where vente_id = p_vente;

  if v_vente.statut = 'payee' then
    select id into v_existing_id
      from public.vente_paiements
     where vente_id = p_vente
     order by created_at desc, id desc
     limit 1;
    return query select v_existing_id, v_vente.total_net, v_rendu;
    return;
  end if;

  if v_vente.statut <> 'brouillon' then
    raise exception 'Vente déjà clôturée';
  end if;

  -- Reprise idempotente d'un paiement déjà enregistré par l'ancien parcours
  -- lorsque le total est complet mais que la finalisation n'a pas été faite.
  if v_paye = v_vente.total_net and v_paye > 0 then
    perform public.vente_finaliser(p_vente);
    select id into v_existing_id
      from public.vente_paiements
     where vente_id = p_vente
     order by created_at desc, id desc
     limit 1;
    return query select v_existing_id, v_vente.total_net, v_rendu;
    return;
  end if;

  if v_paye <> 0 then
    raise exception 'Paiement antérieur partiel ou incohérent : réconciliation nécessaire';
  end if;

  select * into v_paiement
    from public.vente_encaisser(p_vente, p_mode, p_montant_percu, p_reference);

  -- Toute erreur ici annule aussi l'insertion de paiement dans la même transaction.
  perform public.vente_finaliser(p_vente);

  return query select v_paiement.paiement_id, v_paiement.montant_a_payer, v_paiement.monnaie_rendue;
end;
$pos$;

revoke all on function public.vente_encaisser_finaliser(uuid,public.mode_paiement_caisse,integer,text) from public, anon;
grant execute on function public.vente_encaisser_finaliser(uuid,public.mode_paiement_caisse,integer,text) to authenticated;

comment on function public.vente_encaisser_finaliser(uuid,public.mode_paiement_caisse,integer,text) is
  'Parcours POS atomique et idempotent : encaisse, finalise et permet la reprise d''un paiement complet déjà enregistré.';
