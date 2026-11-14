package cm.naxa.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val WorkspaceGreen = Color(0xFF087A55)
private val WorkspaceInk = Color(0xFF17342B)
private val WorkspaceBackground = Color(0xFFF3F7F4)

internal data class NativeWorkspaceModule(val title: String, val description: String)
internal data class NativeWorkspacePage(val title: String, val modules: List<NativeWorkspaceModule>)
internal data class NativeWorkspaceDefinition(
    val eyebrow: String,
    val title: String,
    val subtitle: String,
    val pages: List<NativeWorkspacePage>,
    val scopeNotice: String? = null
)

/**
 * Role-specific native page map. Presentation only: operational records are
 * never fabricated and must be loaded through scoped NAXA APIs.
 */
internal object NaxaNativeWorkspaceCatalog {
    fun pharmacy(role: String): NativeWorkspaceDefinition = when (role.lowercase()) {
        "promoteur" -> NativeWorkspaceDefinition(
            "NAXA / RÉSEAU PROFESSIONNEL", "Espace Promoteur",
            "Pilotage des pharmacies rattachées à votre réseau.",
            listOf(
                page("Vue réseau", "Tableau de bord du réseau", "Pharmacies et états d’activité", "Alertes et échéances"),
                page("Pharmacies", "Établissements rattachés", "Fiches et coordonnées professionnelles", "Visibilité et état de chaque pharmacie"),
                page("Équipe", "Responsables et collaborateurs", "Affectations et périmètres", "Délégations et fonctions autorisées"),
                page("Abonnement", "Abonnement NAXA", "Échéances et état de règlement", "Preuves et reçus de paiement"),
                page("Rapports", "Activité du réseau", "Indicateurs par pharmacie", "Exports et historiques")
            )
        )
        "pharmacie" -> NativeWorkspaceDefinition(
            "NAXA / ÉTABLISSEMENT", "Espace Pharmacie",
            "Gestion de l’établissement, du comptoir et des opérations.",
            listOf(
                page("Accueil", "Activité de la pharmacie", "Commandes et réservations", "Alertes opérationnelles"),
                page("Commandes", "Réservations Marketplace", "Paiements et confirmations", "Préparation et remise au client"),
                page("Stock", "Catalogue local", "Mouvements et inventaires", "Lots, dates et seuils d’alerte"),
                page("Équipe", "Personnel de la pharmacie", "Fonctions et affectations", "Livreurs et permissions"),
                page("Gestion", "Informations de l’établissement", "Horaires et disponibilité", "Livraison et paramètres")
            )
        )
        "responsable" -> NativeWorkspaceDefinition(
            "NAXA / PILOTAGE", "Espace Responsable",
            "Suivi des opérations et validations dans les limites déléguées.",
            listOf(
                page("Pilotage", "Vue opérationnelle", "Activité de l’établissement", "Alertes et tâches à traiter"),
                page("Validations", "Demandes en attente", "Décisions dans les plafonds autorisés", "Historique des validations"),
                page("Équipe", "Collaborateurs affectés", "Présence et fonctions", "Demandes d’assistance"),
                page("Opérations", "Commandes et préparations", "Stock et caisse", "Livraisons et incidents"),
                page("Rapports", "Indicateurs autorisés", "Suivi des délais", "Historique des opérations")
            )
        )
        "caisse" -> NativeWorkspaceDefinition(
            "NAXA / POINT DE VENTE", "Espace Caisse",
            "Encaissement, reçus et clôture des sessions de caisse.",
            listOf(
                page("Comptoir", "Session de caisse", "Ventes comptoir", "Panier et ticket"),
                page("Paiements", "File des paiements", "Réservations à régulariser", "État des confirmations financières"),
                page("Tickets", "Reçus et justificatifs", "Recherche par référence", "Réimpression selon les droits"),
                page("Clôture", "Journal de session", "Comptage et écarts", "Validation de clôture"),
                page("Historique", "Sessions précédentes", "Ventes et annulations", "Traçabilité des opérations")
            )
        )
        "comptable" -> NativeWorkspaceDefinition(
            "NAXA / COMPTABILITÉ", "Espace Comptable",
            "Lecture et rapprochement des données financières autorisées.",
            listOf(
                page("Synthèse", "Vue financière", "Recettes et opérations", "Indicateurs de période"),
                page("Recettes", "Ventes et paiements", "Reçus et justificatifs", "Détail par moyen de paiement"),
                page("Rapprochements", "Transactions à rapprocher", "Écarts et anomalies", "Historique des contrôles"),
                page("Dépenses", "Charges et pièces", "Suivi des justificatifs", "Classement comptable"),
                page("Rapports", "États de période", "Exports comptables", "Historique et traçabilité")
            )
        )
        "pharmacien" -> NativeWorkspaceDefinition(
            "NAXA / PHARMACIE", "Espace Pharmacien",
            "Contrôle pharmaceutique, dispensation et vigilance.",
            listOf(
                page("Accueil", "Activité pharmaceutique", "Alertes et tâches", "Demandes nécessitant une revue"),
                page("Ordonnances", "Ordonnances reçues", "Contrôles et statuts", "Historique des dossiers autorisés"),
                page("Dispensation", "Préparation des délivrances", "Contrôle des produits et quantités", "Traçabilité de la dispensation"),
                page("Catalogue", "Médicaments et références", "Substances et formes", "Informations de lots disponibles"),
                page("Vigilance", "Dates et alertes", "Lots à surveiller", "Signalements et historique")
            )
        )
        "gestionnaire_stock" -> NativeWorkspaceDefinition(
            "NAXA / STOCK", "Espace Gestionnaire de stock",
            "Pilotage des quantités, mouvements, lots et préparation.",
            listOf(
                page("Stock", "État du stock", "Recherche d’articles", "Seuils et ruptures"),
                page("Réceptions", "Entrées de marchandises", "Contrôle des quantités", "Traçabilité des lots"),
                page("Inventaires", "Comptages", "Écarts constatés", "Historique des inventaires"),
                page("Péremptions", "Lots à surveiller", "Dates courtes et expirées", "Alertes et retraits"),
                page("Préparation", "Commandes à préparer", "Contrôle des lignes", "Confirmation de préparation")
            )
        )
        "magasinier" -> NativeWorkspaceDefinition(
            "NAXA / MAGASIN", "Espace Magasinier",
            "Réception physique, rangement et préparation des articles.",
            listOf(
                page("Accueil", "Tâches magasin", "Réceptions attendues", "Préparations à effectuer"),
                page("Réception", "Bons et arrivages", "Quantités réellement reçues", "Lots et dates"),
                page("Rangement", "Emplacements", "Transferts internes", "Traçabilité des mouvements"),
                page("Inventaire", "Comptages guidés", "Écarts à signaler", "Historique des comptages"),
                page("Préparation", "Commandes à préparer", "Contrôle de conformité", "Transmission au Livreur")
            )
        )
        else -> NativeWorkspaceDefinition(
            "NAXA / ESPACE PROFESSIONNEL", "Espace professionnel",
            "Votre rôle actif ne correspond pas à un espace pharmacie reconnu.",
            listOf(page("Accès", "Périmètre du compte", "Vérification des affectations", "Contacter le responsable")),
            "Le rôle « $role » n’est pas reconnu par le catalogue Android. Aucun accès métier supplémentaire n’est accordé."
        )
    }

    fun medicalExams(role: String): NativeWorkspaceDefinition {
        val title = when (role.lowercase()) {
            "responsable", "responsable_centre", "gestionnaire_centre" -> "Espace Responsable du centre"
            "medecin", "médecin" -> "Espace Médecin"
            "technicien", "technicien_laboratoire", "technicien_examens" -> "Espace Technicien"
            "agent_accueil", "accueil" -> "Espace Accueil"
            "caissier", "caisse" -> "Espace Caisse du centre"
            "biologiste", "radiologue" -> "Espace Spécialiste"
            else -> "Espace Examens médicaux"
        }
        return NativeWorkspaceDefinition(
            "NAXA / EXAMENS MÉDICAUX", title,
            "Activité du centre et dossiers accessibles selon les habilitations attribuées.",
            listOf(
                page("Tableau", "Activité du centre", "Rendez-vous du jour", "Demandes et alertes"),
                page("Agenda", "Créneaux et rendez-vous", "Disponibilités des prestations", "Planning des salles et équipes"),
                page("Patients", "Dossiers autorisés", "Historique des demandes", "Informations administratives protégées"),
                page("Examens", "Catalogue des examens", "Demandes et étapes de réalisation", "Suivi des prélèvements lorsque prévu"),
                page("Résultats", "Résultats à traiter", "Validation et diffusion selon habilitation", "Historique des comptes rendus"),
                page("Équipe", "Collaborateurs du centre", "Affectations et invitations", "Fonctions et accès"),
                page("Rapports", "Activité et délais", "Statistiques du centre", "Exports autorisés")
            ),
            "Les dossiers patients et résultats médicaux doivent rester filtrés par le centre actif et les droits serveur du compte."
        )
    }

    fun partner(role: String, partnerType: String?): NativeWorkspaceDefinition {
        val type = partnerType.orEmpty().lowercase()
        if (type in setOf("parapharmacie", "bebe_maman", "bébé_maman", "bebe-et-maman")) {
            val baby = type.contains("bebe") || type.contains("bébé")
            return NativeWorkspaceDefinition(
                "NAXA / PARTENAIRE", if (baby) "Espace Bébé & Maman" else "Espace Parapharmacie",
                "Espace préparatoire, sans activation commerciale.",
                listOf(
                    page("Dossier", "Informations du partenaire", "État du dossier", "Documents et coordonnées"),
                    page("Paramètres", "Préférences d’affichage", "Informations factuelles", "Aucune promotion commerciale")
                ),
                if (baby) {
                    "L’univers Bébé & Maman reste sans publicité, sponsoring, classement promotionnel ni offre incitative."
                } else {
                    "La Parapharmacie est en attente d’activation métier. Aucun parcours de vente ou de promotion n’est ouvert."
                }
            )
        }

        val partnerName = when (type) {
            "centre_medical", "centre-medical", "medical_center" -> "Centre médical"
            "centre_examens", "examens_medicaux", "medical_exams" -> "Centre d’examens"
            "prestations", "prestations_domicile", "home_services" -> "Prestataire de services"
            "dispositifs_medicaux", "medical_devices" -> "Partenaire dispositifs médicaux"
            else -> "Partenaire NAXA"
        }
        return NativeWorkspaceDefinition(
            "NAXA / PARTENAIRE", "Espace $partnerName",
            "Gestion de votre structure et des services autorisés.",
            listOf(
                page("Tableau", "Activité du partenaire", "Demandes entrantes", "Alertes et suivi"),
                page("Services", "Prestations publiées", "Description et disponibilité", "Conditions et zones couvertes"),
                page("Demandes", "Demandes des clients", "États et historique", "Planification des interventions"),
                page("Équipe", "Collaborateurs et affectations", "Invitations et révocations", "Périmètres d’accès"),
                page("Rapports", "Activité et performance", "Demandes traitées", "Exports autorisés")
            ),
            "Le rôle actif doit être confirmé dans le périmètre de ce partenaire. Aucune donnée d’un autre partenaire n’est affichée."
        )
    }
}

private fun page(title: String, vararg moduleLabels: String): NativeWorkspacePage =
    NativeWorkspacePage(title, moduleLabels.map { label ->
        NativeWorkspaceModule(label, nativeModuleDescription(label))
    })

private fun nativeModuleDescription(label: String): String = when (label) {
    "Tableau de bord du réseau" -> "Synthèse des établissements rattachés, avec les indicateurs permis par le périmètre Promoteur."
    "Pharmacies et états d’activité" -> "Suivi des établissements du réseau sans ouvrir les données d’une pharmacie tierce."
    "Alertes et échéances" -> "Échéances d’abonnement et alertes opérationnelles à traiter."
    "Établissements rattachés" -> "Liste des pharmacies accessibles à partir des affectations et du réseau actif."
    "Fiches et coordonnées professionnelles" -> "Informations professionnelles visibles selon les droits du compte."
    "Visibilité et état de chaque pharmacie" -> "État de publication et de fonctionnement de chaque établissement."
    "Responsables et collaborateurs" -> "Collaborateurs et responsables rattachés au périmètre autorisé."
    "Affectations et périmètres" -> "Une affectation explicite par établissement ; un seul poste reste actif à la fois."
    "Délégations et fonctions autorisées" -> "Droits délégués et plafonds appliqués côté serveur."
    "Abonnement NAXA" -> "État de l’abonnement professionnel et échéance connue."
    "Échéances et état de règlement" -> "État déclaré ou vérifié du paiement, sans confondre les deux."
    "Preuves et reçus de paiement" -> "Consultation des preuves et reçus accessibles au compte actif."
    "Activité de la pharmacie" -> "Synthèse des opérations de l’établissement actif."
    "Commandes et réservations" -> "Réservations rattachées à la pharmacie active et leur progression."
    "Alertes opérationnelles" -> "Alertes de stock, de préparation et de traitement."
    "Réservations Marketplace" -> "Demandes reçues par cette pharmacie, dans leur ordre de traitement."
    "Paiements et confirmations" -> "Distinction entre déclaration du payeur, preuve reçue et confirmation vérifiée."
    "Préparation et remise au client" -> "États de préparation, prêt au retrait, retrait et livraison."
    "Catalogue local" -> "Références et produits gérés par l’établissement."
    "Mouvements et inventaires" -> "Entrées, sorties, corrections et résultats d’inventaire autorisés."
    "Lots, dates et seuils d’alerte" -> "Suivi FEFO, dates courtes et alertes sans modifier les quantités."
    "Personnel de la pharmacie" -> "Membres et affectations du personnel de l’établissement."
    "Livreurs et permissions" -> "Affectations Livreur séparées et droits accordés par le serveur."
    "Horaires et disponibilité" -> "Paramètres de disponibilité publiés par l’établissement."
    "Livraison et paramètres" -> "Paramètres de livraison et informations de l’établissement."
    "Vue opérationnelle" -> "Synthèse des opérations de la pharmacie active."
    "Demandes en attente" -> "File de demandes nécessitant une décision autorisée."
    "Décisions dans les plafonds autorisés" -> "Le Responsable ne peut décider que dans les limites fixées par le Promoteur."
    "Historique des validations" -> "Journal des décisions et de leurs auteurs."
    "Collaborateurs affectés" -> "Personnel explicitement affecté au périmètre concerné."
    "Demandes d’assistance" -> "Demandes remontées à l’équipe autorisée."
    "Commandes et préparations" -> "Suivi des commandes et de leur état de préparation."
    "Stock et caisse" -> "Consultation selon les droits du rôle actif ; aucune élévation implicite."
    "Livraisons et incidents" -> "Suivi des missions et signalements selon le rôle actif."
    "Indicateurs autorisés" -> "Indicateurs limités au périmètre et aux habilitations du Responsable."
    "Session de caisse" -> "État de la session active et de son ouverture."
    "Ventes comptoir" -> "Vente au comptoir uniquement dans une session valide."
    "Panier et ticket" -> "Lignes de vente, totaux et justificatif associé."
    "File des paiements" -> "Paiements en attente de confirmation ou d’inscription comptable."
    "Réservations à régulariser" -> "Réservations en attente, sans les marquer payées sur une simple référence."
    "État des confirmations financières" -> "État de confirmation issu du rapprochement de preuves."
    "Reçus et justificatifs" -> "Reçus émis par NAXA et pièces accessibles au compte actif."
    "Recherche par référence" -> "Recherche ciblée par identifiant ou référence de transaction."
    "Réimpression selon les droits" -> "Réimpression uniquement lorsque le rôle et la session l’autorisent."
    "Journal de session" -> "Mouvements et totaux de la session de caisse."
    "Comptage et écarts" -> "Comptage physique et écarts à expliquer."
    "Validation de clôture" -> "Clôture soumise aux contrôles et règles de la Caisse."
    "Vue financière" -> "Synthèse comptable de l’établissement actif."
    "Recettes et opérations" -> "Opérations financières enregistrées et consultables."
    "Indicateurs de période" -> "Indicateurs calculés sur la période retenue."
    "Ventes et paiements" -> "Ventes et paiements confirmés, séparés des déclarations."
    "Détail par moyen de paiement" -> "Répartition par espèces, Mobile Money et autres moyens configurés."
    "Transactions à rapprocher" -> "Éléments non rapprochés ou nécessitant une revue."
    "Écarts et anomalies" -> "Anomalies à examiner sans modifier les preuves d’origine."
    "Charges et pièces" -> "Charges et justificatifs rattachés à l’établissement."
    "Suivi des justificatifs" -> "Contrôle de présence et traçabilité des pièces."
    "Classement comptable" -> "Classement selon les comptes et règles comptables configurés."
    "États de période" -> "États consultables pour une période déterminée."
    "Exports comptables" -> "Exports des seules données autorisées pour le rôle actif."
    "Activité pharmaceutique" -> "Vue des tâches et dossiers pharmaceutiques ouverts."
    "Ordonnances reçues" -> "Ordonnances accessibles au pharmacien authentifié."
    "Contrôles et statuts" -> "Contrôles pharmaceutiques avec statut explicite."
    "Historique des dossiers autorisés" -> "Historique limité aux dossiers accessibles à ce professionnel."
    "Préparation des délivrances" -> "Préparation et vérification avant la délivrance."
    "Contrôle des produits et quantités" -> "Contrôle des lignes et quantités selon les règles de dispensation."
    "Traçabilité de la dispensation" -> "Historique des produits effectivement délivrés."
    "Médicaments et références" -> "Référentiel de médicaments et informations de référence."
    "Substances et formes" -> "Substances actives et formes pharmaceutiques."
    "Informations de lots disponibles" -> "Lots accessibles et informations de traçabilité."
    "Dates et alertes" -> "Alertes de lots et échéances de péremption."
    "État du stock" -> "Quantités disponibles du stock de l’établissement actif."
    "Recherche d’articles" -> "Recherche dans le catalogue local et les références autorisées."
    "Seuils et ruptures" -> "Alertes de seuil et ruptures à traiter."
    "Entrées de marchandises" -> "Entrées réelles et contrôlées dans le stock."
    "Contrôle des quantités" -> "Quantités reçues vérifiées avant validation."
    "Traçabilité des lots" -> "Lots, dates et mouvements conservés."
    "Comptages" -> "Comptage physique avec conservation de l’historique."
    "Écarts constatés" -> "Écarts soumis aux contrôles d’autorisation."
    "Historique des inventaires" -> "Inventaires précédents et décisions associées."
    "Lots à surveiller" -> "Lots proches de la date limite ou bloqués."
    "Dates courtes et expirées" -> "Repérage des produits à date courte ou expirée."
    "Alertes et retraits" -> "Alertes et retraits selon les règles NAXA."
    "Commandes à préparer" -> "Commandes publiées après validation du stock."
    "Contrôle des lignes" -> "Vérification article par article avant confirmation."
    "Confirmation de préparation" -> "Publication de la mission Livreur après préparation effective."
    "Tâches magasin" -> "Liste des opérations affectées au magasinier."
    "Réceptions attendues" -> "Arrivages attendus et pièces associées."
    "Préparations à effectuer" -> "Commandes dont la préparation est autorisée."
    "Bons et arrivages" -> "Documents de réception et arrivages physiques."
    "Quantités réellement reçues" -> "Saisie des quantités constatées, pas des quantités théoriques."
    "Lots et dates" -> "Enregistrement des lots et dates vérifiés."
    "Emplacements" -> "Rangement selon les emplacements définis par la pharmacie."
    "Transferts internes" -> "Transferts traçables sans sortie fictive du stock."
    "Traçabilité des mouvements" -> "Journal des entrées, sorties et déplacements."
    "Comptages guidés" -> "Comptage physique par emplacement ou référence."
    "Écarts à signaler" -> "Signalement des écarts à valider par le rôle habilité."
    "Contrôle de conformité" -> "Vérification des colis et articles avant transmission."
    "Transmission au Livreur" -> "Transmission seulement lorsque la commande est prête au retrait."
    "Activité du centre" -> "Vue de l’activité du centre de santé actif."
    "Rendez-vous du jour" -> "Créneaux et rendez-vous du centre actif."
    "Demandes et alertes" -> "Demandes et alertes de fonctionnement du centre."
    "Créneaux et rendez-vous" -> "Planning du centre et disponibilités réelles."
    "Disponibilités des prestations" -> "Créneaux proposés uniquement lorsqu’ils sont ouverts."
    "Planning des salles et équipes" -> "Planification selon les affectations du centre."
    "Dossiers autorisés" -> "Dossiers visibles uniquement dans le périmètre du centre actif."
    "Historique des demandes" -> "Historique des demandes du centre actif."
    "Informations administratives protégées" -> "Les données patients restent protégées et filtrées par habilitation."
    "Catalogue des examens" -> "Examens et prestations effectivement proposés par le centre."
    "Demandes et étapes de réalisation" -> "Suivi des étapes de réalisation d’un examen."
    "Suivi des prélèvements lorsque prévu" -> "Traçabilité des prélèvements si le protocole de l’examen le prévoit."
    "Résultats à traiter" -> "Résultats accessibles pour relecture ou validation."
    "Validation et diffusion selon habilitation" -> "Seuls les professionnels habilités peuvent valider ou diffuser les résultats."
    "Historique des comptes rendus" -> "Historique des comptes rendus selon les droits du professionnel."
    "Collaborateurs du centre" -> "Collaborateurs rattachés explicitement au centre."
    "Affectations et invitations" -> "Ajout direct ou invitation personnelle selon le parcours autorisé."
    "Fonctions et accès" -> "Droits du poste actif, sans accès implicite aux autres espaces."
    "Activité et délais" -> "Indicateurs d’activité et délais du centre."
    "Statistiques du centre" -> "Statistiques limitées au centre actif."
    "Exports autorisés" -> "Exports filtrés par les droits et le périmètre du compte."
    "Informations du partenaire" -> "Identité et coordonnées de la structure partenaire."
    "État du dossier" -> "État administratif du dossier partenaire."
    "Documents et coordonnées" -> "Documents et informations autorisés de la structure."
    "Préférences d’affichage" -> "Préférences de présentation de l’espace."
    "Aucune promotion commerciale" -> "Contenu factuel uniquement ; aucun mécanisme publicitaire."
    "Demandes entrantes" -> "Demandes rattachées au partenaire actif."
    "Prestations publiées" -> "Offres et prestations réellement autorisées pour le type de partenaire."
    "Description et disponibilité" -> "Informations factuelles et disponibilités confirmées."
    "Conditions et zones couvertes" -> "Conditions et zones réellement prises en charge."
    "Demandes des clients" -> "Demandes clients du partenaire, avec accès filtré."
    "États et historique" -> "Historique des transitions et état actuel."
    "Planification des interventions" -> "Planification selon les ressources et disponibilités."
    "Collaborateurs et affectations" -> "Personnel affecté à cette structure uniquement."
    "Invitations et révocations" -> "Invitations acceptées et révocations autorisées."
    "Périmètres d’accès" -> "Contrôle serveur obligatoire pour chaque lecture et action."
    "Activité et performance" -> "Indicateurs calculés à partir des opérations réelles."
    "Demandes traitées" -> "Demandes effectivement traitées par le partenaire."
    else -> "Données et opérations limitées au rôle actif et à l’établissement autorisé."
}

@Composable
internal fun NativeProfessionalWorkspaceScreen(
    profile: NaxaProfile,
    workspace: String,
    onOpenNotifications: () -> Unit,
    onLogout: () -> Unit
) {
    val definition = remember(profile.effectiveRole, workspace, profile.activePartnerType) {
        when (workspace) {
            "medical_exams" -> NaxaNativeWorkspaceCatalog.medicalExams(profile.effectiveRole)
            "partner" -> NaxaNativeWorkspaceCatalog.partner(profile.effectiveRole, profile.activePartnerType)
            else -> NaxaNativeWorkspaceCatalog.pharmacy(profile.effectiveRole)
        }
    }
    var selectedPage by remember { mutableIntStateOf(0) }
    val page = definition.pages[selectedPage.coerceIn(0, definition.pages.lastIndex)]

    Scaffold(
        containerColor = WorkspaceBackground,
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                definition.pages.forEachIndexed { index, item ->
                    NavigationBarItem(
                        selected = selectedPage == index,
                        onClick = { selectedPage = index },
                        icon = { Text(item.title.take(1), fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                        label = { Text(item.title, maxLines = 1, fontSize = 10.sp) }
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(
            Modifier.fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) {
                    Text(definition.eyebrow, color = WorkspaceGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(definition.title, color = WorkspaceInk, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
                    Text(definition.subtitle, color = WorkspaceInk.copy(alpha = .7f), fontSize = 12.sp)
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    OutlinedButton(onClick = onOpenNotifications) { Text("Alertes") }
                    OutlinedButton(onClick = onLogout) { Text("Quitter") }
                }
            }

            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("Poste actif : \${profile.effectiveRole}", color = WorkspaceGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Text(
                        "Vous consultez uniquement l’espace professionnel actif de votre session NAXA.",
                        color = WorkspaceInk.copy(alpha = .72f), fontSize = 12.sp
                    )
                }
            }

            definition.scopeNotice?.let { notice ->
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF4D5)), shape = RoundedCornerShape(14.dp)) {
                    Text(notice, Modifier.padding(14.dp), color = Color(0xFF694B00), fontSize = 12.sp)
                }
            }

            Text(page.title, color = WorkspaceInk, fontSize = 19.sp, fontWeight = FontWeight.Bold)
            page.modules.forEach { module ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(15.dp)) {
                    Column(
                        Modifier.fillMaxWidth().padding(15.dp),
                        verticalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Text(module.title, color = WorkspaceInk, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text(module.description, color = WorkspaceInk.copy(alpha = .72f), fontSize = 12.sp)
                    }
                }
            }

            Spacer(Modifier.height(4.dp))
            Text(
                "Interface native de navigation. Les données et opérations métier ne sont affichées qu’après raccordement aux API NAXA protégées par rôle et établissement.",
                color = WorkspaceInk.copy(alpha = .55f), fontSize = 10.sp
            )
        }
    }
}
