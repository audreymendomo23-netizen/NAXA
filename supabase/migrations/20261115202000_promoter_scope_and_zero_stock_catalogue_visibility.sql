-- NAXA — extend pharmacy-owned publication to Promoteur scope and keep
-- declared products searchable even when their current sellable quantity is zero.
begin;

-- The trigger gets the target pharmacy from the transaction-local RPC context.
-- It validates that target with the existing NAXA pharmacy/network scope helper.
create or replace function public.produits_garde_fiche()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pharmacie uuid;
  v_role text;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'Connexion requise pour déclarer une référence pharmacie';
  end if;

  v_role := private.naxa_business_function(auth.uid());
  if v_role not in (
    'promoteur','pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  ) then
    raise exception 'Fonction non autorisée à déclarer une référence produit';
  end if;

  if tg_op = 'INSERT' then
    begin
      v_pharmacie := nullif(current_setting('naxa.product_declaration_pharmacy', true),'')::uuid;
    exception when others then
      raise exception 'Contexte de déclaration pharmacie invalide';
    end;

    if v_pharmacie is null
       or not private.naxa_scope_allows(auth.uid(),v_pharmacie,'PHARMACIE') then
      raise exception 'Pharmacie hors périmètre de votre compte';
    end if;

    new.created_by := auth.uid();
    new.created_by_pharmacie_id := v_pharmacie;
    new.source_fiche := 'declaration_pharmacie';
    new.fiche_validee := false;
    new.fiche_maj := null;
    new.bdpm_cis := null;
    new.photo_url := null;
    new.photo_path := null;
    new.photo_source_url := null;
    new.photo_licence := null;
    new.photo_verifiee_le := null;
  else
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

create or replace function public.marketplace_produit_visible(p_produit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  -- Products declared by any active public partner pharmacy remain discoverable
  -- even at quantity zero. Offer search still separately requires fresh sellable stock.
  select p_produit is not null and exists (
    select 1
    from public.stocks s
    join public.pharmacies ph on ph.id=s.pharmacie_id
    where s.produit_id=p_produit
      and ph.actif is true
      and ph.visible_recherche is true
      and ph.est_demo is false
      and ph.archivee_le is null
  );
$function$;

drop policy if exists produits_authenticated_live_offer_read on public.produits;
create policy produits_authenticated_live_offer_read
on public.produits
for select
to authenticated
using (
  public.marketplace_produit_visible(id)
  or (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid()))='promoteur'
    and (select private.naxa_promoteur_valide(auth.uid()))
  )
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'pharmacie','caisse','responsable','comptable','pharmacien',
      'gestionnaire_stock','magasinier'
    )
    and (select public.my_pharmacie()) is not null
  )
);

drop policy if exists produits_write on public.produits;
create policy produits_write
on public.produits
for insert
to authenticated
with check (
  (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'promoteur','pharmacie','pharmacien','pharmacien_assistant',
      'responsable','gestionnaire_stock','magasinier'
    )
    and created_by=auth.uid()
    and created_by_pharmacie_id is not null
    and (select private.naxa_scope_allows(auth.uid(),created_by_pharmacie_id,'PHARMACIE'))
    and fiche_validee is not true
  )
);

drop policy if exists produits_update on public.produits;
create policy produits_update
on public.produits
for update
to authenticated
using (
  (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'promoteur','pharmacie','pharmacien','pharmacien_assistant',
      'responsable','gestionnaire_stock','magasinier'
    )
    and created_by_pharmacie_id is not null
    and (select private.naxa_scope_allows(auth.uid(),created_by_pharmacie_id,'PHARMACIE'))
  )
)
with check (
  (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'promoteur','pharmacie','pharmacien','pharmacien_assistant',
      'responsable','gestionnaire_stock','magasinier'
    )
    and created_by_pharmacie_id is not null
    and (select private.naxa_scope_allows(auth.uid(),created_by_pharmacie_id,'PHARMACIE'))
  )
);

commit;
