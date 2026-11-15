do $test$
declare
  v_def text;
  v_normal text;
  v_indexes text[];
begin
  v_def:=pg_get_functiondef(
    'public.assurance_confirmer_prise_en_charge(uuid,text)'::regprocedure
  );

  v_normal:=regexp_replace(lower(v_def),'\\s+',' ','g');
  if position('on conflict (pharmacie_id,cle_idempotence) do nothing' in v_normal)=0 then
    raise exception 'La confirmation doit cibler la clé unique pharmacie + idempotence';
  end if;

  select array_agg(indexdef) into v_indexes
  from pg_indexes
  where schemaname='public'
    and tablename='compta_evenement'
    and indexname='compta_evenement_pharmacie_id_cle_idempotence_key';

  if v_indexes is null or array_length(v_indexes,1) is null
     or position('UNIQUE' in upper(v_indexes[1]))=0
     or position('(pharmacie_id, cle_idempotence)' in replace(lower(v_indexes[1]),' ',' '))=0 then
    raise exception 'La table compta_evenement doit garantir une unicité idempotente par pharmacie';
  end if;
end
$test$;

select 'Assurance accounting event uses pharmacy-scoped idempotence unique key: PASS' as result;
