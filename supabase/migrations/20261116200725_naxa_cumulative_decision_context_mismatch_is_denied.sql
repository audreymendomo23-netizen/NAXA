CREATE OR REPLACE FUNCTION public.naxa_decide_cumulative_activity(p_approval_id uuid, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=auth.uid();
  v_admin boolean:=false;
  v_approval public.naxa_cumulative_activity_approvals%rowtype;
  v_request public.naxa_cumulative_activity_requests%rowtype;
  v_authorized boolean:=false;
  v_pending integer;
  v_rejected integer;
  v_next_status text;
begin
  if v_actor is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Décision invalide' using errcode='22023'; end if;
  if p_decision='reject' and length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'Un motif de refus de 5 caractères minimum est obligatoire' using errcode='22023';
  end if;
  if length(trim(coalesce(p_reason,'')))>500 then raise exception 'Motif trop long' using errcode='22023'; end if;

  v_admin:=public.is_admin();
  select * into v_approval from public.naxa_cumulative_activity_approvals
  where id=p_approval_id for update;
  if not found or v_approval.status<>'pending' then
    raise exception 'Approbation absente ou déjà traitée' using errcode='23514';
  end if;
  select * into v_request from public.naxa_cumulative_activity_requests
  where id=v_approval.request_id for update;
  if not found or v_request.status<>'pending' then
    raise exception 'Demande absente ou déjà clôturée' using errcode='23514';
  end if;

  if not private.naxa_cumulative_approval_set_current(v_request.id) then
    perform private.naxa_cancel_cumulative_activity_request(
      v_request.id,'Les affectations sources ou les autorités ont changé depuis la création de la demande. Une nouvelle demande est nécessaire.'
    );
    return 'cancelled';
  end if;

  if v_admin and not v_approval.is_admin_required then
    raise exception 'L’Administrateur ne remplace pas les accords organisationnels ordinaires' using errcode='42501';
  end if;

  if not v_admin then
    if v_approval.is_admin_required or v_approval.approver_id<>v_actor then
      raise exception 'Cette décision est réservée à l’Administrateur NAXA' using errcode='42501';
    end if;
    if v_approval.organization_type='pharmacie' then
      if public.naxa_business_function()<>'promoteur' then
        raise exception 'Active le contexte Promoteur avant de décider cette autorisation' using errcode='42501';
      end if;
      v_authorized:=private.naxa_promoteur_valide(v_actor)
        and exists(select 1 from public.promoteur_pharmacies pp
          join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
          where pp.promoteur_id=v_actor and pp.pharmacie_id=v_approval.organization_id and pp.actif=true);
    elsif v_approval.organization_type='spd' then
      if public.naxa_business_function()<>'prestations'
        or public.naxa_active_role_partner() is distinct from v_approval.organization_id then
        raise exception 'Active le bon espace SPD avant de décider cette autorisation' using errcode='42501';
      end if;
      v_authorized:=exists(select 1 from public.partner_members pm
        join public.partners pa on pa.id=pm.partner_id and pa.partner_type='professionnel_domicile' and pa.status='active'
        join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='prestations' and pu.enabled=true
        where pm.partner_id=v_approval.organization_id and pm.user_id=v_actor and pm.member_role='owner');
    end if;
    if not v_authorized then
      perform private.naxa_cancel_cumulative_activity_request(
        v_request.id,'L’autorité d’approbation a été révoquée ou son organisation est inactive.'
      );
      return 'cancelled';
    end if;
  end if;

  update public.naxa_cumulative_activity_approvals
  set status=case when p_decision='approve' then 'approved' else 'rejected' end,
      decided_at=now(),decision_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=p_approval_id;

  if p_decision='reject' then
    update public.naxa_cumulative_activity_requests
    set status='rejected',updated_at=now()
    where id=v_request.id;
    update public.naxa_cumulative_activity_approvals
    set status='invalidated',decided_at=coalesce(decided_at,now()),
        decision_reason=coalesce(decision_reason,'Demande refusée par une autre organisation')
    where request_id=v_request.id and status='pending';
    v_next_status:='rejected';
  else
    select count(*) filter(where status='pending'),
           count(*) filter(where status='rejected')
    into v_pending,v_rejected
    from public.naxa_cumulative_activity_approvals
    where request_id=v_request.id;
    if v_pending=0 and v_rejected=0 then
      update public.naxa_cumulative_activity_requests
      set status='approved',updated_at=now()
      where id=v_request.id;
      v_next_status:='approved';
    else
      v_next_status:='pending';
    end if;
  end if;

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  select distinct recipients.user_id,'cumulative_activity_update',
    case when v_next_status='approved' then 'Cumul professionnel approuvé'
         when v_next_status='rejected' then 'Demande de cumul refusée'
         else 'Décision de cumul enregistrée' end,
    case when v_next_status='approved' then 'Toutes les autorisations organisationnelles sont réunies. Le dossier peut poursuivre son parcours Admin.'
         when v_next_status='rejected' then 'Une organisation a refusé la demande de cumul. Aucun nouvel accès professionnel n’est activé.'
         else 'Une autorisation a été enregistrée ; d’autres décisions sont encore attendues.' end,
    v_request.id
  from (values(v_request.target_profile_id),(v_request.requested_by)) recipients(user_id);
  return v_next_status;
end
$function$
