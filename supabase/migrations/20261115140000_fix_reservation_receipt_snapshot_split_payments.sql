-- Snapshot de ticket pour POS à paiements fractionnés.
-- On retient le paiement Client et jamais la ligne de créance ASSURANCE:%.
-- Si la part Client est nulle, le snapshot est à 0 FCFA / a_convenir (pas un faux encaissement).
create or replace function public.naxa_reservation_receipt_snapshot()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_ticket text;
  v_canal text;
  v_percu integer;
  v_monnaie integer;
  v_date timestamptz;
begin
  if new.statut = 'payee' and old.statut is distinct from 'payee' then
    select
      v.numero_vente,
      p.mode::text,
      coalesce(p.montant_percu,p.montant,0),
      coalesce(p.monnaie_rendue,0),
      coalesce(v.paid_at,p.created_at,now())
    into v_ticket,v_canal,v_percu,v_monnaie,v_date
    from public.ventes v
    left join lateral (
      select vp.*
      from public.vente_paiements vp
      where vp.vente_id=v.id
        and coalesce(vp.reference,'') not like 'ASSURANCE:%'
      order by vp.created_at desc,vp.id desc
      limit 1
    ) p on true
    where v.reservation_id=new.id
      and v.statut='payee'
    order by v.paid_at desc nulls last,v.created_at desc,v.id desc
    limit 1;

    if v_ticket is null then
      raise exception 'Reçu POS incomplet : aucune vente payée ne correspond à cette réservation';
    end if;

    if v_canal is null then
      -- Prise en charge assureur totale : aucun paiement Client n'a été reçu.
      v_canal:='a_convenir';
      v_percu:=0;
      v_monnaie:=0;
    end if;

    if v_percu is null or v_monnaie is null or v_percu<0 or v_monnaie<0 then
      raise exception 'Reçu POS incomplet : montant reçu ou monnaie rendue invalide';
    end if;

    new.paiement_ticket_numero:=v_ticket;
    new.paiement_montant_percu:=v_percu;
    new.paiement_monnaie_rendue:=v_monnaie;
    new.paiement_valide_at:=v_date;
    new.paiement_mode:=case when v_canal='especes' then 'especes_retrait' else v_canal end;
  end if;
  return new;
end;
$function$;
