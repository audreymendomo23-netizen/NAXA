package cm.naxa.app

/**
 * Native workspace routing.
 * Only a server-resolved active workspace can unlock a professional area.
 */
internal object NaxaNativeRole {
    private val pharmacyRoles = setOf(
        "promoteur",
        "pharmacie",
        "responsable",
        "caisse",
        "comptable",
        "pharmacien",
        "gestionnaire_stock",
        "magasinier"
    )

    private val unresolvedRoles = setOf(
        "active_role_unresolved",
        "active_role_conflict",
        "exam_scope_ambiguous",
        "partner_context_unresolved"
    )

    fun supportsClientWorkspace(role: String, workspace: String): Boolean =
        role == "client" && workspace == "client"

    fun supportsAdminWorkspace(role: String, workspace: String): Boolean =
        role == "admin" && workspace == "admin"

    fun supportsCourierWorkspace(role: String, workspace: String): Boolean =
        role == "livreur" && workspace in setOf("pharmacy", "partner", "livreur")

    fun supportsPharmacyWorkspace(role: String, workspace: String): Boolean =
        workspace == "pharmacy" && role in pharmacyRoles

    fun supportsMedicalExamsWorkspace(role: String, workspace: String, centerId: String?): Boolean =
        workspace == "medical_exams" &&
            !centerId.isNullOrBlank() &&
            role.isNotBlank() &&
            role !in unresolvedRoles &&
            role !in setOf("admin", "client", "livreur")

    fun supportsPartnerWorkspace(role: String, workspace: String, partnerId: String?): Boolean =
        workspace == "partner" &&
            !partnerId.isNullOrBlank() &&
            role.isNotBlank() &&
            role !in unresolvedRoles &&
            role !in setOf("admin", "client", "livreur")
}
