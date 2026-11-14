package cm.naxa.app

/**
 * Fail-closed native workspace routing.
 * Until a role-specific native workspace is implemented, only the Client
 * workspace may use the Client navigation.
 */
internal object NaxaNativeRole {
    fun supportsClientWorkspace(role: String, workspace: String): Boolean =
        role == "client" && workspace == "client"

    fun supportsAdminWorkspace(role: String, workspace: String): Boolean =
        role == "admin" && workspace == "admin"
}
