-- NAXA 162 — cohérence du périmètre pharmacie/session des ventes POS.
-- Additif : empêche de rattacher une vente à une session d'une autre pharmacie.
-- La session est verrouillée pendant le contrôle pour éviter une course avec la clôture.
begin;

create or replace function public.naxa_caisse_guard_vente_session_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $guard$
declare
  v_session_pharmacie uuid;
  v_session_statut public.caisse_cloture_statut;
begin
  if new.pharmacie_id is null or new.caisse_session_id is null then
    raise exception 'Vente caisse invalide : pharmacie et session requises';
  end if;

  select c.pharmacie_id, cs.statut
    into v_session_pharmacie, v_session_statut
  from public.caisses_sessions cs
  join public.caisses c on c.id = cs.caisse_id
  where cs.id = new.caisse_session_id
  for update of cs;

  if not found then
    raise exception 'Session de caisse introuvable';
  end if;

  if v_session_pharmacie is distinct from new.pharmacie_id then
    raise log 'NAXA_CAISSE_SCOPE_REJECTED sale=% declared_pharmacy=% session_pharmacy=% actor=%',
      new.id, new.pharmacie_id, v_session_pharmacie, auth.uid();
    raise exception 'Vente refusée : la session appartient à une autre pharmacie';
  end if;

  if tg_op = 'INSERT' and v_session_statut <> 'ouverte' then
    raise exception 'Création de vente refusée : la session de caisse n’est pas ouverte';
  end if;

  return new;
end;
$guard$;

revoke all on function public.naxa_caisse_guard_vente_session_scope() from public, anon, authenticated;

drop trigger if exists trg_naxa_caisse_vente_session_scope on public.ventes;
create trigger trg_naxa_caisse_vente_session_scope
before insert or update of pharmacie_id, caisse_session_id
on public.ventes
for each row
execute function public.naxa_caisse_guard_vente_session_scope();

comment on function public.naxa_caisse_guard_vente_session_scope() is
  'Vérifie que la vente et sa session appartiennent à la même pharmacie ; bloque les créations sur une session clôturée et verrouille la session pendant la vérification.';

commit;
