-- NAXA ERP-003 / Pharmacien — consultation + prescription interne
-- Additif : réutilise public.prescriptions et public.prescription_items.
-- Le droit d'émettre une prescription est strictement réservé à la fonction
-- interne "pharmacien". Aucune décision médicale automatisée n'est ajoutée.

create table if not exists public.consultations_pharmaceutiques (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid references auth.users(id) on delete set null,
  patient_nom text not null check (nullif(trim(patient_nom),'') is not null),
  motif text not null check (nullif(trim(motif),'') is not null),
  observations text,
  conclusion text,
  recommandations text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultations_pharma_scope_idx
  on public.consultations_pharmaceutiques(pharmacie_id, created_at desc);
create index if not exists consultations_pharma_client_idx
  on public.consultations_pharmaceutiques(client_id, created_at desc);

alter table public.prescriptions
  add column if not exists consultation_id uuid
  references public.consultations_pharmaceutiques(id) on delete set null;

alter table public.prescription_items
  add column if not exists posologie text,
  add column if not exists duree text,
  add column if not exists instructions text;

create index if not exists prescriptions_consultation_idx
  on public.prescriptions(consultation_id);

insert into public.naxa_privileges(
  code,family,description,delegable,governance_only,
  famille,libelle,niveau_min,niveau_max,governance,active
)
values
('CREATE_PHARMACY_CONSULTATION','SANTE','Créer une consultation pharmaceutique dans le périmètre de la pharmacie',false,false,'SANTE','Créer une consultation pharmaceutique',1,3,false,true),
('CREATE_PHARMACY_PRESCRIPTION','SANTE','Émettre une prescription depuis une consultation pharmaceutique',false,false,'SANTE','Émettre une prescription',1,3,false,true)
on conflict(code) do update set description=excluded.description,libelle=excluded.libelle,active=true;

alter table public.consultations_pharmaceutiques enable row level security;
revoke all on public.consultations_pharmaceutiques from anon,authenticated;
grant select on public.consultations_pharmaceutiques to authenticated;

drop policy if exists consultations_pharmacien_read on public.consultations_pharmaceutiques;
create policy consultations_pharmacien_read on public.consultations_pharmaceutiques
for select to authenticated using (
  exists(select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.actif
      and p.pharmacie_id=consultations_pharmaceutiques.pharmacie_id
      and p.fonction_interne='pharmacien')
);

create or replace function public.pharmacien_creer_consultation(
  p_pharmacie uuid,p_patient_nom text,p_motif text,p_client_id uuid default null,
  p_observations text default null,p_conclusion text default null,p_recommandations text default null
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid := (select auth.uid()); v_id uuid;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if nullif(trim(coalesce(p_patient_nom,'')),'') is null then raise exception 'Nom du patient requis'; end if;
  if nullif(trim(coalesce(p_motif,'')),'') is null then raise exception 'Motif de consultation requis'; end if;
  if not exists(select 1 from public.profiles p where p.id=u and p.actif and p.pharmacie_id=p_pharmacie and p.fonction_interne='pharmacien')
    then raise exception 'Création de consultation non autorisée'; end if;
  insert into public.consultations_pharmaceutiques(pharmacie_id,client_id,patient_nom,motif,observations,conclusion,recommandations,created_by)
  values(p_pharmacie,p_client_id,trim(p_patient_nom),trim(p_motif),nullif(trim(p_observations),''),nullif(trim(p_conclusion),''),nullif(trim(p_recommandations),''),u)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.pharmacien_creer_consultation(uuid,text,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.pharmacien_creer_consultation(uuid,text,text,uuid,text,text,text) to authenticated;

create or replace function public.pharmacien_creer_prescription(
  p_pharmacie uuid,p_patient_nom text,p_client_id uuid default null,p_consultation_id uuid default null,
  p_document_ref text default null,p_designation text default null,p_quantite integer default null,
  p_posologie text default null,p_duree text default null,p_instructions text default null,p_commentaire text default null
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare u uuid := (select auth.uid()); v_prescription uuid; v_consult public.consultations_pharmaceutiques%rowtype;
begin
  if u is null then raise exception 'Connexion requise'; end if;
  if nullif(trim(coalesce(p_patient_nom,'')),'') is null then raise exception 'Nom du patient requis'; end if;
  if nullif(trim(coalesce(p_designation,'')),'') is null then raise exception 'Produit ou désignation requis'; end if;
  if p_quantite is null or p_quantite<=0 then raise exception 'Quantité prescrite invalide'; end if;
  if not exists(select 1 from public.profiles p where p.id=u and p.actif and p.pharmacie_id=p_pharmacie and p.fonction_interne='pharmacien')
    then raise exception 'Émission de prescription non autorisée'; end if;
  if p_consultation_id is not null then
    select * into v_consult from public.consultations_pharmaceutiques where id=p_consultation_id and pharmacie_id=p_pharmacie;
    if not found then raise exception 'Consultation introuvable ou hors périmètre'; end if;
  end if;
  insert into public.prescriptions(pharmacie_id,client_id,source,document_ref,statut,validateur_id,validee_at,consultation_id)
  values(p_pharmacie,p_client_id,'pharmacie',nullif(trim(p_document_ref),''),'validee',u,now(),p_consultation_id)
  returning id into v_prescription;
  insert into public.prescription_items(prescription_id,designation_prescrite,quantite_prescrite,posologie,duree,instructions,commentaire_pharmacien)
  values(v_prescription,trim(p_designation),p_quantite,nullif(trim(p_posologie),''),nullif(trim(p_duree),''),nullif(trim(p_instructions),''),nullif(trim(p_commentaire),''));
  return v_prescription;
end;
$$;

revoke all on function public.pharmacien_creer_prescription(uuid,text,uuid,uuid,text,text,integer,text,text,text,text) from public,anon,authenticated;
grant execute on function public.pharmacien_creer_prescription(uuid,text,uuid,uuid,text,text,integer,text,text,text,text) to authenticated;

create or replace function public.pharmacien_prescriptions_recentes(p_pharmacie uuid,p_limite integer default 30)
returns table(id uuid,client_id uuid,document_ref text,statut public.prescription_statut,consultation_id uuid,created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif and p.pharmacie_id=p_pharmacie and p.fonction_interne='pharmacien')
    then raise exception 'Accès Pharmacien non autorisé'; end if;
  return query select r.id,r.client_id,r.document_ref,r.statut,r.consultation_id,r.created_at
  from public.prescriptions r where r.pharmacie_id=p_pharmacie and r.source='pharmacie'
  order by r.created_at desc limit greatest(1,least(coalesce(p_limite,30),100));
end;
$$;

revoke all on function public.pharmacien_prescriptions_recentes(uuid,integer) from public,anon,authenticated;
grant execute on function public.pharmacien_prescriptions_recentes(uuid,integer) to authenticated;

create or replace function public.consultations_pharmaceutiques_touch()
returns trigger language plpgsql security invoker set search_path=''
as $$ begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_consultations_pharma_touch on public.consultations_pharmaceutiques;
create trigger trg_consultations_pharma_touch before update on public.consultations_pharmaceutiques
for each row execute function public.consultations_pharmaceutiques_touch();
revoke execute on function public.consultations_pharmaceutiques_touch() from public,anon,authenticated;

comment on table public.consultations_pharmaceutiques is 'Dossier de consultation pharmaceutique, accessible dans le périmètre de la fonction Pharmacien.';
comment on function public.pharmacien_creer_prescription(uuid,text,uuid,uuid,text,text,integer,text,text,text,text) is 'Émet une prescription depuis le parcours Pharmacien et la rattache optionnellement à une consultation. Aucune décision médicale automatisée.';
