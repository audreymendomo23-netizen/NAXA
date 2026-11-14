package cm.naxa.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NaxaNativeRoleTest {
    @Test
    fun onlyClientRoleCanEnterClientWorkspace() {
        assertTrue(NaxaNativeRole.supportsClientWorkspace("client"))
    }

    @Test
    fun professionalAndAdminRolesFailClosed() {
        listOf(
            "admin", "promoteur", "pharmacie", "caisse", "responsable", "comptable",
            "pharmacien", "gestionnaire_stock", "livreur", "partenaire",
            "centre_examens", "soins_domicile"
        ).forEach { role ->
            assertFalse("Role $role must not enter Client workspace", NaxaNativeRole.supportsClientWorkspace(role))
        }
    }

    @Test
    fun activeRoleOverridesBaseRoleForWorkspaceRouting() {
        val profile = NaxaProfile(
            userId = "profile-id",
            role = "client",
            ageVerified = true,
            activeRole = "admin"
        )
        assertFalse(NaxaNativeRole.supportsClientWorkspace(profile.effectiveRole))
    }

    @Test
    fun missingActiveRoleFallsBackToBaseRole() {
        val profile = NaxaProfile(
            userId = "profile-id",
            role = "client",
            ageVerified = true
        )
        assertTrue(NaxaNativeRole.supportsClientWorkspace(profile.effectiveRole))
    }

    @Test
    fun unknownOrMalformedRolesFailClosed() {
        listOf("", "CLIENT", "unknown", "client_admin").forEach { role ->
            assertFalse(NaxaNativeRole.supportsClientWorkspace(role))
        }
    }
}
