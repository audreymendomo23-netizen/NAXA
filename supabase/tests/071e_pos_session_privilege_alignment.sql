-- Vérifier que l'ouverture de session et la création de vente appliquent CREATE_SALE.
begin;

do $test$
declare
  v_open text;
  v_sale text;
begin
  select pg_get_functiondef('public.caisse_ouvrir(uuid,integer)'::regprocedure) into v_open;
  select pg_get_functiondef('public.vente_creer(uuid,uuid)'::regprocedure) into v_sale;

  if position('CREATE_SALE' in v_open)=0 or position('authorize' in v_open)=0 then
    raise exception 'caisse_ouvrir ne vérifie pas CREATE_SALE';
  end if;
  if position('CREATE_SALE' in v_sale)=0 or position('authorize' in v_sale)=0 then
    raise exception 'vente_creer ne vérifie pas CREATE_SALE';
  end if;
  if position('cs.statut = ''ouverte''' in v_sale)=0 then
    raise exception 'vente_creer ne vérifie pas que la session est ouverte';
  end if;
end;
$test$;

rollback;
