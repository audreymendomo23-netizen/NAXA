-- SM-01 — Suspension disciplinaire indépendante du cycle commercial.
-- Migration additive : ne désactive pas les profils/pharmacies et ne touche pas aux paiements.
begin;

create table if not exists public.promoteur_suspensions_disciplinaires (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  motif text not null check (motif = 'faute'),
  observations text,
  statut text not null default 'active' check (statut in ('active','levee')),
  suspendu_par uuid not null references public.profiles(id) on delete restrict,
  suspendu_le timestamptz not null default now(),
  leve_par uuid references public.profiles(id) on delete restrict,
  leve_le timestamptz,
  motif_levee text,
  perimetre_avant jsonb not null default '{}'::jsonb,
  perimetre_apres jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promoteur_suspension_levee_coherente check (
    (statut = 'active' and leve_par is null and leve_le is null)
    or (statut = 'levee' and leve_par is not null and leve_le is not null)
  )
);

create unique index if not exists promoteur_suspension_unique_active
  on public.promoteur_suspensions_disciplinaires(promoteur_id)
  where statut = 'active';
create index if not exists promoteur_suspension_history_idx
  on public.promoteur_suspensions_disciplinaires(promoteur_id, suspendu_le desc);

create table if not exists public.promoteur_suspensions_disciplinaires_audit (
  id bigint generated always as identity primary key,
  suspension_id uuid not null references public.promoteur_suspensions_disciplinaires(id) on delete restrict,
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('suspension_creee','suspension_levee')),
  acteur_id uuid not null references public.profiles(id) on delete restrict,
  cree_le timestamptz not null default now(),
  avant jsonb not null,
  apres jsonb not null,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists promoteur_suspension_audit_history_idx
  on public.promoteur_suspensions_disciplinaires_audit(promoteur_id, cree_le desc);

alter table public.promoteur_suspensions_disciplinaires enable row level security;
alter table public.promoteur_suspensions_disciplinaires_audit enable row level security;
revoke all on public.promoteur_suspensions_disciplinaires from public, anon, authenticated;
revoke all on public.promoteur_suspensions_disciplinaires_audit from public, anon, authenticated;
grant all on public.promoteur_suspensions_disciplinaires to service_role;
grant all on public.promoteur_suspensions_disciplinaires_audit to service_role;

create or replace function private.naxa_promoteur_sous_suspension(p_promoteur uuid)
returns boolean
language sql stable security definer set search_path = ''
as $fn$
  select exists (
    select 1
    from public.promoteur_suspensions_disciplinaires s
    where s.promoteur_id = p_promoteur
      and s.statut = 'active'
  );
$fn$;

create or replace function private.naxa_pharmacie_sous_suspension(p_pharmacie uuid)
returns boolean
language sql stable security definer set search_path = ''
as $fn$
  select exists (
    select 1
    from public.promoteur_suspensions_disciplinaires s
    where s.statut = 'active'
      and (
        exists (
          select 1 from public.promoteur_pharmacies pp
          where pp.promoteur_id = s.promoteur_id
            and pp.pharmacie_id = p_pharmacie
        )
        or exists (
          select 1 from public.profiles pr
          where pr.id = s.promoteur_id
            and pr.pharmacie_id = p_pharmacie
        )
      )
  );
$fn$;

revoke all on function private.naxa_promoteur_sous_suspension(uuid) from public, anon, authenticated;
revoke all on function private.naxa_pharmacie_sous_suspension(uuid) from public, anon, authenticated;

-- API de filtrage publique : ne divulgue pas l'identité du Promoteur suspendu.
create or replace function public.marketplace_pharmacies_disciplinairement_autorisees(p_pharmacies uuid[])
returns uuid[]
language sql stable security definer set search_path = ''
as $fn$
  select coalesce(array_agg(x.id), array[]::uuid[])
  from (
    select distinct p.id
    from unnest(coalesce(p_pharmacies, array[]::uuid[])) as requested(id)
    join public.pharmacies p on p.id = requested.id
    where not private.naxa_pharmacie_sous_suspension(p.id)
  ) x;
$fn$;
revoke all on function public.marketplace_pharmacies_disciplinairement_autorisees(uuid[]) from public;
grant execute on function public.marketplace_pharmacies_disciplinairement_autorisees(uuid[]) to anon, authenticated;

-- Suspendre : décision réservée à un administrateur actif connecté.
create or replace function public.admin_suspendre_promoteur_disciplinaire(
  p_promoteur uuid,
  p_observations text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_admin uuid := auth.uid();
  v_suspension uuid;
  v_before jsonb;
  v_after jsonb;
  v_nom text;
  v_pharmacies jsonb;
begin
  if v_admin is null or not exists (
    select 1 from public.profiles
    where id = v_admin and role::text = 'admin' and actif = true
  ) then
    raise exception 'Administrateur actif requis';
  end if;
  if p_promoteur is null or not exists (
    select 1 from public.profiles where id = p_promoteur and role::text = 'promoteur'
  ) then
    raise exception 'Promoteur introuvable';
  end if;
  if exists (
    select 1 from public.promoteur_suspensions_disciplinaires
    where promoteur_id = p_promoteur and statut = 'active'
  ) then
    raise exception 'Une suspension disciplinaire est déjà active';
  end if;

  select jsonb_build_object(
    'profile', jsonb_build_object('id', p.id, 'actif', p.actif, 'role', p.role::text),
    'pharmacies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ph.id, 'nom', ph.nom, 'actif', ph.actif,
        'visible_recherche', ph.visible_recherche, 'archivee_le', ph.archivee_le
      ) order by ph.nom)
      from public.promoteur_pharmacies pp
      join public.pharmacies ph on ph.id = pp.pharmacie_id
      where pp.promoteur_id = p.id
    ), '[]'::jsonb)
  ), coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.username, p.id::text)
  into v_before, v_nom
  from public.profiles p
  where p.id = p_promoteur
  for update;

  select coalesce(jsonb_agg(jsonb_build_object('id', ph.id, 'nom', ph.nom)), '[]'::jsonb)
    into v_pharmacies
  from public.promoteur_pharmacies pp
  join public.pharmacies ph on ph.id = pp.pharmacie_id
  where pp.promoteur_id = p_promoteur;

  insert into public.promoteur_suspensions_disciplinaires(
    promoteur_id, motif, observations, suspendu_par, perimetre_avant, perimetre_apres
  ) values (
    p_promoteur, 'faute', null,
    v_admin, v_before,
    jsonb_build_object('marketplace_bloquee', true, 'promoteur_id', p_promoteur, 'pharmacies', v_pharmacies)
  ) returning id into v_suspension;

  v_after := jsonb_build_object(
    'suspension_id', v_suspension, 'statut', 'active', 'motif', 'faute',
    'marketplace_bloquee', true, 'pharmacies', v_pharmacies
  );

  insert into public.promoteur_suspensions_disciplinaires_audit(
    suspension_id, promoteur_id, action, acteur_id, avant, apres, detail
  ) values (
    v_suspension, p_promoteur, 'suspension_creee', v_admin, v_before, v_after,
    jsonb_build_object('observations', null)
  );

  insert into public.notifications(user_id, type, titre, corps)
  values (
    p_promoteur, 'suspension_disciplinaire',
    'Suspension disciplinaire de votre accès Marketplace',
    'Votre compte Promoteur et les pharmacies qui vous sont rattachées sont suspendus de la Marketplace pour motif disciplinaire. Cette suspension est à durée indéterminée. Un paiement ou renouvellement d’abonnement ne la lève pas; seule une décision explicite d’un administrateur habilité peut le faire.'
  );

  insert into public.journal_admin(admin_profile_id, action, cible_type, cible_id, motif, detail)
  values (
    v_admin, 'promoteur_suspension_disciplinaire', 'promoteur', p_promoteur::text,
    'Suspension disciplinaire pour faute',
    jsonb_build_object('suspension_id', v_suspension, 'avant', v_before, 'apres', v_after)
  );

  return v_suspension;
end;
$fn$;

create or replace function public.admin_lever_suspension_promoteur(
  p_suspension uuid,
  p_motif text default null
)
returns boolean
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_admin uuid := auth.uid();
  s public.promoteur_suspensions_disciplinaires%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_admin is null or not exists (
    select 1 from public.profiles
    where id = v_admin and role::text = 'admin' and actif = true
  ) then
    raise exception 'Administrateur actif requis';
  end if;

  select * into s
  from public.promoteur_suspensions_disciplinaires
  where id = p_suspension
  for update;
  if not found then raise exception 'Suspension disciplinaire introuvable'; end if;
  if s.statut <> 'active' then raise exception 'Cette suspension est déjà levée'; end if;

  v_before := jsonb_build_object(
    'id', s.id, 'statut', s.statut, 'motif', s.motif,
    'promoteur_id', s.promoteur_id, 'perimetre_apres', s.perimetre_apres
  );

  update public.promoteur_suspensions_disciplinaires
  set statut = 'levee', leve_par = v_admin, leve_le = now(),
      motif_levee = nullif(trim(coalesce(p_motif, '')), ''), updated_at = now()
  where id = s.id;

  v_after := jsonb_build_object(
    'id', s.id, 'statut', 'levee', 'motif', s.motif,
    'promoteur_id', s.promoteur_id, 'leve_par', v_admin,
    'motif_levee', nullif(trim(coalesce(p_motif, '')), '')
  );

  insert into public.promoteur_suspensions_disciplinaires_audit(
    suspension_id, promoteur_id, action, acteur_id, avant, apres, detail
  ) values (
    s.id, s.promoteur_id, 'suspension_levee', v_admin, v_before, v_after,
    jsonb_build_object('motif_levee', nullif(trim(coalesce(p_motif, '')), ''))
  );

  insert into public.notifications(user_id, type, titre, corps)
  values (
    s.promoteur_id, 'suspension_disciplinaire_levee',
    'Décision administrative : suspension disciplinaire levée',
    'Un administrateur habilité a levé votre suspension disciplinaire. Votre accès Marketplace reste soumis aux conditions commerciales et opérationnelles habituelles de NAXA.'
  );

  insert into public.journal_admin(admin_profile_id, action, cible_type, cible_id, motif, detail)
  values (
    v_admin, 'promoteur_suspension_disciplinaire_levee', 'promoteur', s.promoteur_id::text,
    coalesce(nullif(trim(coalesce(p_motif, '')), ''), 'Levée explicite de la suspension disciplinaire'),
    jsonb_build_object('suspension_id', s.id, 'avant', v_before, 'apres', v_after)
  );

  return true;
end;
$fn$;

revoke all on function public.admin_suspendre_promoteur_disciplinaire(uuid,text) from public, anon;
revoke all on function public.admin_lever_suspension_promoteur(uuid,text) from public, anon;
grant execute on function public.admin_suspendre_promoteur_disciplinaire(uuid,text) to authenticated;
grant execute on function public.admin_lever_suspension_promoteur(uuid,text) to authenticated;

-- Disponibilité Marketplace : une pharmacie rattachée à un Promoteur sanctionné ne publie aucune offre.
create or replace function public.marketplace_offre_stock_disponible(
  p_pharmacie uuid,
  p_produit uuid
)
returns table(prix integer, quantite integer)
language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_disponible integer;
begin
  if p_pharmacie is null or p_produit is null
     or private.naxa_pharmacie_sous_suspension(p_pharmacie) then
    return;
  end if;

  select s.* into v_stock
  from public.stocks s
  join public.pharmacies ph on ph.id = s.pharmacie_id
  where s.pharmacie_id = p_pharmacie
    and s.produit_id = p_produit
    and ph.actif = true
    and ph.visible_recherche = true
    and ph.archivee_le is null;

  if not found then return; end if;

  select exists (
    select 1 from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie and l.produit_id = p_produit
  ) into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite), 0)::integer into v_disponible
    from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie and l.produit_id = p_produit
      and coalesce(l.bloque, false) = false
      and (l.date_peremption is null or l.date_peremption >= current_date);
  else
    v_disponible := case
      when v_stock.date_peremption is null or v_stock.date_peremption >= current_date
        then greatest(coalesce(v_stock.quantite, 0), 0)
      else 0
    end;
  end if;

  return query select v_stock.prix, greatest(coalesce(v_disponible, 0), 0);
end;
$fn$;

revoke all on function public.marketplace_offre_stock_disponible(uuid,uuid) from public;
grant execute on function public.marketplace_offre_stock_disponible(uuid,uuid) to anon, authenticated;

-- Le chemin de création de réservation doit refuser aussi les appels directs à la RPC.
create or replace function private.reserve_stock(p_pharmacie uuid, p_items jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $fn$
declare
  v_id uuid;
  it jsonb;
  v_total integer := 0;
  v_prix integer;
  v_q integer;
  v_produit uuid;
  v_stock integer;
  v_reserved integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if private.naxa_pharmacie_sous_suspension(p_pharmacie) then
    raise exception 'Pharmacie suspendue de la Marketplace pour motif disciplinaire';
  end if;
  if not exists (
    select 1 from public.pharmacies
    where id = p_pharmacie and actif = true and visible_recherche = true and archivee_le is null
  ) then raise exception 'Pharmacie indisponible'; end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 10 then
    raise exception 'Panier invalide';
  end if;
  if exists (
    select 1 from (
      select value->>'produit_id' pid, count(*) n
      from jsonb_array_elements(p_items) group by value->>'produit_id'
    ) x where x.n > 1
  ) then raise exception 'Produit dupliqué dans le panier'; end if;

  for it in select value from jsonb_array_elements(p_items) order by (value->>'produit_id')::uuid loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer, 1);
    if v_q < 1 or v_q > 10 then raise exception 'Quantité invalide'; end if;
    select s.quantite, s.prix into v_stock, v_prix
    from public.stocks s
    where s.pharmacie_id = p_pharmacie and s.produit_id = v_produit
      and (s.date_peremption is null or s.date_peremption >= current_date)
    for update;
    if not found then raise exception 'Produit absent ou périmé'; end if;

    select coalesce(sum(ri.quantite), 0)::integer into v_reserved
    from public.reservation_items ri
    join public.reservations r on r.id = ri.reservation_id
    where r.pharmacie_id = p_pharmacie and ri.produit_id = v_produit
      and r.statut in ('en_attente', 'confirmee') and r.expires_at > now()
      and r.consumed_at is null and r.stock_restored = false and r.stock_decremented = false;
    if v_stock - v_reserved < v_q then
      raise exception 'Stock disponible insuffisant après réservations actives';
    end if;
    v_total := v_total + v_prix * v_q;
  end loop;

  insert into public.reservations(client_id, pharmacie_id, expires_at, stock_decremented, stock_restored)
  values (auth.uid(), p_pharmacie, now() + interval '3 hours', false, false)
  returning id into v_id;

  for it in select value from jsonb_array_elements(p_items) order by (value->>'produit_id')::uuid loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer, 1);
    select s.prix into v_prix from public.stocks s
    where s.pharmacie_id = p_pharmacie and s.produit_id = v_produit;
    insert into public.reservation_items(reservation_id, produit_id, quantite, prix_unitaire)
    values (v_id, v_produit, v_q, v_prix);
  end loop;

  update public.reservations set total = v_total where id = v_id;
  return v_id;
end;
$fn$;

revoke all on function private.reserve_stock(uuid,jsonb) from public, anon;
grant execute on function private.reserve_stock(uuid,jsonb) to authenticated;

create or replace function public.reserve_stock(p_pharmacie uuid, p_items jsonb)
returns uuid language sql set search_path = ''
as $fn$ select private.reserve_stock($1, $2) $fn$;
revoke all on function public.reserve_stock(uuid,jsonb) from public, anon;
grant execute on function public.reserve_stock(uuid,jsonb) to authenticated;



-- La suspension est limitée à la Marketplace : le POS interne conserve sa recherche
-- de stock vendable, sans réutiliser la fonction publique filtrée par sanction.
create or replace function private.stock_vendable_interne(
  p_pharmacie uuid,
  p_produit uuid
)
returns table(prix integer, quantite integer)
language plpgsql stable security definer set search_path = ''
as $fn$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_disponible integer;
begin
  select s.* into v_stock
  from public.stocks s
  where s.pharmacie_id = p_pharmacie and s.produit_id = p_produit;
  if not found then return; end if;

  select exists (
    select 1 from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie and l.produit_id = p_produit
  ) into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite), 0)::integer into v_disponible
    from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie and l.produit_id = p_produit
      and coalesce(l.bloque, false) = false
      and (l.date_peremption is null or l.date_peremption >= current_date);
  else
    v_disponible := case
      when v_stock.date_peremption is null or v_stock.date_peremption >= current_date
        then greatest(coalesce(v_stock.quantite, 0), 0)
      else 0
    end;
  end if;
  return query select v_stock.prix, greatest(coalesce(v_disponible, 0), 0);
end;
$fn$;
revoke all on function private.stock_vendable_interne(uuid,uuid) from public, anon, authenticated;

create or replace function public.caisse_rechercher_produit(
  p_pharmacie uuid,
  p_code_barre text default null,
  p_recherche text default null
)
returns table(
  produit_id uuid, nom text, dosage text, conditionnement text,
  code_barre text, prix integer, quantite integer, emplacement text
)
language plpgsql security definer set search_path = ''
as $fn$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;
  return query
  select p.id, p.nom, p.dosage, p.conditionnement, p.code_barre,
         avail.prix, avail.quantite, s.emplacement
  from public.produits p
  join public.stocks s on s.produit_id = p.id and s.pharmacie_id = p_pharmacie
  cross join lateral private.stock_vendable_interne(p_pharmacie, p.id) avail
  where
    (nullif(trim(coalesce(p_code_barre, '')), '') is not null and p.code_barre = trim(p_code_barre))
    or
    (nullif(trim(coalesce(p_recherche, '')), '') is not null and (
      lower(p.nom) like '%' || lower(trim(p_recherche)) || '%'
      or lower(coalesce(p.reference_catalogue, '')) like '%' || lower(trim(p_recherche)) || '%'
      or lower(coalesce(p.code_barre, '')) like '%' || lower(trim(p_recherche)) || '%'
    ))
  order by p.nom
  limit 50;
end;
$fn$;

create or replace function public.caisse_rechercher_codes(
  p_pharmacie uuid,
  p_codes text[]
)
returns table(
  code_barre text, produit_id uuid, nom text, dosage text,
  prix integer, quantite integer, emplacement text
)
language plpgsql security definer set search_path = ''
as $fn$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;
  return query
  select p.code_barre, p.id, p.nom, p.dosage,
         avail.prix, avail.quantite, s.emplacement
  from public.produits p
  join public.stocks s on s.produit_id = p.id and s.pharmacie_id = p_pharmacie
  cross join lateral private.stock_vendable_interne(p_pharmacie, p.id) avail
  where p.code_barre = any(coalesce(p_codes, array[]::text[]))
  order by array_position(p_codes, p.code_barre);
end;
$fn$;

revoke all on function public.caisse_rechercher_produit(uuid,text,text) from public, anon, authenticated;
revoke all on function public.caisse_rechercher_codes(uuid,text[]) from public, anon, authenticated;
grant execute on function public.caisse_rechercher_produit(uuid,text,text) to authenticated;
grant execute on function public.caisse_rechercher_codes(uuid,text[]) to authenticated;

commit;
