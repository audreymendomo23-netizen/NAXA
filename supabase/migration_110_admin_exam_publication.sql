-- NAXA 110 — publication administrative contrôlée des centres, examens et packs.
begin;
create or replace function public.admin_set_exam_center_status(p_center_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.role='admin') then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 if p_status not in ('draft','active','suspended') then raise exception 'Statut invalide' using errcode='22023'; end if;
 if p_status='active' and not exists(
   select 1 from public.exam_centers c join public.partners pa on pa.id=c.partner_id and pa.status='active'
   join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='examens' and pu.enabled
   join public.universes u on u.slug='examens' and u.enabled
   join public.feature_flags ff on ff.flag_key='universe.examens' and ff.enabled
   where c.id=p_center_id
 ) then raise exception 'Partenaire, association ou univers non activé' using errcode='23514'; end if;
 update public.exam_centers set status=p_status,updated_at=now() where id=p_center_id;
 if not found then raise exception 'Centre introuvable' using errcode='P0002'; end if;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'exam_center.status_changed','exam_center',p_center_id::text,jsonb_build_object('status',p_status));
end;$function$;

create or replace function public.admin_set_exam_service_status(p_service_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.role='admin') then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 if p_status not in ('draft','active','archived') then raise exception 'Statut invalide' using errcode='22023'; end if;
 if p_status='active' and not exists(
   select 1 from public.exam_services s join public.exam_centers c on c.id=s.center_id and c.status='active'
   join public.partners pa on pa.id=c.partner_id and pa.status='active'
   join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='examens' and pu.enabled
   join public.universes u on u.slug='examens' and u.enabled
   join public.feature_flags ff on ff.flag_key='universe.examens' and ff.enabled
   where s.id=p_service_id
 ) then raise exception 'Centre, partenaire, association ou univers non activé' using errcode='23514'; end if;
 update public.exam_services set status=p_status,updated_at=now() where id=p_service_id;
 if not found then raise exception 'Examen introuvable' using errcode='P0002'; end if;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'exam_service.status_changed','exam_service',p_service_id::text,jsonb_build_object('status',p_status));
end;$function$;

create or replace function public.admin_set_exam_pack_status(p_pack_id uuid,p_status text)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null or not exists(select 1 from public.profiles p where p.id=v_actor and p.role='admin') then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
 if p_status not in ('draft','active','archived') then raise exception 'Statut invalide' using errcode='22023'; end if;
 if p_status='active' and not exists(
   select 1 from public.exam_packs p join public.exam_centers c on c.id=p.center_id and c.status='active'
   join public.partners pa on pa.id=c.partner_id and pa.status='active'
   join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='examens' and pu.enabled
   join public.universes u on u.slug='examens' and u.enabled
   join public.feature_flags ff on ff.flag_key='universe.examens' and ff.enabled
   where p.id=p_pack_id
 ) then raise exception 'Centre, partenaire, association ou univers non activé' using errcode='23514'; end if;
 update public.exam_packs set status=p_status,updated_at=now() where id=p_pack_id;
 if not found then raise exception 'Pack introuvable' using errcode='P0002'; end if;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
 values(v_actor,'exam_pack.status_changed','exam_pack',p_pack_id::text,jsonb_build_object('status',p_status));
end;$function$;
revoke all on function public.admin_set_exam_center_status(uuid,text) from public,anon;
revoke all on function public.admin_set_exam_service_status(uuid,text) from public,anon;
revoke all on function public.admin_set_exam_pack_status(uuid,text) from public,anon;
grant execute on function public.admin_set_exam_center_status(uuid,text) to authenticated;
grant execute on function public.admin_set_exam_service_status(uuid,text) to authenticated;
grant execute on function public.admin_set_exam_pack_status(uuid,text) to authenticated;
commit;
