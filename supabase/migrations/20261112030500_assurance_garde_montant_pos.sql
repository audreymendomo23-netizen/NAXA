-- Bloquer toute vente Assurance dont le montant encaissé ne correspond pas à la part client figée.
create or replace function private.assurance_lier_vente_reservation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_dossier uuid; v_montant_total numeric; v_montant_client numeric;
begin
  if new.reservation_id is null then return new; end if;
  select d.id,d.montant_total,d.montant_client
    into v_dossier,v_montant_total,v_montant_client
  from public.dossiers_assurance d
  where d.reservation_id=new.reservation_id and d.pharmacie_id=new.pharmacie_id
  for update;
  if v_dossier is null then return new; end if;
  if new.statut='payee' and round(v_montant_client)::bigint<>new.total_net then
    raise exception 'Vente Assurance bloquée : le POS doit encaisser exactement la part client figée du devis';
  end if;
  update public.dossiers_assurance d set vente_id=new.id
  where d.id=v_dossier and (d.vente_id is null or d.vente_id=new.id);
  if new.statut='payee' then
    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,acteur_id,type,montant_fcfa,details
    )
    select new.pharmacie_id,new.reservation_id,v_dossier,new.created_by,
      'vente_assurance_enregistree',round(v_montant_total)::bigint,
      jsonb_build_object('vente_id',new.id,'part_client_fcfa',round(v_montant_client)::bigint)
    where not exists(
      select 1 from public.assurance_evenements e
      where e.dossier_id=v_dossier and e.type='vente_assurance_enregistree'
    );
  end if;
  return new;
end
$$;
