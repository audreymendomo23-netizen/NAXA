-- NAXA Comptabilité — délégation d'écriture Promoteur / Comptable.
begin;

create table if not exists public.compta_droits_ecriture (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  comptable_id uuid not null references public.profiles(id) on delete cascade,
  autorise boolean not null default false,
  accorde_par uuid references public.profiles(id) on delete restrict,
  modifie_par uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pharmacie_id,comptable_id)
);
alter table public.compta_droits_ecriture enable row level security;
revoke all on public.compta_droits_ecriture from anon, authenticated;

insert into public.naxa_role_privileges(role_key,privilege_code)
values ('promoteur','MANAGE_ACCOUNTING')
on conflict do nothing;
insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.architecture_code,'promoteur','MANAGE_ACCOUNTING'
from (values ('ORPHELIN'),('PARENTS_ENFANTS'),('PARENTS_AINES_CADETS'),('HYBRIDE')) a(architecture_code)
on conflict do nothing;

-- Promoteur : droit permanent dans son périmètre.
-- Comptable : droit d'écriture uniquement si le Promoteur l'a explicitement partagé.
do $$
declare
  v_def text;
  v_old text := $old$
  return exists(
    select 1 from public.naxa_profile_privileges pp
    where pp.profile_id=uid
      and pp.privilege_code=p_privilege
      and pp.pharmacie_id=target_pharmacy
      and pp.scope_type=p_scope
      and pp.active
  );
$old$;
  v_new text := $new$
  if p_privilege='MANAGE_ACCOUNTING' and fn='promoteur' then
    return true;
  end if;
  if p_privilege='MANAGE_ACCOUNTING' and fn='comptable' then
    return exists(
      select 1 from public.compta_droits_ecriture d
      where d.pharmacie_id=target_pharmacy
        and d.comptable_id=uid
        and d.autorise
    );
  end if;
  return exists(
    select 1 from public.naxa_profile_privileges pp
    where pp.profile_id=uid
      and pp.privilege_code=p_privilege
      and pp.pharmacie_id=target_pharmacy
      and pp.scope_type=p_scope
      and pp.active
  );
$new$;
begin
  v_def:=pg_get_functiondef('private.naxa_has_privilege(text,uuid,text)'::regprocedure);
  if position(v_old in v_def)=0 then
    raise exception 'Contrat naxa_has_privilege inattendu : remplacement refusé';
  end if;
  execute replace(v_def,v_old,v_new);
end
$$;

-- La lecture du tableau comptable reste ouverte au Comptable affecté,
-- même lorsque le Promoteur a retiré son droit d'écriture.
create or replace function public.compta_scope_autorise(p_pharmacie uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null
    and p_pharmacie is not null
    and private.naxa_business_function(auth.uid())='comptable'
    and private.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
$$;

create or replace function public.compta_ecriture_autorisee(p_pharmacie uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null
    and p_pharmacie is not null
    and private.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
    and private.naxa_has_privilege('MANAGE_ACCOUNTING',p_pharmacie,'PHARMACIE')
$$;

create or replace function public.compta_promoteur_lister_comptables(p_pharmacie uuid default null)
returns table(
  pharmacie_id uuid,
  pharmacie_nom text,
  comptable_id uuid,
  nom text,
  username text,
  compte_actif boolean,
  ecriture_autorisee boolean
)
language plpgsql stable security definer set search_path=''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null
     or private.naxa_business_function(v_uid)<>'promoteur'
     or not private.naxa_promoteur_valide(v_uid) then
    raise exception 'Accès réservé au Promoteur actif' using errcode='42501';
  end if;
  if p_pharmacie is not null
     and not private.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then
    raise exception 'Pharmacie hors de votre réseau' using errcode='42501';
  end if;
  return query
  select distinct ph.id,ph.nom::text,p.id,
    nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),
    p.username::text,p.actif,
    coalesce(d.autorise,false)
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id
  join public.pharmacies ph on ph.id=a.pharmacie_id
  left join public.compta_droits_ecriture d
    on d.pharmacie_id=ph.id and d.comptable_id=p.id
  where a.role_code='comptable'
    and a.statut='active'
    and a.commence_at<=now()
    and (a.expire_at is null or a.expire_at>now())
    and p.actif is true
    and ph.actif is true
    and private.naxa_scope_allows(v_uid,ph.id,'PHARMACIE')
    and (p_pharmacie is null or ph.id=p_pharmacie)
  order by ph.nom,p.username;
end
$$;

create or replace function public.compta_promoteur_configurer_ecriture(
  p_pharmacie uuid,p_comptable uuid,p_autorise boolean
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_old boolean;
begin
  if v_uid is null
     or private.naxa_business_function(v_uid)<>'promoteur'
     or not private.naxa_promoteur_valide(v_uid)
     or not private.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then
    raise exception 'Action réservée au Promoteur actif du réseau' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.naxa_professional_assignments a
    join public.profiles p on p.id=a.profile_id
    where a.profile_id=p_comptable and a.pharmacie_id=p_pharmacie
      and a.role_code='comptable' and a.statut='active'
      and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
      and p.actif is true
  ) then
    raise exception 'Comptable non affecté ou inactif dans cette pharmacie';
  end if;
  select autorise into v_old from public.compta_droits_ecriture
    where pharmacie_id=p_pharmacie and comptable_id=p_comptable for update;
  insert into public.compta_droits_ecriture(pharmacie_id,comptable_id,autorise,accorde_par,modifie_par)
  values(p_pharmacie,p_comptable,p_autorise,case when p_autorise then v_uid else null end,v_uid)
  on conflict(pharmacie_id,comptable_id) do update set
    autorise=excluded.autorise,
    accorde_par=case when excluded.autorise then v_uid else public.compta_droits_ecriture.accorde_par end,
    modifie_par=v_uid,updated_at=now();
  perform public.compta_auditer(
    p_pharmacie,v_uid,
    case when p_autorise then 'droit_ecriture_comptable_partage' else 'droit_ecriture_comptable_retire' end,
    'comptable',p_comptable::text,'succes',
    case when p_autorise then 'Droit de configuration et validation comptable activé'
         else 'Droit d’écriture retiré ; accès en lecture conservé' end
  );
  return jsonb_build_object('pharmacie_id',p_pharmacie,'comptable_id',p_comptable,
    'ecriture_autorisee',p_autorise,'lecture_conservee',true,'precedent',coalesce(v_old,false));
end
$$;

revoke all on function public.compta_ecriture_autorisee(uuid) from public,anon;
revoke all on function public.compta_promoteur_lister_comptables(uuid) from public,anon;
revoke all on function public.compta_promoteur_configurer_ecriture(uuid,uuid,boolean) from public,anon;
grant execute on function public.compta_ecriture_autorisee(uuid) to authenticated;
grant execute on function public.compta_promoteur_lister_comptables(uuid) to authenticated;
grant execute on function public.compta_promoteur_configurer_ecriture(uuid,uuid,boolean) to authenticated;

commit;
