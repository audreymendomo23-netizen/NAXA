-- Require the actual active business role to be Client when deciding an amount proposal.
begin;

create or replace function public.assurance_repondre_proposition_montant(
  p_proposition uuid,
  p_accepter boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_d public.dossiers_assurance%rowtype;
  v_p public.assurance_montant_propositions%rowtype;
  v_s public.assurance_reservation_snapshots%rowtype;
begin
  if v_uid is null or p_accepter is null
     or private.naxa_business_function(v_uid)<>'client'
     or not exists (
       select 1 from public.profiles p
       where p.id=v_uid and p.role='client' and p.actif=true
     ) then
    raise exception 'Compte Client actif en rôle Client et décision explicite requis';
  end if;

  select d.* into v_d
  from public.dossiers_assurance d
  join public.assurance_montant_propositions p on p.dossier_id=d.id
  where p.id=p_proposition
  for update of d;

  if not found or v_d.client_id is distinct from v_uid then
    raise exception 'Proposition inaccessible : seul le Client propriétaire peut répondre';
  end if;

  select * into v_p
  from public.assurance_montant_propositions
  where id=p_proposition and dossier_id=v_d.id
  for update;

  if not found or v_p.client_id is distinct from v_uid
     or v_p.statut<>'proposee' or v_d.statut<>'soumis'
     or v_d.vente_id is not null or coalesce(v_d.montant_rembourse,0)<>0 then
    raise exception 'Cette proposition n''est plus en attente de votre décision';
  end if;

  select * into v_s
  from public.assurance_reservation_snapshots
  where id=v_p.snapshot_id
  for update;

  if not found or v_s.reservation_id is distinct from v_d.reservation_id
     or v_s.valide_client is not true
     or v_p.montant_total_fcfa<>v_s.montant_brut_fcfa
     or v_p.montant_assureur_fcfa>v_s.montant_assureur_fcfa then
    raise exception 'La proposition ne correspond plus au devis initial';
  end if;

  if p_accepter then
    update public.assurance_montant_propositions
    set statut='acceptee',decidee_par=v_uid,decidee_le=now()
    where id=v_p.id;

    update public.dossiers_assurance
    set montant_prise_en_charge=v_p.montant_assureur_fcfa,
        montant_client=v_p.montant_client_fcfa
    where id=v_d.id and statut='soumis';

    if not found then
      raise exception 'Le dossier a changé avant l''acceptation';
    end if;

    update public.assurance_reservation_snapshots
    set accord_client_modification_le=now()
    where id=v_s.id;

    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,
      type,montant_fcfa,details
    ) values (
      v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,
      'accord_client_obtenu',v_p.montant_total_fcfa,
      jsonb_build_object(
        'proposition_id',v_p.id,
        'version',v_p.version,
        'montant_assureur_fcfa',v_p.montant_assureur_fcfa,
        'montant_client_fcfa',v_p.montant_client_fcfa
      )
    );
  else
    update public.assurance_montant_propositions
    set statut='refusee',decidee_par=v_uid,decidee_le=now()
    where id=v_p.id;

    insert into public.assurance_evenements(
      pharmacie_id,reservation_id,dossier_id,assureur_id,acteur_id,
      type,montant_fcfa,details
    ) values (
      v_d.pharmacie_id,v_d.reservation_id,v_d.id,v_s.assureur_id,v_uid,
      'accord_client_refuse',v_p.montant_total_fcfa,
      jsonb_build_object('proposition_id',v_p.id,'version',v_p.version)
    );
  end if;
end;
$function$;

revoke all on function public.assurance_repondre_proposition_montant(uuid,boolean) from public,anon;
grant execute on function public.assurance_repondre_proposition_montant(uuid,boolean) to authenticated,service_role;

commit;
