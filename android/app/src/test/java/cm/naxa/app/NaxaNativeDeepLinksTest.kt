package cm.naxa.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NaxaNativeDeepLinksTest {
    @Test
    fun notificationsAreAvailableFromEveryAuthenticatedWorkspace() {
        listOf("client", "admin", "pharmacy", "medical_exams", "unresolved").forEach { workspace ->
            assertTrue(
                NaxaNativeDeepLinks.resolve("/notifications", workspace) is NaxaNativeDeepLink.Notifications
            )
        }
    }

    @Test
    fun adminRouteRequiresAdminWorkspace() {
        assertTrue(
            NaxaNativeDeepLinks.resolve("/admin", "admin") is NaxaNativeDeepLink.AdminDashboard
        )
        assertTrue(
            NaxaNativeDeepLinks.resolve("/admin", "client") is NaxaNativeDeepLink.Unsupported
        )
        assertTrue(
            NaxaNativeDeepLinks.resolve("/admin/pilotage", "admin") is NaxaNativeDeepLink.Unsupported
        )
    }

    @Test
    fun clientRoutesResolveOnlyInClientWorkspace() {
        assertEquals(
            NaxaNativeDeepLink.ClientTab(2),
            NaxaNativeDeepLinks.resolve("/scanner", "client")
        )
        assertEquals(
            NaxaNativeDeepLink.ClientTab(3),
            NaxaNativeDeepLinks.resolve("/achats", "client")
        )
        assertTrue(
            NaxaNativeDeepLinks.resolve("/scanner", "pharmacy") is NaxaNativeDeepLink.Unsupported
        )
        assertTrue(
            NaxaNativeDeepLinks.resolve("/profil", "medical_exams") is NaxaNativeDeepLink.Unsupported
        )
    }

    @Test
    fun searchQueryIsPreservedButBounded() {
        val result = NaxaNativeDeepLinks.resolve("/resultats?q=paracetamol", "client")
        assertEquals(NaxaNativeDeepLink.ClientTab(1, "paracetamol"), result)

        val longQuery = "x".repeat(150)
        val bounded = NaxaNativeDeepLinks.resolve("/recherche?q=$longQuery", "client")
        assertEquals(120, (bounded as NaxaNativeDeepLink.ClientTab).query?.length)
    }

    @Test
    fun externalAndTraversalLinksAreRejected() {
        val rejected = listOf(
            "https://evil.example",
            "//evil.example/path",
            "/%2e%2e/admin",
            "/client/../admin",
            "/admin\\\\settings",
            "javascript:alert(1)"
        )
        rejected.forEach { value ->
            assertTrue(
                "$value must be rejected",
                NaxaNativeDeepLinks.resolve(value, "admin") is NaxaNativeDeepLink.Unsupported
            )
        }
    }

    @Test
    fun professionalPathsDoNotFallThroughToClientNavigation() {
        listOf("/pharmacie/livreur", "/centre-examens/agenda", "/partenaire/examens")
            .forEach { path ->
                val result = NaxaNativeDeepLinks.resolve(path, "client")
                assertFalse(result is NaxaNativeDeepLink.ClientTab)
                assertTrue(result is NaxaNativeDeepLink.Unsupported)
            }
    }
}
