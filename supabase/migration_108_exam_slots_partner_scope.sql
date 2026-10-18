-- NAXA 108 — génération de créneaux limitée au centre du partenaire appelant.
begin;
create or replace function public.generate_exam_slots_for_center(p_center_id uuid,p_days integer default 14)
returns integer language plpgsql security definer set search_path=''
as $function$
declare h record; d date; ts timestamp; v_count integer:=0; v_tz text:='Africa/Douala';
begin
 if auth.uid() is null or p_center_id is null then raise exception 'Connexion requise' using errcode='28000'; end if;
 if not exists(
   select 1 from public.exam_centers c join public.partner_members pm on pm.partner_id=c.partner_id
   where c.id=p_center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')
 ) and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then
   raise exception 'Accès refusé' using errcode='42501';
 end if;
 if p_days<1 or p_days>14 then raise exception 'La génération est limitée à 14 jours' using errcode='22023'; end if;
 for h in select ch.weekday,ch.opens_at,ch.closes_at,ch.slot_minutes,ch.capacity
   from public.exam_center_hours ch where ch.center_id=p_center_id and ch.enabled=true
 loop
   for d in select (current_timestamp at time zone v_tz)::date + g from generate_series(0,p_days-1) g loop
     if extract(dow from d)=h.weekday then
       ts:=d+h.opens_at;
       while ts + make_interval(mins=>h.slot_minutes) <= d+h.closes_at loop
         if (ts at time zone v_tz)>now() then
           insert into public.exam_slots(center_id,starts_at,ends_at,capacity)
           values(p_center_id,ts at time zone v_tz,(ts+make_interval(mins=>h.slot_minutes)) at time zone v_tz,h.capacity)
           on conflict(center_id,starts_at) do nothing;
           if found then v_count:=v_count+1; end if;
         end if;
         ts:=ts+make_interval(mins=>h.slot_minutes);
       end loop;
     end if;
   end loop;
 end loop;
 return v_count;
end;$function$;
revoke all on function public.generate_exam_slots_for_center(uuid,integer) from public,anon;
grant execute on function public.generate_exam_slots_for_center(uuid,integer) to authenticated;
commit;
