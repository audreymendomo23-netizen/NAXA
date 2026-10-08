-- NAXA ERP-003/Pharmacie — parcours Caisse + Pharmacien + recherche produit
-- Additif : complète les moteurs existants sans créer de second POS ni de second moteur ordonnance.

-- 1. Référencement produit et emplacement pharmacie.
alter table public.produits
  add column if not exists code_barre text;

create unique index if not exists produits_code_barre_uq
  on public.produits(code_barre)
  where nullif(trim(code_barre),'') is not null;

alter table public.stocks
  add column if not exists emplacement text;

create index if not exists stocks_emplacement_idx
  on public.stocks(pharmacie_id, emplacement);

-- 2. Fonction métier Pharmacien : fonction interne, jamais role_type.
alter table public.profiles
  drop constraint if exists profiles_fonction_interne_check;

alter table public.profiles
  add constraint profiles_fonction_interne_check
  check (fonction_interne is null or fonction_interne in (
    'promoteur','responsable','caisse','pharmacien','pharmacien_assistant',
    'manager_regional','chef_agence','custom'
  ));

-- 3. Privilèges pharmaceutiques.
insert into public.naxa_privileges(
  code,family,description,delegable,governance_only,
  famille,libelle,niveau_min,niveau_max,governance,active
)
values
('VIEW_PRESCRIPTION','SANTE','Consulter une ordonnance dans le périmètre autorisé',false,false,'SANTE','Consulter une ordonnance',1,3,false,true),
('EDIT_PRESCRIPTION','SANTE','Renseigner les éléments internes d''une ordonnance',false,false,'SANTE','Renseigner une ordonnance',1,3,false,true),
('VALIDATE_PRESCRIPTION','SANTE','Valider ou rejeter une ordonnance',false,false,'SANTE','Valider une ordonnance',1,3,false,true),
('CONFIRM_DISPENSATION','SANTE','Confirmer la délivrance pharmaceutique',false,false,'SANTE','Confirmer une délivrance',1,3,false,true)
on conflict(code) do update set
 description=excluded.description,
 libelle=excluded.libelle,
 active=true;

-- 4. Recherche caisse par code-barres / nom / référence.
create or replace function public.caisse_rechercher_produit(
  p_pharmacie uuid,
  p_code_barre text default null,
  p_recherche text default null
)
returns table(
  produit_id uuid,
  nom text,
  dosage text,
  conditionnement text,
  code_barre text,
  prix integer,
  quantite integer,
  emplacement text
)
language plpgsql
security definer
set search_path=''
as $lookup$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;

  return query
  select p.id,p.nom,p.dosage,p.conditionnement,p.code_barre,s.prix,s.quantite,s.emplacement
  from public.produits p
  join public.stocks s on s.produit_id=p.id and s.pharmacie_id=p_pharmacie
  where
    (
      nullif(trim(coalesce(p_code_barre,'')),'') is not null
      and p.code_barre=trim(p_code_barre)
    )
    or
    (
      nullif(trim(coalesce(p_recherche,'')),'') is not null
      and (
        lower(p.nom) like '%'||lower(trim(p_recherche))||'%'
        or lower(coalesce(p.reference_catalogue,'')) like '%'||lower(trim(p_recherche))||'%'
        or lower(coalesce(p.code_barre,'')) like '%'||lower(trim(p_recherche))||'%'
      )
    )
  order by p.nom
  limit 50;
end;
$lookup$;

revoke all on function public.caisse_rechercher_produit(uuid,text,text) from public,anon,authenticated;
grant execute on function public.caisse_rechercher_produit(uuid,text,text) to authenticated;

-- 5. Recherche bulk : un scanner clavier peut envoyer plusieurs codes sans créer de vente.
create or replace function public.caisse_rechercher_codes(
  p_pharmacie uuid,
  p_codes text[]
)
returns table(
  code_barre text,
  produit_id uuid,
  nom text,
  dosage text,
  prix integer,
  quantite integer,
  emplacement text
)
language plpgsql
security definer
set search_path=''
as $bulk$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;

  return query
  select p.code_barre,p.id,p.nom,p.dosage,s.prix,s.quantite,s.emplacement
  from public.produits p
  join public.stocks s on s.produit_id=p.id and s.pharmacie_id=p_pharmacie
  where p.code_barre = any(p_codes)
  order by array_position(p_codes,p.code_barre);
end;
$bulk$;

revoke all on function public.caisse_rechercher_codes(uuid,text[]) from public,anon,authenticated;
grant execute on function public.caisse_rechercher_codes(uuid,text[]) to authenticated;

-- 6. Encaissement avec montant réellement perçu et monnaie rendue.
alter table public.vente_paiements
  add column if not exists montant_percu integer check (montant_percu is null or montant_percu > 0);

alter table public.vente_paiements
  add column if not exists monnaie_rendue integer not null default 0 check (monnaie_rendue >= 0);

create or replace function public.vente_encaisser(
  p_vente uuid,
  p_mode public.mode_paiement_caisse,
  p_montant_percu integer,
  p_reference text default null
)
returns table(paiement_id uuid, montant_a_payer integer, monnaie_rendue integer)
language plpgsql
security definer
set search_path=''
as $encaisse$
declare
  v public.ventes%rowtype;
  v_id uuid;
  v_change integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant_percu is null or p_montant_percu <= 0 then raise exception 'Montant perçu invalide'; end if;

  select * into v from public.ventes where id=p_vente for update;
  if not found or v.statut<>'brouillon' then raise exception 'Vente invalide'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  if not exists(select 1 from public.vente_lignes where vente_id=p_vente) then raise exception 'Vente vide'; end if;

  if p_mode <> 'especes' and p_montant_percu <> v.total_net then
    raise exception 'Pour un paiement électronique, le montant perçu doit être exactement égal au total';
  end if;

  v_change := greatest(p_montant_percu-v.total_net,0);

  insert into public.vente_paiements(
    vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue
  )
  values(
    p_vente,p_mode,v.total_net,nullif(trim(p_reference),''),
    auth.uid(),p_montant_percu,v_change
  )
  returning id into v_id;

  return query select v_id,v.total_net,v_change;
end;
$encaisse$;

revoke all on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) from public,anon,authenticated;
grant execute on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) to authenticated;

-- 7. Le parcours ordonnance accepte désormais la fonction Pharmacien canonique.
drop policy if exists prescriptions_staff_read on public.prescriptions;
create policy prescriptions_staff_read
on public.prescriptions for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.actif
      and p.pharmacie_id=prescriptions.pharmacie_id
      and (
        p.role='promoteur'
        or p.fonction_interne in ('pharmacien','pharmacien_assistant')
      )
  )
);

drop policy if exists prescription_items_staff on public.prescription_items;
create policy prescription_items_staff
on public.prescription_items for all to authenticated
using (
  exists (
    select 1
    from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid())
      and p.actif
      and (p.role='promoteur' or p.fonction_interne in ('pharmacien','pharmacien_assistant'))
  )
)
with check (
  exists (
    select 1
    from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid())
      and p.actif
      and (p.role='promoteur' or p.fonction_interne in ('pharmacien','pharmacien_assistant'))
  )
);

create or replace function public.prescription_valider(
  p_prescription uuid,
  p_accepter boolean,
  p_motif text default null
)
returns public.prescription_statut
language plpgsql
security definer
set search_path=''
as $validate$
declare
  v public.prescriptions%rowtype;
  u uuid := (select auth.uid());
  f text;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select * into v from public.prescriptions where id=p_prescription for update;
  if not found then raise exception 'Ordonnance introuvable'; end if;

  select p.fonction_interne into f
  from public.profiles p
  where p.id=u and p.actif and p.pharmacie_id=v.pharmacie_id
    and (p.role='promoteur' or p.fonction_interne in ('pharmacien','pharmacien_assistant'));

  if f is null then raise exception 'Validation ordonnance non autorisée'; end if;
  if v.statut <> 'en_attente' then raise exception 'Ordonnance déjà traitée'; end if;

  if p_accepter then
    update public.prescriptions
    set statut='validee',validateur_id=u,validee_at=now(),motif_rejet=null,updated_at=now()
    where id=p_prescription;
    return 'validee';
  end if;

  if nullif(trim(coalesce(p_motif,'')),'') is null then raise exception 'Motif de rejet obligatoire'; end if;

  update public.prescriptions
  set statut='rejetee',validateur_id=u,validee_at=null,motif_rejet=trim(p_motif),updated_at=now()
  where id=p_prescription;
  return 'rejetee';
end;
$validate$;

revoke all on function public.prescription_valider(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.prescription_valider(uuid,boolean,text) to authenticated;

comment on column public.produits.code_barre is 'Code-barres commercial scannable par la Caisse.';
comment on column public.stocks.emplacement is 'Emplacement physique du produit dans cette pharmacie.';
comment on function public.caisse_rechercher_codes(uuid,text[]) is 'Recherche bulk de codes-barres ; aucune vente ni mutation de stock.';
comment on function public.vente_encaisser(uuid,public.mode_paiement_caisse,integer,text) is 'Encaissement POS : montant exact électronique ou montant supérieur en espèces avec monnaie rendue. Le transfert électronique réel reste soumis à l intégration opérateur officielle.';
