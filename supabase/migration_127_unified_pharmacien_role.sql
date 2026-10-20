-- NAXA ERP — poste unique Pharmacien (remplace le poste Assistant pharmacien).
-- À appliquer après les migrations 125 et 126. Les données métier sont conservées.
begin;

alter table public.profiles drop constraint if exists profiles_fonction_interne_check;
alter table public.profiles drop constraint if exists profiles_fonction_interne_ck;

update public.profiles
set fonction_interne = 'pharmacien'
where fonction_interne = 'pharmacien_assistant';

-- Renommer la colonne d'acteur sans perdre l'historique des préparations.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='prescription_preparations' and column_name='assistant_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='prescription_preparations' and column_name='pharmacien_id') then
    alter table public.prescription_preparations rename column assistant_id to pharmacien_id;
  end if;
end $$;

alter table public.profiles
  add constraint profiles_fonction_interne_check
  check (fonction_interne is null or fonction_interne in (
    'promoteur','responsable','caisse','pharmacien',
    'magasinier','gestionnaire_stock','comptable','manager_regional',
    'chef_agence','custom'
  ));


-- Harmoniser les politiques RLS avec le poste unique Pharmacien.
drop policy if exists prescription_preparations_staff_read on public.prescription_preparations;
create policy prescription_preparations_staff_read
on public.prescription_preparations for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.actif
      and p.pharmacie_id=prescription_preparations.pharmacie_id
      and p.fonction_interne='pharmacien'
  )
);

drop policy if exists prescriptions_staff_read on public.prescriptions;
create policy prescriptions_staff_read
on public.prescriptions for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.actif
      and p.pharmacie_id=prescriptions.pharmacie_id
      and p.fonction_interne='pharmacien'
  )
  or exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.actif
      and p.role::text='promoteur'
      and p.pharmacie_id=prescriptions.pharmacie_id
  )
);

drop policy if exists prescription_items_staff_read on public.prescription_items;
create policy prescription_items_staff_read
on public.prescription_items for select to authenticated
using (
  exists (
    select 1 from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid()) and p.actif
      and p.fonction_interne='pharmacien'
  )
  or exists (
    select 1 from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid()) and p.actif
      and p.role::text='promoteur'
  )
);

drop policy if exists prescription_items_assistant_write on public.prescription_items;
drop policy if exists prescription_items_pharmacien_write on public.prescription_items;
create policy prescription_items_pharmacien_write
on public.prescription_items for all to authenticated
using (
  exists (
    select 1 from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid()) and p.actif
      and (p.role::text='promoteur' or p.fonction_interne='pharmacien')
  )
)
with check (
  exists (
    select 1 from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid()) and p.actif
      and (p.role::text='promoteur' or p.fonction_interne='pharmacien')
  )
);

create or replace function public.pharmacien_soumettre_preparation(
  p_prescription uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  u uuid := (select auth.uid());
  v public.prescriptions%rowtype;
  p uuid;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select pharmacie_id into p from public.profiles
   where id=u and actif and fonction_interne='pharmacien';
  if p is null then raise exception 'Accès Pharmacien non autorisé'; end if;

  select * into v from public.prescriptions
   where id=p_prescription and pharmacie_id=p and source='client'
   for update;
  if not found then raise exception 'Ordonnance introuvable ou hors périmètre'; end if;
  if v.statut <> 'en_attente' then raise exception 'Cette ordonnance n''est plus en attente'; end if;

  insert into public.prescription_preparations(
    prescription_id,pharmacie_id,pharmacien_id,statut,notes_preparation,motif_complement,updated_at
  ) values (p_prescription,p,u,'soumise',nullif(trim(coalesce(p_notes,'')),''),null,now())
  on conflict (prescription_id) do update set
    pharmacien_id=excluded.pharmacien_id,
    statut='soumise',
    notes_preparation=excluded.notes_preparation,
    motif_complement=null,
    updated_at=now();
end;
$$;
revoke all on function public.pharmacien_soumettre_preparation(uuid,text) from public,anon,authenticated;
grant execute on function public.pharmacien_soumettre_preparation(uuid,text) to authenticated;
drop function if exists public.assistant_soumettre_preparation(uuid,text);

create or replace function public.prescription_valider(
  p_prescription uuid,
  p_accepter boolean,
  p_motif text default null
)
returns public.prescription_statut
language plpgsql
security definer
set search_path=''
as $$
declare
  v public.prescriptions%rowtype;
  u uuid := (select auth.uid());
  v_role text;
  v_fn text;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  select * into v from public.prescriptions where id=p_prescription for update;
  if not found then raise exception 'Ordonnance introuvable'; end if;

  select p.role::text,p.fonction_interne into v_role,v_fn
  from public.profiles p
  where p.id=u and p.actif and p.pharmacie_id=v.pharmacie_id;

  if v_role is null or v_fn <> 'pharmacien' then
    raise exception 'Validation ordonnance non autorisée : poste Pharmacien requis';
  end if;
  if v.statut <> 'en_attente' then raise exception 'Ordonnance déjà traitée'; end if;

  if p_accepter then
    update public.prescriptions set statut='validee',validateur_id=u,validee_at=now(),
      motif_rejet=null,updated_at=now() where id=p_prescription;
    update public.prescription_preparations set statut='revue',updated_at=now()
      where prescription_id=p_prescription;
    return 'validee';
  end if;

  if nullif(trim(coalesce(p_motif,'')),'') is null then raise exception 'Motif de rejet obligatoire'; end if;
  update public.prescriptions set statut='rejetee',validateur_id=u,validee_at=null,
    motif_rejet=trim(p_motif),updated_at=now() where id=p_prescription;
  update public.prescription_preparations set statut='revue',updated_at=now()
    where prescription_id=p_prescription;
  return 'rejetee';
end;
$$;
revoke all on function public.prescription_valider(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.prescription_valider(uuid,boolean,text) to authenticated;

comment on table public.prescription_preparations is
  'Suivi de préparation des ordonnances par le poste Pharmacien ; distinct du statut et de la décision pharmaceutique.';
commit;
