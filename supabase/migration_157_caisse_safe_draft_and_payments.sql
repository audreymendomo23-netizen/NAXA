-- NAXA 157 — parcours Caisse : abandon sûr des paniers et paiements non simulés.
-- Additif : aucun déploiement ni changement de données n'est effectué par ce fichier.
begin;

create or replace function public.vente_brouillon_abandonner(p_vente uuid)
returns void
language plpgsql
security definer
set search_path=''
as $abandon$
declare
  v_vente public.ventes%rowtype;
  v_ligne record;
  v_session_statut public.caisse_cloture_statut;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  select * into v_vente
  from public.ventes
  where id=p_vente
  for update;

  if not found then
    raise exception 'Vente introuvable';
  end if;
  if v_vente.statut <> 'brouillon' then
    raise exception 'Seul un panier brouillon peut être abandonné';
  end if;
  if v_vente.created_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Seul le créateur du panier ou NAXA peut l’abandonner';
  end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  select cs.statut into v_session_statut
  from public.caisses_sessions cs
  where cs.id=v_vente.caisse_session_id
  for update;
  if v_session_statut is distinct from 'ouverte' then
    raise exception 'La session de caisse n’est pas ouverte';
  end if;

  if not public.is_admin() then
    select * into v_profile
    from public.profiles
    where id=auth.uid() and actif=true;
    if not found or v_profile.pharmacie_id is distinct from v_vente.pharmacie_id
       or (coalesce(v_profile.role::text,'') <> 'caisse' and coalesce(v_profile.fonction_interne,'') <> 'caisse') then
      raise exception 'Abandon réservé à un compte Caisse actif de cette pharmacie';
    end if;
  end if;

  -- Les quantités sont débitées lors de l'ajout au panier : les restituer une
  -- seule fois avant de marquer le brouillon annulé. Le verrou sur la vente
  -- empêche deux abandons concurrents de restituer deux fois le même stock.
  for v_ligne in
    select vl.produit_id, vl.lot_id, vl.quantite
    from public.vente_lignes vl
    where vl.vente_id=p_vente
    order by vl.id
    for update
  loop
    if v_ligne.lot_id is not null then
      update public.stocks_lots
      set quantite=quantite+v_ligne.quantite
      where id=v_ligne.lot_id
        and pharmacie_id=v_vente.pharmacie_id
        and produit_id=v_ligne.produit_id;
      if not found then
        raise exception 'Lot d’origine introuvable ; abandon annulé sans clôture';
      end if;
    end if;

    update public.stocks
    set quantite=quantite+v_ligne.quantite,
        updated_at=now()
    where pharmacie_id=v_vente.pharmacie_id
      and produit_id=v_ligne.produit_id;
    if not found then
      raise exception 'Stock agrégé d’origine introuvable ; abandon annulé sans clôture';
    end if;
  end loop;

  update public.ventes
  set statut='annulee'
  where id=p_vente and statut='brouillon';
  if not found then
    raise exception 'Le panier a changé de statut pendant l’abandon';
  end if;
end;
$abandon$;

revoke all on function public.vente_brouillon_abandonner(uuid) from public,anon,authenticated;
grant execute on function public.vente_brouillon_abandonner(uuid) to authenticated;

-- Une référence saisie manuellement n'est pas une confirmation opérateur.
-- Tant que l'intégration marchande vérifiée n'existe pas, ces modes sont refusés
-- côté base pour empêcher de finaliser un faux paiement électronique.
create or replace function public.vente_encaisser(
  p_vente uuid,
  p_mode public.mode_paiement_caisse,
  p_montant_percu integer,
  p_reference text default null
)
returns table(paiement_id uuid,montant_a_payer integer,monnaie_rendue integer)
language plpgsql
security definer
set search_path=''
as $encaisse$
declare
  v public.ventes%rowtype;
  v_id uuid;
  v_change integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant_percu is null or p_montant_percu<=0 then raise exception 'Montant perçu invalide'; end if;

  if p_mode in ('orange_money','mtn_momo','mobile_money') then
    raise exception 'Paiement électronique indisponible : aucune confirmation opérateur officielle n’est intégrée';
  end if;

  select * into v from public.ventes where id=p_vente for update;
  if not found or v.statut<>'brouillon' then raise exception 'Vente invalide ou déjà finalisée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  if not exists(select 1 from public.vente_lignes where vente_id=p_vente) then raise exception 'Vente vide'; end if;

  if p_mode='especes' and p_montant_percu<v.total_net then
    raise exception 'Montant espèces insuffisant';
  end if;
  if p_mode<>'especes' and p_montant_percu<>v.total_net then
    raise exception 'Pour ce mode, le montant perçu doit correspondre exactement au total';
  end if;

  v_change:=case when p_mode='especes' then greatest(p_montant_percu-v.total_net,0) else 0 end;
  insert into public.vente_paiements(vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue)
  values(p_vente,p_mode,v.total_net,nullif(trim(p_reference),''),auth.uid(),p_montant_percu,v_change)
  returning id into v_id;
  return query select v_id,v.total_net,v_change;
end;
$encaisse$;

revoke all on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) from public,anon,authenticated;
grant execute on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) to authenticated;

-- Ferme également la voie historique d'encaissement par paiement fractionné.
create or replace function public.vente_ajouter_paiement(
  p_vente uuid,
  p_mode public.mode_paiement_caisse,
  p_montant integer,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $paiement$
declare
  v_vente public.ventes%rowtype;
  v_id uuid;
  v_deja integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant is null or p_montant<=0 then raise exception 'Montant de paiement invalide'; end if;
  if p_mode in ('orange_money','mtn_momo','mobile_money') then
    raise exception 'Paiement électronique indisponible : aucune confirmation opérateur officielle n’est intégrée';
  end if;

  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then raise exception 'Vente introuvable ou déjà clôturée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  select coalesce(sum(montant),0) into v_deja from public.vente_paiements where vente_id=p_vente;
  if v_deja+p_montant>v_vente.total_net then raise exception 'Le paiement dépasse le total de la vente'; end if;
  insert into public.vente_paiements(vente_id,mode,montant,reference,created_by)
  values(p_vente,p_mode,p_montant,nullif(trim(p_reference),''),auth.uid())
  returning id into v_id;
  return v_id;
end;
$paiement$;

revoke all on function public.vente_ajouter_paiement(uuid,public.mode_paiement_caisse,integer,text) from public,anon,authenticated;
grant execute on function public.vente_ajouter_paiement(uuid,public.mode_paiement_caisse,integer,text) to authenticated;


-- Encaissement espèces atomique : paiement et passage de la vente à payée
-- sont validés dans la même transaction pour éviter un paiement orphelin.
create or replace function public.vente_encaisser_finaliser(
  p_vente uuid,
  p_montant_percu integer
)
returns table(paiement_id uuid,montant_a_payer integer,monnaie_rendue integer)
language plpgsql
security definer
set search_path=''
as $encaisse_final$
declare
  v_vente public.ventes%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_id uuid;
  v_change integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant_percu is null or p_montant_percu<=0 then
    raise exception 'Montant espèces invalide';
  end if;

  select * into v_vente
  from public.ventes
  where id=p_vente
  for update;
  if not found or v_vente.statut<>'brouillon' then
    raise exception 'Vente introuvable ou déjà finalisée';
  end if;

  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  if not exists (
    select 1 from public.pharmacies ph
    where ph.id=v_vente.pharmacie_id
      and ph.actif=true
      and ph.visible_recherche=true
  ) then
    raise exception 'La pharmacie est inactive ou non publiée';
  end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=v_vente.caisse_session_id
    and cs.statut='ouverte'
    and (public.is_admin() or cs.ouvert_par=auth.uid())
    and c.actif=true
    and c.pharmacie_id=v_vente.pharmacie_id
  for update of cs;
  if not found then
    raise exception 'Session de caisse fermée ou inactive';
  end if;

  if not public.is_admin() and not exists (
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.actif=true
      and p.pharmacie_id=v_vente.pharmacie_id
      and (p.role::text='caisse' or p.fonction_interne='caisse')
  ) then
    raise exception 'Encaissement réservé à un compte Caisse actif de cette pharmacie';
  end if;

  if not exists(select 1 from public.vente_lignes where vente_id=p_vente) then
    raise exception 'Vente vide';
  end if;
  if exists(select 1 from public.vente_paiements where vente_id=p_vente) then
    raise exception 'Un paiement est déjà enregistré pour cette vente ; aucun second encaissement ne sera ajouté';
  end if;
  if p_montant_percu<v_vente.total_net then
    raise exception 'Montant espèces insuffisant';
  end if;

  v_change:=greatest(p_montant_percu-v_vente.total_net,0);
  insert into public.vente_paiements(
    vente_id,mode,montant,created_by,montant_percu,monnaie_rendue
  )
  values(
    p_vente,'especes',v_vente.total_net,auth.uid(),p_montant_percu,v_change
  )
  returning id into v_id;

  update public.ventes
  set statut='payee',
      mode_paiement='especes',
      paiement_ref=null,
      paid_at=now()
  where id=p_vente and statut='brouillon';
  if not found then
    raise exception 'La vente a changé de statut pendant l’encaissement';
  end if;

  return query select v_id,v_vente.total_net,v_change;
end;
$encaisse_final$;

revoke all on function public.vente_encaisser_finaliser(uuid,integer) from public,anon,authenticated;
grant execute on function public.vente_encaisser_finaliser(uuid,integer) to authenticated;


-- Les RPC historiques s'appuient sur can_operate_pharmacy, qui est un contrôle
-- de périmètre et non un rôle de caisse. Ces gardes empêchent une autre équipe
-- de créer des ventes, d'ajouter des lignes ou d'enregistrer des paiements dans
-- le poste Caisse, y compris via un appel direct aux anciennes RPC.
create or replace function public.naxa_caisse_actor_for_pharmacy(p_pharmacie uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $actor$
  select exists (
    select 1
    from public.pharmacies ph
    where ph.id=p_pharmacie
      and ph.actif=true
      and ph.visible_recherche=true
  )
  and (
    public.is_admin()
    or (
      exists (
        select 1
        from public.profiles p
        where p.id=(select auth.uid())
          and p.actif=true
          and p.pharmacie_id=p_pharmacie
          and (p.role::text='caisse' or p.fonction_interne='caisse')
      )
      and public.can_operate_pharmacy(p_pharmacie)
    )
  );
$actor$;

revoke all on function public.naxa_caisse_actor_for_pharmacy(uuid) from public,anon,authenticated;

create or replace function public.naxa_guard_caisse_session_write()
returns trigger
language plpgsql
security definer
set search_path=''
as $guard$
declare
  v_pharmacie uuid;
  v_cash integer;
  v_theorique integer;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  select c.pharmacie_id into v_pharmacie
  from public.caisses c
  where c.id=new.caisse_id;
  if not public.naxa_caisse_actor_for_pharmacy(v_pharmacie) then
    raise exception 'Session réservée à une Caisse active de cette pharmacie';
  end if;

  if tg_op='INSERT' then
    if new.ouvert_par is distinct from auth.uid()
       or not exists(select 1 from public.caisses c where c.id=new.caisse_id and c.actif=true) then
      raise exception 'Ouverture réservée à la Caisse active qui la demande';
    end if;
  elsif tg_op='UPDATE' then
    if new.caisse_id is distinct from old.caisse_id
       or new.ouvert_par is distinct from old.ouvert_par
       or new.fond_initial is distinct from old.fond_initial
       or new.ouvert_at is distinct from old.ouvert_at then
      raise exception 'Les paramètres d’ouverture de session sont immuables';
    end if;
    if old.statut<>'ouverte' or new.statut<>'cloturee' then
      raise exception 'Une session ouverte ne peut être modifiée que par une clôture contrôlée';
    end if;
    if old.ouvert_par is distinct from auth.uid() or new.cloture_par is distinct from auth.uid()
       or new.cloture_at is null or new.total_compte is null then
      raise exception 'Seul l’ouvreur de la session peut enregistrer la clôture';
    end if;

    select coalesce(sum(
      case
        when pay.nb>0 then pay.cash
        when pay.nb=0 and v.mode_paiement='especes' then v.total_net
        else 0
      end
    ),0)::integer into v_cash
    from public.ventes v
    left join lateral (
      select coalesce(sum(vp.montant) filter (where vp.mode='especes'),0)::integer as cash,
             count(*) as nb
      from public.vente_paiements vp
      where vp.vente_id=v.id
    ) pay on true
    where v.caisse_session_id=old.id and v.statut='payee';

    v_theorique:=old.fond_initial+coalesce(v_cash,0);
    if new.total_theorique is distinct from v_theorique
       or new.ecart is distinct from (new.total_compte-v_theorique) then
      raise exception 'Le rapprochement de clôture ne correspond pas aux paiements enregistrés';
    end if;
  end if;
  return new;
end;
$guard$;

revoke all on function public.naxa_guard_caisse_session_write() from public,anon,authenticated;
drop trigger if exists trg_naxa_guard_caisse_session_write on public.caisses_sessions;
create trigger trg_naxa_guard_caisse_session_write
before insert or update on public.caisses_sessions
for each row execute function public.naxa_guard_caisse_session_write();

create or replace function public.naxa_guard_pos_vente_write()
returns trigger
language plpgsql
security definer
set search_path=''
as $guard$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op='INSERT' then
    -- Sérialise la création de brouillon par poste afin d'éviter les doubles
    -- clics concurrents avant le contrôle d'un panier déjà ouvert.
    perform 1 from public.caisses_sessions cs
    where cs.id=new.caisse_session_id
    for update;

    if new.statut<>'brouillon'
       or new.created_by is distinct from auth.uid()
       or not public.naxa_caisse_actor_for_pharmacy(new.pharmacie_id)
       or not exists (
         select 1 from public.caisses_sessions cs
         where cs.id=new.caisse_session_id
           and cs.statut='ouverte'
           and cs.ouvert_par=auth.uid()
           and exists(select 1 from public.caisses c where c.id=cs.caisse_id and c.pharmacie_id=new.pharmacie_id and c.actif=true)
       )
       or exists (
         select 1 from public.ventes v
         where v.caisse_session_id=new.caisse_session_id
           and v.created_by=auth.uid()
           and v.statut='brouillon'
       ) then
      raise exception 'Création de vente réservée à une session ouverte du compte Caisse actif';
    end if;
  elsif new.statut='payee' and old.statut is distinct from 'payee' then
    if new.created_by is distinct from auth.uid()
       or not public.naxa_caisse_actor_for_pharmacy(new.pharmacie_id)
       or not exists (
         select 1 from public.caisses_sessions cs
         where cs.id=new.caisse_session_id and cs.statut='ouverte' and cs.ouvert_par=auth.uid()
       ) then
      raise exception 'Finalisation réservée au créateur Caisse dans une session ouverte';
    end if;
  end if;
  return new;
end;
$guard$;

revoke all on function public.naxa_guard_pos_vente_write() from public,anon,authenticated;
drop trigger if exists trg_naxa_guard_pos_vente_insert on public.ventes;
create trigger trg_naxa_guard_pos_vente_insert
before insert on public.ventes
for each row execute function public.naxa_guard_pos_vente_write();
drop trigger if exists trg_naxa_guard_pos_vente_finalize on public.ventes;
create trigger trg_naxa_guard_pos_vente_finalize
before update of statut on public.ventes
for each row execute function public.naxa_guard_pos_vente_write();

create or replace function public.naxa_guard_pos_line_write()
returns trigger
language plpgsql
security definer
set search_path=''
as $guard$
declare
  v_vente public.ventes%rowtype;
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op<>'INSERT' then
    raise exception 'Les lignes POS ne peuvent pas être modifiées directement';
  end if;

  select * into v_vente from public.ventes where id=new.vente_id;
  if not found or v_vente.statut<>'brouillon'
     or v_vente.created_by is distinct from auth.uid()
     or not public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)
     or not exists (
       select 1 from public.caisses_sessions cs
       where cs.id=v_vente.caisse_session_id
         and cs.statut='ouverte'
         and cs.ouvert_par=auth.uid()
     ) then
    raise exception 'Ajout de ligne réservé au créateur Caisse dans une session ouverte qui lui appartient';
  end if;
  return new;
end;
$guard$;

revoke all on function public.naxa_guard_pos_line_write() from public,anon,authenticated;
drop trigger if exists trg_naxa_guard_pos_line_write on public.vente_lignes;
create trigger trg_naxa_guard_pos_line_write
before insert or update or delete on public.vente_lignes
for each row execute function public.naxa_guard_pos_line_write();

create or replace function public.naxa_guard_pos_payment_write()
returns trigger
language plpgsql
security definer
set search_path=''
as $guard$
declare
  v_vente public.ventes%rowtype;
begin
  if auth.uid() is null or public.is_admin() then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op<>'INSERT' then
    raise exception 'Les paiements POS ne peuvent pas être modifiés directement';
  end if;

  select * into v_vente from public.ventes where id=new.vente_id;
  if not found or v_vente.statut<>'brouillon'
     or v_vente.created_by is distinct from auth.uid()
     or not public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)
     or not exists (
       select 1 from public.caisses_sessions cs
       where cs.id=v_vente.caisse_session_id
         and cs.statut='ouverte'
         and cs.ouvert_par=auth.uid()
     ) then
    raise exception 'Paiement réservé au créateur Caisse dans une session ouverte qui lui appartient';
  end if;
  return new;
end;
$guard$;

revoke all on function public.naxa_guard_pos_payment_write() from public,anon,authenticated;
drop trigger if exists trg_naxa_guard_pos_payment_write on public.vente_paiements;
create trigger trg_naxa_guard_pos_payment_write
before insert or update or delete on public.vente_paiements
for each row execute function public.naxa_guard_pos_payment_write();


-- Le navigateur ne doit jamais écrire directement les tables comptables :
-- les mutations passent par les RPC contrôlées et les déclencheurs ci-dessus.
-- Les droits SELECT existants restent inchangés pour l'écran et l'historique.
revoke insert, update, delete on public.caisses_sessions from public,anon,authenticated;
revoke insert, update, delete on public.ventes from public,anon,authenticated;
revoke insert, update, delete on public.vente_lignes from public,anon,authenticated;
revoke insert, update, delete on public.vente_paiements from public,anon,authenticated;

commit;
