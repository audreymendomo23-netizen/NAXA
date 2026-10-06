-- NAXA 022 — fermeture du périmètre Caisse
-- Additif / non destructif. La Caisse reste un opérateur de la pharmacie.

drop policy if exists stocks_write on public.stocks;
create policy stocks_write on public.stocks
for all
using (
  public.is_admin()
  or (
    pharmacie_id=public.my_pharmacie()
    and public.authorize('EDIT_STOCK_QUANTITY',pharmacie_id,'POSTE_CAISSE')
  )
)
with check (
  public.is_admin()
  or (
    pharmacie_id=public.my_pharmacie()
    and public.authorize('EDIT_STOCK_QUANTITY',pharmacie_id,'POSTE_CAISSE')
  )
);

create or replace function public.set_garde(p_garde boolean)
returns void language plpgsql security definer set search_path=''
as $naxa$
declare v_pharmacie uuid := public.my_pharmacie();
begin
  if v_pharmacie is null then raise exception 'Réservé aux comptes pharmacie actifs'; end if;
  if not public.authorize('MANAGE_GUARD_STATUS',v_pharmacie,'PHARMACIE') then
    raise exception 'Privilège de gestion de garde insuffisant';
  end if;
  update public.pharmacies set de_garde=p_garde where id=v_pharmacie;
end
$naxa$;
revoke all on function public.set_garde(boolean) from public,anon,authenticated;
grant execute on function public.set_garde(boolean) to authenticated;

create or replace function public.set_reservation_status(p_id uuid,p_statut resa_statut)
returns void language plpgsql security definer set search_path=''
as $naxa$
declare
  r public.reservations;
  v_uid uuid := (select auth.uid());
  v_pharmacie uuid;
  transition_ok boolean := false;
begin
  select * into r from public.reservations where id=p_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  v_pharmacie := r.pharmacie_id;

  if r.client_id=v_uid and p_statut='annulee' then
    transition_ok := true;
  elsif public.is_admin() then
    transition_ok := true;
  elsif v_pharmacie=public.my_pharmacie() then
    if p_statut='confirmee' then
      transition_ok := public.authorize('CONFIRM_RESERVATION',v_pharmacie,'PHARMACIE');
    elsif p_statut='payee' then
      transition_ok := public.authorize('CONFIRM_PAYMENT',v_pharmacie,'POSTE_CAISSE')
        or public.authorize('CONFIRM_PAYMENT',v_pharmacie,'PHARMACIE');
    elsif p_statut='retiree' then
      transition_ok := public.authorize('CONFIRM_WITHDRAWAL',v_pharmacie,'POSTE_CAISSE')
        or public.authorize('CONFIRM_WITHDRAWAL',v_pharmacie,'PHARMACIE');
    elsif p_statut='annulee' then
      transition_ok := public.authorize('CANCEL_RESERVATION',v_pharmacie,'POSTE_CAISSE')
        or public.authorize('CANCEL_RESERVATION',v_pharmacie,'PHARMACIE');
    elsif p_statut='expiree' then
      transition_ok := public.authorize('EXPIRE_RESERVATION',v_pharmacie,'POSTE_CAISSE')
        or public.authorize('EXPIRE_RESERVATION',v_pharmacie,'PHARMACIE');
    end if;
  end if;

  if not transition_ok then raise exception 'Action non autorisée'; end if;

  transition_ok := case
    when r.statut='en_attente' then p_statut in ('confirmee','payee','annulee','expiree')
    when r.statut='confirmee' then p_statut in ('payee','retiree','annulee','expiree')
    when r.statut='payee' then p_statut='retiree'
    else false
  end;
  if not transition_ok then raise exception 'Transition de réservation interdite: % -> %',r.statut,p_statut; end if;

  if p_statut in ('annulee','expiree') then perform public.restore_stock(p_id); end if;
  update public.reservations set statut=p_statut where id=p_id;
end
$naxa$;
revoke all on function public.set_reservation_status(uuid,resa_statut) from public,anon,authenticated;
grant execute on function public.set_reservation_status(uuid,resa_statut) to authenticated;

insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.architecture_code,'caisse',p.code
from (values ('ORPHELIN'),('PARENTS_ENFANTS'),('PARENTS_AINES_CADETS'),('HYBRIDE')) a(architecture_code)
join public.naxa_privileges p on p.code in (
 'VIEW_PHARMACY','VIEW_PRODUCTS','VIEW_STOCK','EDIT_STOCK_QUANTITY',
 'VIEW_RESERVATIONS','PROCESS_RESERVATION','CONFIRM_RESERVATION','CHANGE_RESERVATION_STATUS',
 'CANCEL_RESERVATION','VIEW_RESERVATION_HISTORY','VIEW_SALES','CREATE_SALE','CONFIRM_PAYMENT',
 'CONFIRM_WITHDRAWAL','VIEW_SALES_HISTORY','VIEW_CA','VIEW_CA_HISTORY','VIEW_PILOTAGE',
 'VIEW_CAISSE_PILOTAGE','VIEW_ACTIVITY_KPI','VIEW_ALERT_KPI','VIEW_REPORTS','VIEW_CAISSE_REPORT'
)
on conflict do nothing;

delete from public.naxa_architecture_privileges
where role_key='caisse'
and privilege_code in (
 'IMPORT_STOCK','VIEW_PURCHASE_COST','EDIT_PURCHASE_COST','VIEW_CURRENT_VALUATION','VIEW_MARGIN',
 'MANAGE_GUARD_STATUS','CREATE_CAISSE','MANAGE_CAISSES','SUSPEND_CAISSE','REACTIVATE_CAISSE',
 'ASSIGN_PRIVILEGE','REVOKE_PRIVILEGE','CREATE_RESPONSABLE','MANAGE_RESPONSABLES',
 'SUSPEND_RESPONSABLE','REACTIVATE_RESPONSABLE','CHANGE_ARCHITECTURE','VIEW_NETWORK_PILOTAGE',
 'VIEW_NETWORK_REPORT','EXPORT_NETWORK'
);

create or replace function public.stats_caisse_scope(p_jours integer default 7)
returns jsonb language plpgsql stable security definer set search_path=''
as $naxa$
declare
 uid uuid := (select auth.uid());
 pid uuid;
 debut timestamptz := now() - make_interval(days => greatest(1,least(coalesce(p_jours,7),365)));
begin
 select pharmacie_id into pid from public.profiles where id=uid and role='caisse' and actif=true;
 if pid is null then raise exception 'Accès Caisse refusé'; end if;
 if not public.authorize('VIEW_CAISSE_PILOTAGE',pid,'POSTE_CAISSE') then raise exception 'Pilotage Caisse non autorisé'; end if;
 return jsonb_build_object(
  'role','caisse','pharmacie_id',pid,'jours',greatest(1,least(coalesce(p_jours,7),365)),
  'evenements_reservation',coalesce((select count(*) from public.reservation_events e where e.actor_id=uid and e.occurred_at>=debut),0),
  'paiements',coalesce((select count(*) from public.reservation_events e where e.actor_id=uid and e.event_type='status_changed' and e.to_statut='payee' and e.occurred_at>=debut),0),
  'retraits',coalesce((select count(*) from public.reservation_events e where e.actor_id=uid and e.event_type='status_changed' and e.to_statut='retiree' and e.occurred_at>=debut),0),
  'annulations',coalesce((select count(*) from public.reservation_events e where e.actor_id=uid and e.event_type='status_changed' and e.to_statut='annulee' and e.occurred_at>=debut),0),
  'ca',coalesce((select sum(r.total)::int from public.reservations r join public.reservation_events e on e.reservation_id=r.id where e.actor_id=uid and e.event_type='status_changed' and e.to_statut in ('payee','retiree') and e.occurred_at>=debut),0)
 );
end
$naxa$;
revoke all on function public.stats_caisse_scope(integer) from public,anon,authenticated;
grant execute on function public.stats_caisse_scope(integer) to authenticated;
