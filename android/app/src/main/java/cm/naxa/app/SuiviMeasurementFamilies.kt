package cm.naxa.app

/** One consent-family mapping shared by the Compose screen and the background sync worker. */
object SuiviMeasurementFamilies {
    fun device(deviceKey: String): String? = when (deviceKey) {
        "tensiometre", "thermometre", "oxymetre", "capteur_cardiaque_bluetooth" -> "constantes"
        "glucometre", "balance", "balance_impedance" -> "metabolisme"
        "podometre", "montre_connectee", "bracelet_activite" -> "activite"
        else -> null
    }

    fun measurement(type: String): String? = when (type) {
        "tension_systolique", "tension_diastolique", "frequence_cardiaque", "temperature",
        "saturation_oxygene", "frequence_respiratoire", "debit_expiratoire", "ecg_note",
        "capacite_vitale" -> "constantes"
        "glycemie", "poids", "taille", "imc", "cholesterol_total", "masse_grasse",
        "masse_musculaire", "masse_osseuse", "cetonemie", "acide_urique", "cholesterol_hdl",
        "cholesterol_ldl" -> "metabolisme"
        "pas_jour", "activite_minutes", "hydratation_ml", "vitesse_course",
        "vitesse_cyclisme", "cadence_course", "longueur_foulee" -> "activite"
        "sommeil_heures" -> "sommeil"
        "douleur_score", "humeur_score", "cycle_jour", "symptome_note" -> "bien_etre"
        "medicament_pris" -> "traitements"
        else -> null
    }
}
