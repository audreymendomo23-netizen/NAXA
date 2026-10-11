-- Contrôle structurel du parcours POS atomique/idempotent.
begin;

do $test$
declare
  v_def text;
begin
  if to_regprocedure('public.vente_encaisser_finaliser(uuid,public.mode_paiement_caisse,integer,text)') is null then
    raise exception 'RPC vente_encaisser_finaliser absente';
  end if;

  select pg_get_functiondef('public.vente_encaisser_finaliser(uuid,public.mode_paiement_caisse,integer,text)'::regprocedure)
    into v_def;

  if position('for update' in lower(v_def))=0 then
    raise exception 'La vente n''est pas verrouillée pendant le parcours atomique';
  end if;
  if position('public.vente_encaisser' in v_def)=0 or position('public.vente_finaliser' in v_def)=0 then
    raise exception 'Les deux moteurs POS existants ne sont pas appelés';
  end if;
  if position('v_vente.statut = ''payee''' in v_def)=0 or position('v_paye = v_vente.total_net' in v_def)=0 then
    raise exception 'La reprise idempotente n''est pas implémentée';
  end if;
  if has_function_privilege('anon','public.vente_encaisser_finaliser(uuid,public.mode_paiement_caisse,integer,text)','EXECUTE') then
    raise exception 'RPC atomique accessible à anon';
  end if;
end;
$test$;

select true as naxa_071d_vente_encaisser_finaliser_atomique_pass;
rollback;
