-- NAXA — révocation par Responsable limitée à la Caisse, comme l'ERP Pharmacie.
begin;

create or replace function public.naxa_revoke_partner_professional_assignment(
  p_assignment uuid,
  p_motif text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_actor_role text;
  v_assignment public.naxa_partner_professional_assignments%rowtype;
  v_required_privilege text;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif de révocation obligatoire';
  end if;

  select * into v_assignment
  from public.naxa_partner_professional_assignments
  where id=p_assignment and statut='active'
  for update;
  if not found then raise exception 'Affectation active introuvable'; end if;

  if public.is_admin() then
    null;
  else
    v_actor_role:=public.naxa_business_function(v_actor);
    if not private.naxa_partner_scope_allows(v_actor,v_assignment.partner_id,'PARTENAIRE') then
      raise exception 'Révocation hors établissement actif';
    end if;

    if v_actor_role='promoteur' then
      if not exists (
        select 1 from public.partner_members pm
        where pm.partner_id=v_assignment.partner_id
          and pm.user_id=v_actor and pm.member_role='owner'
      ) then
        raise exception 'Seul le Promoteur titulaire peut révoquer une affectation';
      end if;
      v_required_privilege:=case
        when v_assignment.role_code='caisse' then 'SUSPEND_CAISSE'
        when v_assignment.role_code='responsable' then 'SUSPEND_RESPONSABLE'
        else 'ASSIGN_USER_TO_PHARMACY'
      end;
      if not private.naxa_has_partner_privilege(v_required_privilege,v_assignment.partner_id) then
        raise exception 'Privilège % absent pour cette Parapharmacie',v_required_privilege;
      end if;
    elsif v_actor_role='responsable' then
      if v_assignment.role_code<>'caisse'
        or not private.naxa_has_partner_privilege('SUSPEND_CAISSE',v_assignment.partner_id) then
        raise exception 'Le Responsable ne peut révoquer que les Caisses dans les limites qui lui sont déléguées';
      end if;
    else
      raise exception 'Révocation non autorisée pour ce poste';
    end if;
  end if;

  update public.naxa_partner_professional_assignments
  set statut='revoked',
      revoque_par=v_actor,
      revoque_at=now(),
      motif_revocation=trim(p_motif)
  where id=p_assignment and statut='active';

  return found;
end;
$function$;

revoke all on function public.naxa_revoke_partner_professional_assignment(uuid,text) from public,anon;
grant execute on function public.naxa_revoke_partner_professional_assignment(uuid,text) to authenticated,service_role;

commit;
