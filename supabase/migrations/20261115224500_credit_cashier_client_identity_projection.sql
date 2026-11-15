-- NAXA — Projection minimale des clients crédit visibles par le poste Caisse.
-- Le caissier ne reçoit que l'identité minimale des clients ayant un crédit actif
-- dans sa pharmacie active. Aucun droit de lecture global sur public.profiles n'est ajouté.
begin;

create or replace function public.caisse_credit_clients_lister(p_pharmacie uuid)
returns table(
  client_id uuid,
  solde integer,
  plafond integer,
  first_name text,
  last_name text,
  phone text,
  username text
)
language plpgsql
stable
security definer
set search_path=''
as $function$
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_pharmacie is null or not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(p_pharmacie)) then
    raise exception 'Lecture des clients crédit réservée à la Caisse autorisée de cette pharmacie';
  end if;

  return query
  select c.client_id,c.solde,c.plafond,p.first_name,p.last_name,p.phone,p.username
  from public.client_credits c
  join public.profiles p on p.id=c.client_id
  where c.pharmacie_id=p_pharmacie
    and c.actif=true
    and p.actif=true
    and p.role::text='client'
  order by p.last_name nulls last,p.first_name nulls last,p.username nulls last,c.updated_at desc;
end
$function$;

revoke all on function public.caisse_credit_clients_lister(uuid) from public,anon;
grant execute on function public.caisse_credit_clients_lister(uuid) to authenticated;

commit;
