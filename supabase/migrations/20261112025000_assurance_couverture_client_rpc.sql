-- Permettre au client de déclarer sa couverture sans accès direct en écriture.
create or replace function public.assurance_enregistrer_couverture(
  p_assureur uuid,p_numero_adherent text,p_numero_police text,
  p_date_debut date,p_date_fin date,p_plafond numeric,p_taux numeric
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null or not exists(
    select 1 from public.profiles p where p.id=v_uid and p.role='client' and p.actif=true
  ) then raise exception 'Compte client actif requis'; end if;
  if not exists(select 1 from public.assureurs a where a.id=p_assureur and a.actif=true) then
    raise exception 'Assureur inconnu ou inactif';
  end if;
  if length(trim(coalesce(p_numero_adherent,''))) not between 2 and 100
    or length(trim(coalesce(p_numero_police,'')))>100
    or p_date_debut is null or (p_date_fin is not null and p_date_fin<p_date_debut)
    or (p_plafond is not null and p_plafond<0)
    or p_taux is null or p_taux not between 0 and 100 then
    raise exception 'Informations de couverture invalides';
  end if;
  select id into v_id from public.couvertures_assurance
  where client_id=v_uid and assureur_id=p_assureur
    and lower(trim(numero_adherent))=lower(trim(p_numero_adherent))
  order by created_at desc limit 1;
  if v_id is not null then
    update public.couvertures_assurance set
      numero_police=nullif(trim(coalesce(p_numero_police,'')),''),
      date_debut=p_date_debut,date_fin=p_date_fin,plafond=p_plafond,
      taux_prise_en_charge=p_taux,actif=true
    where id=v_id;
    return v_id;
  end if;
  insert into public.couvertures_assurance(
    client_id,assureur_id,numero_adherent,numero_police,date_debut,date_fin,plafond,taux_prise_en_charge,actif
  ) values(v_uid,p_assureur,trim(p_numero_adherent),
    nullif(trim(coalesce(p_numero_police,'')),''),p_date_debut,p_date_fin,p_plafond,p_taux,true)
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric) from public,anon;
grant execute on function public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric) to authenticated;
