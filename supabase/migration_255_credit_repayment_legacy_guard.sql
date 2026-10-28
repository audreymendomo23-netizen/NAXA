-- NAXA 255 — empêcher l'ancien contrat libre de qualifier silencieusement un moyen non espèces.
-- Les nouveaux appels doivent utiliser la signature typée de migration 254.
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
declare
  v_motif text := lower(trim(coalesce(p_motif,'')));
begin
  if v_motif !~ '^(esp[eè]ces|especes)?$' then
    raise exception 'Contrat de remboursement obsolète : utilisez le moyen de paiement structuré; seuls les remboursements espèces sont disponibles';
  end if;

  return public.client_credit_rembourser(
    p_credit,p_montant,'especes'::public.mode_paiement_caisse,p_reference,
    case when v_motif='' then null else 'Espèces' end
  );
end;
$legacy$;

revoke all on function public.client_credit_rembourser(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.client_credit_rembourser(uuid,integer,text,text) to authenticated;

commit;
