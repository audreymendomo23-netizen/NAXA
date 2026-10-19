-- NAXA 155 — contexte pharmacie explicite pour les actions Promoteur.
-- L'identifiant cible n'est jamais une autorisation : le scope et le privilège sont revérifiés en base.
begin;

create or replace function public.set_garde_for_pharmacy(
  p_pharmacie uuid,
  p_garde boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if p_pharmacie is null or p_garde is null then
    raise exception 'Pharmacie et statut de garde obligatoires' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role::text = 'promoteur' and p.actif = true
  ) then
    raise exception 'Action réservée à un Promoteur actif' using errcode = '42501';
  end if;
  if not public.naxa_has_privilege('EDIT_PHARMACY', p_pharmacie, 'PHARMACIE') then
    raise exception 'Pharmacie hors périmètre ou privilège absent' using errcode = '42501';
  end if;

  update public.pharmacies
  set de_garde = p_garde
  where id = p_pharmacie
    and actif = true
    and visible_recherche = true;

  if not found then
    raise exception 'Pharmacie inactive ou non publiée' using errcode = '23514';
  end if;
end
$function$;

revoke all on function public.set_garde_for_pharmacy(uuid, boolean) from public, anon;
grant execute on function public.set_garde_for_pharmacy(uuid, boolean) to authenticated;

commit;
