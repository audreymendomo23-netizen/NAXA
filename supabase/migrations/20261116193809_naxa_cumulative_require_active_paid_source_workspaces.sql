do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)'::regprocedure)
 into v_definition;
 v_old := $old$
   v_has_source :=
     exists(select 1 from public.naxa_professional_assignments a
       where a.profile_id=p_target_profile_id and a.statut='active'
         and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
     or exists(select 1 from public.promoteur_pharmacies pp
       where pp.promoteur_id=p_target_profile_id and pp.actif=true)
     or exists(select 1 from public.profiles p
       where p.id=p_target_profile_id and p.role::text in ('pharmacie','caisse')
         and p.pharmacie_id is not null);
$old$;
 v_new := $new$
   v_has_source :=
     exists(select 1 from public.naxa_professional_assignments a
       join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true and ph.archivee_le is null
       join public.promoteur_pharmacies pp on pp.pharmacie_id=ph.id and pp.actif=true
       where a.profile_id=p_target_profile_id and a.statut='active'
         and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
     or exists(select 1 from public.promoteur_pharmacies pp
       join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
       where pp.promoteur_id=p_target_profile_id and pp.actif=true)
     or exists(select 1 from public.profiles p
       join public.pharmacies ph on ph.id=p.pharmacie_id and ph.actif=true and ph.archivee_le is null
       join public.promoteur_pharmacies pp on pp.pharmacie_id=ph.id and pp.actif=true
       where p.id=p_target_profile_id and p.role::text in ('pharmacie','caisse'));
$new$;
 if position('join public.pharmacies ph on ph.id=a.pharmacie_id' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Pharmacy source active-status anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 v_definition:=replace(v_definition,
  'and pa.partner_type=''professionnel_domicile'' and pa.status=''active''',
  'and pa.partner_type=''professionnel_domicile'' and pa.status=''active'' and private.naxa_partner_has_confirmed_payment(pa.id)');
 execute v_definition;
end
$patch$;

do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure)
 into v_definition;
 v_old := 'and pa.partner_type=''professionnel_domicile'' and pa.status=''active''';
 v_new := v_old || ' and private.naxa_partner_has_confirmed_payment(pa.id)';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Professional assignment SPD lock guard anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;

 select pg_get_functiondef('public.naxa_grant_livreur_assignment(uuid,uuid,timestamp with time zone,timestamp with time zone,text)'::regprocedure)
 into v_definition;
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Courier assignment SPD lock guard anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;
end
$patch$;

do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb)'::regprocedure)
 into v_definition;
 v_old := 'exists(select 1 from public.naxa_professional_assignments a
     where a.profile_id=p_owner_user_id and a.statut=''active''
       and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
   or exists(select 1 from public.promoteur_pharmacies pp
     where pp.promoteur_id=p_owner_user_id and pp.actif=true)
   or exists(select 1 from public.profiles p where p.id=p_owner_user_id
     and p.role::text in (''pharmacie'',''caisse'') and p.pharmacie_id is not null)';
 v_new := 'exists(select 1 from public.naxa_professional_assignments a
     join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true and ph.archivee_le is null
     where a.profile_id=p_owner_user_id and a.statut=''active''
       and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
   or exists(select 1 from public.promoteur_pharmacies pp
     join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
     where pp.promoteur_id=p_owner_user_id and pp.actif=true)
   or exists(select 1 from public.profiles p
     join public.pharmacies ph on ph.id=p.pharmacie_id and ph.actif=true and ph.archivee_le is null
     where p.id=p_owner_user_id and p.role::text in (''pharmacie'',''caisse''))';
 if position('join public.pharmacies ph on ph.id=a.pharmacie_id' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Admin dossier source active-status anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
   execute v_definition;
 end if;
end
$patch$;
