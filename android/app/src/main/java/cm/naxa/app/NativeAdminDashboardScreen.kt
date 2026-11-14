package cm.naxa.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

private val AdminGreen = Color(0xFF087A55)
private val AdminInk = Color(0xFF17342B)
private val AdminBackground = Color(0xFFF3F7F4)

@Composable
internal fun NativeAdminDashboardScreen(
    repository: AdminDashboardRepository,
    onLogout: () -> Unit
) {
    var snapshot by remember { mutableStateOf<AdminDashboardSnapshot?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun refresh() {
        loading = true
        error = null
        try {
            snapshot = repository.load()
        } catch (exception: Exception) {
            error = exception.message ?: "Impossible de charger le tableau de bord."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(Unit) { refresh() }

    Surface(modifier = Modifier.fillMaxSize(), color = AdminBackground) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "NAXA  /  ADMINISTRATION",
                        color = AdminGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.1.sp
                    )
                    Text(
                        text = "Tableau de bord",
                        color = AdminInk,
                        fontSize = 27.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                    Text(
                        text = "Vue d’ensemble du réseau et des opérations",
                        color = AdminInk.copy(alpha = 0.72f),
                        fontSize = 13.sp
                    )
                }
                OutlinedButton(onClick = onLogout) {
                    Text("Quitter")
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    color = Color(0xFFE1F3EA),
                    shape = RoundedCornerShape(50)
                ) {
                    Text(
                        "Poste Admin actif",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                        color = AdminGreen,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(Modifier.weight(1f))
                OutlinedButton(
                    onClick = { scope.launch { refresh() } },
                    enabled = !loading
                ) {
                    Text("Actualiser")
                }
            }

            error?.let { message ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFE9E7)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(message, color = Color(0xFF8A2018), fontSize = 13.sp)
                        Button(
                            onClick = { scope.launch { refresh() } },
                            enabled = !loading,
                            colors = ButtonDefaults.buttonColors(containerColor = AdminGreen)
                        ) {
                            Text("Réessayer")
                        }
                    }
                }
            }

            if (loading && snapshot == null) {
                Box(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 38.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AdminGreen)
                }
            }

            snapshot?.let { data ->
                if (data.partial) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF4D5)),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text(
                            "Indicateurs partiels : une ou plusieurs sources administratives sont indisponibles. Les totaux ne sont pas complets.",
                            modifier = Modifier.padding(14.dp),
                            color = Color(0xFF694B00),
                            fontSize = 13.sp
                        )
                    }
                }

                Text(
                    text = "Indicateurs du réseau",
                    color = AdminInk,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    AdminMetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Pharmacies",
                        value = data.summary.pharmaciesTotal?.toString() ?: "—",
                        detail = "Hors comptes de démonstration"
                    )
                    AdminMetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Stocks horodatés",
                        value = data.summary.stockTimestamped?.toString() ?: "—",
                        detail = "Avec date de mise à jour"
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    AdminMetricCard(
                        modifier = Modifier.weight(1f),
                        title = "À actualiser",
                        value = data.summary.stockNeedsUpdate?.toString() ?: "—",
                        detail = "Sans date de stock connue"
                    )
                    AdminMetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Quartiers",
                        value = data.summary.neighborhoodsCovered?.toString() ?: "—",
                        detail = "Quartiers déclarés distincts"
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    AdminMetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Alertes Promoteurs",
                        value = data.summary.promoterAlerts?.toString() ?: "—",
                        detail = "Impayés ou échéances dépassées"
                    )
                    AdminMetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Pharmacies inactives",
                        value = data.summary.inactivePharmacies?.toString() ?: "—",
                        detail = "Inactives ou non visibles"
                    )
                }

                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(9.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Actualisation des stocks", color = AdminInk, fontWeight = FontWeight.Bold)
                            Text(
                                data.summary.stockProgressPercent?.let { "$it%" } ?: "—",
                                color = AdminGreen,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                        data.summary.stockProgressPercent?.let { value ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(9.dp)
                                    .background(Color(0xFFE5ECE8), RoundedCornerShape(50))
                            ) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth(value.coerceIn(0, 100) / 100f)
                                        .height(9.dp)
                                        .background(AdminGreen, RoundedCornerShape(50))
                                )
                            }
                        }
                        Text(
                            data.summary.lastStockUpdate?.let { "Dernière mise à jour : $it" }
                                ?: "Date de dernière mise à jour indisponible",
                            color = AdminInk.copy(alpha = 0.68f),
                            fontSize = 12.sp
                        )
                        Text(
                            "Alertes réseau : ${data.summary.alertsTotal?.toString() ?: "—"}",
                            color = AdminInk,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Text(
                    text = "Dernières actions administratives",
                    color = AdminInk,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                if (data.recentActivity.isEmpty()) {
                    Text(
                        "Aucune entrée récente disponible.",
                        color = AdminInk.copy(alpha = 0.65f),
                        fontSize = 13.sp
                    )
                } else {
                    data.recentActivity.forEach { entry ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(Modifier.fillMaxWidth().padding(13.dp)) {
                                Text(entry.action, color = AdminInk, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${entry.entityType} · ${entry.createdAt}",
                                    color = AdminInk.copy(alpha = 0.68f),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            Text(
                "Console native NAXA · données chargées par API Admin authentifiée",
                color = AdminInk.copy(alpha = 0.55f),
                fontSize = 11.sp
            )
        }
    }
}

@Composable
private fun AdminMetricCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    detail: String
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(15.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(title, color = AdminInk.copy(alpha = 0.72f), fontSize = 11.sp, fontWeight = FontWeight.Medium)
            Text(value, color = AdminInk, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
            Text(detail, color = AdminInk.copy(alpha = 0.62f), fontSize = 10.sp)
        }
    }
}
