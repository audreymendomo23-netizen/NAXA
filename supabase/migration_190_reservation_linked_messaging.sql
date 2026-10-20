-- NAXA 190 — conversation Marketplace liée à une réservation précise.
begin;
alter table public.messages_pharmacie
  add column if not exists reservation_id uuid references public.reservations(id) on delete set null;
create index if not exists messages_pharmacie_reservation_idx
  on public.messages_pharmacie(reservation_id, created_at desc)
  where reservation_id is not null;

create or replace function public.envoyer_message_reservation(
  p_reservation uuid,
  p_corps text,
  p_anonyme boolean default true
)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_pharmacie uuid;
  v_statut text;
  v_mode text;
  v_fil uuid;
  v_nom text;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if char_length(trim(coalesce(p_corps,''))) not between 1 and 1000 then raise exception 'Message invalide'; end if;
  select r.pharmacie_id, r.statut::text, r.mode::text
    into v_pharmacie, v_statut, v_mode
  from public.reservations r
  where r.id=p_reservation and r.client_id=v_user
  for update;
  if not found then raise exception 'Réservation introuvable ou accès refusé'; end if;
  if v_mode <> 'reservation' then raise exception 'Cette messagerie est réservée aux réservations avec retrait en pharmacie'; end if;
  if v_statut in ('annulee','expiree','retiree') then raise exception 'Cette réservation est terminée; la messagerie transactionnelle est fermée'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.role='client') then raise exception 'Rôle client requis'; end if;

  insert into public.fils_messages(pharmacie_id,client_id,anonyme)
  values(v_pharmacie,v_user,coalesce(p_anonyme,true))
  on conflict(client_id,pharmacie_id) do update
    set anonyme=excluded.anonyme
  returning id into v_fil;

  insert into public.messages_pharmacie(fil_id,expediteur,corps,reservation_id)
  values(v_fil,'client',trim(p_corps),p_reservation);

  select coalesce(nullif(trim(p.first_name),''),'Client') into v_nom
  from public.profiles p where p.id=v_user;
  insert into public.notifications(pharmacie_id,type,titre,corps,fil_id,reservation_id)
  values(v_pharmacie,'message','Message concernant une réservation',
    left((case when coalesce(p_anonyme,true) then 'Client anonyme · ' else coalesce(v_nom,'Client') || ' · ' end)
      || 'Réservation #' || upper(left(replace(p_reservation::text,'-',''),8)) || ' : ' || trim(p_corps),1000),
    v_fil,p_reservation);
  return v_fil;
end;
$function$;
revoke all on function public.envoyer_message_reservation(uuid,text,boolean) from public, anon;
grant execute on function public.envoyer_message_reservation(uuid,text,boolean) to authenticated;
comment on function public.envoyer_message_reservation(uuid,text,boolean) is
  'Envoie un message in-app côté client lié au dossier de réservation et notifie la pharmacie; pas de SMS/WhatsApp automatique.';
commit;
