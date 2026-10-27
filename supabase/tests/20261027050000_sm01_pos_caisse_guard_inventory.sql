-- SM-01 point 3 — revue structurelle des RPC POS, paiements, annulations et clôture.
-- Test à exécuter dans une base de test après application ordonnée des migrations.
begin;
do $test$
declare
  v_proc regprocedure;
  v_definition text;
begin
  v_proc := to_regprocedure('public.vente_reservation_encaisser(uuid,uuid,integer)');
  if v_proc is null then raise exception 'SM-01.3.POS.1 : encaissement atomique de réservation absent'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('naxa_caisse_actor_for_pharmacy' in v_definition)=0
     or position('ouvert_par' in v_definition)=0
     or position('expires_at' in v_definition)=0
     or position('for update' in lower(v_definition))=0 then
    raise exception 'SM-01.3.POS.2 : encaissement réservation sans toutes les gardes attendues';
  end if;

  v_proc := to_regprocedure('public.vente_ajouter_produit(uuid,uuid,integer)');
  if v_proc is null then raise exception 'SM-01.3.POS.3 : ajout produit POS absent'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('naxa_caisse_actor_for_pharmacy' in v_definition)=0
     or position('caisse_session_id' in v_definition)=0
     or position('brouillon' in v_definition)=0 then
    raise exception 'SM-01.3.POS.4 : ajout produit sans identité, session ou état brouillon';
  end if;

  v_proc := to_regprocedure('public.vente_produit_retirer(uuid,uuid)');
  if v_proc is null then raise exception 'SM-01.3.POS.5 : retrait produit POS absent'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('created_by' in v_definition)=0
     or position('naxa_caisse_actor_for_pharmacy' in v_definition)=0
     or position('ouvert_par' in v_definition)=0 then
    raise exception 'SM-01.3.POS.6 : retrait produit sans garde propriétaire/périmètre/session';
  end if;

  v_proc := to_regprocedure('public.vente_brouillon_abandonner(uuid)');
  if v_proc is null then raise exception 'SM-01.3.POS.7 : abandon de panier absent'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('created_by' in v_definition)=0
     or position('naxa_caisse_actor_for_pharmacy' in v_definition)=0
     or position('ouvert_par' in v_definition)=0 then
    raise exception 'SM-01.3.POS.8 : abandon de panier sans garde propriétaire/périmètre/session';
  end if;

  v_proc := to_regprocedure('public.caisse_decaisser(uuid,integer,text,text,text)');
  if v_proc is null then raise exception 'SM-01.3.CASH.1 : RPC décaissement absente'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('ouvert_par' in v_definition)=0
     or position('p_montant' in v_definition)=0
     or position('p_motif' in v_definition)=0
     or position('profiles' in v_definition)=0 then
    raise exception 'SM-01.3.CASH.2 : décaissement sans garde identité/session/montant/motif/profil';
  end if;

  v_proc := to_regprocedure('public.caisse_cloturer(uuid,integer)');
  if v_proc is null then raise exception 'SM-01.3.CASH.3 : clôture de caisse absente'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('auth.uid()' in v_definition)=0
     or position('v_session.ouvert_par is distinct from auth.uid()' in lower(v_definition))=0
     or position('v_decaissements' in lower(v_definition))=0
     or position('for update' in lower(v_definition))=0 then
    raise exception 'SM-01.3.CASH.4 : clôture sans garde titulaire, verrouillage ou rapprochement décaissements';
  end if;

  v_proc := to_regprocedure('public.vente_annulation_decider(uuid,boolean)');
  if v_proc is null then raise exception 'SM-01.3.POS.9 : décision d’annulation absente'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('demandee_par' in v_definition)=0
     or position('promoteur' in lower(v_definition))=0
     or position('can_access_pharmacy' in v_definition)=0 then
    raise exception 'SM-01.3.POS.10 : décision d’annulation sans séparation des tâches/rôle/périmètre';
  end if;

  v_proc := to_regprocedure('public.vente_annuler(uuid)');
  if v_proc is null then raise exception 'SM-01.3.POS.11 : exécution d’annulation absente'; end if;
  select pg_get_functiondef(v_proc) into v_definition;
  if position('statut' in v_definition)=0
     or position('approuvee' in v_definition)=0
     or position('can_operate_pharmacy' in v_definition)=0 then
    raise exception 'SM-01.3.POS.12 : annulation sans vente payée, approbation ou périmètre';
  end if;

  -- Les RPC sensibles de caisse sont appelables par authenticated mais pas anon.
  if has_function_privilege('anon','public.vente_reservation_encaisser(uuid,uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.caisse_decaisser(uuid,integer,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.caisse_cloturer(uuid,integer)','EXECUTE') then
    raise exception 'SM-01.3.CASH.5 : RPC POS/caisse accessible au rôle anon';
  end if;
end
$test$;
rollback;
