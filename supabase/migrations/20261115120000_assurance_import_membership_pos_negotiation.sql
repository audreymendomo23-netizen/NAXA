-- NAXA Assurance : import strict des listes reçues, vérification par pharmacie,
-- accord versionné du Client et réconciliation POS sur le dernier partage accepté.
begin;

-- 1) Une couverture déclarée par le Client ne devient éligible qu'après rapprochement
-- exact d'une liste reçue de l'assureur pour la pharmacie concernée.
alter table public.couvertures_assurance
  add column if not exists verification_statut text not null default 'non_verifiee',
  add column if not exists verification_pharmacie_id uuid references public.pharmacies(id) on delete restrict,
  add column if not exists verification_import_id uuid,
  add column if not exists verification_le timestamptz,
  add column if not exists verification_par uuid references auth.users(id) on delete restrict;

alter table public.couvertures_assurance
  drop constraint if exists couvertures_assurance_verification_statut_check;
alter table public.couvertures_assurance
  add constraint couvertures_assurance_verification_statut_check
  check (verification_statut in ('non_verifiee','verifiee','suspendue','expiree'));

create or replace function private.assurance_normaliser_identifiant(p_value text)
returns text
language sql
immutable
set search_path=''
as $function$
  select nullif(upper(regexp_replace(trim(coalesce(p_value,'')),'[[:space:]]+','','g')),'')
$function$;

create table if not exists public.assurance_imports (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  assureur_id uuid not null references public.assureurs(id) on delete restrict,
  reference_source text not null check (char_length(btrim(reference_source)) between 3 and 120),
  nom_fichier text not null check (char_length(btrim(nom_fichier)) between 1 and 180),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  statut text not null default 'simulee' check (statut in ('simulee','appliquee')),
  total_lignes integer not null default 0 check (total_lignes between 0 and 5000),
  correspondances integer not null default 0 check (correspondances >= 0),
  sans_correspondance integer not null default 0 check (sans_correspondance >= 0),
  ambiguite integer not null default 0 check (ambiguite >= 0),
  invalides integer not null default 0 check (invalides >= 0),
  doublons integer not null default 0 check (doublons >= 0),
  cree_par uuid not null references auth.users(id) on delete restrict,
  cree_le timestamptz not null default now(),
  applique_par uuid references auth.users(id) on delete restrict,
  applique_le timestamptz,
  constraint assurance_imports_file_once unique (pharmacie_id,assureur_id,sha256)
);

create table if not exists public.assurance_import_lignes (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.assurance_imports(id) on delete restrict,
  numero_ligne integer not null check (numero_ligne > 0),
  numero_adherent text,
  numero_police text,
  beneficiaire_nom text,
  membre_statut text check (membre_statut is null or membre_statut in ('actif','suspendu','expire')),
  date_debut date,
  date_fin date,
  adherent_normalise text,
  police_normalisee text,
  beneficiaire_normalise text,
  couverture_id uuid references public.couvertures_assurance(id) on delete restrict,
  resultat text not null check (resultat in (
    'correspondance_unique','sans_correspondance','ambigu','doublon_fichier','invalide','appliquee'
  )),
  motif text,
  appliquee_le timestamptz,
  constraint assurance_import_lignes_numero_uq unique (import_id,numero_ligne),
  constraint assurance_import_lignes_dates_check check (date_fin is null or date_debut is null or date_fin>=date_debut)
);

create index if not exists assurance_imports_pharmacy_date_idx
  on public.assurance_imports(pharmacie_id,cree_le desc);
create index if not exists assurance_import_lignes_import_result_idx
  on public.assurance_import_lignes(import_id,resultat);
create index if not exists assurance_import_lignes_match_idx
  on public.assurance_import_lignes(adherent_normalise,police_normalisee,beneficiaire_normalise);

alter table public.couvertures_assurance
  drop constraint if exists couvertures_assurance_verification_import_id_fkey;
alter table public.couvertures_assurance
  add constraint couvertures_assurance_verification_import_id_fkey
  foreign key (verification_import_id) references public.assurance_imports(id) on delete restrict;

alter table public.assurance_imports enable row level security;
alter table public.assurance_import_lignes enable row level security;
drop policy if exists assurance_imports_pharmacy_read on public.assurance_imports;
create policy assurance_imports_pharmacy_read
on public.assurance_imports for select to authenticated
using (
  public.can_access_pharmacy(pharmacie_id)
  and private.naxa_business_function(auth.uid()) in ('promoteur','pharmacien','responsable')
);
drop policy if exists assurance_import_lignes_pharmacy_read on public.assurance_import_lignes;
create policy assurance_import_lignes_pharmacy_read
on public.assurance_import_lignes for select to authenticated
using (
  exists (
    select 1 from public.assurance_imports i
    where i.id=import_id
      and public.can_access_pharmacy(i.pharmacie_id)
      and private.naxa_business_function(auth.uid()) in ('promoteur','pharmacien','responsable')
  )
);
revoke all on table public.assurance_imports from public,anon,authenticated;
revoke all on table public.assurance_import_lignes from public,anon,authenticated;
grant select on table public.assurance_imports,public.assurance_import_lignes to authenticated;
grant all on table public.assurance_imports,public.assurance_import_lignes to service_role;

create or replace function public.assurance_import_simuler(
  p_pharmacie uuid,
  p_assureur uuid,
  p_reference_source text,
  p_nom_fichier text,
  p_sha256 text,
  p_lignes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_batch uuid;
  v_entry record;
  v_row jsonb;
  v_member text;
  v_policy text;
  v_beneficiary text;
  v_status text;
  v_start_text text;
  v_end_text text;
  v_start date;
  v_end date;
  v_member_key text;
  v_policy_key text;
  v_beneficiary_key text;
  v_match_count integer;
  v_coverage uuid;
  v_result text;
  v_reason text;
  v_total integer:=0;
  v_matches integer:=0;
  v_unmatched integer:=0;
  v_ambiguous integer:=0;
  v_invalid integer:=0;
  v_duplicates integer:=0;
begin
  if v_uid is null then raise exception 'Connexion professionnelle requise'; end if;
  v_role:=private.naxa_business_function(v_uid);
  if v_role not in ('promoteur','pharmacien','responsable')
     or not private.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then
    raise exception 'Import réservé au Promoteur, Pharmacien ou Responsable de la pharmacie active';
  end if;
  if not exists(select 1 from public.assureurs a where a.id=p_assureur and a.actif=true) then
    raise exception 'Assureur actif introuvable';
  end if;
  if char_length(btrim(coalesce(p_reference_source,''))) not between 3 and 120
     or char_length(btrim(coalesce(p_nom_fichier,''))) not between 1 and 180
     or p_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'Référence source, nom de fichier ou empreinte SHA-256 invalide';
  end if;
  if jsonb_typeof(p_lignes)<>'array'
     or jsonb_array_length(p_lignes)<1 or jsonb_array_length(p_lignes)>5000 then
    raise exception 'Le fichier doit contenir entre 1 et 5 000 lignes de données';
  end if;

  select id into v_batch from public.assurance_imports
  where pharmacie_id=p_pharmacie and assureur_id=p_assureur and sha256=lower(p_sha256);
  if v_batch is not null then
    raise exception 'Ce fichier a déjà été importé ou simulé pour cet assureur et cette pharmacie';
  end if;

  insert into public.assurance_imports(
    pharmacie_id,assureur_id,reference_source,nom_fichier,sha256,statut,total_lignes,cree_par
  ) values(
    p_pharmacie,p_assureur,trim(p_reference_source),trim(p_nom_fichier),lower(p_sha256),
    'simulee',jsonb_array_length(p_lignes),v_uid
  ) returning id into v_batch;

  for v_entry in
    select value,ordinality::integer numero
    from jsonb_array_elements(p_lignes) with ordinality
  loop
    v_row:=v_entry.value;
    v_total:=v_total+1;
    v_member:=nullif(btrim(coalesce(v_row->>'numero_adherent','')),'');
    v_policy:=nullif(btrim(coalesce(v_row->>'numero_police','')),'');
    v_beneficiary:=nullif(btrim(coalesce(v_row->>'beneficiaire_nom','')),'');
    v_status:=lower(trim(coalesce(v_row->>'statut','')));
    v_start_text:=nullif(trim(coalesce(v_row->>'date_debut','')),'');
    v_end_text:=nullif(trim(coalesce(v_row->>'date_fin','')),'');
    v_start:=null;
    v_end:=null;
    v_reason:=null;
    v_result:='invalide';
    v_coverage:=null;
    v_match_count:=0;
    v_member_key:=private.assurance_normaliser_identifiant(v_member);
    v_policy_key:=private.assurance_normaliser_identifiant(v_policy);
    v_beneficiary_key:=private.assurance_normaliser_nom(v_beneficiary);

    begin
      if jsonb_typeof(v_row)<>'object' then
        v_reason:='Ligne non structurée';
      elsif v_member_key is null or char_length(v_member)>100 then
        v_reason:='Numéro adhérent absent ou trop long';
      elsif v_policy is not null and char_length(v_policy)>100 then
        v_reason:='Numéro de police trop long';
      elsif v_beneficiary is not null and char_length(v_beneficiary)>160 then
        v_reason:='Nom du bénéficiaire trop long';
      elsif v_start_text is null or v_start_text !~ '^\d{4}-\d{2}-\d{2}$' then
        v_reason:='Date de début requise au format AAAA-MM-JJ';
      elsif v_end_text is not null and v_end_text !~ '^\d{4}-\d{2}-\d{2}$' then
        v_reason:='Date de fin invalide ; format AAAA-MM-JJ requis';
      elsif v_status not in ('actif','active','valide','valid','suspendu','suspendue','suspended','expire','expiree','expiré','expired','resilie','résilié','inactif') then
        v_reason:='Statut assureur absent ou non reconnu';
      else
        v_start:=v_start_text::date;
        if v_end_text is not null then v_end:=v_end_text::date; end if;
        if v_end is not null and v_end<v_start then
          v_reason:='La fin de validité précède le début';
        end if;
      end if;
    exception when others then
      v_reason:='Date invalide dans le fichier assureur';
    end;

    if v_reason is null then
      v_status:=case
        when v_status in ('suspendu','suspendue','suspended') then 'suspendu'
        when v_status in ('expire','expiree','expiré','expired','resilie','résilié','inactif') then 'expire'
        else 'actif'
      end;
      select count(*),(array_agg(c.id order by c.id))[1]
      into v_match_count,v_coverage
      from public.couvertures_assurance c
      join public.profiles p on p.id=c.client_id and p.role::text='client' and p.actif=true
      where c.assureur_id=p_assureur
        and private.assurance_normaliser_identifiant(c.numero_adherent)=v_member_key
        and private.assurance_normaliser_identifiant(c.numero_police) is not distinct from v_policy_key
        and (
          v_beneficiary_key is null
          or private.assurance_normaliser_nom(concat_ws(' ',p.first_name,p.last_name))=v_beneficiary_key
        );

      if v_match_count=0 then
        v_result:='sans_correspondance';
        v_reason:='Aucune couverture NAXA ne correspond exactement à l''adhérent, la police et au bénéficiaire déclaré';
      elsif v_match_count>1 then
        v_result:='ambigu';
        v_reason:='Plusieurs couvertures correspondent ; aucune n''a été vérifiée';
        v_coverage:=null;
      else
        v_result:='correspondance_unique';
      end if;
    end if;

    insert into public.assurance_import_lignes(
      import_id,numero_ligne,numero_adherent,numero_police,beneficiaire_nom,
      membre_statut,date_debut,date_fin,adherent_normalise,police_normalisee,
      beneficiaire_normalise,couverture_id,resultat,motif
    ) values(
      v_batch,v_entry.numero,v_member,v_policy,v_beneficiary,v_status,v_start,v_end,
      v_member_key,v_policy_key,v_beneficiary_key,v_coverage,v_result,v_reason
    );
  end loop;

  update public.assurance_import_lignes l
  set resultat='doublon_fichier',couverture_id=null,
      motif='Clé adhérent/police/bénéficiaire répétée dans le fichier ; vérification manuelle requise'
  where l.import_id=v_batch and l.resultat='correspondance_unique'
    and exists(
      select 1 from public.assurance_import_lignes x
      where x.import_id=l.import_id and x.id<>l.id
        and x.adherent_normalise=l.adherent_normalise
        and coalesce(x.police_normalisee,'')=coalesce(l.police_normalisee,'')
        and coalesce(x.beneficiaire_normalise,'')=coalesce(l.beneficiaire_normalise,'')
    );

  select
    count(*) filter(where resultat='correspondance_unique'),
    count(*) filter(where resultat='sans_correspondance'),
    count(*) filter(where resultat='ambigu'),
    count(*) filter(where resultat='invalide'),
    count(*) filter(where resultat='doublon_fichier')
  into v_matches,v_unmatched,v_ambiguous,v_invalid,v_duplicates
  from public.assurance_import_lignes where import_id=v_batch;

  update public.assurance_imports
  set correspondances=v_matches,sans_correspondance=v_unmatched,
      ambiguite=v_ambiguous,invalides=v_invalid,doublons=v_duplicates
  where id=v_batch;

  return jsonb_build_object(
    'import_id',v_batch,'statut','simulee','total_lignes',v_total,
    'correspondances',v_matches,'sans_correspondance',v_unmatched,
    'ambiguite',v_ambiguous,'invalides',v_invalid,'doublons',v_duplicates
  );
end;
$function$;

create or replace function public.assurance_import_appliquer(p_import uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_i public.assurance_imports%rowtype;
  v_role text;
  v_applied integer:=0;
  v_suspended integer:=0;
  v_expired integer:=0;
begin
  if v_uid is null then raise exception 'Connexion professionnelle requise'; end if;
  select * into v_i from public.assurance_imports where id=p_import for update;
  if not found then raise exception 'Import introuvable'; end if;
  v_role:=private.naxa_business_function(v_uid);
  if v_role not in ('promoteur','pharmacien','responsable')
     or not private.naxa_scope_allows(v_uid,v_i.pharmacie_id,'PHARMACIE') then
    raise exception 'Import hors périmètre ou poste non autorisé';
  end if;
  if v_i.statut<>'simulee' then raise exception 'Cet import a déjà été appliqué'; end if;
  if v_i.correspondances<1 then
    raise exception 'Aucune correspondance unique à appliquer ; corrigez le fichier ou les identifiants NAXA';
  end if;

  update public.couvertures_assurance c
  set verification_statut=case
        when l.membre_statut='suspendu' then 'suspendue'
        when l.membre_statut='expire' or (l.date_fin is not null and l.date_fin<current_date) then 'expiree'
        else 'verifiee'
      end,
      actif=case
        when l.membre_statut='actif' and (l.date_fin is null or l.date_fin>=current_date) then true
        else false
      end,
      date_debut=l.date_debut,
      date_fin=l.date_fin,
      verification_pharmacie_id=v_i.pharmacie_id,
      verification_import_id=v_i.id,
      verification_le=now(),
      verification_par=v_uid
  from public.assurance_import_lignes l
  where l.import_id=v_i.id and l.resultat='correspondance_unique'
    and c.id=l.couverture_id and c.assureur_id=v_i.assureur_id;

  get diagnostics v_applied=row_count;
  if v_applied<1 then raise exception 'Aucune couverture encore raccordée ; import non appliqué'; end if;

  update public.assurance_import_lignes
  set resultat='appliquee',appliquee_le=now()
  where import_id=v_i.id and resultat='correspondance_unique';

  select count(*) filter(where membre_statut='suspendu'),
         count(*) filter(where membre_statut='expire' or (date_fin is not null and date_fin<current_date))
  into v_suspended,v_expired
  from public.assurance_import_lignes
  where import_id=v_i.id and resultat='appliquee';

  update public.assurance_imports
  set statut='appliquee',applique_par=v_uid,applique_le=now()
  where id=v_i.id;

  insert into public.assurance_evenements(
    pharmacie_id,assureur_id,acteur_id,type,details
  ) values(
    v_i.pharmacie_id,v_i.assureur_id,v_uid,'liste_assures_importee',
    jsonb_build_object(
      'import_id',v_i.id,'reference_source',v_i.reference_source,
      'sha256',v_i.sha256,'total_lignes',v_i.total_lignes,
      'couvertures_appliquees',v_applied,'suspendues',v_suspended,'expirees',v_expired
    )
  );

  return jsonb_build_object(
    'import_id',v_i.id,'statut','appliquee','couvertures_appliquees',v_applied,
    'suspendues',v_suspended,'expirees',v_expired
  );
end;
$function$;

revoke all on function public.assurance_import_simuler(uuid,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.assurance_import_simuler(uuid,uuid,text,text,text,jsonb) to authenticated;
revoke all on function public.assurance_import_appliquer(uuid) from public,anon;
grant execute on function public.assurance_import_appliquer(uuid) to authenticated;

-- 2) Le client ne peut pas conserver une validation si sa déclaration change.
create or replace function public.assurance_enregistrer_couverture(
  p_assureur uuid,p_numero_adherent text,p_numero_police text,
  p_date_debut date,p_date_fin date,p_plafond numeric,p_taux numeric
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles p where p.id=v_uid and p.role='client' and p.actif=true
  ) then raise exception 'Compte client actif requis'; end if;
  if not exists(select 1 from public.assureurs a where a.id=p_assureur and a.actif=true) then
    raise exception 'Assureur inconnu ou inactif';
  end if;
  if length(trim(coalesce(p_numero_adherent,''))) not between 2 and 100
    or length(trim(coalesce(p_numero_police,'')))>100
    or p_date_debut is null or (p_date_fin is not null and p_date_fin<p_date_debut) then
    raise exception 'Informations de couverture invalides';
  end if;
  select id into v_id from public.couvertures_assurance
  where client_id=v_uid and assureur_id=p_assureur
    and lower(trim(numero_adherent))=lower(trim(p_numero_adherent))
  order by created_at desc limit 1;
  if v_id is not null then
    update public.couvertures_assurance set
      numero_police=nullif(trim(coalesce(p_numero_police,'')),''),
      date_debut=p_date_debut,date_fin=p_date_fin,plafond=null,
      taux_prise_en_charge=100,actif=true,
      verification_statut='non_verifiee',verification_pharmacie_id=null,
      verification_import_id=null,verification_le=null,verification_par=null
    where id=v_id;
    return v_id;
  end if;
  insert into public.couvertures_assurance(
    client_id,assureur_id,numero_adherent,numero_police,date_debut,date_fin,
    plafond,taux_prise_en_charge,actif,verification_statut
  ) values(
    v_uid,p_assureur,trim(p_numero_adherent),
    nullif(trim(coalesce(p_numero_police,'')),''),p_date_debut,p_date_fin,
    null,100,true,'non_verifiee'
  )
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric) from public,anon;
grant execute on function public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric) to authenticated;

-- 3) Calcul d'un devis uniquement sur une couverture rapprochée sur la liste
-- importée par la pharmacie active. Le tarif reste celui de la convention.
create or replace function public.assurance_calculer_devis(p_reservation uuid,p_couverture uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid(); v_r public.reservations%rowtype; v_c public.couvertures_assurance%rowtype;
  v_conv public.assurance_conventions%rowtype; v_item record; v_rule public.assurance_regles_convention%rowtype;
  v_snapshot uuid; v_brut bigint:=0; v_assureur bigint:=0; v_client bigint;
  v_line_brut bigint; v_line_cover bigint; v_rate numeric; v_remaining bigint; v_excluded boolean;
  v_lines jsonb:='[]'::jsonb; v_rules jsonb:='[]'::jsonb; v_docs jsonb:='[]'::jsonb;
begin
  if v_uid is null then raise exception 'Connexion client requise'; end if;
  select * into v_r from public.reservations where id=p_reservation and client_id=v_uid for update;
  if not found or v_r.mode<>'reservation' or v_r.statut not in ('en_attente','confirmee') then
    raise exception 'Réservation non éligible au devis assurance';
  end if;
  if exists(select 1 from public.assurance_reservation_snapshots where reservation_id=v_r.id) then
    raise exception 'Un devis est déjà figé pour cette réservation ; créez une nouvelle réservation pour recalculer';
  end if;
  select * into v_c from public.couvertures_assurance
  where id=p_couverture and client_id=v_uid and actif
    and date_debut<=current_date and (date_fin is null or date_fin>=current_date)
    and verification_statut='verifiee'
    and verification_pharmacie_id=v_r.pharmacie_id
    and verification_import_id is not null;
  if not found then
    raise exception 'Couverture non retrouvée dans une liste assureur importée pour cette pharmacie, inactive ou expirée';
  end if;
  select * into v_conv from public.assurance_conventions
  where pharmacie_id=v_r.pharmacie_id and assureur_id=v_c.assureur_id
    and statut='active' and date_debut<=current_date and (date_fin is null or date_fin>=current_date);
  if not found then raise exception 'Cette pharmacie n’a pas de convention active avec cet assureur'; end if;
  v_remaining:=case when v_c.plafond is null then 9223372036854775807 else greatest(0,round(v_c.plafond)::bigint) end;

  for v_item in
    select ri.produit_id,ri.quantite,ri.prix_unitaire,p.nom,p.categorie
    from public.reservation_items ri join public.produits p on p.id=ri.produit_id
    where ri.reservation_id=v_r.id order by ri.produit_id
  loop
    v_line_brut:=v_item.prix_unitaire::bigint*v_item.quantite::bigint;
    v_brut:=v_brut+v_line_brut;
    select * into v_rule from public.assurance_regles_convention r
    where r.convention_id=v_conv.id and r.actif
      and r.valide_du<=current_date and (r.valide_jusquau is null or r.valide_jusquau>=current_date)
      and (
        (r.portee='produit' and r.produit_id=v_item.produit_id)
        or (r.portee='categorie' and lower(r.categorie)=lower(v_item.categorie))
        or r.portee='tout'
      )
    order by case r.portee when 'produit' then 1 when 'categorie' then 2 else 3 end,
      r.valide_du desc,r.version desc limit 1;
    if not found then raise exception 'Aucune règle de prise en charge ne couvre le produit %',v_item.nom; end if;

    v_rate:=least(v_c.taux_prise_en_charge,v_rule.taux);
    v_excluded:=coalesce(v_rule.exclusions,'[]'::jsonb) ? v_item.produit_id::text
      or exists (
        select 1 from jsonb_array_elements_text(coalesce(v_rule.exclusions,'[]'::jsonb)) e(value)
        where lower(e.value)=lower(coalesce(v_item.categorie,'__none__'))
      );
    if v_excluded then
      v_line_cover:=0;
    else
      v_line_cover:=round(v_line_brut*v_rate/100)::bigint;
      if v_rule.plafond_fcfa is not null then v_line_cover:=least(v_line_cover,v_rule.plafond_fcfa); end if;
      v_line_cover:=greatest(0,v_line_cover-coalesce(v_rule.franchise_fcfa,0));
      v_line_cover:=least(v_line_cover,v_remaining);
      v_remaining:=v_remaining-v_line_cover;
    end if;
    v_docs:=v_docs||coalesce(v_rule.justificatifs_requis,'[]'::jsonb);
    v_rules:=v_rules||jsonb_build_array(jsonb_build_object(
      'rule_id',v_rule.id,'version',v_rule.version,'portee',v_rule.portee,
      'taux_applique',v_rate,'plafond_fcfa',v_rule.plafond_fcfa,
      'franchise_fcfa',v_rule.franchise_fcfa,'exclu',v_excluded
    ));
    v_assureur:=v_assureur+v_line_cover;
    v_lines:=v_lines||jsonb_build_array(jsonb_build_object(
      'produit_id',v_item.produit_id,'nom',v_item.nom,'quantite',v_item.quantite,
      'prix_unitaire_fcfa',v_item.prix_unitaire,'montant_brut_fcfa',v_line_brut,
      'montant_assureur_fcfa',v_line_cover,'montant_client_fcfa',v_line_brut-v_line_cover
    ));
  end loop;
  v_brut:=coalesce(v_brut,0);
  v_client:=v_brut-v_assureur;
  insert into public.assurance_reservation_snapshots(
    reservation_id,pharmacie_id,client_id,couverture_id,assureur_id,
    montant_brut_fcfa,montant_assureur_fcfa,montant_client_fcfa,regle_snapshot
  ) values(
    v_r.id,v_r.pharmacie_id,v_uid,v_c.id,v_c.assureur_id,
    v_brut,v_assureur,v_client,
    jsonb_build_object('convention_id',v_conv.id,'couverture_taux',v_c.taux_prise_en_charge,
      'couverture_plafond_fcfa',v_c.plafond,'rules',v_rules,'items',v_lines,
      'justificatifs_requis',(select coalesce(jsonb_agg(distinct value),'[]'::jsonb) from jsonb_array_elements(v_docs)))
  ) returning id into v_snapshot;
  insert into public.dossiers_assurance(
    pharmacie_id,client_id,couverture_id,reservation_id,statut,
    montant_total,montant_prise_en_charge,montant_client,created_by
  ) values(v_r.pharmacie_id,v_uid,v_c.id,v_r.id,'brouillon',v_brut,v_assureur,v_client,v_uid);
  insert into public.assurance_evenements(
    pharmacie_id,reservation_id,assureur_id,acteur_id,type,montant_fcfa,details
  ) values(v_r.pharmacie_id,v_r.id,v_c.assureur_id,v_uid,'devis_calcule',v_brut,
    jsonb_build_object('snapshot_id',v_snapshot,'part_assureur_fcfa',v_assureur,'part_client_fcfa',v_client));
  return v_snapshot;
end;
$function$;

revoke all on function public.assurance_calculer_devis(uuid,uuid) from public,anon;
grant execute on function public.assurance_calculer_devis(uuid,uuid) to authenticated;

-- 4) La dernière proposition acceptée est celle que la caisse et le déclencheur
-- comptable doivent rapprocher. Une proposition en attente bloque le paiement.
create or replace function private.assurance_lier_vente_reservation()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_dossier public.dossiers_assurance%rowtype;
  v_snapshot public.assurance_reservation_snapshots%rowtype;
  v_proposition public.assurance_montant_propositions%rowtype;
  v_part_client bigint;
  v_part_assureur bigint;
  v_has_proposition boolean:=false;
begin
  if new.reservation_id is null then return new; end if;
  select * into v_dossier from public.dossiers_assurance d
  where d.reservation_id=new.reservation_id and d.pharmacie_id=new.pharmacie_id
  for update;
  if not found then return new; end if;

  select * into v_snapshot from public.assurance_reservation_snapshots s
  where s.reservation_id=new.reservation_id for update;
  if not found then raise exception 'Dossier Assurance sans snapshot : vente bloquée'; end if;

  if exists(select 1 from public.assurance_montant_propositions p
    where p.dossier_id=v_dossier.id and p.statut='proposee') then
    raise exception 'Une proposition de montant attend encore la décision du Client';
  end if;

  select * into v_proposition
  from public.assurance_montant_propositions p
  where p.dossier_id=v_dossier.id and p.statut='acceptee'
  order by p.version desc limit 1;
  v_has_proposition:=found;
  if v_has_proposition then
    v_part_assureur:=v_proposition.montant_assureur_fcfa;
    v_part_client:=v_proposition.montant_client_fcfa;
  else
    v_part_assureur:=v_snapshot.montant_assureur_fcfa;
    v_part_client:=v_snapshot.montant_client_fcfa;
  end if;

  if new.statut='payee' then
    if not v_snapshot.valide_client or v_snapshot.controle_documents_statut<>'conforme'
      or v_dossier.statut not in ('accepte','clos') then
      raise exception 'Accord client, justificatifs conformes et prise en charge confirmée obligatoires';
    end if;
    if new.total_brut<>v_snapshot.montant_brut_fcfa
      or new.total_net<>v_snapshot.montant_brut_fcfa
      or round(v_dossier.montant_total)::bigint<>v_snapshot.montant_brut_fcfa
      or round(v_dossier.montant_prise_en_charge)::bigint<>v_part_assureur
      or round(v_dossier.montant_client)::bigint<>v_part_client
      or v_part_assureur+v_part_client<>new.total_net then
      raise exception 'Répartition POS incohérente avec la dernière proposition acceptée';
    end if;
    select coalesce(sum(vp.montant),0)::bigint into v_part_assureur
    from public.vente_paiements vp
    where vp.vente_id=new.id and vp.reference like 'ASSURANCE:%';
    select coalesce(sum(vp.montant),0)::bigint into v_part_client
    from public.vente_paiements vp
    where vp.vente_id=new.id and coalesce(vp.reference,'') not like 'ASSURANCE:%';
    if v_part_assureur<>round(v_dossier.montant_prise_en_charge)::bigint
      or v_part_client<>round(v_dossier.montant_client)::bigint
      or v_part_assureur+v_part_client<>new.total_net then
      raise exception 'Règlements POS différents du partage accepté';
    end if;
  end if;

  update public.dossiers_assurance d set vente_id=new.id
  where d.id=v_dossier.id and (d.vente_id is null or d.vente_id=new.id);
  if not found then raise exception 'Dossier Assurance déjà rattaché à une autre vente'; end if;

  if new.statut='payee' then
    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,type,montant_fcfa,details
    ) values(
      new.pharmacie_id,new.reservation_id,v_dossier.id,v_snapshot.assureur_id,new.created_by,
      'vente_assurance_enregistree',v_snapshot.montant_brut_fcfa,
      jsonb_build_object('vente_id',new.id,
        'part_client_fcfa',v_dossier.montant_client,
        'part_assureur_fcfa',v_dossier.montant_prise_en_charge,
        'proposition_version',case when v_has_proposition then v_proposition.version else null end)
    ) on conflict do nothing;

    if v_dossier.montant_prise_en_charge>0 then
      insert into public.compta_evenement(
        pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees,statut
      ) values(
        new.pharmacie_id,'assurance_prise_en_charge','dossier_assurance',v_dossier.id::text,
        'assurance-prise-en-charge:'||v_dossier.id::text,coalesce(new.paid_at,now()),
        jsonb_build_object('date_comptable',timezone('Africa/Douala',coalesce(new.paid_at,now()))::date::text,
          'montant_fcfa',round(v_dossier.montant_prise_en_charge)::bigint,
          'reference_source',coalesce(v_dossier.reference_externe,v_dossier.id::text),
          'dossier_id',v_dossier.id::text,'assureur_id',v_snapshot.assureur_id::text,
          'vente_id',new.id::text),
        'a_traiter'
      ) on conflict(pharmacie_id,cle_idempotence) do nothing;
    end if;
  end if;
  return new;
end;
$function$;

-- POS: mêmes montants que le dossier après accord explicite du Client.
create or replace function public.vente_reservation_encaisser(
  p_reservation uuid,p_session uuid,p_montant_percu integer,p_canal text,p_code_paiement text
) returns table(
  vente_id uuid,numero_vente text,total integer,monnaie_rendue integer,canal text,code_paiement text
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  r public.reservations%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_vente uuid;
  v_numero text;
  v_monnaie integer:=0;
  v_canal public.mode_paiement_caisse;
  v_montant_enregistre integer;
  v_snapshot public.assurance_reservation_snapshots%rowtype;
  v_dossier public.dossiers_assurance%rowtype;
  v_proposition public.assurance_montant_propositions%rowtype;
  v_has_assurance boolean:=false;
  v_has_proposition boolean:=false;
  v_part_assureur bigint:=0;
  v_part_client bigint;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null then raise exception 'Réservation et session de caisse requises'; end if;
  if p_code_paiement is null or length(btrim(p_code_paiement))<6 then raise exception 'Code de paiement requis'; end if;
  if p_montant_percu is null or p_montant_percu<0 then raise exception 'Montant perçu invalide'; end if;
  if p_canal not in ('especes','orange_money','mtn_momo','mobile_money','carte','autre') then raise exception 'Canal de paiement non pris en charge'; end if;
  v_canal:=p_canal::public.mode_paiement_caisse;

  select * into r from public.reservations where id=p_reservation for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  if r.mode<>'reservation' then raise exception 'Seules les réservations avec retrait en pharmacie sont encaissables ici'; end if;
  if upper(btrim(r.code_paiement))<>upper(btrim(p_code_paiement)) then raise exception 'Code de paiement incorrect'; end if;
  if r.statut<>'confirmee' then raise exception 'La réservation doit être confirmée par la pharmacie avant encaissement'; end if;
  if r.expires_at<=now() then raise exception 'Réservation expirée : aucun encaissement ne peut être effectué'; end if;
  if r.paiement_statut='effectue' then raise exception 'Cette réservation est déjà marquée comme payée'; end if;
  if not public.naxa_caisse_actor_for_pharmacy(r.pharmacie_id) then raise exception 'Encaissement réservé à un compte Caisse actif de cette pharmacie'; end if;

  select cs.* into v_session
  from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and cs.statut='ouverte' and cs.ouvert_par=auth.uid()
    and c.actif=true and c.pharmacie_id=r.pharmacie_id
  for update of cs;
  if not found then raise exception 'Session ouverte introuvable ou hors pharmacie'; end if;
  if exists(select 1 from public.ventes v where v.reservation_id=r.id) then raise exception 'Une vente POS est déjà liée à cette réservation'; end if;

  select coalesce(sum(ri.quantite*ri.prix_unitaire),0)::integer into v_montant_enregistre
  from public.reservation_items ri where ri.reservation_id=r.id;
  if not exists(select 1 from public.reservation_items ri where ri.reservation_id=r.id) then raise exception 'Réservation sans articles'; end if;
  if v_montant_enregistre<>r.total then raise exception 'Le total des articles ne correspond pas au total de la réservation'; end if;

  select * into v_snapshot from public.assurance_reservation_snapshots s
  where s.reservation_id=r.id for update;
  v_has_assurance:=found;
  select * into v_dossier from public.dossiers_assurance d
  where d.reservation_id=r.id and d.pharmacie_id=r.pharmacie_id for update;
  if v_has_assurance and not found then raise exception 'Snapshot Assurance sans dossier correspondant'; end if;
  if not v_has_assurance and found then raise exception 'Dossier Assurance sans snapshot financier'; end if;

  if v_has_assurance then
    if not v_snapshot.valide_client then raise exception 'Accord client Assurance obligatoire'; end if;
    if v_snapshot.controle_documents_statut<>'conforme' then raise exception 'Contrôle conforme des justificatifs obligatoire'; end if;
    if v_dossier.statut not in ('accepte','clos') then raise exception 'Prise en charge assureur non confirmée par la pharmacie'; end if;
    if v_dossier.vente_id is not null then raise exception 'Dossier Assurance déjà lié à une vente'; end if;
    if exists(select 1 from public.assurance_montant_propositions p
      where p.dossier_id=v_dossier.id and p.statut='proposee') then
      raise exception 'Une proposition de montant attend la réponse du Client';
    end if;
    select * into v_proposition from public.assurance_montant_propositions p
    where p.dossier_id=v_dossier.id and p.statut='acceptee'
    order by p.version desc limit 1;
    v_has_proposition:=found;
    if v_has_proposition then
      v_part_assureur:=v_proposition.montant_assureur_fcfa;
      v_part_client:=v_proposition.montant_client_fcfa;
    else
      v_part_assureur:=v_snapshot.montant_assureur_fcfa;
      v_part_client:=v_snapshot.montant_client_fcfa;
    end if;
    if v_snapshot.montant_brut_fcfa<>r.total
      or round(v_dossier.montant_total)::bigint<>v_snapshot.montant_brut_fcfa
      or round(v_dossier.montant_prise_en_charge)::bigint<>v_part_assureur
      or round(v_dossier.montant_client)::bigint<>v_part_client
      or v_part_assureur+v_part_client<>v_snapshot.montant_brut_fcfa then
      raise exception 'Incohérence entre le devis initial, la dernière proposition acceptée et le dossier';
    end if;
  else
    v_part_client:=r.total::bigint;
  end if;

  if p_canal='especes' then
    if p_montant_percu<v_part_client then raise exception 'Montant espèces insuffisant pour le reste à payer client'; end if;
    v_monnaie:=p_montant_percu-v_part_client;
  else
    if p_montant_percu<>v_part_client then raise exception 'Le montant reçu doit être exactement égal à la part client acceptée'; end if;
  end if;

  insert into public.ventes(
    pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,created_by,reservation_id
  ) values(r.pharmacie_id,p_session,r.client_id,'brouillon',0,r.total,r.total,auth.uid(),r.id)
  returning id into v_vente;

  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  select v_vente,ri.produit_id,ri.quantite,ri.prix_unitaire
  from public.reservation_items ri where ri.reservation_id=r.id order by ri.produit_id;

  if v_has_assurance and v_part_assureur>0 then
    perform public.vente_payer_assurance(v_vente,v_dossier.id,v_part_assureur::integer);
  end if;
  if v_part_client>0 then
    insert into public.vente_paiements(
      vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue
    ) values(
      v_vente,v_canal,v_part_client::integer,'Marketplace NAXA · '||upper(r.code_paiement),
      auth.uid(),p_montant_percu,v_monnaie
    );
  end if;

  perform public.vente_finaliser(v_vente);
  update public.reservations
  set paiement_mode=case when p_canal='especes' then 'especes_retrait' else p_canal end,
      paiement_ref='Marketplace NAXA · '||upper(r.code_paiement)
  where id=r.id;
  perform public.set_reservation_status(r.id,'payee'::public.resa_statut);

  select v.numero_vente into v_numero from public.ventes v where v.id=v_vente;
  return query select v_vente,v_numero,r.total,v_monnaie,p_canal,upper(r.code_paiement);
end;
$function$;

revoke all on function public.vente_reservation_encaisser(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.vente_reservation_encaisser(uuid,uuid,integer,text,text) to authenticated;

-- 5) Reçu client: le partage présenté après paiement reflète le montant négocié,
-- tout en conservant dans les champs initiaux la trace du devis d'origine.
create or replace function public.get_client_reservation_ticket(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_res public.reservations%rowtype;
  v_sale public.ventes%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select r.* into v_res
  from public.reservations r
  where r.id=p_reservation_id and r.client_id=auth.uid()
    and r.statut::text in ('payee','retiree');
  if not found then raise exception 'Ticket indisponible pour cette réservation'; end if;

  select v.* into v_sale from public.ventes v
  where v.reservation_id=v_res.id and v.statut::text='payee'
  order by v.paid_at desc nulls last,v.created_at desc limit 1;
  if not found then raise exception 'Aucune vente POS payée associée à cette réservation'; end if;

  return jsonb_build_object(
    'receipt_type','cashier_ticket',
    'sale',jsonb_build_object(
      'vente_id',v_sale.id,'numero_vente',v_sale.numero_vente,
      'pharmacie_id',v_sale.pharmacie_id,'statut',v_sale.statut::text,
      'created_at',v_sale.created_at,'paid_at',v_sale.paid_at,
      'total_brut',v_sale.total_brut,'remise',v_sale.remise,'total_net',v_sale.total_net,
      'mode_paiement',v_sale.mode_paiement::text,'paiement_ref',v_sale.paiement_ref,
      'caisse_session_id',v_sale.caisse_session_id,
      'caisse_id',(select cs.caisse_id from public.caisses_sessions cs where cs.id=v_sale.caisse_session_id),
      'caisse_nom',(select c.nom from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id where cs.id=v_sale.caisse_session_id)
    ),
    'items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'produit_id',vl.produit_id,'produit_nom',p.nom,'produit_dosage',p.dosage,
        'quantite',vl.quantite,'prix_unitaire',vl.prix_unitaire,'total_ligne',vl.total_ligne
      ) order by vl.id)
      from public.vente_lignes vl join public.produits p on p.id=vl.produit_id where vl.vente_id=v_sale.id
    ),'[]'::jsonb),
    'payments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode',vp.mode::text,'montant',vp.montant,'reference',vp.reference,
        'montant_percu',vp.montant_percu,'monnaie_rendue',vp.monnaie_rendue,'created_at',vp.created_at
      ) order by vp.created_at,vp.id)
      from public.vente_paiements vp where vp.vente_id=v_sale.id
    ),'[]'::jsonb),
    'assurance',(
      select jsonb_build_object(
        'assureur_nom',a.nom,'montant_brut_fcfa',s.montant_brut_fcfa,
        'montant_assureur_initial_fcfa',s.montant_assureur_fcfa,
        'montant_client_initial_fcfa',s.montant_client_fcfa,
        'montant_assureur_fcfa',d.montant_prise_en_charge,
        'montant_client_fcfa',d.montant_client,
        'proposition_acceptee',(select jsonb_build_object('version',p.version,'motif',p.motif,'proposee_le',p.proposee_le,'decidee_le',p.decidee_le)
          from public.assurance_montant_propositions p where p.dossier_id=d.id and p.statut='acceptee'
          order by p.version desc limit 1),
        'valide_client',s.valide_client,
        'controle_documents_statut',s.controle_documents_statut,
        'statut_dossier',d.statut,
        'montant_rembourse_fcfa',coalesce(d.montant_rembourse,0),
        'statut_remboursement',coalesce(d.statut_remboursement,'non_rembourse')
      )
      from public.assurance_reservation_snapshots s
      join public.dossiers_assurance d on d.reservation_id=s.reservation_id and d.pharmacie_id=s.pharmacie_id
      left join public.assureurs a on a.id=s.assureur_id
      where s.reservation_id=v_res.id limit 1
    ),
    'reservation',jsonb_build_object(
      'reservation_id',v_res.id,'ticket_numero_snapshot',v_res.paiement_ticket_numero,
      'montant_percu_snapshot',v_res.paiement_montant_percu,
      'monnaie_rendue_snapshot',v_res.paiement_monnaie_rendue,
      'paiement_valide_at',v_res.paiement_valide_at
    )
  );
end;
$function$;
revoke all on function public.get_client_reservation_ticket(uuid) from public,anon;
grant execute on function public.get_client_reservation_ticket(uuid) to authenticated;

-- 6) Event privé d'import : pharmacie seulement, jamais diffusé aux événements du client.
alter table public.assurance_evenements
  drop constraint if exists assurance_evenements_type_check;
alter table public.assurance_evenements
  add constraint assurance_evenements_type_check
  check (type = any (array[
    'devis_calcule','reservation_assurance_validee','documents_controles',
    'prise_en_charge_confirmee','prise_en_charge_refusee','montant_modifie',
    'accord_client_obtenu','accord_client_refuse','vente_assurance_enregistree',
    'remboursement_recu','remboursement_partiel','dossier_solde',
    'liste_assures_importee'
  ]::text[]));

commit;
