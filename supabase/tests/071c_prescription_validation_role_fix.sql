-- Régression : Promoteur avec fonction_interne NULL doit rester autorisé comme prévu par 063.
begin;

do $test$
declare
  v_def text;
begin
  if to_regprocedure('public.prescription_valider(uuid,boolean,text)') is null then
    raise exception 'RPC prescription_valider absente';
  end if;

  select pg_get_functiondef('public.prescription_valider(uuid,boolean,text)'::regprocedure)
    into v_def;

  if position('p.role::text = ''promoteur''' in v_def)=0 then
    raise exception 'Le rôle Promoteur n''est pas explicitement autorisé';
  end if;
  if position('pharmacien_assistant' in v_def)=0 or position('pharmacien' in v_def)=0 then
    raise exception 'Les fonctions Pharmacien historiques ne sont pas conservées';
  end if;
  if position('p.pharmacie_id = v.pharmacie_id' in v_def)=0 then
    raise exception 'Le contrôle du périmètre pharmacie est absent';
  end if;
end;
$test$;

select true as naxa_071c_prescription_validation_role_fix_pass;
rollback;
