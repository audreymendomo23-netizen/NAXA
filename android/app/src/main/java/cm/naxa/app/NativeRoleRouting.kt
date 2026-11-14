package cm.naxa.app

/**
 * Native workspace routing.
 * Each supported role is routed only to a native workspace that has an
 * implemented screen; unsupported roles remain fail-closed.
 */
internal object NaxaNativeRole {
    fun supportsClientWorkspace(role: String, workspace: String): Boolean =
        role == "client" && workspace == "client"

    fun supportsAdminWorkspace(role: String, workspace: String): Boolean =
        role == "admin" && workspace == "admin"

    fun supportsCourierWorkspace(role: String, workspace: String): Boolean =
        role == "livreur" && workspace in setOf("pharmacy", "partner", "livreur")
}
