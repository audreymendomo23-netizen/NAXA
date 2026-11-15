-- NAXA — Pharmacy-owned product declaration and initial stock reference.
-- Atomic: create/reuse the pharmacy-declared product and initialize its stock row at 0.
-- No NAXA/Admin fiche approval is part of this flow.

begin;

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
  if v_user is null then
    raise exception 'Connexion requise';
  end if;

  if p_pharmacie is null or public.my_pharmacie() is distinct from p_pharmacie then
    raise exception 'Sélectionnez une pharmacie active de votre affectation';
  end if;

  select coalesce(private.naxa_business_function(v_user),'')
    into v_role;
  if v_role not in (
    'pharmacie','pharmacien','pharmacien_assistant',
    'responsable','gestionnaire_stock','magasinier'
  ) then
    raise exception 'La déclaration produit est réservée aux fonctions professionnelles de la pharmacie';
  end if;

  select p.actif into v_profile_active
  from public.profiles p
  where p.id=v_user;
  if v_profile_active is not true then
    raise exception 'Profil inactif';
  end if;

  if not exists (
    select 1 from public.pharmacies p
    where p.id=p_pharmacie and p.actif is true and p.archivee_le is null
  ) then
    raise exception 'Pharmacie inactive ou archivée';
  end if;

  if p_nom is null or char_length(trim(p_nom)) not between 2 and 180
     or p_dci is null or char_length(trim(p_dci)) not between 1 and 180
     or p_dosage is null or char_length(trim(p_dosage)) not between 1 and 80
     or p_forme is null or char_length(trim(p_forme)) not between 1 and 100 then
    raise exception 'Nom, DCI, dosage et forme sont obligatoires';
  end if;

  if p_prix is null or p_prix<0 then
    raise exception 'Prix de vente FCFA invalide';
  end if;

  if p_emplacement is not null and char_length(trim(p_emplacement))>160 then
    raise exception 'Emplacement limité à 160 caractères';
  end if;

  if p_code_barre is not null and trim(p_code_barre)<>'' and trim(p_code_barre) !~ '^[0-9]{8,14}$' then
    raise exception 'Code-barres invalide (8 à 14 chiffres)';
  end if;

  -- Reuse an exact shared catalogue identity where possible; the pharmacy remains
  -- responsible for its own stock, price, lot and expiry on this product.
  select p.id into v_product
  from public.produits p
  where lower(trim(p.nom))=lower(trim(p_nom))
    and lower(trim(p.dci))=lower(trim(p_dci))
    and lower(trim(p.dosage))=lower(trim(p_dosage))
    and lower(trim(p.forme))=lower(trim(p_forme))
  order by p.id
  limit 1;

  if v_product is null then
    insert into public.produits(
      nom,dci,dosage,forme,code_barre,sur_ordonnance,
      source_fiche,fiche_validee
    )
    values(
      trim(p_nom),trim(p_dci),trim(p_dosage),trim(p_forme),
      nullif(trim(coalesce(p_code_barre,'')),''),coalesce(p_sur_ordonnance,false),
      'declaration_pharmacie',false
    )
    returning id into v_product;
  end if;

  -- Existing guarded RPC performs the active pharmacy / professional assignment
  -- checks, and creates a zero-quantity reference only (never fictitious stock).
  perform public.gestionnaire_stock_reference_initialiser(
    p_pharmacie,v_product,p_prix,nullif(trim(coalesce(p_emplacement,'')),'')
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

commit;
