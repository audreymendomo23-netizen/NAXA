package cm.naxa.app

/**
 * Fail-closed native workspace routing.
 * Until a role-specific native workspace is implemented, only the Client
 * workspace may use the Client navigation.
 */
internal object NaxaNativeRole {
    fun supportsClientWorkspace(role: String): Boolean = role == "client"
}
