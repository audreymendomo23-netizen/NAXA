-- NAXA 264 — approbation crédit Marketplace : débit physique atomique, droits Responsable et affectations permanentes.
-- Migration additive. À appliquer d'abord sur l'environnement de test ; aucune application Production dans ce chantier.
begin;

-- 1) L'affectation ordinaire est permanente ; l'urgence seule porte une expiration.
alter table public.naxa_professional_assignments
  add column if not exists nature_affectation text;

update public.naxa_professional_assignments
set nature_affectation = case when expire_at is null then 'ordinaire' else 'urgence' end
where nature_affectation is null;

alter table public.naxa_professional_assignments
  alter column nature_affectation set default 'ordinaire',
  alter column nature_affectation set not null,
  alter column expire_at drop not null;

alter table public.naxa_professional_assignments
  drop constraint if exists naxa_professional_assignment_period_ck,
  drop constraint if exists naxa_professional_assignment_nature_ck;

alter table public.naxa_professional_assignments
  add constraint naxa_professional_assignment_nature_ck check (
    (nature_affectation = 'ordinaire' and expire_at is null)
    or
    (nature_affectation = 'urgence' and expire_at is not null and expire_at > commence_at)
  );

-- 2) Le périmètre PHARMACIE suit les affectations professionnelles actives,
--    y compris pour un Responsable affecté à plusieurs pharmacies du même réseau.
create or replace function private.naxa_scope_allows(
  p_profile uuid,
  p_pharmacie uuid,
  p_scope text default 'PHARMACIE'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
select case
  when p_profile is null then false
  when p_scope = 'RESEAU' then
    private.naxa_promoteur_valide(p_profile)
    and exists (
      select 1 from public.profiles p
      where p.id = p_profile and p.actif and p.role::text = 'promoteur'
    )
    and exists (
      select 1 from public.promoteur_pharmacies pp
      where pp.promoteur_id = p_profile
        and pp.actif
        and (p_pharmacie is null or pp.pharmacie_id = p_pharmacie)
    )
  when p_scope = 'PHARMACIE' then
    exists (
      select 1 from public.profiles p
      where p.id = p_profile and p.actif and p.role::text = 'admin'
    )
    or (
      private.naxa_promoteur_valide(p_profile)
      and exists (
        select 1 from public.profiles p
        where p.id = p_profile and p.actif and p.role::text = 'promoteur'
      )
      and exists (
        select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id = p_profile and pp.pharmacie_id = p_pharmacie and pp.actif
      )
    )
    or exists (
      select 1 from public.profiles p
      where p.id = p_profile and p.actif and p.role::text <> 'promoteur'
        and p.pharmacie_id = p_pharmacie
    )
    or exists (
      select 1
      from public.naxa_professional_assignments a
      join public.profiles p on p.id = a.profile_id and p.actif = true
      join public.pharmacies ph on ph.id = a.pharmacie_id and ph.actif = true
      where a.profile_id = p_profile
        and a.pharmacie_id = p_pharmacie
        and a.statut = 'active'
        and a.commence_at <= now()
        and (a.expire_at is null or a.expire_at > now())
    )
  when p_scope = 'POSTE_CAISSE' then
    exists (
      select 1 from public.profiles p
      where p.id = p_profile and p.actif
        and (
          (p.role::text = 'admin')
          or (p.role::text = 'caisse' and p.pharmacie_id = p_pharmacie)
          or exists (
            select 1 from public.naxa_professional_assignments a
            where a.profile_id = p.id
              and a.pharmacie_id = p_pharmacie
              and a.fonction = 'caisse'
              and a.statut = 'active'
              and a.commence_at <= now()
              and (a.expire_at is null or a.expire_at > now())
          )
        )
    )
  else false
end
$function$;

-- 3) Autoriser le Promoteur à gérer les droits de son Responsable sur les autres
--    pharmacies de son réseau ; un Responsable délégué garde son périmètre affecté.
create or replace function private.naxa_can_manage_privilege_target(
  p_target uuid,
  p_pharmacie uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles actor
    join public.profiles target on target.id = p_target
    where actor.id = (select auth.uid())
      and actor.actif
      and target.actif
      and p_target <> actor.id
      and (
        (
          public.naxa_business_function(actor.id) = 'promoteur'
          and target.parent_profile_id = actor.id
          and public.naxa_business_function(target.id) in ('responsable','caisse')
          and exists (
            select 1 from public.promoteur_pharmacies pp
            where pp.promoteur_id = actor.id
              and pp.pharmacie_id = p_pharmacie
              and pp.actif
          )
          and (
            target.pharmacie_id = p_pharmacie
            or public.naxa_business_function(target.id) = 'responsable'
          )
        )
        or
        (
          public.naxa_business_function(actor.id) = 'responsable'
          and target.parent_profile_id = actor.id
          and public.naxa_business_function(target.id) = 'caisse'
          and (
            target.pharmacie_id = p_pharmacie
            or exists (
              select 1 from public.naxa_professional_assignments a
              where a.profile_id = actor.id
                and a.pharmacie_id = p_pharmacie
                and a.fonction = 'responsable'
                and a.statut = 'active'
                and a.commence_at <= now()
                and (a.expire_at is null or a.expire_at > now())
            )
          )
        )
      )
  )
$function$;

-- 4) Aligner les fonctions d'affectation avec les périodes permanentes/urgentes.
create or replace function public.naxa_has_active_professional_assignment(
  p_profile uuid,
  p_pharmacie uuid,
  p_fonction text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_profile is not null
    and p_pharmacie is not null
    and p_fonction is not null
    and (p_profile = (select auth.uid()) or (select public.is_admin()))
    and exists (
      select 1
      from public.naxa_professional_assignments a
      join public.profiles p on p.id = a.profile_id and p.actif = true
      join public.pharmacies ph on ph.id = a.pharmacie_id and ph.actif = true
      where a.profile_id = p_profile
        and a.pharmacie_id = p_pharmacie
        and a.fonction = p_fonction
        and a.statut = 'active'
        and a.commence_at <= now()
        and (a.expire_at is null or a.expire_at > now())
    );
$function$;

revoke all on function public.naxa_has_active_professional_assignment(uuid,uuid,text) from public, anon;
grant execute on function public.naxa_has_active_professional_assignment(uuid,uuid,text) to authenticated;

create or replace function public.naxa_grant_professional_assignment(
  p_target uuid,
  p_pharmacie uuid,
  p_fonction text,
  p_commence_at timestamptz,
  p_expire_at timestamptz,
  p_motif text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
  v_profile public.profiles%rowtype;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target = v_actor then
    raise exception 'Cible ou pharmacie invalide';
  end if;
  if p_fonction not in ('caisse','gestionnaire_stock','magasinier','pharmacien','responsable','comptable') then
    raise exception 'Fonction non autorisée';
  end if;
  if p_commence_at is null
     or (p_expire_at is not null and (p_expire_at <= p_commence_at or p_expire_at <= now())) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif)) < 5 or length(trim(p_motif)) > 500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_target and actif = true
  for update;
  if not found then raise exception 'Le compte cible doit être actif'; end if;

  if not exists (
    select 1
    from public.profiles p
    join public.promoteur_pharmacies pp on pp.promoteur_id = p.id
    join public.pharmacies ph on ph.id = pp.pharmacie_id
    where p.id = v_actor
      and p.role::text = 'promoteur'
      and p.actif = true
      and pp.pharmacie_id = p_pharmacie
      and pp.actif = true
      and ph.actif = true
  ) then raise exception 'Pharmacie hors réseau Promoteur ou inactive'; end if;

  if not public.naxa_can('ASSIGN_USER_TO_PHARMACY', p_pharmacie, p_target) then
    raise exception 'Permission ASSIGN_USER_TO_PHARMACY refusée';
  end if;

  if exists (
    select 1
    from public.naxa_professional_assignments a
    where a.profile_id = p_target
      and a.pharmacie_id = p_pharmacie
      and a.fonction = p_fonction
      and a.statut = 'active'
      and a.commence_at < coalesce(p_expire_at, 'infinity'::timestamptz)
      and coalesce(a.expire_at, 'infinity'::timestamptz) > p_commence_at
  ) then
    raise exception 'Une affectation de cette fonction chevauche déjà la période';
  end if;

  insert into public.naxa_professional_assignments(
    profile_id, pharmacie_id, fonction, statut, nature_affectation,
    motif, commence_at, expire_at, accorde_par
  ) values (
    p_target, p_pharmacie, p_fonction, 'active',
    case when p_expire_at is null then 'ordinaire' else 'urgence' end,
    trim(p_motif), p_commence_at, p_expire_at, v_actor
  ) returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) from public, anon;
grant execute on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated;

create or replace function public.naxa_revoke_professional_assignment(
  p_assignment uuid,
  p_motif text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_assignment public.naxa_professional_assignments%rowtype;
  v_primary_pharmacy uuid;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_motif is null or length(trim(p_motif)) < 5 or length(trim(p_motif)) > 500 then
    raise exception 'Motif de révocation obligatoire';
  end if;

  select * into v_assignment
  from public.naxa_professional_assignments
  where id = p_assignment and statut = 'active'
  for update;
  if not found then raise exception 'Affectation active introuvable'; end if;

  if not exists (
    select 1
    from public.profiles p
    join public.promoteur_pharmacies pp on pp.promoteur_id = p.id
    where p.id = v_actor
      and p.role::text = 'promoteur'
      and p.actif = true
      and pp.pharmacie_id = v_assignment.pharmacie_id
      and pp.actif = true
  ) and not public.is_admin() then
    raise exception 'Révocation hors périmètre autorisé';
  end if;

  update public.naxa_professional_assignments
  set statut = 'revoked',
      revoque_par = v_actor,
      revoque_at = now(),
      motif_revocation = trim(p_motif)
  where id = p_assignment;

  select pharmacie_id into v_primary_pharmacy
  from public.profiles
  where id = v_assignment.profile_id;

  if v_assignment.fonction = 'responsable'
     and v_primary_pharmacy is distinct from v_assignment.pharmacie_id
     and not exists (
       select 1
       from public.naxa_professional_assignments a
       where a.profile_id = v_assignment.profile_id
         and a.pharmacie_id = v_assignment.pharmacie_id
         and a.fonction = 'responsable'
         and a.statut = 'active'
         and a.commence_at <= now()
         and (a.expire_at is null or a.expire_at > now())
     ) then
    update public.naxa_profile_privileges
    set active = false, revoked_at = now()
    where profile_id = v_assignment.profile_id
      and pharmacie_id = v_assignment.pharmacie_id
      and privilege_code = 'APPROVE_MARKETPLACE_CREDIT'
      and scope_type = 'PHARMACIE'
      and active = true
      and revoked_at is null;
  end if;

  return true;
end;
$function$;

revoke all on function public.naxa_revoke_professional_assignment(uuid,text) from public, anon;
grant execute on function public.naxa_revoke_professional_assignment(uuid,text) to authenticated;

-- 5) Droit dédié : disponible uniquement à un Responsable N2 des architectures 3/4,
--    et attribuable individuellement par le Promoteur.
insert into public.naxa_privileges(
  code, family, description, niveau_min, niveau_max, delegable,
  governance, active, famille, libelle, governance_only
)
values (
  'APPROVE_MARKETPLACE_CREDIT', 'CREDIT',
  'Approuver une demande de crédit Marketplace dans une pharmacie explicitement affectée',
  2, 2, true, false, true, 'CREDIT',
  'Approuver un crédit Marketplace', false
)
on conflict (code) do update set
  family = excluded.family,
  description = excluded.description,
  niveau_min = excluded.niveau_min,
  niveau_max = excluded.niveau_max,
  delegable = excluded.delegable,
  governance = false,
  active = true,
  famille = excluded.famille,
  libelle = excluded.libelle,
  governance_only = false;

insert into public.naxa_architecture_privileges(architecture_code, role_key, privilege_code)
values
  ('PARENTS_AINES_CADETS', 'responsable', 'APPROVE_MARKETPLACE_CREDIT'),
  ('HYBRIDE', 'responsable', 'APPROVE_MARKETPLACE_CREDIT')
on conflict do nothing;

-- 6) Contrôle serveur dédié à l'approbation : Promoteur valide, Admin ou Responsable
--    dont l'affectation et le privilège explicite correspondent à cette pharmacie.
create or replace function private.naxa_actor_can_approve_marketplace_credit(
  p_pharmacie uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_function text;
begin
  if v_actor is null or p_pharmacie is null then return false; end if;
  if public.is_admin() then return true; end if;

  v_function := public.naxa_business_function(v_actor);
  if v_function = 'promoteur' then
    return private.naxa_scope_allows(v_actor, p_pharmacie, 'PHARMACIE');
  end if;
  if v_function <> 'responsable' then return false; end if;

  return exists (
    select 1
    from public.profiles actor
    join public.promoteur_pharmacies network
      on network.promoteur_id = actor.parent_profile_id
     and network.pharmacie_id = p_pharmacie
     and network.actif = true
    join public.pharmacies ph
      on ph.id = network.pharmacie_id and ph.actif = true
    join public.pharmacie_architectures pa
      on pa.pharmacie_id = ph.id and pa.active = true
    join public.naxa_architecture_privileges ap
      on ap.architecture_code = pa.architecture_code
     and ap.role_key = 'responsable'
     and ap.privilege_code = 'APPROVE_MARKETPLACE_CREDIT'
    join public.naxa_privileges privilege
      on privilege.code = ap.privilege_code
     and privilege.active = true
     and privilege.delegable = true
     and privilege.governance = false
     and privilege.governance_only = false
    join public.naxa_profile_privileges assigned
      on assigned.profile_id = actor.id
     and assigned.privilege_code = privilege.code
     and assigned.pharmacie_id = ph.id
     and assigned.scope_type = 'PHARMACIE'
     and assigned.active = true
     and assigned.revoked_at is null
    where actor.id = v_actor
      and actor.actif = true
      and actor.role::text = 'pharmacie'
      and actor.fonction_interne = 'responsable'
      and actor.niveau_interne = 2
      and private.naxa_promoteur_valide(actor.parent_profile_id)
      and (
        actor.pharmacie_id = ph.id
        or exists (
          select 1
          from public.naxa_professional_assignments a
          where a.profile_id = actor.id
            and a.pharmacie_id = ph.id
            and a.fonction = 'responsable'
            and a.statut = 'active'
            and a.commence_at <= now()
            and (a.expire_at is null or a.expire_at > now())
            and a.accorde_par = actor.parent_profile_id
        )
      )
  );
end;
$function$;

revoke all on function private.naxa_actor_can_approve_marketplace_credit(uuid) from public, anon, authenticated;

create or replace function public.naxa_can_approve_marketplace_credit(
  p_pharmacie uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.naxa_actor_can_approve_marketplace_credit($1)
$function$;

revoke all on function public.naxa_can_approve_marketplace_credit(uuid) from public, anon;
grant execute on function public.naxa_can_approve_marketplace_credit(uuid) to authenticated;

-- 7) L'approbation Marketplace crée l'ordre, affecte les lots FEFO et débite
--    physiquement les lots + le stock agrégé dans une seule transaction.
create or replace function public.client_credit_demande_decider(
  p_demande uuid,
  p_approuver boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.client_credit_requests%rowtype;
  c public.client_credits%rowtype;
  v_reservation uuid;
  v_total integer;
  v_item record;
  v_lot record;
  v_need integer;
  v_take integer;
  v_unallocated integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select * into r
  from public.client_credit_requests
  where id = p_demande
  for update;

  if not found or r.statut <> 'en_attente' then
    raise exception 'Demande introuvable ou déjà traitée';
  end if;

  if r.origine = 'marketplace' then
    if not private.naxa_actor_can_approve_marketplace_credit(r.pharmacie_id) then
      raise exception 'Approbation réservée au Promoteur, à NAXA ou à un Responsable expressément autorisé';
    end if;
  elsif public.is_admin() is not true and not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.actif
      and p.role::text = 'promoteur'
      and p.niveau_interne = 1
  ) then
    raise exception 'Décision réservée au Promoteur ou à NAXA';
  end if;

  if r.origine <> 'marketplace'
     and not public.is_admin()
     and not public.can_access_pharmacy(r.pharmacie_id) then
    raise exception 'Pharmacie hors périmètre';
  end if;

  if not p_approuver then
    update public.client_credit_requests
    set statut = 'rejetee', decided_by = auth.uid(), decided_at = now()
    where id = r.id;
    return;
  end if;

  if r.origine = 'marketplace' then
    if r.panier_items is null or r.reservation_id is not null then
      raise exception 'Panier de crédit absent ou demande déjà réservée';
    end if;

    select * into c
    from public.client_credits
    where id = r.credit_id
    for update;

    if not found or not c.actif or c.solde > 0 then
      raise exception 'Le crédit client a changé depuis la soumission';
    end if;

    if exists (
      select 1
      from public.client_credit_requests q
      where q.client_id = r.client_id
        and q.id <> r.id
        and q.statut in ('en_attente','approuvee')
        and q.consumed_at is null
    ) then
      raise exception 'Une autre demande de crédit est déjà active';
    end if;

    v_reservation := private.reserve_stock(r.pharmacie_id, r.panier_items);

    select total into v_total
    from public.reservations
    where id = v_reservation
    for update;

    if v_total is distinct from r.montant then
      raise exception 'Le prix ou le total du panier a changé : la demande doit être réexaminée';
    end if;

    perform pg_catalog.set_config(
      'naxa.stock_motif',
      'Approbation crédit Marketplace ' || r.id::text,
      true
    );

    for v_item in
      select ri.produit_id, ri.quantite
      from public.reservation_items ri
      where ri.reservation_id = v_reservation
      order by ri.produit_id
    loop
      if exists (
        select 1
        from public.stocks_lots sl
        where sl.pharmacie_id = r.pharmacie_id
          and sl.produit_id = v_item.produit_id
      ) then
        -- Réserver d'abord les anciens holds non affectés avant d'attribuer
        -- aux lots physiques de cette nouvelle demande.
        select greatest(
          coalesce(sum(ri.quantite), 0) - coalesce((
            select sum(a.quantite)
            from public.reservation_item_lots a
            join public.reservations ar on ar.id = a.reservation_id
            where ar.pharmacie_id = r.pharmacie_id
              and ar.id <> v_reservation
              and a.produit_id = v_item.produit_id
              and a.restauree_at is null
              and ar.statut in ('en_attente','confirmee')
              and ar.expires_at > now()
              and ar.consumed_at is null
              and ar.stock_restored = false
              and ar.stock_decremented = false
          ), 0), 0)::integer
        into v_unallocated
        from public.reservation_items ri
        join public.reservations ar on ar.id = ri.reservation_id
        where ar.pharmacie_id = r.pharmacie_id
          and ar.id <> v_reservation
          and ri.produit_id = v_item.produit_id
          and ar.statut in ('en_attente','confirmee')
          and ar.expires_at > now()
          and ar.consumed_at is null
          and ar.stock_restored = false
          and ar.stock_decremented = false;

        v_need := v_item.quantite;

        for v_lot in
          select sl.id,
            greatest(sl.quantite - coalesce((
              select sum(a.quantite)::integer
              from public.reservation_item_lots a
              join public.reservations active_r on active_r.id = a.reservation_id
              where a.lot_id = sl.id
                and a.restauree_at is null
                and active_r.id <> v_reservation
                and active_r.statut in ('en_attente','confirmee')
                and active_r.expires_at > now()
                and active_r.consumed_at is null
                and active_r.stock_restored = false
                and active_r.stock_decremented = false
            ), 0), 0)::integer as disponible
          from public.stocks_lots sl
          where sl.pharmacie_id = r.pharmacie_id
            and sl.produit_id = v_item.produit_id
            and sl.quantite > 0
            and coalesce(sl.bloque, false) = false
            and sl.date_peremption is not null
            and sl.date_peremption >= current_date
          order by sl.date_peremption, sl.numero_lot, sl.id
          for update
        loop
          exit when v_need = 0;
          v_take := least(v_need, greatest(v_lot.disponible - v_unallocated, 0));
          v_unallocated := greatest(v_unallocated - v_lot.disponible, 0);

          if v_take > 0 then
            insert into public.reservation_item_lots(
              reservation_id, produit_id, lot_id, quantite
            ) values (
              v_reservation, v_item.produit_id, v_lot.id, v_take
            );

            update public.stocks_lots
            set quantite = quantite - v_take, updated_at = now()
            where id = v_lot.id
              and pharmacie_id = r.pharmacie_id
              and produit_id = v_item.produit_id
              and quantite >= v_take;

            if not found then
              raise exception 'Le lot FEFO a changé pendant l’approbation ; opération annulée';
            end if;

            v_need := v_need - v_take;
          end if;
        end loop;

        if v_need <> 0 then
          raise exception 'Lots FEFO disponibles insuffisants pour débiter le crédit';
        end if;
      end if;

      -- Après débit des lots, le trigger de cohérence contrôle l'égalité
      -- entre stock agrégé et somme des lots.
      update public.stocks
      set quantite = quantite - v_item.quantite,
          updated_at = now()
      where pharmacie_id = r.pharmacie_id
        and produit_id = v_item.produit_id
        and quantite >= v_item.quantite;

      if not found then
        raise exception 'Stock physique insuffisant au moment de l’approbation';
      end if;
    end loop;

    update public.reservations
    set client_id = r.client_id,
        credit_request_id = r.id,
        mode = 'reservation',
        statut = 'confirmee'::public.resa_statut,
        preparation_statut = 'non_commencee',
        stock_decremented = true,
        stock_restored = false
    where id = v_reservation;

    update public.client_credit_requests
    set statut = 'approuvee',
        decided_by = auth.uid(),
        decided_at = now(),
        reservation_id = v_reservation
    where id = r.id;

    return;
  end if;

  -- Conserver le parcours historique des demandes de dépassement issues de la caisse.
  select * into c
  from public.client_credits
  where id = r.credit_id
  for update;

  if not found then raise exception 'Crédit client introuvable'; end if;

  update public.client_credits set updated_at = now() where id = c.id;
  update public.client_credit_requests
  set statut = 'approuvee', decided_by = auth.uid(), decided_at = now()
  where id = r.id;
end
$function$;

revoke all on function public.client_credit_demande_decider(uuid,boolean) from public, anon, authenticated;
grant execute on function public.client_credit_demande_decider(uuid,boolean) to authenticated;

-- 8) Le retrait ne re-décrémente ni les lots ni le stock si l'approbation les a déjà débités.
create or replace function public.vente_reservation_credit_finaliser(
  p_reservation uuid,
  p_session uuid,
  p_reference text default null
)
returns table(vente_id uuid, numero_vente text, total integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.reservations%rowtype;
  q public.client_credit_requests%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_vente uuid;
  v_numero text;
  v_total_lignes integer;
  v_item record;
  v_lot record;
  v_lots_count integer;
  v_allocated integer;
  v_remaining integer;
  v_take integer;
  v_stock_already_decremented boolean;
  v_op uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null then
    raise exception 'Réservation et session de caisse requises';
  end if;

  select * into r
  from public.reservations
  where id = p_reservation
  for update;

  if not found then raise exception 'Réservation introuvable'; end if;
  if r.mode <> 'reservation' or r.statut <> 'confirmee' then
    raise exception 'La réservation doit être confirmée pour le retrait';
  end if;
  if r.expires_at <= now() then raise exception 'Réservation expirée'; end if;
  if r.paiement_statut = 'effectue' then raise exception 'Réservation déjà payée'; end if;
  if not public.naxa_caisse_actor_for_pharmacy(r.pharmacie_id) then
    raise exception 'Opération réservée à la caisse active de cette pharmacie';
  end if;
  if exists (select 1 from public.ventes v where v.reservation_id = r.id) then
    raise exception 'Une vente POS est déjà liée à cette réservation';
  end if;
  if r.credit_request_id is null then
    raise exception 'Cette réservation ne provient pas d’une demande de crédit Marketplace';
  end if;

  select * into q
  from public.client_credit_requests
  where id = r.credit_request_id
  for update;

  if not found or q.origine <> 'marketplace' or q.statut <> 'approuvee'
     or q.reservation_id is distinct from r.id or q.consumed_at is not null
     or q.vente_id is not null then
    raise exception 'Demande de crédit absente, non approuvée ou déjà consommée';
  end if;

  if q.client_id is distinct from r.client_id
     or q.pharmacie_id is distinct from r.pharmacie_id
     or q.credit_id is null then
    raise exception 'La demande de crédit ne correspond pas à cette réservation';
  end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id = cs.caisse_id
  where cs.id = p_session
    and cs.statut = 'ouverte'
    and cs.ouvert_par = auth.uid()
    and c.actif = true
    and c.pharmacie_id = r.pharmacie_id
  for update of cs;

  if not found then
    raise exception 'Session ouverte introuvable, inactive ou hors pharmacie';
  end if;

  select coalesce(sum(ri.quantite * ri.prix_unitaire), 0)::integer
  into v_total_lignes
  from public.reservation_items ri
  where ri.reservation_id = r.id;

  if not exists (select 1 from public.reservation_items ri where ri.reservation_id = r.id) then
    raise exception 'Réservation sans articles';
  end if;

  if v_total_lignes <> r.total or q.montant <> r.total then
    raise exception 'Le total des articles, de la réservation et du crédit doit être identique';
  end if;

  insert into public.ventes(
    pharmacie_id, caisse_session_id, client_id, statut, remise,
    total_brut, total_net, created_by, reservation_id
  ) values (
    r.pharmacie_id, p_session, r.client_id, 'brouillon', 0,
    r.total, r.total, auth.uid(), r.id
  ) returning id into v_vente;

  v_stock_already_decremented := coalesce(r.stock_decremented, true);

  for v_item in
    select ri.produit_id, ri.quantite, ri.prix_unitaire
    from public.reservation_items ri
    where ri.reservation_id = r.id
    order by ri.produit_id
  loop
    perform 1
    from public.stocks s
    where s.pharmacie_id = r.pharmacie_id
      and s.produit_id = v_item.produit_id
    for update;

    if not found then raise exception 'Produit absent du stock au retrait'; end if;

    select count(*) into v_lots_count
    from public.stocks_lots l
    where l.pharmacie_id = r.pharmacie_id
      and l.produit_id = v_item.produit_id;

    if v_lots_count > 0 then
      select coalesce(sum(a.quantite), 0)::integer into v_allocated
      from public.reservation_item_lots a
      where a.reservation_id = r.id
        and a.produit_id = v_item.produit_id
        and a.restauree_at is null;

      if v_allocated <> v_item.quantite then
        raise exception 'Allocation de lots absente ou incohérente pour la réservation';
      end if;

      v_remaining := v_item.quantite;

      for v_lot in
        select l.id, l.quantite, l.date_peremption, a.quantite as reserve_qty
        from public.reservation_item_lots a
        join public.stocks_lots l on l.id = a.lot_id
          and l.pharmacie_id = r.pharmacie_id
          and l.produit_id = v_item.produit_id
        where a.reservation_id = r.id
          and a.produit_id = v_item.produit_id
          and a.restauree_at is null
          and a.quantite > 0
          and (v_stock_already_decremented or l.quantite > 0)
          and coalesce(l.bloque, false) = false
          and (l.date_peremption is null or l.date_peremption >= current_date)
        order by l.date_peremption asc nulls last, l.created_at asc, l.id asc
        for update of l, a
      loop
        exit when v_remaining = 0;
        v_take := least(v_remaining, v_lot.reserve_qty);

        if not v_stock_already_decremented then
          if v_lot.quantite < v_take then
            raise exception 'Quantité insuffisante dans un lot affecté à cette réservation';
          end if;

          update public.stocks_lots
          set quantite = quantite - v_take, updated_at = now()
          where id = v_lot.id;
        end if;

        insert into public.vente_lignes(
          vente_id, produit_id, lot_id, quantite, prix_unitaire
        ) values (
          v_vente, v_item.produit_id, v_lot.id, v_take, v_item.prix_unitaire
        );

        v_remaining := v_remaining - v_take;
      end loop;

      if v_remaining > 0 then
        raise exception 'Lots affectés indisponibles au retrait';
      end if;
    else
      if exists (
        select 1 from public.stocks s
        where s.pharmacie_id = r.pharmacie_id
          and s.produit_id = v_item.produit_id
          and s.date_peremption is not null
          and s.date_peremption < current_date
      ) then
        raise exception 'Stock périmé : retrait refusé';
      end if;

      insert into public.vente_lignes(
        vente_id, produit_id, quantite, prix_unitaire
      ) values (
        v_vente, v_item.produit_id, v_item.quantite, v_item.prix_unitaire
      );
    end if;

    if not v_stock_already_decremented then
      update public.stocks
      set quantite = quantite - v_item.quantite, updated_at = now()
      where pharmacie_id = r.pharmacie_id
        and produit_id = v_item.produit_id
        and quantite >= v_item.quantite;

      if not found then raise exception 'Stock physique insuffisant au retrait'; end if;
    end if;
  end loop;

  update public.client_credit_requests
  set vente_id = v_vente
  where id = q.id
    and statut = 'approuvee'
    and consumed_at is null
    and vente_id is null;

  if not found then raise exception 'La demande de crédit a déjà été liée à une vente'; end if;

  v_op := public.client_credit_enregistrer_vente(
    v_vente, r.total, nullif(trim(p_reference), '')
  );

  if v_op is null then raise exception 'Échec de création de l’opération de crédit'; end if;

  update public.client_credit_operations
  set caisse_session_id = p_session
  where id = v_op and vente_id = v_vente and nature = 'credit';

  if not found then raise exception 'Opération de crédit non rattachée à la session de caisse'; end if;

  update public.reservations
  set paiement_mode = 'credit',
      paiement_ref = nullif(trim(p_reference), ''),
      consumed_by_vente_id = v_vente,
      consumed_at = now(),
      stock_decremented = true,
      stock_restored = false
  where id = r.id;

  perform public.set_reservation_status(r.id, 'payee'::public.resa_statut);

  select v.numero_vente into v_numero
  from public.ventes v
  where v.id = v_vente;

  return query select v_vente, v_numero, r.total;
end
$function$;

revoke all on function public.vente_reservation_credit_finaliser(uuid,uuid,text) from public, anon;
grant execute on function public.vente_reservation_credit_finaliser(uuid,uuid,text) to authenticated;

comment on function public.client_credit_demande_decider(uuid,boolean) is
  'Approuve ou refuse un crédit Marketplace. L''approbation crée une réservation liée, alloue FEFO et débite immédiatement stock agrégé et lots ; le retrait POS ne redébite jamais les quantités.';
comment on function public.vente_reservation_credit_finaliser(uuid,uuid,text) is
  'Finalise le retrait d’un crédit Marketplace approuvé, consomme les lots déjà débités à l’approbation sans second débit, puis crée atomiquement vente et opération de crédit.';

commit;
