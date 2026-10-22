-- Renouvellement administratif à échéance manuelle et audit. Aucun paiement n'est présumé vérifié.
create table if not exists public.admin_pharmacie_audit (
 id uuid primary key default gen_random_uuid(),
 pharmacie_id uuid references public.pharmacies(id) on delete set null,
 promoteur_id uuid references public.profiles(id) on delete set null,
 acteur_id uuid not null references public.profiles(id),
 action text not null, motif text not null,
 avant jsonb not null default '{}'::jsonb, apres jsonb not null default '{}'::jsonb,
 cree_le timestamptz not null default now()
);
alter table public.admin_pharmacie_audit enable row level security;
revoke all on public.admin_pharmacie_audit from anon, authenticated;
grant select,insert on public.admin_pharmacie_audit to service_role;

create or replace function public.admin_renouveler_promoteur(p_promoteur uuid,p_nouvelle_echeance date,p_motif text,p_admin uuid)
returns date language plpgsql security definer set search_path='' as $$
declare c public.conventions_promoteurs%rowtype; a public.abonnements_promoteurs%rowtype;
 nc int; na int; nl int; ph uuid; v_architecture text; avant jsonb; apres jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='admin' and actif=true) then raise exception 'Accès réservé à un administrateur actif'; end if;
 if p_nouvelle_echeance is null or p_nouvelle_echeance<=current_date or length(trim(coalesce(p_motif,'')))<5 then raise exception 'Échéance future et motif (5 caractères minimum) obligatoires'; end if;
 if not exists(select 1 from public.profiles where id=p_promoteur and role='promoteur') then raise exception 'Promoteur introuvable'; end if;
 select count(*) into nc from public.conventions_promoteurs where promoteur_id=p_promoteur;
 select count(*) into na from public.abonnements_promoteurs where promoteur_id=p_promoteur;
 select count(*) into nl from public.promoteur_pharmacies where promoteur_id=p_promoteur;
 if nc<>1 or na<>1 then raise exception 'Une convention et un abonnement uniques sont requis'; end if;
 if nl<>1 then raise exception 'Un lien promoteur-pharmacie unique est requis'; end if;
 select architecture_code into v_architecture from public.profiles where id=p_promoteur;
 select * into c from public.conventions_promoteurs where promoteur_id=p_promoteur for update;
 select * into a from public.abonnements_promoteurs where promoteur_id=p_promoteur for update;
 if c.architecture_code is null or c.architecture_code is distinct from v_architecture or a.convention_id is distinct from c.id or a.montant_mensuel is distinct from c.montant_mensuel then raise exception 'Convention, abonnement et architecture incohérents'; end if;
 select pharmacie_id into ph from public.promoteur_pharmacies where promoteur_id=p_promoteur for update;
 avant:=jsonb_build_object('convention_statut',c.statut,'convention_echeance',c.date_expiration,'abonnement_statut',a.statut,'abonnement_echeance',a.echeance,'profil_actif',(select actif from public.profiles where id=p_promoteur),'pharmacie_id',ph);
 update public.conventions_promoteurs set date_expiration=p_nouvelle_echeance,statut='active' where id=c.id;
 update public.abonnements_promoteurs set echeance=p_nouvelle_echeance,statut='actif',bloque_le=null,reactive_le=now(),reactive_par=p_admin where id=a.id;
 -- Ne touche ni date_paiement ni au registre de paiements : renouvellement administratif ≠ preuve de règlement.
 update public.profiles set actif=true where id=p_promoteur;
 update public.promoteur_pharmacies set actif=true where promoteur_id=p_promoteur;
 update public.pharmacies p set actif=true where exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_promoteur and pp.pharmacie_id=p.id);
 apres:=jsonb_build_object('convention_statut','active','convention_echeance',p_nouvelle_echeance,'abonnement_statut','actif','abonnement_echeance',p_nouvelle_echeance,'profil_actif',true,'pharmacie_id',ph);
 insert into public.admin_pharmacie_audit(pharmacie_id,promoteur_id,acteur_id,action,motif,avant,apres) values(ph,p_promoteur,p_admin,'renouvellement_manuel',trim(p_motif),avant,apres);
 return p_nouvelle_echeance;
end $$;
revoke all on function public.admin_renouveler_promoteur(uuid,date,text,uuid) from public,anon,authenticated;
grant execute on function public.admin_renouveler_promoteur(uuid,date,text,uuid) to service_role;
