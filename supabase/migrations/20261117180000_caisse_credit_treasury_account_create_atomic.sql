-- Création atomique et idempotente des comptes Caisse par canal.
create or replace function public.caisse_credit_tresorerie_compte_creer(
  p_pharmacie uuid,
  p_canal text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_type public.tresorerie_compte_type;
  v_nom text;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_pharmacie is null or not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(p_pharmacie)) then
    raise exception 'Création du compte de trésorerie refusée pour cette pharmacie';
  end if;
  if p_canal not in ('especes','orange_money','mtn_momo') then
    raise exception 'Canal de paiement invalide';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_pharmacie::text || ':caisse-treasury:' || p_canal,0));
  select c.id into v_id
  from public.tresorerie_comptes c
  where c.pharmacie_id=p_pharmacie and c.canal_paiement=p_canal and c.actif
  limit 1
  for update;
  if found then return v_id; end if;

  v_type := case when p_canal='especes'
    then 'especes'::public.tresorerie_compte_type
    else 'mobile_money'::public.tresorerie_compte_type end;
  v_nom := case p_canal
    when 'especes' then 'Caisse — Espèces'
    when 'orange_money' then 'Compte — Orange Money'
    else 'Compte — MTN MoMo' end;

  insert into public.tresorerie_comptes(
    pharmacie_id,nom,type,solde_initial,actif,created_by,canal_paiement
  ) values (
    p_pharmacie,v_nom,v_type,0,true,auth.uid(),p_canal
  ) returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.caisse_credit_tresorerie_compte_creer(uuid,text) from public,anon;
grant execute on function public.caisse_credit_tresorerie_compte_creer(uuid,text) to authenticated;
