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
            "admin", "promoteur", "pharmacie", "responsable", "comptable",
            "pharmacien", "gestionnaire_stock", "livreur", "partenaire",
            "centre_examens", "soins_domicile"
        ).forEach { role ->
            assertFalse("Role $role must not enter Client workspace", NaxaNativeRole.supportsClientWorkspace(role))
        }
    }

    @Test
    fun unknownOrMalformedRolesFailClosed() {
        listOf("", "CLIENT", "unknown", "client_admin").forEach { role ->
            assertFalse(NaxaNativeRole.supportsClientWorkspace(role))
        }
    }
}
