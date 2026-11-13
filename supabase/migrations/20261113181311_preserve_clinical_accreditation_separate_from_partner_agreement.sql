-- NAXA — séparer l'agrément médical du statut indépendant de Partenaire.
-- Un salarié peut être médicalement agréé et accéder aux données cliniques uniquement
-- dans le cadre des liens patients, consentements et politiques RLS existants.
-- Le statut de Partenaire indépendant reste conditionné par la convention autonome.
create or replace function private.suivi_is_verified_professional(p_user_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $function$
  select coalesce(exists(
    select 1
    from public.suivi_professionals sp
    join public.profiles account on account.id=sp.user_id
    where sp.user_id=p_user_id
      and sp.verified is true
      and sp.verification_status='verified'
      and (sp.verification_expires_at is null or sp.verification_expires_at>now())
      and account.actif=true
  ),false);
$function$;
revoke all on function private.suivi_is_verified_professional(uuid) from public,anon,authenticated;
