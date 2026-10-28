-- NAXA 257 — cinq scénarios regroupés pour le retrait crédit Marketplace.
-- À exécuter après les migrations 203, 209, 247, 252 et 256 sur une BASE DE TEST.
-- Les contrôles de fonctions sont réels; les fixtures temporaires testent les invariants
-- d'allocation/rollback, mais ne remplacent pas un E2E avec données caisse/crédit.
begin;

do $contract$
declare w text; a text; rs text; c text; e text; o text; compact text;
begin
  if to_regprocedure('public.vente_reservation_credit_finaliser(uuid,uuid,text)') is null
     or to_regprocedure('public.client_credit_demande_decider(uuid,boolean)') is null
     or to_regprocedure('public.restore_stock(uuid)') is null
     or to_regprocedure('private.set_reservation_status(uuid,public.resa_statut)') is null
     or to_regprocedure('public.expirer_reservations_cron(integer)') is null
     or to_regprocedure('public.marketplace_offre_stock_disponible(uuid,uuid)') is null then
    raise exception 'Contrat incomplet : RPC retrait/allocation/restauration/annulation/expiration absente';
  end if;
  select pg_get_functiondef('public.vente_reservation_credit_finaliser(uuid,uuid,text)'::regprocedure) into w;
  select pg_get_functiondef('public.client_credit_demande_decider(uuid,boolean)'::regprocedure) into a;
  select pg_get_functiondef('public.restore_stock(uuid)'::regprocedure) into rs;
  select pg_get_functiondef('private.set_reservation_status(uuid,public.resa_statut)'::regprocedure) into c;
  select pg_get_functiondef('public.expirer_reservations_cron(integer)'::regprocedure) into e;
  select pg_get_functiondef('public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure) into o;
  compact:=lower(regexp_replace(w,'\s+','','g'));

  -- 1: allocation propre à chaque réservation et verrouillage lot+allocation.
  if position('a.reservation_id=r.id' in compact)=0 or position('a.produit_id=v_item.produit_id' in compact)=0
     or position('forupdateofl,a' in compact)=0 or position('reservation_item_lots' in lower(a))=0 then
    raise exception 'Scénario 1 : retrait non isolé par allocation de réservation';
  end if;
  -- 2: décrément des lots et du stock agrégé avec garde de quantité.
  if position('updatepublic.stocks_lotssetquantite=quantite-v_take' in compact)=0
     or position('updatepublic.stockssetquantite=quantite-v_item.quantite' in compact)=0
     or position('quantite>=v_item.quantite' in compact)=0 then
    raise exception 'Scénario 2 : contrat de décrément lot/stock incomplet';
  end if;
  -- 3: lots bloqués/périmés exclus et quantité restante refusée.
  if position('coalesce(l.bloque,false)=false' in compact)=0
     or position('l.date_peremption>=current_date' in compact)=0
     or position('ifv_remaining>0thenraiseexception' in compact)=0 then
    raise exception 'Scénario 3 : garde lot invalide/insuffisant absente';
  end if;
  -- 4: les erreurs remontent; le retrait passe par le registre de crédit.
  if position('exceptionwhen' in compact)>0 or position('raiseexception' in compact)=0
     or position('client_credit_enregistrer_vente' in lower(w))=0 then
    raise exception 'Scénario 4 : rollback transactionnel/registre crédit compromis';
  end if;
  -- 5: restauration idempotente, jamais après consommation; annulation/expiration branchées.
  if position('stock_decremented' in lower(rs))=0 or position('stock_restored' in lower(rs))=0
     or position('consumed_atisnull' in lower(regexp_replace(rs,'\s+','','g')))=0
     or position('restore_stock' in lower(e))=0 or position('expiree' in lower(e))=0
     or position('set_reservation_status' in lower(c))=0
     or position('stock_decremented=false' in lower(regexp_replace(o,'\s+','','g')))=0 then
    raise exception 'Scénario 5 : libération/expiration ou protection double-restauration incomplète';
  end if;
end
$contract$;

create temporary table _naxa257_lots(id text primary key, qty int not null check(qty>=0), blocked bool not null default false) on commit drop;
create temporary table _naxa257_alloc(reservation text, lot text references _naxa257_lots(id), qty int not null, restored bool not null default false, primary key(reservation,lot)) on commit drop;
create temporary table _naxa257_stock(product text primary key, qty int not null check(qty>=0)) on commit drop;
insert into _naxa257_lots values ('A',3,false),('B',4,false),('C',2,false);
insert into _naxa257_alloc(reservation,lot,qty) values ('R1','A',2),('R1','B',1),('R2','B',2),('R2','C',1);
insert into _naxa257_stock values ('P',9);

do $fixtures$
declare need int; take int; x record; lots_before int; stock_before int;
begin
  -- 1: retrait R2 en premier ne consomme que B(2)+C(1), pas A réservé à R1.
  need:=3;
  for x in select l.id,l.qty,a.qty allocated from _naxa257_alloc a join _naxa257_lots l on l.id=a.lot where a.reservation='R2' and not a.restored order by l.id for update of l,a loop
    take:=least(need,x.allocated);
    if x.qty<take then raise exception 'R2 lot insuffisant'; end if;
    update _naxa257_lots set qty=qty-take where id=x.id;
    update _naxa257_alloc set restored=true where reservation='R2' and lot=x.id;
    need:=need-take;
  end loop;
  if need<>0 or (select qty from _naxa257_lots where id='A')<>3 or
     (select qty from _naxa257_lots where id='B')<>2 or (select qty from _naxa257_lots where id='C')<>1 then
    raise exception 'Scénario 1 : retrait inversé a consommé des lots incorrects';
  end if;
  -- 2: le stock global suit le retrait de 3 unités; la somme des lots est également 6.
  update _naxa257_stock set qty=qty-3 where product='P' and qty>=3;
  if not found or (select qty from _naxa257_stock where product='P')<>6 or
     (select sum(qty) from _naxa257_lots)<>6 then raise exception 'Scénario 2 : rapprochement incorrect'; end if;
  -- 3: une allocation vers un lot bloqué ne peut pas être substituée silencieusement.
  insert into _naxa257_lots values ('X',5,true);
  insert into _naxa257_alloc values ('R3','X',2,false);
  need:=2;
  for x in select l.id,l.qty,a.qty allocated from _naxa257_alloc a join _naxa257_lots l on l.id=a.lot where a.reservation='R3' and not a.restored and not l.blocked for update of l,a loop
    take:=least(need,x.allocated); update _naxa257_lots set qty=qty-take where id=x.id; need:=need-take;
  end loop;
  if need<>2 or (select qty from _naxa257_lots where id='X')<>5 then raise exception 'Scénario 3 : lot bloqué consommé'; end if;
  -- 4: une erreur après écriture annule toutes les écritures de la sous-transaction.
  select sum(qty) into lots_before from _naxa257_lots;
  select qty into stock_before from _naxa257_stock where product='P';
  begin
    update _naxa257_lots set qty=qty-1 where id='A';
    update _naxa257_stock set qty=qty-1 where product='P';
    raise exception 'naxa257_injected_failure';
  exception when others then if sqlerrm<>'naxa257_injected_failure' then raise; end if;
  end;
  if (select sum(qty) from _naxa257_lots)<>lots_before or (select qty from _naxa257_stock where product='P')<>stock_before then
    raise exception 'Scénario 4 : rollback fixture incomplet';
  end if;
  -- 5: libérer un hold logique deux fois ne modifie jamais le stock physique.
  select sum(qty) into lots_before from _naxa257_lots;
  update _naxa257_alloc set restored=true where reservation='R1' and not restored;
  update _naxa257_alloc set restored=true where reservation='R1' and not restored;
  if (select sum(qty) from _naxa257_lots)<>lots_before then raise exception 'Scénario 5 : libération a touché le stock'; end if;
end
$fixtures$;

rollback;
select '257_credit_withdrawal_five_scenarios PASS' as resultat;
