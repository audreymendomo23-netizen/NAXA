-- NAXA — Types standards supplémentaires décodés par les adaptateurs BLE.
begin;

alter table public.suivi_measurements drop constraint if exists suivi_measurements_measurement_type_check;
alter table public.suivi_measurements add constraint suivi_measurements_measurement_type_check check (measurement_type in (
  'tension_systolique','tension_diastolique','tension_arterielle_moyenne','frequence_cardiaque','temperature','saturation_oxygene',
  'glycemie','poids','taille','imc','frequence_respiratoire','cholesterol_total','sommeil_heures',
  'pas_jour','activite_minutes','hydratation_ml','douleur_score','humeur_score','cycle_jour',
  'medicament_pris','symptome_note','debit_expiratoire','ecg_note','masse_grasse','masse_musculaire',
  'masse_osseuse','cetonemie','acide_urique','cholesterol_hdl','cholesterol_ldl','capacite_vitale',
  'vitesse_course','cadence_course','longueur_foulee','pourcentage_musculaire','masse_maigre',
  'masse_maigre_molle','masse_eau_corporelle','metabolisme_basal'
));

alter table public.suivi_reminders drop constraint if exists suivi_reminders_measurement_type_check;
alter table public.suivi_reminders add constraint suivi_reminders_measurement_type_check check (measurement_type in (
  'tension_systolique','tension_diastolique','tension_arterielle_moyenne','frequence_cardiaque','temperature','saturation_oxygene',
  'glycemie','poids','taille','imc','frequence_respiratoire','cholesterol_total','sommeil_heures',
  'pas_jour','activite_minutes','hydratation_ml','douleur_score','humeur_score','cycle_jour',
  'medicament_pris','symptome_note','debit_expiratoire','ecg_note','masse_grasse','masse_musculaire',
  'masse_osseuse','cetonemie','acide_urique','cholesterol_hdl','cholesterol_ldl','capacite_vitale',
  'vitesse_course','cadence_course','longueur_foulee','pourcentage_musculaire','masse_maigre',
  'masse_maigre_molle','masse_eau_corporelle','metabolisme_basal'
));

alter table public.suivi_alert_rules drop constraint if exists suivi_alert_rules_measurement_type_check;
alter table public.suivi_alert_rules add constraint suivi_alert_rules_measurement_type_check check (measurement_type in (
  'tension_systolique','tension_diastolique','tension_arterielle_moyenne','frequence_cardiaque','temperature','saturation_oxygene',
  'glycemie','poids','taille','imc','frequence_respiratoire','cholesterol_total','sommeil_heures',
  'pas_jour','activite_minutes','hydratation_ml','douleur_score','humeur_score','cycle_jour',
  'debit_expiratoire','masse_grasse','masse_musculaire','masse_osseuse','cetonemie','acide_urique',
  'cholesterol_hdl','cholesterol_ldl','capacite_vitale','vitesse_course','cadence_course','longueur_foulee',
  'pourcentage_musculaire','masse_maigre','masse_maigre_molle','masse_eau_corporelle','metabolisme_basal'
));

create or replace function public.suivi_measurement_family(p_type text)
returns text language sql immutable set search_path=public,pg_temp as $$
  select case
    when p_type in ('tension_systolique','tension_diastolique','tension_arterielle_moyenne','frequence_cardiaque','temperature','saturation_oxygene','frequence_respiratoire','debit_expiratoire','ecg_note','capacite_vitale') then 'constantes'
    when p_type in ('glycemie','poids','taille','imc','cholesterol_total','masse_grasse','masse_musculaire','masse_osseuse','cetonemie','acide_urique','cholesterol_hdl','cholesterol_ldl','pourcentage_musculaire','masse_maigre','masse_maigre_molle','masse_eau_corporelle','metabolisme_basal') then 'metabolisme'
    when p_type in ('pas_jour','activite_minutes','hydratation_ml','vitesse_course','cadence_course','longueur_foulee') then 'activite'
    when p_type='sommeil_heures' then 'sommeil'
    when p_type in ('douleur_score','humeur_score','cycle_jour','symptome_note') then 'bien_etre'
    when p_type='medicament_pris' then 'traitements'
    else null end;
$$;
revoke all on function public.suivi_measurement_family(text) from public,anon;
grant execute on function public.suivi_measurement_family(text) to authenticated;

commit;
