-- Verification indépendante par pharmacie pour une même couverture Client.
begin;

alter table public.couvertures_assurance
  add column if not exists declaration_maj_at timestamptz not null default now();

create or replace function private.assurance_stamp_couverture_declaration()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if old.numero_adherent is distinct from new.numero_adherent
     or old.numero_police is distinct from new.numero_police
     or old.date_debut is distinct from new.date_debut
     or old.date_fin is distinct from new.date_fin
     or old.assureur_id is distinct from new.assureur_id then
    new.declaration_maj_at:=now();
  end if;
  return new;
end;
$function$;

drop trigger if exists assurance_stamp_couverture_declaration
  on public.couvertures_assurance;
create trigger assurance_stamp_couverture_declaration
before update on public.couvertures_assurance
for each row execute function private.assurance_stamp_couverture_declaration();

alter table public.assurance_imports
  add column if not exists mode_import text not null default 'complet';
alter table public.assurance_imports
  drop constraint if exists assurance_imports_mode_import_check;
alter table public.assurance_imports
  add constraint assurance_imports_mode_import_check
  check (mode_import in ('complet','delta'));

create table if not exists public.assurance_couverture_verifications (
  id uuid primary key default gen_random_uuid(),
  couverture_id uuid not null references public.couvertures_assurance(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  assureur_id uuid not null references public.assureurs(id) on delete restrict,
  import_id uuid not null references public.assurance_imports(id) on delete restrict,
  import_ligne_id uuid not null references public.assurance_import_lignes(id) on delete restrict,
  statut text not null check (statut in ('verifiee','suspendue','expiree','remplacee')),
  date_debut date,
  date_fin date,
  declaration_maj_at timestamptz not null,
  verification_le timestamptz not null default now(),
  verification_par uuid not null references auth.users(id) on delete restrict,
  constraint assurance_couverture_verifications_line_uq unique(import_ligne_id),
  constraint assurance_couverture_verifications_import_coverage_uq unique(couverture_id,pharmacie_id,import_id),
  constraint assurance_couverture_verifications_date_check
    check (date_fin is null or date_debut is null or date_fin>=date_debut)
);

create index if not exists assurance_couverture_verifications_lookup_idx
  on public.assurance_couverture_verifications(couverture_id,pharmacie_id,verification_le desc);

alter table public.assurance_couverture_verifications enable row level security;
drop policy if exists assurance_couverture_verifications_scope_read
  on public.assurance_couverture_verifications;
create policy assurance_couverture_verifications_scope_read
on public.assurance_couverture_verifications
for select to authenticated
using (
  exists(
    select 1 from public.couvertures_assurance c
    where c.id=couverture_id and c.client_id=(select auth.uid())
  )
  or public.can_access_pharmacy(pharmacie_id)
);
revoke all on table public.assurance_couverture_verifications from public,anon,authenticated;
grant select on table public.assurance_couverture_verifications to authenticated;
grant all on table public.assurance_couverture_verifications to service_role;

create or replace function public.assurance_import_simuler_mode(
  p_pharmacie uuid,
  p_assureur uuid,
  p_reference_source text,
  p_nom_fichier text,
  p_sha256 text,
  p_lignes jsonb,
  p_mode_import text default 'complet'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
  v_import uuid;
begin
  if p_mode_import not in ('complet','delta') then
    raise exception 'Mode import invalide : utilisez complet ou delta';
  end if;
  v_result:=public.assurance_import_simuler(
    p_pharmacie,p_assureur,p_reference_source,p_nom_fichier,p_sha256,p_lignes
  );
  v_import:=(v_result->>'import_id')::uuid;
  update public.assurance_imports set mode_import=p_mode_import where id=v_import;
  return v_result||jsonb_build_object('mode_import',p_mode_import);
end;
$function$;
revoke all on function public.assurance_import_simuler_mode(uuid,uuid,text,text,text,jsonb,text) from public,anon;
grant execute on function public.assurance_import_simuler_mode(uuid,uuid,text,text,text,jsonb,text) to authenticated;

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

  if v_i.mode_import='complet' then
    update public.assurance_couverture_verifications
    set statut='remplacee'
    where pharmacie_id=v_i.pharmacie_id
      and assureur_id=v_i.assureur_id
      and statut in ('verifiee','suspendue','expiree');
  end if;

  insert into public.assurance_couverture_verifications(
    couverture_id,pharmacie_id,assureur_id,import_id,import_ligne_id,
    statut,date_debut,date_fin,declaration_maj_at,verification_par
  )
  select
    c.id,v_i.pharmacie_id,v_i.assureur_id,v_i.id,l.id,
    case
      when l.membre_statut='suspendu' then 'suspendue'
      when l.membre_statut='expire' or (l.date_fin is not null and l.date_fin<current_date) then 'expiree'
      else 'verifiee'
    end,
    l.date_debut,l.date_fin,c.declaration_maj_at,v_uid
  from public.assurance_import_lignes l
  join public.couvertures_assurance c
    on c.id=l.couverture_id and c.assureur_id=v_i.assureur_id
  where l.import_id=v_i.id and l.resultat='correspondance_unique'
  on conflict(import_ligne_id) do nothing;

  get diagnostics v_applied=row_count;
  if v_applied<1 then raise exception 'Aucune couverture rapprochée ; import non appliqué'; end if;

  update public.assurance_import_lignes
  set resultat='appliquee',appliquee_le=now()
  where import_id=v_i.id and resultat='correspondance_unique';

  select
    count(*) filter(where membre_statut='suspendu'),
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
      'sha256',v_i.sha256,'mode_import',v_i.mode_import,
      'total_lignes',v_i.total_lignes,
      'couvertures_appliquees',v_applied,'suspendues',v_suspended,'expirees',v_expired
    )
  );

  return jsonb_build_object(
    'import_id',v_i.id,'statut','appliquee','mode_import',v_i.mode_import,
    'couvertures_appliquees',v_applied,'suspendues',v_suspended,'expirees',v_expired
  );
end;
$function$;

revoke all on function public.assurance_import_appliquer(uuid) from public,anon;
grant execute on function public.assurance_import_appliquer(uuid) to authenticated;

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
  select c.* into v_c from public.couvertures_assurance c
  where c.id=p_couverture and c.client_id=v_uid and c.actif
    and c.date_debut<=current_date and (c.date_fin is null or c.date_fin>=current_date)
    and exists (
      select 1
      from public.assurance_couverture_verifications v
      where v.couverture_id=c.id
        and v.pharmacie_id=v_r.pharmacie_id
        and v.id=(
          select v2.id from public.assurance_couverture_verifications v2
          where v2.couverture_id=c.id and v2.pharmacie_id=v_r.pharmacie_id
          order by v2.verification_le desc,v2.id desc
          limit 1
        )
        and v.statut='verifiee'
        and v.declaration_maj_at=c.declaration_maj_at
        and (v.date_debut is null or v.date_debut<=current_date)
        and (v.date_fin is null or v.date_fin>=current_date)
    );
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

commit;
