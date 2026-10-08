-- NAXA ERP-012 — Offline ERP avancé : idempotence et synchronisation transactionnelle du stock
-- Additif au mécanisme IndexedDB déjà intégré dans /pharmacie.
-- Ne crée pas de second moteur de stock.

create table if not exists public.offline_operations (
  operation_id uuid primary key,
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  operation_type text not null check (operation_type = 'stock_set_quantity'),
  quantite integer not null check (quantite >= 0),
  base_updated_at timestamptz not null,
  statut text not null default 'pending'
    check (statut in ('pending','applied','conflict','failed')),
  resultat jsonb,
  erreur text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists offline_operations_user_idx
  on public.offline_operations(created_by, created_at desc);

create index if not exists offline_operations_pharmacy_idx
  on public.offline_operations(pharmacie_id, created_at desc);

alter table public.offline_operations enable row level security;

drop policy if exists offline_operations_select_own on public.offline_operations;
create policy offline_operations_select_own
  on public.offline_operations
  for select
  to authenticated
  using ((select auth.uid()) = created_by);

drop policy if exists offline_operations_insert_scope on public.offline_operations;
create policy offline_operations_insert_scope
  on public.offline_operations
  for insert
  to authenticated
  with check (
    (select auth.uid()) = created_by
    and (public.is_admin() or public.can_access_pharmacy(pharmacie_id))
  );

drop policy if exists offline_operations_update_own on public.offline_operations;
create policy offline_operations_update_own
  on public.offline_operations
  for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

revoke all on table public.offline_operations from anon, authenticated;
grant select, insert on table public.offline_operations to authenticated;

create or replace function public.offline_stock_set_quantity(
  p_operation_id uuid,
  p_pharmacie_id uuid,
  p_produit_id uuid,
  p_quantite integer,
  p_base_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_op public.offline_operations%rowtype;
  v_stock public.stocks%rowtype;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  if p_operation_id is null then
    raise exception 'Identifiant d''opération requis';
  end if;
  if p_quantite is null or p_quantite < 0 then
    raise exception 'Quantité invalide';
  end if;
  if not (public.is_admin() or public.can_access_pharmacy(p_pharmacie_id)) then
    raise exception 'Pharmacie hors périmètre';
  end if;

  select *
    into v_op
    from public.offline_operations
   where operation_id = p_operation_id
     and created_by = v_uid
   for update;

  if found then
    if v_op.statut = 'applied' or v_op.statut = 'conflict' or v_op.statut = 'failed' then
      return coalesce(v_op.resultat, jsonb_build_object('status', v_op.statut));
    end if;
  else
    insert into public.offline_operations(
      operation_id, pharmacie_id, produit_id, operation_type,
      quantite, base_updated_at, created_by
    )
    values (
      p_operation_id, p_pharmacie_id, p_produit_id, 'stock_set_quantity',
      p_quantite, p_base_updated_at, v_uid
    )
    returning * into v_op;
  end if;

  select *
    into v_stock
    from public.stocks
   where pharmacie_id = p_pharmacie_id
     and produit_id = p_produit_id
   for update;

  if not found then
    update public.offline_operations
       set statut = 'failed',
           erreur = 'Stock introuvable',
           resultat = jsonb_build_object('status','failed','reason','stock_not_found'),
           updated_at = now()
     where operation_id = p_operation_id
       and created_by = v_uid;
    return jsonb_build_object('status','failed','reason','stock_not_found');
  end if;

  if v_stock.updated_at <> p_base_updated_at then
    update public.offline_operations
       set statut = 'conflict',
           erreur = 'Le stock serveur a changé depuis la mise en cache',
           resultat = jsonb_build_object(
             'status','conflict',
             'server_quantity',v_stock.quantite,
             'server_updated_at',v_stock.updated_at
           ),
           updated_at = now()
     where operation_id = p_operation_id
       and created_by = v_uid;

    return jsonb_build_object(
      'status','conflict',
      'server_quantity',v_stock.quantite,
      'server_updated_at',v_stock.updated_at
    );
  end if;

  update public.stocks
     set quantite = p_quantite,
         updated_at = now()
   where pharmacie_id = p_pharmacie_id
     and produit_id = p_produit_id
     and updated_at = p_base_updated_at;

  if not found then
    select *
      into v_stock
      from public.stocks
     where pharmacie_id = p_pharmacie_id
       and produit_id = p_produit_id;

    update public.offline_operations
       set statut = 'conflict',
           erreur = 'Conflit détecté pendant la mise à jour',
           resultat = jsonb_build_object(
             'status','conflict',
             'server_quantity',v_stock.quantite,
             'server_updated_at',v_stock.updated_at
           ),
           updated_at = now()
     where operation_id = p_operation_id
       and created_by = v_uid;

    return jsonb_build_object(
      'status','conflict',
      'server_quantity',v_stock.quantite,
      'server_updated_at',v_stock.updated_at
    );
  end if;

  update public.offline_operations
     set statut = 'applied',
         applied_at = now(),
         resultat = jsonb_build_object(
           'status','applied',
           'quantity',p_quantite
         ),
         erreur = null,
         updated_at = now()
   where operation_id = p_operation_id
     and created_by = v_uid;

  return jsonb_build_object('status','applied','quantity',p_quantite);
end;
$$;

revoke execute on function public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)
  from public, anon, authenticated;
grant execute on function public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)
  to authenticated;
