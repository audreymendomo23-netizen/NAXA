do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)'::regprocedure)
 into v_definition;
 v_old := ' v_actor_role text;';
 v_new := ' v_actor_role text; v_required_privilege text;';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Cumulative actor role declaration changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;

 v_old := $old$
   v_actor_role:=private.naxa_business_function(v_actor);
   if not public.is_admin() then
     if v_actor_role='promoteur' then
       if not private.naxa_promoteur_valide(v_actor) or not exists(
         select 1 from public.promoteur_pharmacies pp
         where pp.promoteur_id=v_actor and pp.pharmacie_id=p_destination_pharmacy_id and pp.actif=true
       ) then raise exception 'Pharmacie hors réseau du Promoteur' using errcode='42501'; end if;
     elsif v_actor_role='pharmacie' then
       if private.naxa_active_role_pharmacy(v_actor) is distinct from p_destination_pharmacy_id then
         raise exception 'Pharmacie active différente de la destination' using errcode='42501';
       end if;
     else
       raise exception 'Seul le Promoteur ou la Pharmacie destination peut demander cette affectation' using errcode='42501';
     end if;
   end if;
$old$;
 v_new := $new$
   v_actor_role:=private.naxa_business_function(v_actor);
   if not public.is_admin() then
     if v_actor_role='promoteur' then
       if not private.naxa_promoteur_valide(v_actor) or not exists(
         select 1 from public.promoteur_pharmacies pp
         where pp.promoteur_id=v_actor and pp.pharmacie_id=p_destination_pharmacy_id and pp.actif=true
       ) then raise exception 'Pharmacie hors réseau du Promoteur' using errcode='42501'; end if;
       v_required_privilege:=case
         when p_destination_role_code='caisse' then 'CREATE_CAISSE'
         when p_destination_role_code='responsable' then 'CREATE_RESPONSABLE'
         else 'ASSIGN_USER_TO_PHARMACY'
       end;
       if p_destination_role_code='caisse' then
         if not public.naxa_can('CREATE_CAISSE',p_destination_pharmacy_id,null) then
           raise exception 'Privilège CREATE_CAISSE absent' using errcode='42501';
         end if;
       elsif not public.naxa_has_privilege(v_required_privilege,p_destination_pharmacy_id,'PHARMACIE') then
         raise exception 'Privilège % absent',v_required_privilege using errcode='42501';
       end if;
     elsif v_actor_role='pharmacie' and p_destination_role_code='livreur' then
       if private.naxa_active_role_pharmacy(v_actor) is distinct from p_destination_pharmacy_id
         or not public.naxa_scope_allows(v_actor,p_destination_pharmacy_id,'PHARMACIE') then
         raise exception 'Pharmacie active différente de la destination' using errcode='42501';
       end if;
     else
       raise exception 'Seul le Promoteur autorisé ou la Pharmacie pour un Livreur peut demander cette affectation' using errcode='42501';
     end if;
   end if;
$new$;
 if position('v_required_privilege:=case' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Cumulative actor authorization block changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;
end
$patch$;
