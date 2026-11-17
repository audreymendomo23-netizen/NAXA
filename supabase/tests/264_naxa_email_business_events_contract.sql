-- Contrat des événements métier e-mail NAXA. Aucun e-mail n'est envoyé.
begin;
do $contract$
declare v_table regclass;
begin
  v_table:=to_regclass('private.email_delivery_outbox');
  if v_table is null then raise exception '264 FAIL: outbox universelle absente'; end if;

  if not exists(select 1 from pg_trigger where tgname='trg_naxa_exam_invite_email_events' and not tgisinternal) then
    raise exception '264 FAIL: déclencheur invitation Examens absent';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_naxa_livreur_invite_email_events' and not tgisinternal) then
    raise exception '264 FAIL: déclencheur invitation Livreur absent';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_naxa_auth_activation_email' and not tgisinternal) then
    raise exception '264 FAIL: déclencheur activation Auth absent';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_naxa_partner_dossier_email_events' and not tgisinternal) then
    raise exception '264 FAIL: déclencheur décision dossier partenaire absent';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_naxa_partner_subscription_notification_email' and not tgisinternal) then
    raise exception '264 FAIL: déclencheur notifications abonnement absent';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_naxa_home_agreement_email_events' and not tgisinternal) then
    raise exception '264 FAIL: déclencheur convention domicile absent';
  end if;
  if has_table_privilege('authenticated','private.email_delivery_outbox','select')
    or has_table_privilege('anon','private.email_delivery_outbox','select') then
    raise exception '264 FAIL: accès direct client à l''outbox';
  end if;
  if has_function_privilege('authenticated','public.emettre_rappels_invitations_email()','execute')
    or has_function_privilege('anon','public.emettre_rappels_invitations_email()','execute') then
    raise exception '264 FAIL: RPC de rappel invitation exposée';
  end if;
  if has_function_privilege('authenticated','public.emettre_rappels_conventions_prestations_email()','execute')
    or has_function_privilege('anon','public.emettre_rappels_conventions_prestations_email()','execute') then
    raise exception '264 FAIL: RPC rappel convention exposée';
  end if;
  if not has_function_privilege('service_role','public.emettre_rappels_invitations_email()','execute')
    or not has_function_privilege('service_role','public.emettre_rappels_conventions_prestations_email()','execute') then
    raise exception '264 FAIL: droits worker service_role absents';
  end if;
end $contract$;
select '264 business email events contract PASS' as resultat;
rollback;
