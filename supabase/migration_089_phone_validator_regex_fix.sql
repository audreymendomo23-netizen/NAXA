-- NAXA 089 — corrige l’expression régulière du validateur téléphonique.
-- L’utilisation de [+] évite toute ambiguïté d’échappement SQL/regex.
begin;

create or replace function private.naxa_phone_valid_for_country(
  p_country text,
  p_phone text
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $function$
  select case upper(trim(coalesce(p_country, '')))
    when 'CM' then coalesce(trim(p_phone), '') ~ '^[+]237[0-9]{9}$'
    when 'CF' then coalesce(trim(p_phone), '') ~ '^[+]236[0-9]{8}$'
    when 'TD' then coalesce(trim(p_phone), '') ~ '^[+]235[0-9]{8}$'
    when 'CG' then coalesce(trim(p_phone), '') ~ '^[+]242[0-9]{9}$'
    when 'CD' then coalesce(trim(p_phone), '') ~ '^[+]243[0-9]{9}$'
    when 'GQ' then coalesce(trim(p_phone), '') ~ '^[+]240[0-9]{9}$'
    when 'GA' then coalesce(trim(p_phone), '') ~ '^[+]241[0-9]{8}$'
    when 'ST' then coalesce(trim(p_phone), '') ~ '^[+]239[0-9]{7}$'
    when 'AO' then coalesce(trim(p_phone), '') ~ '^[+]244[0-9]{9}$'
    when 'BI' then coalesce(trim(p_phone), '') ~ '^[+]257[0-9]{8}$'
    when 'RW' then coalesce(trim(p_phone), '') ~ '^[+]250[0-9]{9}$'
    else false
  end
$function$;

revoke all on function private.naxa_phone_valid_for_country(text, text)
  from public, anon, authenticated;

commit;
