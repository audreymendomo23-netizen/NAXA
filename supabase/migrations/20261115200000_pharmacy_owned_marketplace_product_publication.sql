-- NAXA product publishing: pharmacies declare references; NAXA does not validate fiches.
-- Public visibility is driven only by an active pharmacy's real, fresh, sellable stock.
begin;

alter table public.produits
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_by_pharmacie_id uuid references public.pharmacies(id) on delete set null;

create index if not exists produits_created_by_pharmacie_idx
  on public.produits(created_by_pharmacie_id)
  where created_by_pharmacie_id is not null;

-- Keep every descriptive field provided by a pharmacy. The legacy validation flag
-- stays false for pharmacy-created rows and is no longer used to gate publication.
create or replace function public.produits_garde_fiche()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Connexion requise pour déclarer une référence pharmacie';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_pharmacie_id := public.my_pharmacie();
    if new.created_by_pharmacie_id is null then
      raise exception 'Une pharmacie active doit être sélectionnée pour déclarer cette référence';
    end if;
    new.source_fiche := 'declaration_pharmacie';
    new.fiche_validee := false;
    new.fiche_maj := null;
    new.bdpm_cis := null;
    -- Photos remain on their separate source/licence workflow.
    new.photo_url := null;
    new.photo_path := null;
    new.photo_source_url := null;
    new.photo_licence := null;
    new.photo_verifiee_le := null;
  else
    -- The owner pharmacy can correct its own declaration, but cannot change
    -- the creator, claim a NAXA validation, attach a foreign regulatory ID,
    -- or bypass the separate image-rights flow.
    new.created_by := old.created_by;
    new.created_by_pharmacie_id := old.created_by_pharmacie_id;
    new.source_fiche := old.source_fiche;
    new.fiche_validee := old.fiche_validee;
    new.fiche_maj := old.fiche_maj;
    new.bdpm_cis := old.bdpm_cis;
    new.photo_url := old.photo_url;
    new.photo_path := old.photo_path;
    new.photo_source_url := old.photo_source_url;
    new.photo_licence := old.photo_licence;
    new.photo_verifiee_le := old.photo_verifiee_le;
  end if;

  return new;
end
$function$;

-- Remove every historical fiche_validee gate from the stock offer engine and
-- pharmacy search routines. These routines continue to enforce active/public
-- pharmacies, stock freshness, lots, expiry, blocked lots and reservation holds.
do $migration$
declare
  v_definition text;
  v_guard text := E'  -- Le catalogue Marketplace ne publie jamais une fiche non validée.\n  if not exists (\n    select 1 from public.produits p\n    where p.id=p_produit and p.fiche_validee is true\n  ) then\n    return;\n  end if;\n\n';
begin
  foreach v_definition in array array[
    pg_get_functiondef('private.marketplace_offre_stock_disponible_guarded(uuid,uuid)'::regprocedure),
    pg_get_functiondef('private.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure)
  ]
  loop
    if position(v_guard in v_definition)=0 then
      raise exception 'Garde fiche attendu absent dans le moteur Marketplace; migration interrompue';
    end if;
    v_definition := replace(v_definition,v_guard,'');
    if position('fiche_validee' in v_definition)>0 then
      raise exception 'Un filtre fiche_validee subsiste dans le moteur Marketplace';
    end if;
    execute v_definition;
  end loop;

  v_definition := pg_get_functiondef(
    'private.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure
  );
  if position(E'on pr.fiche_validee is true\n    and ' in v_definition)=0 then
    raise exception 'Filtre fiche_validee inattendu dans search_pharmacies';
  end if;
  v_definition := replace(v_definition,E'on pr.fiche_validee is true\n    and ',E'on ');
  if position('fiche_validee' in v_definition)>0 then
    raise exception 'Un filtre fiche_validee subsiste dans search_pharmacies';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef(
    'private.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure
  );
  if position(E'on pr.fiche_validee is true\n    and ' in v_definition)=0
     or position('and p.fiche_validee is true' in v_definition)=0 then
    raise exception 'Filtres fiche_validee inattendus dans search_pharmacies_bulk';
  end if;
  v_definition := replace(v_definition,E'on pr.fiche_validee is true\n    and ',E'on ');
  v_definition := replace(v_definition,'and p.fiche_validee is true','');
  if position('fiche_validee' in v_definition)>0 then
    raise exception 'Un filtre fiche_validee subsiste dans search_pharmacies_bulk';
  end if;
  execute v_definition;
end
$migration$;

-- Boolean visibility predicate for products. It exposes no stock amount and
-- returns true only when at least one pharmacy has a currently sellable offer.
create or replace function public.marketplace_produit_visible(p_produit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_produit is not null and exists (
    select 1
    from public.stocks s
    join public.pharmacies ph on ph.id=s.pharmacie_id
    cross join lateral private.marketplace_offre_stock_disponible_guarded(
      s.pharmacie_id,s.produit_id
    ) offer
    where s.produit_id=p_produit
      and ph.actif is true
      and ph.visible_recherche is true
      and ph.est_demo is false
      and ph.archivee_le is null
      and offer.quantite>0
  );
$function$;

revoke all on function public.marketplace_produit_visible(uuid) from public;
grant execute on function public.marketplace_produit_visible(uuid)
  to anon, authenticated, service_role;

-- A client can read a product only while at least one real pharmacy offer exists.
drop policy if exists produits_read on public.produits;
drop policy if exists produits_public_validated_read on public.produits;
drop policy if exists produits_authenticated_catalog_read on public.produits;
drop policy if exists produits_public_live_offer_read on public.produits;
drop policy if exists produits_authenticated_live_offer_read on public.produits;

create policy produits_public_live_offer_read
on public.produits
for select
to anon
using (public.marketplace_produit_visible(id));

create policy produits_authenticated_live_offer_read
on public.produits
for select
to authenticated
using (
  public.marketplace_produit_visible(id)
  or (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'pharmacie','caisse','responsable','comptable','pharmacien',
      'gestionnaire_stock','magasinier'
    )
    and (select public.my_pharmacie()) is not null
  )
);

-- Pharmacy teams create and edit declarations inside their selected pharmacy.
-- No NAXA approval or ficha validation is required for a product to be offered.
drop policy if exists produits_write on public.produits;
drop policy if exists produits_update on public.produits;

create policy produits_write
on public.produits
for insert
to authenticated
with check (
  (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'pharmacie','caisse','responsable','comptable','pharmacien',
      'gestionnaire_stock','magasinier'
    )
    and (select public.my_pharmacie()) is not null
    and created_by=auth.uid()
    and created_by_pharmacie_id=(select public.my_pharmacie())
    and fiche_validee is not true
  )
);

create policy produits_update
on public.produits
for update
to authenticated
using (
  (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'pharmacie','caisse','responsable','comptable','pharmacien',
      'gestionnaire_stock','magasinier'
    )
    and (select public.my_pharmacie()) is not null
    and created_by_pharmacie_id=(select public.my_pharmacie())
  )
)
with check (
  (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'pharmacie','caisse','responsable','comptable','pharmacien',
      'gestionnaire_stock','magasinier'
    )
    and (select public.my_pharmacie()) is not null
    and created_by_pharmacie_id=(select public.my_pharmacie())
  )
);

commit;
