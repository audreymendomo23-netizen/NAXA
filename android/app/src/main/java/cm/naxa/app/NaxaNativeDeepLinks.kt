package cm.naxa.app

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

internal sealed interface NaxaNativeDeepLink {
    data object Notifications : NaxaNativeDeepLink
    data object AdminDashboard : NaxaNativeDeepLink
    data class ClientTab(val index: Int, val query: String? = null) : NaxaNativeDeepLink
    data class Unsupported(val reason: String) : NaxaNativeDeepLink
}

internal object NaxaNativeDeepLinks {
    fun resolve(rawPath: String?, activeWorkspace: String): NaxaNativeDeepLink {
        if (rawPath.isNullOrBlank()) {
            return NaxaNativeDeepLink.Unsupported("Aucune destination n’a été fournie.")
        }
        if (
            rawPath.length > 2048 ||
            !rawPath.startsWith("/") ||
            rawPath.startsWith("//") ||
            rawPath.contains("://") ||
            rawPath.contains('\\') ||
            rawPath.any { it.isISOControl() }
        ) {
            return NaxaNativeDeepLink.Unsupported("Lien NAXA invalide.")
        }

        val uri = try {
            URI(rawPath)
        } catch (_: Exception) {
            return NaxaNativeDeepLink.Unsupported("Lien NAXA invalide.")
        }
        if (uri.scheme != null || uri.rawAuthority != null) {
            return NaxaNativeDeepLink.Unsupported("Les liens externes ne sont pas ouverts dans l’espace natif.")
        }

        val path = uri.path.orEmpty()
        val segments = path.split('/')
        if (
            path.isBlank() ||
            path.contains("//") ||
            path.contains('\\') ||
            segments.any { it == "." || it == ".." } ||
            path.length > 512
        ) {
            return NaxaNativeDeepLink.Unsupported("Chemin NAXA non autorisé.")
        }

        if (path == "/notifications") return NaxaNativeDeepLink.Notifications

        if (path == "/admin") {
            return if (activeWorkspace == "admin") NaxaNativeDeepLink.AdminDashboard
            else NaxaNativeDeepLink.Unsupported("Le poste Admin doit être actif pour ouvrir cette destination.")
        }
        if (path.startsWith("/admin/")) {
            return NaxaNativeDeepLink.Unsupported("Ce module Admin n’est pas encore disponible dans l’application Android.")
        }

        val clientTab = when (path) {
            "/", "/client", "/client/accueil" -> 0
            "/recherche", "/resultats" -> 1
            "/scanner" -> 2
            "/achats", "/client/historique" -> 3
            "/profil", "/client/profil" -> 4
            else -> null
        }
        if (clientTab != null) {
            if (activeWorkspace != "client") {
                return NaxaNativeDeepLink.Unsupported("Cette destination appartient à l’espace Client.")
            }
            val query = if (clientTab == 1) {
                uri.queryParameter("q")
                    ?.filterNot { it.isISOControl() }
                    ?.take(120)
                    ?.takeIf { it.isNotBlank() }
            } else null
            return NaxaNativeDeepLink.ClientTab(clientTab, query)
        }

        return NaxaNativeDeepLink.Unsupported("Cette destination n’est pas encore disponible dans l’application Android.")
    }

    private fun URI.queryParameter(name: String): String? {
        val query = rawQuery ?: return null
        for (part in query.split('&')) {
            val pair = part.split('=', limit = 2)
            val key = decodeQueryComponent(pair[0]) ?: continue
            if (key == name) return decodeQueryComponent(pair.getOrElse(1) { "" })
        }
        return null
    }

    private fun decodeQueryComponent(value: String): String? = try {
        URLDecoder.decode(value, StandardCharsets.UTF_8.name())
    } catch (_: IllegalArgumentException) {
        null
    }
}
