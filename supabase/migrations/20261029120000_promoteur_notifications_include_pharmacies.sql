-- NAXA — noms Promoteur/pharmacies dans les alertes de validité et de règlement.
-- Le job Supabase pg_cron existant reste le seul rappel quotidien planifié.
begin;

create or replace function public.promoteur_soumettre_reglement(
  p_promoteur uuid,p_montant integer,p_canal text,p_canal_autre text,p_compte_payeur text,
  p_reference text,p_paye_le timestamptz,p_preuve_path text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
 v_abonnement public.abonnements_promoteurs%rowtype;
 v_convention public.conventions_promoteurs%rowtype;
 v_id uuid;
 v_admin record;
 v_canal_label text;
 v_promoteur_label text;
 v_pharmacies_label text;
begin
 if p_promoteur is null or not exists(select 1 from public.profiles where id=p_promoteur and role::text='promoteur') then raise exception 'Promoteur introuvable'; end if;
 if p_montant is null or p_montant<=0 then raise exception 'Montant invalide'; end if;
 if p_canal not in ('orange_money','mtn_momo','virement','depot_bancaire','especes','autre') then raise exception 'Canal de paiement invalide'; end if;
 if p_canal='autre' and length(trim(coalesce(p_canal_autre,''))) not between 2 and 80 then raise exception 'Précisez le canal de paiement'; end if;
 if length(trim(coalesce(p_compte_payeur,'')))<3 or length(trim(p_compte_payeur))>120 then raise exception 'Le numéro de compte ou de téléphone ayant effectué le paiement est requis'; end if;
 if p_paye_le is null or p_paye_le>now()+interval '5 minutes' then raise exception 'La date réelle du paiement est requise et ne peut pas être future'; end if;
 if p_preuve_path is null or p_preuve_path !~ ('^'||p_promoteur::text||'/[0-9a-fA-F-]+\.(pdf|jpg|jpeg|png|webp|mp4|webm|mov)$') then raise exception 'Chemin de preuve invalide'; end if;
 select * into v_abonnement from public.abonnements_promoteurs where promoteur_id=p_promoteur for update;
 if not found then raise exception 'Abonnement Promoteur introuvable'; end if;
 select * into v_convention from public.conventions_promoteurs where id=v_abonnement.convention_id and promoteur_id=p_promoteur for update;
 if not found then raise exception 'Convention Promoteur introuvable'; end if;
 if p_montant<>v_abonnement.montant_mensuel or p_montant<>v_convention.montant_mensuel then raise exception 'Le montant ne correspond pas au tarif mensuel convenu'; end if;
 if exists(select 1 from public.abonnement_promoteur_reglements where promoteur_id=p_promoteur and statut='en_attente') then raise exception 'Un règlement est déjà en attente pour ce Promoteur'; end if;
 select coalesce(nullif(trim(concat_ws(' ',first_name,last_name)),''),nullif(username,''),p_promoteur::text)
 into v_promoteur_label from public.profiles where id=p_promoteur;
 select coalesce(string_agg(ph.nom, ', ' order by ph.nom), 'Aucune pharmacie rattachée')
 into v_pharmacies_label
 from public.promoteur_pharmacies pp
 join public.pharmacies ph on ph.id=pp.pharmacie_id
 where pp.promoteur_id=p_promoteur;
 insert into public.abonnement_promoteur_reglements(promoteur_id,abonnement_id,montant,canal,canal_autre,compte_payeur,reference,paye_le,preuve_path,enregistre_par)
 values(p_promoteur,v_abonnement.id,p_montant,p_canal,nullif(trim(coalesce(p_canal_autre,'')),''),trim(p_compte_payeur),nullif(trim(coalesce(p_reference,'')),''),p_paye_le,p_preuve_path,p_promoteur)
 returning id into v_id;
 v_canal_label:=case p_canal when 'orange_money' then 'Orange Money' when 'mtn_momo' then 'MTN Mobile Money' when 'virement' then 'Virement bancaire' when 'depot_bancaire' then 'Dépôt bancaire' when 'especes' then 'Espèces' else coalesce(nullif(trim(p_canal_autre),''),'Autre') end;
 for v_admin in select id from public.profiles where role::text='admin' and actif=true loop
  insert into public.notifications(user_id,type,titre,corps)
  values(v_admin.id,'abonnement_reglement_a_verifier','Paiement Promoteur à vérifier',
   left(v_promoteur_label||' — Pharmacie(s) : '||v_pharmacies_label||
   '. A déclaré un paiement de '||p_montant::text||' FCFA via '||v_canal_label||
   '. Compte payeur : '||trim(p_compte_payeur)||'. Référence : '||coalesce(nullif(trim(p_reference),''),'non renseignée')||
   '. Date déclarée : '||to_char(p_paye_le at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI')||
   '. Ouvrez le suivi des règlements pour vérifier la preuve.',1000));
 end loop;
 insert into public.notifications(user_id,type,titre,corps)
 values(p_promoteur,'abonnement_reglement_soumis','Paiement transmis à NAXA',
  'Votre déclaration de paiement a été transmise à l’administrateur pour vérification. Votre abonnement ne sera renouvelé qu’après confirmation.');
 return v_id;
end $$;

revoke all on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text) to service_role;

create or replace function public.generer_rappels_echeance_promoteurs()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r record;
  v_admin record;
  v_due date := (now() at time zone 'Africa/Douala')::date + 5;
  v_count integer := 0;
begin
  for r in
    select a.id, a.promoteur_id, a.echeance, a.montant_mensuel,
           coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''),
                    nullif(p.username, ''), p.id::text) as nom_promoteur,
           coalesce((
             select string_agg(ph.nom, ', ' order by ph.nom)
             from public.promoteur_pharmacies pp
             join public.pharmacies ph on ph.id=pp.pharmacie_id
             where pp.promoteur_id=a.promoteur_id
           ), 'Aucune pharmacie rattachée') as pharmacies_noms
    from public.abonnements_promoteurs a
    join public.profiles p on p.id = a.promoteur_id and p.role::text = 'promoteur'
    where a.statut = 'actif'
      and a.echeance = v_due
      and a.rappel_5j_envoye_at is null
      and (a.rappel_5j_en_cours_at is null or a.rappel_5j_en_cours_at < now() - interval '15 minutes')
    for update of a skip locked
  loop
    insert into public.notifications(user_id, type, titre, corps)
    values (
      r.promoteur_id,
      'abonnement_echeance_5j',
      'Votre abonnement expire dans 5 jours',
      'Votre abonnement mensuel NAXA pour le Promoteur ' || r.nom_promoteur ||
      ' (pharmacie(s) : ' || r.pharmacies_noms || ') arrive à échéance le ' ||
      to_char(r.echeance, 'DD/MM/YYYY') || '. Tarif mensuel : ' ||
      r.montant_mensuel::text || ' FCFA. Effectuez le paiement par votre canal habituel, puis déclarez-le dans « Mes paiements » avec ses références et sa preuve.'
    );

    for v_admin in
      select id from public.profiles where role::text = 'admin' and actif = true
    loop
      insert into public.notifications(user_id, type, titre, corps)
      values (
        v_admin.id,
        'abonnement_echeance_5j_admin',
        'Échéance Promoteur dans 5 jours',
        left(
          'L’abonnement du Promoteur ' || r.nom_promoteur || ' — pharmacie(s) : ' || r.pharmacies_noms ||
          ' — arrive à échéance le ' || to_char(r.echeance, 'DD/MM/YYYY') || '. Tarif mensuel : ' ||
          r.montant_mensuel::text || ' FCFA. Suivez le règlement et sa validation dans le pilotage NAXA.',
          1000
        )
      );
    end loop;

    update public.abonnements_promoteurs
    set rappel_5j_envoye_at = now(), rappel_5j_en_cours_at = null
    where id = r.id and rappel_5j_envoye_at is null;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.generer_rappels_echeance_promoteurs() from public, anon, authenticated;
grant execute on function public.generer_rappels_echeance_promoteurs() to service_role;

commit;
