-- NAXA — correction additive de prescription_valider.
-- Conserve les rôles autorisés par la migration 063 ; ne remplace aucune migration historique.
create or replace function public.prescription_valider(
  p_prescription uuid,
  p_accepter boolean,
  p_motif text default null
)
returns public.prescription_statut
language plpgsql
security definer
set search_path = ''
as $validate$
declare
  v public.prescriptions%rowtype;
  u uuid := (select auth.uid());
  v_role text;
  v_fonction text;
begin
  if u is null then
    raise exception 'Connexion requise';
  end if;

  select * into v
    from public.prescriptions
   where id = p_prescription
   for update;
  if not found then
    raise exception 'Ordonnance introuvable';
  end if;

  select p.role::text, p.fonction_interne
    into v_role, v_fonction
    from public.profiles p
   where p.id = u
     and p.actif
     and p.pharmacie_id = v.pharmacie_id
     and (p.role::text = 'promoteur'
          or p.fonction_interne in ('pharmacien','pharmacien_assistant'));

  if not found then
    raise exception 'Validation ordonnance non autorisée';
  end if;

  if v.statut <> 'en_attente' then
    raise exception 'Ordonnance déjà traitée';
  end if;

  if p_accepter then
    update public.prescriptions
       set statut = 'validee',
           validateur_id = u,
           validee_at = now(),
           motif_rejet = null,
           updated_at = now()
     where id = p_prescription;
    return 'validee';
  end if;

  if nullif(trim(coalesce(p_motif,'')), '') is null then
    raise exception 'Motif de rejet obligatoire';
  end if;

  update public.prescriptions
     set statut = 'rejetee',
         validateur_id = u,
         validee_at = null,
         motif_rejet = trim(p_motif),
         updated_at = now()
   where id = p_prescription;
  return 'rejetee';
end;
$validate$;

revoke all on function public.prescription_valider(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.prescription_valider(uuid,boolean,text) to authenticated;

comment on function public.prescription_valider(uuid,boolean,text) is
  'Valide/rejette une ordonnance en respectant le périmètre pharmacie et les rôles historiques Promoteur, Pharmacien et Pharmacien assistant.';
