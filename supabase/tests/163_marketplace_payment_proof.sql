-- NAXA 163 — aucun changement de statut ne peut simuler un paiement.
begin;

do $structure$
declare
  v_private text;
  v_public text;
  v_command text;
begin
  select pg_get_functiondef(p.oid) into v_private
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='set_reservation_status' and p.pronargs=2;

  select pg_get_functiondef(p.oid) into v_public
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='set_reservation_status' and p.pronargs=2;

  select pg_get_functiondef(p.oid) into v_command
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='mettre_a_jour_commande_client' and p.pronargs=3;

  if v_private is null or position('public.vente_paiements' in lower(v_private))=0
     or position('public.ventes' in lower(v_private))=0
     or position('ticket pos payé' in lower(v_private))=0 then
    raise exception 'La transition privée ne vérifie pas la preuve POS';
  end if;

  if v_public is null or position('private.set_reservation_status' in lower(v_public))=0 then
    raise exception 'La RPC publique ne délègue pas à la transition privée protégée';
  end if;

  if v_command is null or position('paiement non confirmé' in lower(v_command))=0
     or position('v.reservation_id = v_r.id' in lower(v_command))=0
     or position('public.vente_paiements' in lower(v_command))=0 then
    raise exception 'La commande peut encore confirmer un paiement sans ticket POS lié';
  end if;

  if not has_function_privilege('authenticated','public.set_reservation_status(uuid,public.resa_statut)','EXECUTE')
     or not has_function_privilege('authenticated','public.mettre_a_jour_commande_client(uuid,text,boolean)','EXECUTE') then
    raise exception 'Droits RPC authentifiés manquants';
  end if;

  if has_function_privilege('anon','public.set_reservation_status(uuid,public.resa_statut)','EXECUTE')
     or has_function_privilege('anon','public.mettre_a_jour_commande_client(uuid,text,boolean)','EXECUTE') then
    raise exception 'Une RPC de transition est exécutable par anon';
  end if;
end
$structure$;

select '163_marketplace_payment_proof PASS' as resultat;
rollback;
