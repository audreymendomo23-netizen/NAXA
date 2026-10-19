-- NAXA 156 — garde finale d'activation des Caisses du réseau Promoteur.
-- Défense en profondeur : même si un appelant atteint une autre voie d'écriture,
-- une Caisse ne peut être activée par un Promoteur que dans une pharmacie
-- active/publiée, liée activement et avec un abonnement Promoteur valide.
begin;

create or replace function public.naxa_guard_promoteur_caisse_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_actor_role text;
  v_actor_active boolean;
begin
  -- Les désactivations restent possibles pour fermer un accès.
  if new.role::text <> 'caisse' or new.actif is distinct from true then
    return new;
  end if;

  -- Les opérations de maintenance de confiance (service_role) sont distinctes
  -- des mutations initiées par un utilisateur authentifié.
  if v_uid is null then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  select p.role::text, p.actif
    into v_actor_role, v_actor_active
  from public.profiles p
  where p.id = v_uid;

  if v_actor_role <> 'promoteur' then
    return new;
  end if;

  if v_actor_active is distinct from true then
    raise exception 'Promoteur inactif : activation de Caisse interdite'
      using errcode = '42501';
  end if;

  if new.parent_profile_id is distinct from v_uid then
    raise exception 'La Caisse doit être un enfant direct du Promoteur'
      using errcode = '42501';
  end if;

  if new.pharmacie_id is null or not exists (
    select 1
    from public.pharmacies ph
    where ph.id = new.pharmacie_id
      and ph.actif = true
      and ph.visible_recherche = true
  ) then
    raise exception 'La pharmacie de la Caisse doit être active et publiée'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.promoteur_pharmacies pp
    where pp.promoteur_id = v_uid
      and pp.pharmacie_id = new.pharmacie_id
      and pp.actif = true
  ) then
    raise exception 'Pharmacie hors réseau Promoteur actif'
      using errcode = '42501';
  end if;

  if not public.naxa_promoteur_valide(v_uid) then
    raise exception 'Abonnement Promoteur invalide'
      using errcode = '42501';
  end if;

  return new;
end
$function$;

revoke all on function public.naxa_guard_promoteur_caisse_activation() from public, anon, authenticated;

drop trigger if exists trg_naxa_guard_promoteur_caisse_activation on public.profiles;
create trigger trg_naxa_guard_promoteur_caisse_activation
before insert or update of role, actif, pharmacie_id, parent_profile_id
on public.profiles
for each row
execute function public.naxa_guard_promoteur_caisse_activation();

commit;
