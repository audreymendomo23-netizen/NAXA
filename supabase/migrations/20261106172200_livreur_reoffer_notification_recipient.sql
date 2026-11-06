-- NAXA — réaffectation de mission : notification utilisateur distincte du contexte pharmacie.
begin;
create or replace function public.naxa_delivery_reoffer(p_mission uuid,p_note text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_role text;
begin
  if v_uid is null or p_note is null or length(trim(p_note))<5 or length(trim(p_note))>300 then
    raise exception 'Motif de réaffectation invalide';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found then raise exception 'Mission introuvable'; end if;
  if not public.naxa_scope_allows(v_uid,v_m.pharmacie_id,'PHARMACIE') then raise exception 'Mission hors périmètre'; end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('promoteur','pharmacie','gestionnaire_stock','magasinier','responsable') then
    raise exception 'Réaffectation réservée à la pharmacie ou au Promoteur';
  end if;
  if v_m.statut not in ('accepted','failed') or v_m.picked_up_at is not null then
    raise exception 'La mission ne peut être réouverte après le retrait du colis';
  end if;

  update public.naxa_delivery_mission_offers
  set offer_status='recalled'
  where mission_id=p_mission and offer_status in ('offered','accepted');

  update public.naxa_delivery_missions
  set livreur_id=null,statut='available',accepted_at=null,failed_at=null,
      failure_code=null,failure_note=null,updated_at=now()
  where id=p_mission;
  update public.reservations set commande_statut='preparation' where id=v_m.reservation_id;

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_m.id,v_m.reservation_id,v_m.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_m.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'reoffered','Mission remise à disposition des livreurs',trim(p_note));

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,'delivery_mission','Livraison remise à disposition',
    'Une livraison attend un livreur.',v_m.reservation_id,v_m.id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_m.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_reoffer(uuid,text) from public,anon;
grant execute on function public.naxa_delivery_reoffer(uuid,text) to authenticated;
commit;
