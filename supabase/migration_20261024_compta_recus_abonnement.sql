-- NAXA 20261024 — lecture minimale des reçus d'abonnement par le Comptable.
-- Pas d'accès direct à la table ni de divulgation des données Mobile Money.
begin;

create or replace function public.compta_lire_recus_abonnement(
  p_debut date default null,
  p_fin date default null
)
returns table (
  id uuid,
  periode_du date,
  periode_au date,
  montant integer,
  reference text,
  paye_le timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pharmacie uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_debut is not null and p_fin is not null and p_debut > p_fin then
    raise exception 'Période invalide' using errcode = '22007';
  end if;

  select p.pharmacie_id into v_pharmacie
  from public.profiles p
  where p.id = auth.uid() and p.actif is true;

  if v_pharmacie is null
     or not coalesce(public.naxa_can('MANAGE_ACCOUNTING', v_pharmacie, null), false) then
    raise exception 'Privilège Comptable requis' using errcode = '42501';
  end if;

  return query
  select ap.id, ap.periode_du, ap.periode_au, ap.montant, ap.reference, ap.paye_le, ap.created_at
  from public.abonnement_paiements ap
  where ap.pharmacie_id = v_pharmacie
    and (p_debut is null or ap.periode_au >= p_debut)
    and (p_fin is null or ap.periode_du <= p_fin)
  order by ap.paye_le desc nulls last, ap.created_at desc
  limit 100;
end;
$$;

revoke all on function public.compta_lire_recus_abonnement(date,date) from public, anon;
grant execute on function public.compta_lire_recus_abonnement(date,date) to authenticated;

commit;
