-- NAXA 165 — correction de sélection de session pour la RPC de décaissement.
begin;
create or replace function public.caisse_decaisser(
  p_session uuid,
  p_montant integer,
  p_categorie text,
  p_motif text,
  p_justificatif_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $decaisser$
declare
  v_session public.caisses_sessions%rowtype;
  v_pharmacie uuid;
  v_id uuid;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_session is null then raise exception 'Session de caisse requise'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Le montant du décaissement doit être supérieur à zéro'; end if;
  if p_categorie not in ('depense', 'remise_coffre', 'appoint', 'autre') then raise exception 'Catégorie de décaissement invalide'; end if;
  if p_motif is null or length(trim(p_motif)) < 5 or length(trim(p_motif)) > 500 then
    raise exception 'Le motif doit contenir entre 5 et 500 caractères';
  end if;
  if p_justificatif_ref is not null and length(trim(p_justificatif_ref)) > 200 then
    raise exception 'Référence de justificatif trop longue';
  end if;

  select cs.*
    into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id = cs.caisse_id
  where cs.id = p_session
    and cs.statut = 'ouverte'
    and cs.ouvert_par = auth.uid()
    and c.actif = true
  for update of cs;
  if not found then raise exception 'Session ouverte introuvable, inactive ou non détenue par ce compte'; end if;

  select c.pharmacie_id into v_pharmacie
  from public.caisses c
  where c.id = v_session.caisse_id and c.actif = true;
  if v_pharmacie is null then raise exception 'Pharmacie de caisse introuvable ou inactive'; end if;

  select * into v_profile
  from public.profiles p
  where p.id = auth.uid()
    and p.actif = true
    and p.pharmacie_id = v_pharmacie
    and (coalesce(p.role::text, '') = 'caisse' or coalesce(p.fonction_interne, '') = 'caisse');
  if not found and not public.is_admin() then
    raise exception 'Décaissement réservé à un compte Caisse actif de cette pharmacie';
  end if;

  insert into public.caisse_decaissements(
    pharmacie_id, caisse_session_id, montant, categorie, motif, justificatif_ref, created_by
  ) values (
    v_pharmacie, p_session, p_montant, p_categorie, trim(p_motif), nullif(trim(p_justificatif_ref), ''), auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$decaisser$;
revoke all on function public.caisse_decaisser(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.caisse_decaisser(uuid, integer, text, text, text) to authenticated;
commit;
