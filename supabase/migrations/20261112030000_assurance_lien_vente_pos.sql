-- Relier la vente POS au dossier Assurance de la réservation sans créer de paiement fictif.
create or replace function private.assurance_lier_vente_reservation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_dossier uuid; v_assureur uuid; v_montant bigint;
begin
  if new.reservation_id is null then return new; end if;
  update public.dossiers_assurance d
  set vente_id=new.id
  where d.reservation_id=new.reservation_id
    and d.pharmacie_id=new.pharmacie_id
    and (d.vente_id is null or d.vente_id=new.id)
  returning d.id,d.couverture_id,d.montant_total
  into v_dossier,v_assureur,v_montant;
  if v_dossier is not null and new.statut='payee' then
    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,acteur_id,type,montant_fcfa,details
    )
    select new.pharmacie_id,new.reservation_id,v_dossier,new.created_by,
      'vente_assurance_enregistree',v_montant,
      jsonb_build_object('vente_id',new.id)
    where not exists(
      select 1 from public.assurance_evenements e
      where e.dossier_id=v_dossier and e.type='vente_assurance_enregistree'
    );
  end if;
  return new;
end
$$;
drop trigger if exists assurance_lier_vente_reservation on public.ventes;
create trigger assurance_lier_vente_reservation
after insert or update of reservation_id,statut on public.ventes
for each row execute function private.assurance_lier_vente_reservation();
