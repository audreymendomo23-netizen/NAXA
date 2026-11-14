-- NAXA — permettre la sélection d'une affectation professionnelle Caisse autonome.
-- Les anciens profils de base « caisse » conservent leur compatibilité historique.
-- Les comptes Client ne peuvent sélectionner Caisse qu'avec une affectation active
-- rattachée à une pharmacie active et dans le périmètre demandé.
CREATE OR REPLACE FUNCTION public.naxa_select_active_role(p_role_code text, p_pharmacie_id uuid, p_partner_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_role public.naxa_roles%rowtype;
  v_allowed boolean:=false;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_profile from public.profiles
  where id=v_uid and actif=true for update;
  if not found then raise exception 'Profil actif introuvable'; end if;

  if p_role_code is null then
    if p_pharmacie_id is not null or p_partner_id is not null then
      raise exception 'Un rôle nul ne peut porter aucun périmètre';
    end if;
    delete from public.naxa_profile_active_roles where profile_id=v_uid;
    update public.profiles
    set fonction_interne=null,
        pharmacie_id=case when v_profile.role::text in ('pharmacie','caisse')
          then v_profile.pharmacie_id else null end
    where id=v_uid;
    return true;
  end if;

  if p_pharmacie_id is not null and p_partner_id is not null then
    raise exception 'Un poste ne peut pas être partagé entre Pharmacie et Parapharmacie';
  end if;

  select * into v_role from public.naxa_roles
  where code=p_role_code and actif=true;
  if not found then raise exception 'Rôle inconnu ou inactif'; end if;

  if p_partner_id is not null then
    if not exists (
      select 1 from public.partners pa
      join public.naxa_partner_architectures aa on aa.partner_id=pa.id and aa.active=true
      join public.naxa_professional_account_domains d
        on d.profile_id=v_uid and d.domain_code='PARAPHARMACIE'
      where pa.id=p_partner_id and pa.partner_type='parapharmacie' and pa.status='active'
    ) then raise exception 'Établissement Parapharmacie hors périmètre ou inactif'; end if;

    if p_role_code='promoteur' then
      v_allowed:=exists (
        select 1 from public.partner_members pm
        where pm.partner_id=p_partner_id and pm.user_id=v_uid and pm.member_role='owner'
      );
    else
      v_allowed:=exists (
        select 1 from public.naxa_partner_professional_assignments a
        where a.profile_id=v_uid and a.partner_id=p_partner_id
          and a.role_code=p_role_code and a.statut='active'
          and a.commence_at<=now()
          and (a.expire_at is null or a.expire_at>now())
      );
    end if;
  elsif p_role_code in ('admin','client','promoteur') then
    v_allowed:=v_profile.role::text=p_role_code;
    if p_role_code='promoteur' then
      v_allowed:=v_allowed and private.naxa_promoteur_valide(v_uid);
    end if;
    if p_pharmacie_id is not null then v_allowed:=false; end if;
  elsif p_role_code='pharmacie' then
    v_allowed:=p_pharmacie_id is not null
      and v_profile.role::text='pharmacie'
      and p_pharmacie_id=v_profile.pharmacie_id
      and exists(select 1 from public.pharmacies ph
        where ph.id=p_pharmacie_id and ph.actif=true);
  elsif p_role_code='caisse' then
    v_allowed:=p_pharmacie_id is not null
      and exists(select 1 from public.pharmacies ph
        where ph.id=p_pharmacie_id and ph.actif=true)
      and (
        (v_profile.role::text='caisse' and p_pharmacie_id=v_profile.pharmacie_id)
        or exists(
          select 1 from public.naxa_professional_assignments a
          where a.profile_id=v_uid and a.role_code='caisse'
            and a.pharmacie_id=p_pharmacie_id and a.statut='active'
            and a.commence_at<=now()
            and (a.expire_at is null or a.expire_at>now())
        )
      );
  else
    v_allowed:=p_pharmacie_id is not null and exists (
      select 1 from public.naxa_professional_assignments a
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
      where a.profile_id=v_uid and a.role_code=p_role_code
        and a.pharmacie_id=p_pharmacie_id and a.statut='active'
        and a.commence_at<=now()
        and (
          a.expire_at is null or a.expire_at>now()
          or (
            p_role_code='livreur'
            and exists(select 1 from public.naxa_delivery_missions m
              where m.livreur_id=v_uid and m.pharmacie_id=p_pharmacie_id
                and m.statut in ('accepted','picked_up','arrived'))
          )
        )
    );
  end if;

  if not v_allowed then raise exception 'Ce rôle n’est pas attribué à ce compte pour ce périmètre'; end if;

  insert into public.naxa_profile_active_roles(
    profile_id,role_code,pharmacie_id,partner_id,selected_at,updated_at
  ) values(v_uid,p_role_code,p_pharmacie_id,p_partner_id,now(),now())
  on conflict(profile_id) do update set
    role_code=excluded.role_code,
    pharmacie_id=excluded.pharmacie_id,
    partner_id=excluded.partner_id,
    selected_at=now(),
    updated_at=now();

  update public.profiles
  set fonction_interne=case
        when p_role_code in ('admin','client','pharmacie','promoteur') then null
        else p_role_code
      end,
      pharmacie_id=case
        when p_partner_id is not null then v_profile.pharmacie_id
        when p_role_code in ('admin','client','promoteur') then null
        when p_role_code in ('pharmacie','caisse') then v_profile.pharmacie_id
        else p_pharmacie_id
      end
  where id=v_uid;
  return true;
end;
$function$

