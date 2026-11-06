-- NAXA — autoriser au compte Pharmacie de révoquer un poste Livreur de sa propre pharmacie.
begin;

create or replace function public.naxa_revoke_professional_assignment(
  p_assignment uuid,
  p_motif text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_assignment public.naxa_professional_assignments%rowtype;
  v_actor_role text;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif de révocation obligatoire';
  end if;
  select * into v_assignment from public.naxa_professional_assignments
  where id=p_assignment and statut='active' for update;
  if not found then raise exception 'Affectation active introuvable'; end if;

  if public.is_admin() then
    null;
  else
    v_actor_role:=public.naxa_business_function(v_actor);
    if v_actor_role='promoteur' then
      if not private.naxa_promoteur_valide(v_actor)
        or not exists(select 1 from public.promoteur_pharmacies pp
          where pp.promoteur_id=v_actor and pp.pharmacie_id=v_assignment.pharmacie_id and pp.actif) then
        raise exception 'Révocation hors réseau Promoteur';
      end if;
      if not public.naxa_has_privilege('ASSIGN_USER_TO_PHARMACY',v_assignment.pharmacie_id,'PHARMACIE')
         and v_assignment.role_code not in ('caisse','responsable') then
        raise exception 'Privilège de révocation absent';
      end if;
    elsif v_actor_role='responsable' and v_assignment.role_code='caisse' then
      if not exists(select 1 from public.profiles p where p.id=v_actor and p.pharmacie_id=v_assignment.pharmacie_id)
        or not public.naxa_can('SUSPEND_CAISSE',v_assignment.pharmacie_id,v_assignment.profile_id) then
        raise exception 'Le Responsable ne peut pas révoquer cette affectation Caisse';
      end if;
    elsif v_actor_role='pharmacie' and v_assignment.role_code='livreur' then
      if public.naxa_active_role_pharmacy(v_actor) is distinct from v_assignment.pharmacie_id
        or not public.naxa_scope_allows(v_actor,v_assignment.pharmacie_id,'PHARMACIE') then
        raise exception 'Une Pharmacie ne peut révoquer que ses propres Livreurs';
      end if;
    else
      raise exception 'Révocation hors périmètre autorisé';
    end if;
  end if;

  update public.naxa_professional_assignments
  set statut='revoked',revoque_par=v_actor,revoque_at=now(),motif_revocation=trim(p_motif)
  where id=p_assignment;
  return true;
end;
$function$;
revoke all on function public.naxa_revoke_professional_assignment(uuid,text) from public,anon;
grant execute on function public.naxa_revoke_professional_assignment(uuid,text) to authenticated;

commit;
