package cm.naxa.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeWorkspaceCatalogTest {
    @Test
    fun everyPharmacyStaffRoleHasItsOwnNativePageSet() {
        val roles = listOf(
            "promoteur",
            "pharmacie",
            "responsable",
            "caisse",
            "comptable",
            "pharmacien",
            "gestionnaire_stock",
            "magasinier"
        )

        roles.forEach { role ->
            val definition = NaxaNativeWorkspaceCatalog.pharmacy(role)
            assertTrue("Missing pages for $role", definition.pages.size >= 4)
            assertTrue("Empty page for $role", definition.pages.all { it.modules.isNotEmpty() })
        }
    }

    @Test
    fun medicalExamsWorkspaceContainsClinicalAndTeamSections() {
        val definition = NaxaNativeWorkspaceCatalog.medicalExams("technicien_laboratoire")

        assertEquals("Espace Technicien", definition.title)
        assertTrue(definition.pages.any { it.title == "Patients" })
        assertTrue(definition.pages.any { it.title == "Examens" })
        assertTrue(definition.pages.any { it.title == "Résultats" })
        assertTrue(definition.pages.any { it.title == "Équipe" })
        assertNotNull(definition.scopeNotice)
    }

    @Test
    fun babyAndParapharmacySpacesKeepTheirBusinessRestrictions() {
        val baby = NaxaNativeWorkspaceCatalog.partner("gestionnaire", "bebe_maman")
        val para = NaxaNativeWorkspaceCatalog.partner("gestionnaire", "parapharmacie")

        assertEquals(2, baby.pages.size)
        assertTrue(baby.scopeNotice!!.contains("sans publicité"))
        assertEquals(2, para.pages.size)
        assertTrue(para.scopeNotice!!.contains("attente d’activation"))
    }

    @Test
    fun professionalRoutesRequireTheResolvedActiveScope() {
        assertTrue(NaxaNativeRole.supportsPharmacyWorkspace("promoteur", "pharmacy"))
        assertTrue(NaxaNativeRole.supportsPharmacyWorkspace("gestionnaire_stock", "pharmacy"))
        assertFalse(NaxaNativeRole.supportsPharmacyWorkspace("client", "pharmacy"))
        assertFalse(NaxaNativeRole.supportsPharmacyWorkspace("livreur", "pharmacy"))

        assertTrue(NaxaNativeRole.supportsMedicalExamsWorkspace(
            "technicien_laboratoire", "medical_exams", "center-id"
        ))
        assertFalse(NaxaNativeRole.supportsMedicalExamsWorkspace(
            "technicien_laboratoire", "medical_exams", null
        ))
        assertTrue(NaxaNativeRole.supportsPartnerWorkspace("gestionnaire", "partner", "partner-id"))
        assertFalse(NaxaNativeRole.supportsPartnerWorkspace("gestionnaire", "partner", null))
    }
}
