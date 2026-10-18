-- NAXA 109 — le RPC de réservation applique aussi les flags et l’état commercial public.
begin;
create or replace function public.book_exam_appointment(p_slot_id uuid,p_service_id uuid default null,p_pack_id uuid default null,p_client_note text default null)
returns table(appointment_id uuid,ticket_code text,starts_at timestamptz,price_fcfa integer)
language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_slot public.exam_slots%rowtype; v_center uuid; v_name text; v_price integer; v_id uuid; v_ticket text;
begin
 if v_user is null then raise exception 'Connexion requise' using errcode='28000'; end if;
 if (p_service_id is null)::integer + (p_pack_id is null)::integer <> 1 then raise exception 'Choisir un examen ou un pack' using errcode='22023'; end if;
 select * into v_slot from public.exam_slots s where s.id=p_slot_id for update;
 if not found or v_slot.status<>'open' or v_slot.starts_at<=now() or v_slot.reserved_count>=v_slot.capacity then raise exception 'Créneau indisponible' using errcode='P0001'; end if;
 v_center:=v_slot.center_id;
 if not exists(
   select 1 from public.exam_centers c
   join public.partners p on p.id=c.partner_id and p.status='active'
   join public.partner_universes pu on pu.partner_id=p.id and pu.universe_slug='examens' and pu.enabled=true
   join public.universes u on u.slug='examens' and u.enabled=true
   join public.feature_flags ff on ff.flag_key='universe.examens' and ff.enabled=true
   where c.id=v_center and c.status='active'
 ) then raise exception 'Centre non disponible' using errcode='P0001'; end if;
 if p_service_id is not null then
   select s.name,s.price_fcfa into v_name,v_price from public.exam_services s where s.id=p_service_id and s.center_id=v_center and s.status='active';
 else
   select p.name,p.price_fcfa into v_name,v_price from public.exam_packs p where p.id=p_pack_id and p.center_id=v_center and p.status='active';
 end if;
 if v_name is null then raise exception 'Examen ou pack indisponible dans ce centre' using errcode='P0001'; end if;
 update public.exam_slots set reserved_count=reserved_count+1 where id=p_slot_id and reserved_count<capacity;
 if not found then raise exception 'Créneau complet' using errcode='P0001'; end if;
 insert into public.exam_appointments(client_id,center_id,slot_id,service_id,pack_id,item_name,price_fcfa,reminder_at,client_note)
 values(v_user,v_center,p_slot_id,p_service_id,p_pack_id,v_name,v_price,v_slot.starts_at-interval '24 hours',nullif(left(trim(coalesce(p_client_note,'')),500),''))
 returning id,exam_appointments.ticket_code into v_id,v_ticket;
 return query select v_id,v_ticket,v_slot.starts_at,v_price;
end;$function$;
revoke all on function public.book_exam_appointment(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.book_exam_appointment(uuid,uuid,uuid,text) to authenticated;
commit;
