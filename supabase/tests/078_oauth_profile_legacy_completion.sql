-- Test structurel NAXA 078 ; rollback systématique.
begin;
do $test$
declare
  v_source text;
begin
  select pg_get_functiondef('public.naxa_complete_google_profile(text,text,text,text,text,date,boolean)'::regprocedure)
    into v_source;
  if position('update public.profiles' in lower(v_source))=0 then
    raise exception 'RPC ne permet pas de compléter un profil client historique';
  end if;
  if position('insert into public.profiles' in lower(v_source))=0 then
    raise exception 'RPC ne permet pas de créer un profil OAuth absent';
  end if;
  if position('consent_accepted_at = now()' in lower(v_source))=0 then
    raise exception 'Horodatage du consentement absent';
  end if;
  if position('age_verified = true' in lower(v_source))=0 then
    raise exception 'Validation d''âge absente';
  end if;
end;
$test$;
select true as naxa_078_google_legacy_profile_pass;
rollback;
