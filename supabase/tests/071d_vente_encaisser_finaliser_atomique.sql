-- Contrat statique de la RPC POS atomique utilisée par l'interface caisse.
select to_regprocedure('public.vente_encaisser_finaliser(uuid,integer)') is not null;

select to_regprocedure('public.vente_encaisser_finaliser(uuid,public.mode_paiement_caisse,integer,text)') is not null;

select p.prosecdef
from pg_proc p
where p.oid = 'public.vente_encaisser_finaliser(uuid,integer)'::regprocedure;

select has_function_privilege('authenticated', 'public.vente_encaisser_finaliser(uuid,integer)', 'EXECUTE');

select not has_function_privilege('anon', 'public.vente_encaisser_finaliser(uuid,integer)', 'EXECUTE');

select pg_get_functiondef('public.vente_encaisser_finaliser(uuid,integer)'::regprocedure) like '%especes%';
