-- NAXA — Crédit Marketplace + crédit au comptoir : stock, plafonds délégués et comptabilité.
-- Cible : Replay d'abord. Ne crée aucun compte, écriture ou paramètre comptable de démonstration.
begin;

create table if not exists public.naxa_responsable_credit_limits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  plafond_fcfa bigint not null check (plafond_fcfa >= 0),
  actif boolean not null default true,
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, pharmacie_id)
);

alter table public.naxa_responsable_credit_limits enable row level security;
drop policy if exists naxa_responsable_credit_limits_read on public.naxa_responsable_credit_limits;
create policy naxa_responsable_credit_limits_read
on public.naxa_responsable_credit_limits
for select to authenticated
using (
  profile_id = (select auth.uid())
  or public.is_admin()
  or public.can_access_pharmacy(pharmacie_id)
);
revoke all on public.naxa_responsable_credit_limits from anon, public;
grant select on public.naxa_responsable_credit_limits to authenticated;

create or replace function public.naxa_responsable_credit_limit_configurer(
  p_responsable uuid,
  p_pharmacie uuid,
  p_plafond_fcfa bigint
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_responsable is null or p_pharmacie is null or p_plafond_fcfa is null or p_plafond_fcfa<0 then
    raise exception 'Responsable, pharmacie et plafond valide requis';
  end if;
  if public.is_admin() is not true and not exists (
    select 1 from public.profiles promoter
    where promoter.id=auth.uid()
      and promoter.actif and promoter.role::text='promoteur' and promoter.niveau_interne=1
      and private.naxa_promoteur_valide(promoter.id)
      and exists (
        select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=promoter.id and pp.pharmacie_id=p_pharmacie and pp.actif
      )
  ) then
    raise exception 'Seul le Promoteur propriétaire du réseau ou NAXA peut fixer ce plafond';
  end if;
  if not exists (
    select 1 from public.profiles r
    where r.id=p_responsable and r.actif
      and r.role::text='pharmacie' and r.fonction_interne='responsable' and r.niveau_interne=2
  ) then raise exception 'Le compte cible n’est pas un Responsable actif'; end if;
  if not public.naxa_has_active_professional_assignment(p_responsable,p_pharmacie,'responsable') then
    raise exception 'Le Responsable ne possède pas d’affectation active pour cette pharmacie';
  end if;
  insert into public.naxa_responsable_credit_limits(
    profile_id,pharmacie_id,plafond_fcfa,actif,created_by,updated_by
  ) values(p_responsable,p_pharmacie,p_plafond_fcfa,true,auth.uid(),auth.uid())
  on conflict(profile_id,pharmacie_id) do update
    set plafond_fcfa=excluded.plafond_fcfa,actif=true,updated_by=auth.uid(),updated_at=now()
  returning id into v_id;
  return v_id;
end
$function$;

revoke all on function public.naxa_responsable_credit_limit_configurer(uuid,uuid,bigint) from public,anon;
grant execute on function public.naxa_responsable_credit_limit_configurer(uuid,uuid,bigint) to authenticated;

create or replace function public.naxa_can_approve_client_credit(
  p_pharmacie uuid,
  p_montant integer
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare v_function text;
begin
  if auth.uid() is null or p_pharmacie is null or p_montant is null or p_montant<=0 then return false; end if;
  if public.is_admin() then return true; end if;
  v_function:=private.naxa_business_function(auth.uid());
  if v_function='promoteur' then
    return private.naxa_actor_can_approve_marketplace_credit(p_pharmacie);
  end if;
  if v_function<>'responsable'
     or not private.naxa_actor_can_approve_marketplace_credit(p_pharmacie) then
    return false;
  end if;
  return exists (
    select 1 from public.naxa_responsable_credit_limits l
    where l.profile_id=auth.uid() and l.pharmacie_id=p_pharmacie
      and l.actif and l.plafond_fcfa>=p_montant::bigint
  );
end
$function$;

revoke all on function public.naxa_can_approve_client_credit(uuid,integer) from public,anon;
grant execute on function public.naxa_can_approve_client_credit(uuid,integer) to authenticated;

-- La configuration d'un compte de crédit doit viser un véritable Client actif.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.client_credit_configurer(uuid,uuid,integer)'::regprocedure)
    into v_definition;
  if position('if p_plafond < 0 then raise exception ''Plafond invalide''; end if;' in v_definition)=0 then
    raise exception 'Contrat inattendu de client_credit_configurer ; migration interrompue';
  end if;
  v_definition:=replace(
    v_definition,
    'if p_plafond < 0 then raise exception ''Plafond invalide''; end if;',
    'if p_client is null or not exists(select 1 from public.profiles p where p.id=p_client and p.actif and p.role::text=''client'') then raise exception ''Le compte cible doit être un Client actif''; end if;' || E'\n  ' ||
    'if p_plafond < 0 then raise exception ''Plafond invalide''; end if;'
  );
  execute v_definition;
end
$migration$;

-- Les Responsables peuvent décider les demandes Caisse et Marketplace, mais uniquement
-- dans le montant que le Promoteur a explicitement délégué pour cette pharmacie.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.client_credit_demande_decider(uuid,boolean)'::regprocedure)
    into v_definition;
  if position('if r.origine=''marketplace'' then' || E'\n    if not private.naxa_actor_can_approve_marketplace_credit(r.pharmacie_id) then' in v_definition)=0 then
    raise exception 'Contrat de décision crédit inattendu ; migration interrompue';
  end if;
  v_definition:=replace(
    v_definition,
    'if r.origine=''marketplace'' then' || E'\n    if not private.naxa_actor_can_approve_marketplace_credit(r.pharmacie_id) then',
    'if r.origine in (''marketplace'',''caisse'') then' || E'\n    if not public.naxa_can_approve_client_credit(r.pharmacie_id,r.montant) then'
  );
  execute v_definition;
end
$migration$;

-- Lors du retrait Marketplace, le stock est déjà décrémenté à l'approbation.
-- Le trigger POS doit donc marquer le draft comme pré-décrémenté au lieu de le débiter encore.
do $migration$
declare v_definition text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.naxa_pos_debit_before_sale_paid()'::regprocedure)
    into v_definition;
  v_old:=E'if old.statut=''brouillon'' and new.statut=''payee'' and not old.stock_decremented_at_draft then\n    perform private.naxa_pos_debit_stock(old.id);\n    new.stock_decremented_at_draft:=true;\n  end if;';
  v_new:=E'if old.statut=''brouillon'' and new.statut=''payee'' and not old.stock_decremented_at_draft then\n    if old.reservation_id is not null and exists (\n      select 1 from public.reservations r\n      where r.id=old.reservation_id and r.stock_decremented and not r.stock_restored\n        and r.consumed_by_vente_id=old.id\n    ) then\n      new.stock_decremented_at_draft:=true;\n    else\n      perform private.naxa_pos_debit_stock(old.id);\n      new.stock_decremented_at_draft:=true;\n    end if;\n  end if;';
  if position(v_old in v_definition)=0 then
    raise exception 'Trigger POS de débit introuvable ou déjà modifié ; migration interrompue';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;

-- Une vente entièrement à crédit n'est pas un encaissement de trésorerie.
do $migration$
declare v_definition text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.compta_emettre_evenement_metier()'::regprocedure)
    into v_definition;
  v_old:='elsif new.statut::text=''payee'' and old.statut::text<>''payee'' then';
  v_new:=v_old || E'\n      if coalesce(new.mode_paiement::text,'''')=''credit'' then return new; end if;';
  if position(v_old in v_definition)=0 then
    raise exception 'Émetteur de vente comptable inattendu ; migration interrompue';
  end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;

-- Un octroi de crédit est comptabilisé depuis l'opération de crédit, jamais comme vente encaissée.
create or replace function public.compta_emettre_octroi_credit()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_date timestamptz; v_date_comptable date;
begin
  if new.nature<>'credit' then return new; end if;
  if new.montant is null or new.montant<=0 then
    raise exception 'Montant octroi de crédit invalide pour la comptabilité';
  end if;
  v_date:=coalesce(new.created_at,clock_timestamp());
  v_date_comptable:=timezone('Africa/Douala',v_date)::date;
  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees
  ) values(
    new.pharmacie_id,'credit_octroi','credit_operation',new.id::text,
    'credit_operation:'||new.id::text||':credit_octroi',v_date,
    jsonb_build_object('montant_fcfa',new.montant::text,'date_comptable',v_date_comptable::text,
      'reference_source',coalesce(nullif(trim(new.reference),''),new.id::text))
  ) on conflict(pharmacie_id,cle_idempotence) do nothing;
  return new;
end
$function$;

revoke all on function public.compta_emettre_octroi_credit() from public,anon,authenticated;
drop trigger if exists compta_outbox_credit_octroi on public.client_credit_operations;
create trigger compta_outbox_credit_octroi
after insert on public.client_credit_operations
for each row when (new.nature='credit')
execute function public.compta_emettre_octroi_credit();

-- Étend le worker comptable actif sans écraser ses contrats Assurance et annulation de vente.
do $migration$
declare v_definition text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.compta_traiter_evenement(uuid,uuid)'::regprocedure)
    into v_definition;
  v_old:='(''vente_encaissee'',''depense_validee'',''vente_annulee'',''assurance_prise_en_charge'',''assurance_remboursement_recu'')';
  v_new:='(''vente_encaissee'',''depense_validee'',''vente_annulee'',''assurance_prise_en_charge'',''assurance_remboursement_recu'',''credit_octroi'',''credit_remboursement'')';
  if position(v_old in v_definition)=0 then raise exception 'Liste des événements du worker inattendue'; end if;
  v_definition:=replace(v_definition,v_old,v_new);
  v_old:='(''vente'',''depense'',''vente_annulation'',''dossier_assurance'',''reglement_assurance'')';
  v_new:='(''vente'',''depense'',''vente_annulation'',''dossier_assurance'',''reglement_assurance'',''credit_operation'')';
  if position(v_old in v_definition)=0 then raise exception 'Liste des sources du worker inattendue'; end if;
  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;

-- Finalisation sécurisée d'une vente au comptoir à crédit.
-- En cas de dépassement, crée une demande caisse sans mouvement de stock ;
-- l'approbation Promoteur/Responsable autorise la reprise du même draft.
create or replace function public.vente_credit_finaliser(
  p_vente uuid,
  p_reference text default null
)
returns table(
  resultat text,
  demande_id uuid,
  operation_id uuid,
  numero_vente text,
  total integer
)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_vente public.ventes%rowtype;
  v_credit public.client_credits%rowtype;
  v_request public.client_credit_requests%rowtype;
  v_request_id uuid;
  v_operation_id uuid;
  v_balance bigint;
  v_session public.caisses_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_vente is null then raise exception 'Vente requise'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then
    raise exception 'Vente introuvable ou déjà finalisée';
  end if;
  if v_vente.client_id is null then raise exception 'Associez un Client à cette vente avant de choisir le crédit'; end if;
  if v_vente.total_net<=0 or not exists(select 1 from public.vente_lignes vl where vl.vente_id=p_vente) then
    raise exception 'Vente vide ou montant invalide';
  end if;
  if not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Finalisation à crédit réservée à une Caisse autorisée de cette pharmacie';
  end if;
  if not exists (
    select 1 from public.pharmacies ph
    where ph.id=v_vente.pharmacie_id and ph.actif and ph.archivee_le is null
  ) then raise exception 'La pharmacie est inactive ou archivée'; end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=v_vente.caisse_session_id and cs.statut='ouverte' and cs.cloture_at is null
    and c.actif and c.pharmacie_id=v_vente.pharmacie_id
    and (public.is_admin() or cs.ouvert_par=auth.uid())
  for update of cs;
  if not found then raise exception 'Session personnelle de caisse ouverte requise'; end if;
  if not exists(select 1 from public.vente_lignes vl where vl.vente_id=p_vente) then
    raise exception 'Vente vide';
  end if;
  if exists(select 1 from public.vente_paiements vp where vp.vente_id=p_vente) then
    raise exception 'Un paiement existe déjà pour cette vente';
  end if;

  select * into v_credit from public.client_credits c
  where c.client_id=v_vente.client_id and c.pharmacie_id=v_vente.pharmacie_id and c.actif
  for update;
  if not found then raise exception 'Aucun compte de crédit actif pour ce Client dans cette pharmacie'; end if;

  select * into v_request from public.client_credit_requests q
  where q.vente_id=p_vente
  order by q.created_at desc,q.id desc limit 1
  for update;

  if found then
    if v_request.statut='en_attente' then
      return query select 'decision_requise',v_request.id,null::uuid,v_vente.numero_vente,v_vente.total_net;
      return;
    end if;
    if v_request.statut='rejetee' then
      raise exception 'La demande de crédit de cette vente a été refusée ; le Client doit régler comptant ou une nouvelle vente doit être créée';
    end if;
    if v_request.statut<>'approuvee' or v_request.consumed_at is not null then
      raise exception 'La demande de crédit est déjà consommée ou dans un état non autorisé';
    end if;
    if v_request.montant<>v_vente.total_net then
      raise exception 'Le panier a changé depuis l’approbation ; le montant doit être réexaminé';
    end if;
  else
    if exists (
      select 1 from public.client_credit_requests q
      where q.client_id=v_vente.client_id and q.statut in ('en_attente','approuvee')
        and q.consumed_at is null
    ) then
      raise exception 'Une autre demande de crédit de ce Client est déjà en cours';
    end if;
    v_balance:=v_credit.solde::bigint+v_vente.total_net::bigint;
    if v_balance>v_credit.plafond then
      v_request_id:=public.client_credit_demander(p_vente,v_vente.total_net,'Achat à crédit au comptoir');
      return query select 'decision_requise',v_request_id,null::uuid,v_vente.numero_vente,v_vente.total_net;
      return;
    end if;
  end if;

  v_operation_id:=public.client_credit_enregistrer_vente(
    p_vente,v_vente.total_net,nullif(trim(p_reference),'')
  );
  if v_operation_id is null then raise exception 'Opération de crédit non créée'; end if;

  update public.client_credit_operations op
  set caisse_session_id=v_vente.caisse_session_id
  where op.id=v_operation_id and op.vente_id=p_vente and op.nature='credit';
  if not found then raise exception 'Opération de crédit non rattachée à la session de caisse'; end if;

  update public.vente_paiements vp
  set montant_percu=v_vente.total_net,monnaie_rendue=0
  where vp.vente_id=p_vente and vp.mode='credit';
  if not found then raise exception 'Paiement POS crédit absent'; end if;

  update public.ventes v
  set statut='payee',mode_paiement='credit',paiement_ref=nullif(trim(p_reference),''),paid_at=now()
  where v.id=p_vente and v.statut='brouillon';
  if not found then raise exception 'La vente à crédit n’a pas pu être finalisée'; end if;

  return query select 'finalisee',v_request.id,v_operation_id,v_vente.numero_vente,v_vente.total_net;
end
$function$;

revoke all on function public.vente_credit_finaliser(uuid,text) from public,anon;
grant execute on function public.vente_credit_finaliser(uuid,text) to authenticated;

commit;
