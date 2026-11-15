-- NAXA — pharmacy-owned descriptive product identities.
-- Every pharmacy can declare/edit its own fiche, even when another pharmacy
-- already declared the same nominal medicine. NAXA/Admin does not approve it.
-- Legacy catalogue rows with a NULL owner remain reusable by pharmacies.

begin;

-- Fail closed rather than constructing a non-unique scoped identity index.
do $preflight$
begin
  if exists (
    select 1
    from public.produits
    where created_by_pharmacie_id is not null
    group by created_by_pharmacie_id,
      lower(btrim(nom)), lower(btrim(dci)), lower(btrim(dosage)), lower(btrim(forme))
    having count(*) > 1
  ) then
    raise exception 'Doublons de fiches déjà présents dans une pharmacie ; corriger avant migration';
  end if;

  if exists (
    select 1
    from public.produits
    where created_by_pharmacie_id is not null
      and nullif(btrim(code_barre), '') is not null
    group by created_by_pharmacie_id, btrim(code_barre)
    having count(*) > 1
  ) then
    raise exception 'Doublons de code-barres déjà présents dans une pharmacie ; corriger avant migration';
  end if;
end
$preflight$;

-- Remove global identity rules. A product identity now belongs to one pharmacy.
alter table public.produits
  drop constraint if exists produits_nom_dosage_forme_key;

drop index if exists public.produits_code_barre_uq;

create unique index produits_pharmacy_identity_uq
  on public.produits (
    created_by_pharmacie_id,
    lower(btrim(nom)),
    lower(btrim(dci)),
    lower(btrim(dosage)),
    lower(btrim(forme))
  )
  where created_by_pharmacie_id is not null;

create unique index produits_pharmacy_barcode_uq
  on public.produits (created_by_pharmacie_id, btrim(code_barre))
  where created_by_pharmacie_id is not null
    and nullif(btrim(code_barre), '') is not null;

-- Create/reuse only the current pharmacy's own declaration.
-- Legacy shared catalogue rows (NULL owner) remain selectable from the
-- pharmacy stock screen, but a new declaration never adopts another owner's fiche.
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
  v_code_barre text := nullif(btrim(coalesce(p_code_barre,'')),'');
  v_emplacement text := nullif(btrim(coalesce(p_emplacement,'')),'');
begin
  if v_user is null then
    raise exception 'Connexion requise';
  end if;

  select coalesce(private.naxa_business_function(v_user),'')
    into v_role;

  if v_role not in (
    'promoteur','pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  ) then
    raise exception 'La déclaration produit est réservée aux fonctions professionnelles de la pharmacie';
  end if;

  if not private.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') then
    raise exception 'Pharmacie hors périmètre de votre compte';
  end if;

  select p.actif into v_profile_active
  from public.profiles p
  where p.id=v_user;
  if v_profile_active is not true then
    raise exception 'Profil inactif';
  end if;

  if p_nom is null or char_length(btrim(p_nom)) not between 2 and 180
     or p_dci is null or char_length(btrim(p_dci)) not between 1 and 180
     or p_dosage is null or char_length(btrim(p_dosage)) not between 1 and 80
     or p_forme is null or char_length(btrim(p_forme)) not between 1 and 100 then
    raise exception 'Nom, DCI, dosage et forme sont obligatoires';
  end if;

  if p_prix is null or p_prix<0 then
    raise exception 'Prix de vente FCFA invalide';
  end if;

  if v_emplacement is not null and char_length(v_emplacement)>160 then
    raise exception 'Emplacement limité à 160 caractères';
  end if;

  if v_code_barre is not null and v_code_barre !~ '^[0-9]{8,14}$' then
    raise exception 'Code-barres invalide (8 à 14 chiffres)';
  end if;

  -- Serialize declarations for the same pharmacy/identity, then for an
  -- optional barcode. This makes the per-pharmacy uniqueness deterministic.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'naxa-product-fiche:' || p_pharmacie::text || ':' ||
      lower(btrim(p_nom)) || chr(31) ||
      lower(btrim(p_dci)) || chr(31) ||
      lower(btrim(p_dosage)) || chr(31) ||
      lower(btrim(p_forme)),
      0
    )
  );

  if v_code_barre is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'naxa-product-barcode:' || p_pharmacie::text || ':' || v_code_barre,
        0
      )
    );

    if exists (
      select 1
      from public.produits p
      where p.created_by_pharmacie_id=p_pharmacie
        and btrim(p.code_barre)=v_code_barre
        and not (
          lower(btrim(p.nom))=lower(btrim(p_nom))
          and lower(btrim(p.dci))=lower(btrim(p_dci))
          and lower(btrim(p.dosage))=lower(btrim(p_dosage))
          and lower(btrim(p.forme))=lower(btrim(p_forme))
        )
    ) then
      raise exception 'Ce code-barres est déjà utilisé par une autre fiche de votre pharmacie';
    end if;
  end if;

  select p.id into v_product
  from public.produits p
  where p.created_by_pharmacie_id=p_pharmacie
    and lower(btrim(p.nom))=lower(btrim(p_nom))
    and lower(btrim(p.dci))=lower(btrim(p_dci))
    and lower(btrim(p.dosage))=lower(btrim(p_dosage))
    and lower(btrim(p.forme))=lower(btrim(p_forme))
  for update;

  if v_product is not null then
    -- Re-submitting an existing fiche may update that pharmacy's price/location,
    -- but never the quantity or another pharmacy's product description.
    update public.stocks
    set prix=p_prix,
        emplacement=coalesce(v_emplacement,emplacement),
        updated_at=now()
    where pharmacie_id=p_pharmacie and produit_id=v_product;

    if found then
      return v_product;
    end if;

    perform public.gestionnaire_stock_reference_initialiser(
      p_pharmacie,v_product,p_prix,v_emplacement
    );
    return v_product;
  end if;

  perform set_config('naxa.product_declaration_pharmacy',p_pharmacie::text,true);

  insert into public.produits(
    nom,dci,dosage,forme,code_barre,sur_ordonnance,source_fiche,fiche_validee
  )
  values(
    btrim(p_nom),btrim(p_dci),btrim(p_dosage),btrim(p_forme),
    v_code_barre,coalesce(p_sur_ordonnance,false),
    'declaration_pharmacie',false
  )
  returning id into v_product;

  perform public.gestionnaire_stock_reference_initialiser(
    p_pharmacie,v_product,p_prix,v_emplacement
  );

  return v_product;
end;
$function$;

revoke all on function public.pharmacie_produit_declarer_et_reference_initialiser(
  uuid,text,text,text,text,integer,text,text,boolean
) from public,anon;

grant execute on function public.pharmacie_produit_declarer_et_reference_initialiser(
  uuid,text,text,text,text,integer,text,text,boolean
) to authenticated,service_role;

-- Generic initialisation may use a legacy shared catalogue entry or a fiche
-- owned by the target pharmacy. It cannot attach another pharmacy's fiche.
-- Admin remains a read-only observer of product declarations and stock offers.
create or replace function public.gestionnaire_stock_reference_initialiser(
  p_pharmacie uuid,
  p_produit uuid,
  p_prix integer,
  p_emplacement text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_owner uuid;
begin
  if v_user is null then
    raise exception 'Connexion requise';
  end if;

  if private.naxa_business_function(v_user)='admin' then
    raise exception 'Administrateur : consultation uniquement du catalogue et des offres pharmacie';
  end if;

  if p_prix is null or p_prix<0 then
    raise exception 'Prix de vente invalide';
  end if;

  if p_emplacement is not null and char_length(trim(p_emplacement))>160 then
    raise exception 'Emplacement limité à 160 caractères';
  end if;

  if not private.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE')
     and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
     and not public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier') then
    raise exception 'Pharmacie hors périmètre';
  end if;

  if not exists (
    select 1 from public.pharmacies p
    where p.id=p_pharmacie and p.actif=true and p.archivee_le is null
  ) then
    raise exception 'Pharmacie inactive ou archivée';
  end if;

  select p.created_by_pharmacie_id into v_owner
  from public.produits p
  where p.id=p_produit;

  if not found then
    raise exception 'Produit catalogue introuvable';
  end if;

  if v_owner is not null and v_owner is distinct from p_pharmacie then
    raise exception 'Cette fiche appartient à une autre pharmacie. Déclarez votre propre fiche produit';
  end if;

  select * into v_profile
  from public.profiles
  where id=v_user and actif=true;

  if not found or not (
    private.naxa_business_function(v_user)='promoteur'
    or private.naxa_business_function(v_user) in (
      'pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'
    )
    or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')
    or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(v_user,p_pharmacie,'magasinier')
  ) then
    raise exception 'Initialisation de stock non autorisée';
  end if;

  insert into public.stocks(pharmacie_id,produit_id,prix,quantite,emplacement)
  values(p_pharmacie,p_produit,p_prix,0,nullif(trim(coalesce(p_emplacement,'')),''));

  if not found then
    raise exception 'Référence non initialisée';
  end if;

  return true;
exception when unique_violation then
  raise exception 'Cette référence existe déjà dans le stock de cette pharmacie';
end;
$function$;

-- The Admin remains allowed to inspect the catalogue but cannot insert/update
-- pharmacy declarations. No central approval or mutation path is granted.
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
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
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
end;
$function$;

drop policy if exists produits_write on public.produits;
create policy produits_write
on public.produits
for insert
to authenticated
with check (
  (select private.naxa_business_function(auth.uid())) in (
    'promoteur','pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  )
  and created_by=auth.uid()
  and created_by_pharmacie_id is not null
  and (select private.naxa_scope_allows(auth.uid(),created_by_pharmacie_id,'PHARMACIE'))
  and fiche_validee is not true
);

drop policy if exists produits_update on public.produits;
create policy produits_update
on public.produits
for update
to authenticated
using (
  (select private.naxa_business_function(auth.uid())) in (
    'promoteur','pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  )
  and created_by_pharmacie_id is not null
  and (select private.naxa_scope_allows(auth.uid(),created_by_pharmacie_id,'PHARMACIE'))
)
with check (
  (select private.naxa_business_function(auth.uid())) in (
    'promoteur','pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  )
  and created_by_pharmacie_id is not null
  and (select private.naxa_scope_allows(auth.uid(),created_by_pharmacie_id,'PHARMACIE'))
);

commit;
