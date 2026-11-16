do $test$
declare
  v_payment text;
  v_finalizer text;
  v_guard text;
  v_payment_normal text;
  v_finalizer_normal text;
begin
  v_payment:=pg_get_functiondef(
    'public.vente_ajouter_paiement(uuid,mode_paiement_caisse,integer,text)'::regprocedure
  );
  v_finalizer:=pg_get_functiondef(
    'public.vente_credit_finaliser(uuid,text)'::regprocedure
  );
  v_guard:=pg_get_functiondef(
    'public.naxa_guard_pos_payment_write()'::regprocedure
  );
  v_payment_normal:=regexp_replace(lower(v_payment),'\s+',' ','g');
  v_finalizer_normal:=regexp_replace(lower(v_finalizer),'\s+',' ','g');

  if position('montant_percu,monnaie_rendue' in v_payment_normal)=0
     or position('case when p_mode=''credit'' then p_montant else null end' in v_payment_normal)=0
     or position('p_mode,p_montant,nullif(trim(p_reference),''''),auth.uid()' in v_payment_normal)=0 then
    raise exception 'vente_ajouter_paiement doit enregistrer montant_percu et monnaie_rendue dès l’INSERT crédit';
  end if;

  if position('vp.montant_percu=v_vente.total_net' in v_finalizer_normal)=0
     or position('vp.monnaie_rendue=0' in v_finalizer_normal)=0
     or position('update public.vente_paiements' in v_finalizer_normal)>0
     or position('paiement pos crédit absent ou incomplet' in v_finalizer_normal)=0 then
    raise exception 'vente_credit_finaliser doit vérifier les métadonnées insérées sans UPDATE POS protégé';
  end if;

  if position('if tg_op<>''insert'' then' in lower(v_guard))=0
     or position('les paiements pos ne peuvent pas être modifiés directement' in lower(v_guard))=0 then
    raise exception 'Le garde-fou doit continuer à refuser les modifications directes de paiements POS';
  end if;

  if has_function_privilege(
       'anon',
       'public.vente_ajouter_paiement(uuid,mode_paiement_caisse,integer,text)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.vente_ajouter_paiement(uuid,mode_paiement_caisse,integer,text)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.vente_credit_finaliser(uuid,text)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.vente_credit_finaliser(uuid,text)'::regprocedure,
       'EXECUTE'
     ) then
    raise exception 'ACL des RPC POS crédit non conformes';
  end if;
end
$test$;

select 'POS credit payment metadata is inserted atomically; direct payment mutation guard remains strict: PASS' as result;
