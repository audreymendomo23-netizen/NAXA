package cm.naxa.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NaxaNativeRoleTest {
    @Test
    fun onlyVerifiedClientWorkspaceCanEnterClientNavigation() {
        assertTrue(NaxaNativeRole.supportsClientWorkspace("client", "client"))
        assertFalse(NaxaNativeRole.supportsClientWorkspace("client", "medical_exams"))
        assertFalse(NaxaNativeRole.supportsClientWorkspace("client", "partner"))
        assertFalse(NaxaNativeRole.supportsClientWorkspace("client", "unresolved"))
    }

    @Test
    fun professionalAndAdminRolesFailClosedFromClientWorkspace() {
        listOf(
            "admin", "promoteur", "pharmacie", "caisse", "responsable", "comptable",
            "pharmacien", "gestionnaire_stock", "magasinier", "livreur", "partenaire",
            "directeur", "accueil", "caissier", "technicien_laboratoire", "biologiste",
            "manipulateur_imagerie", "radiologue", "responsable_qualite", "responsable_securite"
        ).forEach { role ->
            assertFalse(
                "Role $role must not enter Client workspace",
                NaxaNativeRole.supportsClientWorkspace(role, "client")
            )
        }
    }

    @Test
    fun adminWorkspaceRequiresBothAdminRoleAndAdminDomain() {
        assertTrue(NaxaNativeRole.supportsAdminWorkspace("admin", "admin"))
        assertFalse(NaxaNativeRole.supportsAdminWorkspace("client", "admin"))
        assertFalse(NaxaNativeRole.supportsAdminWorkspace("admin", "client"))
        assertFalse(NaxaNativeRole.supportsAdminWorkspace("admin", "unresolved"))
    }

    @Test
    fun activeRoleOverridesBaseRoleForWorkspaceRouting() {
        val profile = NaxaProfile(
            userId = "profile-id",
            role = "client",
            ageVerified = true,
            activeRole = "admin",
            activeWorkspace = "admin"
        )
        assertFalse(
            NaxaNativeRole.supportsClientWorkspace(profile.effectiveRole, profile.activeWorkspace)
        )
        assertTrue(
            NaxaNativeRole.supportsAdminWorkspace(profile.effectiveRole, profile.activeWorkspace)
        )
    }

    @Test
    fun missingActiveRoleFallsBackToBaseClientWorkspace() {
        val profile = NaxaProfile(
            userId = "profile-id",
            role = "client",
            ageVerified = true
        )
        assertTrue(
            NaxaNativeRole.supportsClientWorkspace(profile.effectiveRole, profile.activeWorkspace)
        )
    }

    @Test
    fun unknownOrMalformedRolesFailClosed() {
        listOf("", "CLIENT", "unknown", "client_admin", "exam_scope_ambiguous")
            .forEach { role ->
                assertFalse(NaxaNativeRole.supportsClientWorkspace(role, "client"))
                assertFalse(NaxaNativeRole.supportsAdminWorkspace(role, "admin"))
            }
    }
}
