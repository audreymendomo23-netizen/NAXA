-- NAXA POS: internal sellable stock must not depend on Marketplace publication.
-- A pharmacy may operate its own cash register while hidden from public search.
-- Keep the shared public Marketplace filter strict; use a separate internal guard.

begin;

create or replace function private.naxa_pos_stock_vendable(
  p_pharmacie uuid,
  p_produit uuid
)
returns table(prix integer, quantite integer)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_sellable integer;
  v_reserved integer;
  v_today date := private.naxa_date_cameroun();
begin
  if p_pharmacie is null or p_produit is null then
    return;
  end if;

  select s.* into v_stock
  from public.stocks s
  join public.pharmacies ph on ph.id = s.pharmacie_id
  where s.pharmacie_id = p_pharmacie
    and s.produit_id = p_produit
    and ph.actif is true
    and ph.archivee_le is null;

  if not found then
    return;
  end if;

  select exists (
    select 1 from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie
      and l.produit_id = p_produit
  ) into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite), 0)::integer
      into v_sellable
    from public.stocks_lots l
    where l.pharmacie_id = p_pharmacie
      and l.produit_id = p_produit
      and l.quantite > 0
      and coalesce(l.bloque, false) = false
      and (l.date_peremption is null or l.date_peremption >= v_today);
  else
    v_sellable := case
      when v_stock.date_peremption is null or v_stock.date_peremption >= v_today
        then greatest(coalesce(v_stock.quantite, 0), 0)
      else 0
    end;
  end if;

  select coalesce(sum(ri.quantite), 0)::integer
    into v_reserved
  from public.reservation_items ri
  join public.reservations r on r.id = ri.reservation_id
  where r.pharmacie_id = p_pharmacie
    and ri.produit_id = p_produit
    and r.mode in ('reservation', 'commande')
    and r.statut in ('en_attente', 'confirmee')
    and r.expires_at > now()
    and r.consumed_at is null
    and coalesce(r.stock_restored, false) = false
    and coalesce(r.stock_decremented, false) = false;

  return query
  select v_stock.prix,
         greatest(coalesce(v_sellable, 0) - coalesce(v_reserved, 0), 0);
end;
$function$;

revoke all on function private.naxa_pos_stock_vendable(uuid, uuid)
  from public, anon, authenticated, service_role;

comment on function private.naxa_pos_stock_vendable(uuid, uuid) is
  'Disponibilité interne Caisse : pharmacie active non archivée, lots FEFO non bloqués et non périmés, réservations déduites; indépendante de la visibilité Marketplace, du statut démo et du rafraîchissement public des stocks.';

do $rewire$
declare
  v_signature regprocedure;
  v_definition text;
  v_before text;
  v_signatures regprocedure[] := array[
    'private.naxa_pos_debit_stock(uuid)'::regprocedure,
    'public.vente_ajouter_produit(uuid,uuid,integer)'::regprocedure,
    'public.caisse_rechercher_produit(uuid,text,text)'::regprocedure,
    'public.caisse_rechercher_codes(uuid,text[])'::regprocedure
  ];
begin
  foreach v_signature in array v_signatures
  loop
    v_definition := pg_get_functiondef(v_signature);
    v_before := v_definition;
    v_definition := replace(
      v_definition,
      'public.marketplace_offre_stock_disponible(',
      'private.naxa_pos_stock_vendable('
    );
    if v_definition = v_before then
      raise exception 'Appel Marketplace attendu absent de %; rebranchement POS interrompu', v_signature;
    end if;
    execute v_definition;
  end loop;
end
$rewire$;

commit;
