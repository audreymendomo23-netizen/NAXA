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

-- Promoteur can declare for any active pharmacy in their validated network.
create or replace function public.pharmacie_produit_declarer_et_reference_initialiser(
  p_pharmacie uuid,
  p_nom text,
  p_dci text,
  p_dosage text,
  p_forme text,
  p_prix integer,
  p_emplacement text default null,
  p_code_barre text default null,
  p_sur_ordonnance boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_profile_active boolean;
  v_product uuid;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;

  select coalesce(private.naxa_business_function(v_user),'') into v_role;
  if v_role not in (
    'promoteur','pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  ) then
    raise exception 'La déclaration produit est réservée aux fonctions professionnelles de la pharmacie';
  end if;
  if not private.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') then
    raise exception 'Pharmacie hors périmètre de votre compte';
  end if;

  select p.actif into v_profile_active from public.profiles p where p.id=v_user;
  if v_profile_active is not true then raise exception 'Profil inactif'; end if;

  if p_nom is null or char_length(trim(p_nom)) not between 2 and 180
     or p_dci is null or char_length(trim(p_dci)) not between 1 and 180
     or p_dosage is null or char_length(trim(p_dosage)) not between 1 and 80
     or p_forme is null or char_length(trim(p_forme)) not between 1 and 100 then
    raise exception 'Nom, DCI, dosage et forme sont obligatoires';
  end if;
  if p_prix is null or p_prix<0 then raise exception 'Prix de vente FCFA invalide'; end if;
  if p_emplacement is not null and char_length(trim(p_emplacement))>160 then
    raise exception 'Emplacement limité à 160 caractères';
  end if;
  if p_code_barre is not null and trim(p_code_barre)<>'' and trim(p_code_barre) !~ '^[0-9]{8,14}
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
 then
    raise exception 'Code-barres invalide (8 à 14 chiffres)';
  end if;

  select p.id into v_product
  from public.produits p
  where lower(trim(p.nom))=lower(trim(p_nom))
    and lower(trim(p.dci))=lower(trim(p_dci))
    and lower(trim(p.dosage))=lower(trim(p_dosage))
    and lower(trim(p.forme))=lower(trim(p_forme))
  order by p.id
  limit 1;

  if v_product is null then
    perform set_config('naxa.product_declaration_pharmacy',p_pharmacie::text,true);
    insert into public.produits(
      nom,dci,dosage,forme,code_barre,sur_ordonnance,source_fiche,fiche_validee
    )
    values(
      trim(p_nom),trim(p_dci),trim(p_dosage),trim(p_forme),
      nullif(trim(coalesce(p_code_barre,'')),''),coalesce(p_sur_ordonnance,false),
      'declaration_pharmacie',false
    )
    returning id into v_product;
  end if;

  perform public.gestionnaire_stock_reference_initialiser(
    p_pharmacie,v_product,p_prix,nullif(trim(coalesce(p_emplacement,'')),'')
  );
  return v_product;
end;
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
