-- SM-01 points 2 et 3 — annulation transactionnelle et garde des RPC sensibles.
-- Versionné sur main uniquement. À appliquer et tester hors production avant toute activation.
begin;

alter table public.reservations
  add column if not exists preparation_statut text not null default 'non_commencee',
  add column if not exists preparation_demarre_le timestamptz,
  add column if not exists prete_au_retrait_le timestamptz;

alter table public.reservations
  drop constraint if exists reservations_preparation_statut_check;
alter table public.reservations
  add constraint reservations_preparation_statut_check
  check (preparation_statut in ('non_commencee','en_preparation','prete_au_retrait','annulee'));

comment on column public.reservations.preparation_statut is
  'État persistant de préparation physique; distinct du statut de paiement/retrait. Une réservation prête au retrait est protégée de l’annulation disciplinaire.';
comment on column public.reservations.preparation_demarre_le is
  'Horodatage du démarrage réel de préparation enregistré par la RPC pharmacie.';
comment on column public.reservations.prete_au_retrait_le is
  'Horodatage du marquage prêt au retrait enregistré par la RPC pharmacie.';

create table if not exists public.reservation_suspension_disciplinaire_audit (
  id bigint generated always as identity primary key,
  suspension_id uuid not null references public.promoteur_suspensions_disciplinaires(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('annulee','echec_annulation')),
  acteur_id uuid not null references public.profiles(id) on delete restrict,
  cree_le timestamptz not null default now(),
  avant jsonb not null,
  apres jsonb not null,
  erreur text
);
create index if not exists reservation_suspension_disc_audit_reservation_idx
  on public.reservation_suspension_disciplinaire_audit(reservation_id, cree_le desc);
create index if not exists reservation_suspension_disc_audit_suspension_idx
  on public.reservation_suspension_disciplinaire_audit(suspension_id, cree_le desc);
alter table public.reservation_suspension_disciplinaire_audit enable row level security;
revoke all on public.reservation_suspension_disciplinaire_audit from public, anon, authenticated;
grant all on public.reservation_suspension_disciplinaire_audit to service_role;

-- La préparation physique n'est jamais déduite de « confirmee » : elle est enregistrée explicitement.
create or replace function public.gestionnaire_stock_reservation_preparation(
  p_reservation uuid,
  p_etat text
) returns boolean
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_user uuid := auth.uid();
  v_r public.reservations%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if p_etat not in ('en_preparation','prete_au_retrait') then
    raise exception 'État de préparation invalide';
  end if;

  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode <> 'reservation' then
    raise exception 'Réservation introuvable';
  end if;
  if v_r.statut <> 'confirmee' then
    raise exception 'Seule une réservation confirmée peut entrer en préparation';
  end if;
  if not public.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Réservation hors périmètre pharmacie';
  end if;
  select * into v_profile from public.profiles where id=v_user and actif=true;
  if not found or not (
    coalesce(v_profile.role::text,'') in ('admin','promoteur')
    or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
    or public.naxa_has_privilege('MANAGE_LOTS',v_r.pharmacie_id,'PHARMACIE')
  ) then
    raise exception 'Action réservée à un rôle pharmacie autorisé';
  end if;

  if v_r.preparation_statut = 'prete_au_retrait' then
    if p_etat = 'prete_au_retrait' then return true; end if;
    raise exception 'Une réservation prête au retrait ne peut pas revenir en préparation';
  end if;
  if v_r.preparation_statut = 'annulee' then
    raise exception 'Réservation déjà annulée';
  end if;
  if p_etat = 'en_preparation' and v_r.preparation_statut = 'en_preparation' then
    return true;
  end if;
  if p_etat = 'prete_au_retrait' and v_r.preparation_statut <> 'en_preparation' then
    raise exception 'Démarrez la préparation avant de marquer la réservation prête';
  end if;

  update public.reservations
  set preparation_statut=p_etat,
      preparation_demarre_le=case when p_etat='en_preparation' then coalesce(preparation_demarre_le,now()) else preparation_demarre_le end,
      prete_au_retrait_le=case when p_etat='prete_au_retrait' then now() else prete_au_retrait_le end
  where id=p_reservation;
  return true;
end;
$fn$;
revoke all on function public.gestionnaire_stock_reservation_preparation(uuid,text) from public, anon;
grant execute on function public.gestionnaire_stock_reservation_preparation(uuid,text) to authenticated;

-- Renforce aussi l'annulation manuelle directe : la couche UI n'est pas une barrière de sécurité.
create or replace function public.gestionnaire_stock_reservation_annuler(p_reservation uuid)
returns boolean language plpgsql security definer set search_path=''
as $fn$
declare
  v_user uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_profile public.profiles%rowtype;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'reservation' then raise exception 'Réservation avec retrait introuvable'; end if;
  if not public.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE') then raise exception 'Réservation hors périmètre pharmacie'; end if;
  select * into v_profile from public.profiles where id=v_user and actif=true;
  if not found or not (
    coalesce(v_profile.role::text,'') in ('admin','promoteur')
    or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
    or public.naxa_has_privilege('MANAGE_LOTS',v_r.pharmacie_id,'PHARMACIE')
  ) then raise exception 'Annulation réservée à un rôle pharmacie autorisé'; end if;
  if v_r.preparation_statut='prete_au_retrait' then
    raise exception 'Une réservation prête au retrait est protégée contre l’annulation';
  end if;
  if v_r.statut not in ('en_attente','confirmee') then
    raise exception 'Seule une réservation active peut être annulée';
  end if;
  perform public.restore_stock(p_reservation);
  update public.reservations
  set statut='annulee'::public.resa_statut, preparation_statut='annulee'
  where id=p_reservation and statut in ('en_attente','confirmee');
  if not found then raise exception 'La réservation a changé pendant l’annulation'; end if;
  return true;
end;
$fn$;
revoke all on function public.gestionnaire_stock_reservation_annuler(uuid) from public, anon;
grant execute on function public.gestionnaire_stock_reservation_annuler(uuid) to authenticated;

-- Exécuté dans la transaction qui crée la sanction : les réservations éligibles et la sanction
-- sont atomiques. Un échec de restitution est isolé, audité et reste à réconcilier.
create or replace function private.naxa_annuler_reservations_suspendues()
returns trigger
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_r public.reservations%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_annulees integer := 0;
  v_echecs integer := 0;
begin
  if new.statut <> 'active' then return new; end if;

  for v_r in
    select r.*
    from public.reservations r
    where r.mode='reservation'
      and r.statut in ('en_attente','confirmee')
      and r.statut not in ('payee','retiree')
      and r.preparation_statut in ('non_commencee','en_preparation')
      and r.consumed_at is null
      and r.consumed_by_vente_id is null
      and exists (
        select 1
        from jsonb_array_elements(coalesce(new.perimetre_apres->'pharmacies','[]'::jsonb)) as pharmacy(item)
        where pharmacy.item->>'id'=r.pharmacie_id::text
      )
    order by r.pharmacie_id,r.id
    for update
  loop
    v_before := jsonb_build_object(
      'reservation_id',v_r.id,'statut',v_r.statut::text,
      'preparation_statut',v_r.preparation_statut,
      'stock_decremented',v_r.stock_decremented,
      'stock_restored',v_r.stock_restored,
      'consumed_at',v_r.consumed_at,
      'consumed_by_vente_id',v_r.consumed_by_vente_id
    );
    begin
      perform public.restore_stock(v_r.id);
      update public.reservations
      set statut='annulee'::public.resa_statut, preparation_statut='annulee'
      where id=v_r.id and statut in ('en_attente','confirmee');
      if not found then raise exception 'La réservation a changé pendant l’annulation'; end if;
      select jsonb_build_object(
        'reservation_id',r.id,'statut',r.statut::text,
        'preparation_statut',r.preparation_statut,
        'stock_decremented',r.stock_decremented,
        'stock_restored',r.stock_restored,
        'consumed_at',r.consumed_at,
        'consumed_by_vente_id',r.consumed_by_vente_id
      ) into v_after
      from public.reservations r where r.id=v_r.id;

      insert into public.reservation_suspension_disciplinaire_audit(
        suspension_id,reservation_id,promoteur_id,pharmacie_id,client_id,action,acteur_id,avant,apres
      ) values (
        new.id,v_r.id,new.promoteur_id,v_r.pharmacie_id,v_r.client_id,
        'annulee',new.suspendu_par,v_before,v_after
      );
      insert into public.notifications(user_id,type,titre,corps,reservation_id)
      values (
        v_r.client_id,'reservation_annulee_disciplinaire',
        'Réservation annulée',
        'Votre réservation #'||upper(left(replace(v_r.id::text,'-',''),8))||
        ' a été annulée à la suite d’une suspension disciplinaire de la pharmacie. Si un paiement POS avait été enregistré, contactez la pharmacie : aucun paiement validé n’est annulé automatiquement.',
        v_r.id
      );
      v_annulees := v_annulees+1;
    exception when others then
      -- La sous-transaction annule toute mutation de stock/statut/notification de cette réservation.
      insert into public.reservation_suspension_disciplinaire_audit(
        suspension_id,reservation_id,promoteur_id,pharmacie_id,client_id,action,acteur_id,avant,apres,erreur
      ) values (
        new.id,v_r.id,new.promoteur_id,v_r.pharmacie_id,v_r.client_id,
        'echec_annulation',new.suspendu_par,v_before,
        jsonb_build_object('reservation_id',v_r.id,'statut_apres',v_r.statut::text,'preparation_statut_apres',v_r.preparation_statut),
        left(sqlerrm,1000)
      );
      v_echecs := v_echecs+1;
    end;
  end loop;

  if v_annulees > 0 or v_echecs > 0 then
    insert into public.notifications(user_id,type,titre,corps)
    values (
      new.promoteur_id,'suspension_disciplinaire_reservations',
      case when v_echecs=0 then 'Réservations Marketplace annulées' else 'Réservations à réconcilier après suspension' end,
      'Traitement disciplinaire : '||v_annulees||' réservation(s) annulée(s), '||v_echecs||
      ' échec(s) journalisé(s). Les dossiers en échec nécessitent une réconciliation; les dossiers prêts au retrait, payés ou retirés ont été préservés.'
    );
  end if;
  return new;
end;
$fn$;

revoke all on function private.naxa_annuler_reservations_suspendues() from public, anon, authenticated;
drop trigger if exists naxa_suspension_disciplinaire_annuler_reservations on public.promoteur_suspensions_disciplinaires;
create trigger naxa_suspension_disciplinaire_annuler_reservations
after insert on public.promoteur_suspensions_disciplinaires
for each row execute function private.naxa_annuler_reservations_suspendues();

comment on function private.naxa_annuler_reservations_suspendues() is
  'À la création d’une suspension active, annule les réservations non payées en attente ou en préparation; préserve les dossiers prêts au retrait, payés et retirés; journalise chaque résultat.';

commit;
