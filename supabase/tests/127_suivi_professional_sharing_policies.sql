-- Test NAXA 127 : policies pour destinataires et administration des professionnels.
do $test$
declare recipient_policy boolean; admin_policy boolean;
begin
 select exists(select 1 from pg_policies where schemaname='public' and tablename='suivi_shares' and policyname='suivi_shares_recipient_select') into recipient_policy;
 select exists(select 1 from pg_policies where schemaname='public' and tablename='suivi_professionals' and policyname='suivi_professionals_admin_manage') into admin_policy;
 if not recipient_policy then raise exception 'NAXA 127: lecture du partage par le destinataire manquante'; end if;
 if not admin_policy then raise exception 'NAXA 127: gestion admin des professionnels manquante'; end if;
 if not public.is_suivi_test_account('00000000-0000-0000-0000-000000000000'::uuid) then null; else raise exception 'NAXA 127: UUID absent autorisé'; end if;
end;
$test$;
select true as naxa_127_suivi_sharing_policies_pass;
