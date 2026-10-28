-- NAXA 250 — inclure les remboursements de crédit dans le solde théorique de clôture.
-- Verrouillage de la session dans la fonction existante sérialise clôture et remboursement.
-- Migration versionnée uniquement : aucune application sur une base distante.
begin;

create or replace function public.caisse_cloturer(p_session uuid,p_total_compte integer,p_ecart_justification text)
returns table(total_theorique integer,total_compte integer,ecart integer)
language plpgsql security definer set search_path=''
as $cloturer$
declare
 v_session public.caisses_sessions%rowtype;
 v_pharmacie uuid;
 v_theorique integer;
 v_cash integer;
 v_decaissements integer;
 v_credit_remboursements integer;
 v_ecart integer;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if p_total_compte is null or p_total_compte<0 then raise exception 'Comptage invalide'; end if;
 if p_ecart_justification is not null and length(trim(p_ecart_justification)) not between 5 and 500 then raise exception 'La justification doit contenir entre 5 et 500 caractères'; end if;
 select cs.* into v_session from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id
 where cs.id=p_session and (public.is_admin() or public.can_operate_pharmacy(c.pharmacie_id)) for update of cs;
 if not found then raise exception 'Session caisse introuvable ou hors périmètre'; end if;
 select c.pharmacie_id into v_pharmacie from public.caisses c where c.id=v_session.caisse_id;
 if not public.is_admin() then
  if v_session.ouvert_par is distinct from auth.uid() or not exists(
   select 1 from public.profiles p where p.id=auth.uid() and p.actif=true and p.pharmacie_id=v_pharmacie
    and (coalesce(p.role::text,'')='caisse' or coalesce(p.fonction_interne,'')='caisse')
  ) then raise exception 'Clôture réservée au titulaire actif de la session Caisse'; end if;
 end if;
 if v_session.statut<>'ouverte' then raise exception 'Session déjà clôturée'; end if;
 if exists(select 1 from public.ventes v where v.caisse_session_id=p_session and v.statut='brouillon') then raise exception 'Impossible de clôturer : vente brouillon encore ouverte'; end if;
 select coalesce(sum(case when vp.nb>0 then vp.montant when vp.nb=0 and v.mode_paiement='especes' then v.total_net else 0 end),0)
 into v_cash from public.ventes v left join lateral(
  select coalesce(sum(vp2.montant) filter(where vp2.mode='especes'),0) montant,count(*) nb
  from public.vente_paiements vp2 where vp2.vente_id=v.id
 ) vp on true where v.caisse_session_id=p_session and v.statut='payee';
 select coalesce(sum(d.montant),0)::integer into v_decaissements
 from public.caisse_decaissements d where d.caisse_session_id=p_session;
 select coalesce(sum(o.montant),0)::integer into v_credit_remboursements
 from public.client_credit_operations o
 where o.caisse_session_id=p_session and o.nature='remboursement';
 v_theorique:=v_session.fond_initial+coalesce(v_cash,0)
   +coalesce(v_credit_remboursements,0)-coalesce(v_decaissements,0);
 if v_theorique<0 then raise exception 'Solde théorique négatif : vérifier les décaissements enregistrés'; end if;
 v_ecart:=p_total_compte-v_theorique;
 if v_ecart<>0 and (p_ecart_justification is null or length(trim(p_ecart_justification))<5) then
  raise exception 'Écart de % FCFA : une justification de 5 à 500 caractères est obligatoire avant la clôture',v_ecart;
 end if;
 update public.caisses_sessions set statut='cloturee',cloture_at=now(),cloture_par=auth.uid(),
  total_theorique=v_theorique,total_compte=p_total_compte,ecart=v_ecart,
  ecart_justification=nullif(trim(p_ecart_justification), ''),
  ecart_statut=case when v_ecart=0 then 'conforme' else 'a_verifier' end
 where id=p_session;
 return query select v_theorique,p_total_compte,v_ecart;
end;
$cloturer$;
revoke all on function public.caisse_cloturer(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.caisse_cloturer(uuid,integer,text) to authenticated;

commit;
