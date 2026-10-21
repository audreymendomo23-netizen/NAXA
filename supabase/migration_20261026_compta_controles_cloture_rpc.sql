-- NAXA Comptable — écriture atomique des contrôles de clôture pour le parcours UI/API.
begin;

create or replace function public.compta_enregistrer_controle_cloture(
  p_pharmacie uuid,
  p_periode uuid,
  p_controle_code text,
  p_statut text,
  p_reference_preuve text,
  p_motif text,
  p_acteur uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $controle$
declare
  v_periode public.compta_periodes%rowtype;
  v_id uuid;
  v_reference text := nullif(trim(coalesce(p_reference_preuve, '')), '');
  v_motif text := nullif(trim(coalesce(p_motif, '')), '');
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Enregistrement de contrôle réservé au service serveur' using errcode = '42501';
  end if;
  if p_pharmacie is null or p_periode is null or p_acteur is null
     or p_controle_code not in ('dotations','paie','tva','stock','rapprochements','regularisations','a_nouveaux')
     or p_statut not in ('a_controler','valide','non_applicable') then
    raise exception 'Paramètres du contrôle invalides';
  end if;
  if length(coalesce(p_reference_preuve,'')) > 500 or length(coalesce(p_motif,'')) > 500 then
    raise exception 'La référence et le motif sont limités à 500 caractères';
  end if;
  if p_statut = 'valide' and v_reference is null then
    raise exception 'Une référence de preuve est obligatoire pour valider le contrôle';
  end if;
  if p_statut = 'non_applicable' and v_motif is null then
    raise exception 'Un motif est obligatoire pour déclarer le contrôle non applicable';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_acteur and p.actif is true and p.pharmacie_id = p_pharmacie
  ) then
    raise exception 'Acteur inactif ou hors du périmètre de la pharmacie' using errcode = '42501';
  end if;

  select * into v_periode
  from public.compta_periodes
  where id = p_periode and pharmacie_id = p_pharmacie
  for update;
  if not found or v_periode.statut <> 'ouverte' then
    raise exception 'Période introuvable ou déjà clôturée';
  end if;
  if p_controle_code in ('regularisations','a_nouveaux')
     and v_periode.date_fin <> (date_trunc('year', v_periode.date_fin::timestamp) + interval '1 year - 1 day')::date then
    raise exception 'Les régularisations et à-nouveaux ne concernent que la clôture annuelle';
  end if;

  insert into public.compta_controles_cloture(
    pharmacie_id, periode_id, controle_code, statut, reference_preuve, motif,
    controle_par, controle_le, updated_at
  ) values (
    p_pharmacie, p_periode, p_controle_code, p_statut, v_reference, v_motif,
    case when p_statut = 'a_controler' then null else p_acteur end,
    case when p_statut = 'a_controler' then null else clock_timestamp() end,
    clock_timestamp()
  )
  on conflict (pharmacie_id, periode_id, controle_code) do update set
    statut = excluded.statut,
    reference_preuve = excluded.reference_preuve,
    motif = excluded.motif,
    controle_par = excluded.controle_par,
    controle_le = excluded.controle_le,
    updated_at = clock_timestamp()
  returning id into v_id;

  perform public.compta_auditer(
    p_pharmacie, p_acteur, 'controle_cloture_enregistre',
    p_controle_code, p_periode::text, 'succes',
    'statut=' || p_statut
  );
  return v_id;
end;
$controle$;

revoke all on function public.compta_enregistrer_controle_cloture(uuid,uuid,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.compta_enregistrer_controle_cloture(uuid,uuid,text,text,text,text,uuid) to service_role;

commit;
