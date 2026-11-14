package cm.naxa.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private data class NativeAdminSection(
    val title: String,
    val subtitle: String,
    val modules: List<Pair<String, String>>
)

private val nativeAdminSections = listOf(
    NativeAdminSection(
        "Gestion des pharmacies",
        "Dossiers, conformité et état des établissements.",
        listOf(
            "Dossiers pharmacie" to "Consultation des dossiers et de leurs étapes de validation.",
            "Documents et attestations" to "Contrôle des fichiers réellement reçus et des pièces validées.",
            "État des établissements" to "Visibilité, activation, suspension et historique.",
            "Réseau et couverture" to "Répartition géographique et indicateurs réels du réseau."
        )
    ),
    NativeAdminSection(
        "Promoteurs",
        "Gestion des propriétaires et de leur réseau de pharmacies.",
        listOf(
            "Dossiers Promoteur" to "Identité professionnelle et état du dossier.",
            "Abonnements" to "Échéances, montants dus et état de validité.",
            "Preuves de paiement" to "Rapprochement des preuves et revue manuelle.",
            "Affectations" to "Contrôle du réseau et des fonctions déléguées."
        )
    ),
    NativeAdminSection(
        "Partenaires et univers",
        "Structures partenaires, services et règles de publication.",
        listOf(
            "Registre des partenaires" to "Structures, catégories, rattachements et état.",
            "Univers NAXA" to "Pharmacie, dispositifs médicaux, examens et prestations autorisés.",
            "Publications" to "Contrôle des produits, fiches et offres avant diffusion.",
            "Restrictions commerciales" to "Respect des univers suspendus ou sans publicité."
        )
    ),
    NativeAdminSection(
        "Paiements",
        "Contrôle des intentions, preuves et confirmations financières.",
        listOf(
            "Files de rapprochement" to "Preuves débit/crédit à rapprocher par transaction.",
            "Revue manuelle" to "Dossiers ambigus, incomplets ou contradictoires.",
            "Reçus NAXA" to "Reçus durables et statut de confirmation.",
            "Journal financier" to "Historique des décisions et des changements d’état."
        )
    ),
    NativeAdminSection(
        "Marketplace et réservations",
        "Suivi des demandes, réservations et opérations de livraison.",
        listOf(
            "Réservations" to "État des dossiers Marketplace et historique.",
            "Paiements" to "Confirmation financière distincte de l’inscription POS.",
            "Mouvements de stock" to "Contrôle des débits, restitutions et allocations.",
            "Livraisons" to "Missions, statuts et incidents signalés."
        )
    ),
    NativeAdminSection(
        "Rapports et sécurité",
        "Pilotage du réseau, traçabilité et contrôles d’accès.",
        listOf(
            "Indicateurs BI" to "KPI calculés à partir des données réelles, hors démos.",
            "Journal d’audit" to "Actions administratives, acteur, horodatage et cible.",
            "Rapports et exports" to "Fichiers générés selon les droits Admin.",
            "Sécurité et accès" to "État des comptes, habilitations et alertes."
        )
    )
)

@Composable
internal fun NativeAdminWorkspaceScreen(
    repository: AdminDashboardRepository,
    deepLinkNotice: String?,
    onOpenNotifications: () -> Unit,
    onLogout: () -> Unit
) {
    var selectedSection by remember { mutableIntStateOf(0) }

    Scaffold(
        containerColor = Color(0xFFF3F7F4),
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                NavigationBarItem(
                    selected = selectedSection == 0,
                    onClick = { selectedSection = 0 },
                    icon = { Text("V", fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                    label = { Text("Vue", fontSize = 10.sp) }
                )
                nativeAdminSections.forEachIndexed { index, section ->
                    NavigationBarItem(
                        selected = selectedSection == index + 1,
                        onClick = { selectedSection = index + 1 },
                        icon = { Text(section.title.take(1), fontSize = 10.sp, fontWeight = FontWeight.Bold) },
                        label = { Text(section.title.substringBefore(' '), maxLines = 1, fontSize = 9.sp) }
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(Modifier.fillMaxSize().padding(innerPadding)) {
            if (selectedSection == 0) {
                NativeAdminDashboardScreen(
                    repository = repository,
                    deepLinkNotice = deepLinkNotice,
                    onOpenNotifications = onOpenNotifications,
                    onLogout = onLogout
                )
            } else {
                val section = nativeAdminSections[selectedSection - 1]
                Column(
                    Modifier.fillMaxSize().padding(horizontal = 18.dp, vertical = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("NAXA / ADMINISTRATION", color = Color(0xFF087A55), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text(section.title, color = Color(0xFF17342B), fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                    Text(section.subtitle, color = Color(0xFF52675E), fontSize = 13.sp)
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(onClick = onOpenNotifications, modifier = Modifier.weight(1f)) {
                            Text("Notifications")
                        }
                        OutlinedButton(onClick = onLogout, modifier = Modifier.weight(1f)) {
                            Text("Quitter")
                        }
                    }
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF4D5)),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(
                            "Page native construite. Les listes, détails et décisions de cette rubrique restent à raccorder à leurs API Admin sécurisées ; aucune donnée de démonstration n’est affichée.",
                            Modifier.padding(14.dp),
                            color = Color(0xFF694B00),
                            fontSize = 12.sp
                        )
                    }
                    section.modules.forEach { (title, description) ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(15.dp)
                        ) {
                            Column(
                                Modifier.fillMaxWidth().padding(15.dp),
                                verticalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                Text(title, color = Color(0xFF17342B), fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                Text(description, color = Color(0xFF52675E), fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
