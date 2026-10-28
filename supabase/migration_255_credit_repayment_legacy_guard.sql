-- NAXA 255 — imposer le contrat typé pour éviter toute inférence depuis le motif libre.
-- La signature historique ne permet pas de prouver le moyen réellement encaissé.
begin;

create or replace function public.client_credit_rembourser(
  p_credit uuid,
  p_montant integer,
  p_reference text default null,
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $legacy$
begin
  raise exception 'Contrat de remboursement obsolète : utilisez le moyen de paiement structuré; aucun mode ne peut être déduit du motif libre';
end;
$legacy$;

revoke all on function public.client_credit_rembourser(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.client_credit_rembourser(uuid,integer,text,text) to authenticated;

commit;
