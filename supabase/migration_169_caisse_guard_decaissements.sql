-- NAXA 169 — aligner la garde de clôture avec les décaissements historisés.
begin;
create or replace function public.naxa_guard_caisse_session_write()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
 v_pharmacie uuid;
 v_cash integer;
 v_decaissements integer;
 v_theorique integer;
begin
 if auth.uid() is null or public.is_admin() then return new; end if;
 select c.pharmacie_id into v_pharmacie from public.caisses c where c.id=new.caisse_id;
 if not public.naxa_caisse_actor_for_pharmacy(v_pharmacie) then raise exception 'Session réservée à une Caisse active de cette pharmacie'; end if;
 if tg_op='INSERT' then
  if new.ouvert_par is distinct from auth.uid() or not exists(select 1 from public.caisses c where c.id=new.caisse_id and c.actif=true) then raise exception 'Ouverture réservée à la Caisse active qui la demande'; end if;
 elsif tg_op='UPDATE' then
  if new.caisse_id is distinct from old.caisse_id or new.ouvert_par is distinct from old.ouvert_par or new.fond_initial is distinct from old.fond_initial or new.ouvert_at is distinct from old.ouvert_at then raise exception 'Les paramètres d’ouverture de session sont immuables'; end if;
  if old.statut<>'ouverte' or new.statut<>'cloturee' then raise exception 'Une session ouverte ne peut être modifiée que par une clôture contrôlée'; end if;
  if old.ouvert_par is distinct from auth.uid() or new.cloture_par is distinct from auth.uid() or new.cloture_at is null or new.total_compte is null then raise exception 'Seul l’ouvreur de la session peut enregistrer la clôture'; end if;
  select coalesce(sum(case when pay.nb>0 then pay.cash when pay.nb=0 and v.mode_paiement='especes' then v.total_net else 0 end),0)::integer
   into v_cash
  from public.ventes v left join lateral (
   select coalesce(sum(vp.montant) filter(where vp.mode='especes'),0)::integer as cash,count(*) as nb
   from public.vente_paiements vp where vp.vente_id=v.id
  ) pay on true where v.caisse_session_id=old.id and v.statut='payee';
  select coalesce(sum(d.montant),0)::integer into v_decaissements from public.caisse_decaissements d where d.caisse_session_id=old.id;
  v_theorique:=old.fond_initial+coalesce(v_cash,0)-coalesce(v_decaissements,0);
  if new.total_theorique is distinct from v_theorique or new.ecart is distinct from (new.total_compte-v_theorique) then raise exception 'Le rapprochement de clôture ne correspond pas aux paiements et décaissements enregistrés'; end if;
 end if;
 return new;
end;
$function$;
commit;
