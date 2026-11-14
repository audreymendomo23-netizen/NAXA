package cm.naxa.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import java.text.NumberFormat
import java.util.Locale

private val CourierGreen = Color(0xFF087A55)
private val CourierInk = Color(0xFF17342B)
private val CourierBackground = Color(0xFFF3F7F4)

@Composable
internal fun NativeCourierWorkspaceScreen(
    repository: CourierRepository,
    onOpenNotifications: () -> Unit,
    onLogout: () -> Unit
) {
    var missions by remember { mutableStateOf<List<CourierMission>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var busyMission by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var includeHistory by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun refresh() {
        loading = true
        error = null
        try {
            missions = repository.missions(includeHistory)
        } catch (exception: Exception) {
            error = exception.message ?: "Impossible de charger les missions."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(includeHistory) { refresh() }

    Surface(Modifier.fillMaxSize(), color = CourierBackground) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(Modifier.weight(1f)) {
                    Text("NAXA  /  LIVRAISON", color = CourierGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text("Espace Livreur", color = CourierInk, fontSize = 27.sp, fontWeight = FontWeight.ExtraBold)
                    Text("Missions transmises après préparation par Stock", color = CourierInk.copy(alpha = .68f), fontSize = 12.sp)
                }
                OutlinedButton(onClick = onLogout) { Text("Quitter") }
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onOpenNotifications, modifier = Modifier.weight(1f)) { Text("Notifications") }
                OutlinedButton(onClick = { scope.launch { refresh() } }, enabled = !loading, modifier = Modifier.weight(1f)) { Text("Actualiser") }
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { includeHistory = false }, modifier = Modifier.weight(1f)) { Text("Missions actives") }
                OutlinedButton(onClick = { includeHistory = true }, modifier = Modifier.weight(1f)) { Text("Historique") }
            }

            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(15.dp)) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Règle de retrait", color = CourierGreen, fontWeight = FontWeight.Bold)
                    Text("Une mission peut être acceptée lorsqu’elle est proposée. Le retrait du colis reste bloqué par le serveur tant que Stock n’a pas confirmé la préparation et que le paiement requis n’est pas vérifié.", color = CourierInk.copy(alpha = .78f), fontSize = 12.sp)
                }
            }

            error?.let { message ->
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFE9E7)), shape = RoundedCornerShape(14.dp)) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(message, color = Color(0xFF8A2018), fontSize = 13.sp)
                        Button(onClick = { scope.launch { refresh() } }, enabled = !loading) { Text("Réessayer") }
                    }
                }
            }

            if (loading && missions.isEmpty()) {
                Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = CourierGreen)
                }
            } else if (missions.isEmpty() && error == null) {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(15.dp)) {
                    Column(Modifier.padding(18.dp)) {
                        Text(if (includeHistory) "Aucune mission dans l’historique" else "Aucune livraison disponible", color = CourierInk, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        Text("Les nouvelles missions apparaîtront ici après validation et préparation par la pharmacie.", color = CourierInk.copy(alpha = .68f), fontSize = 13.sp)
                    }
                }
            }

            missions.forEach { mission ->
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(16.dp)) {
                    Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(statusLabel(mission.status), color = CourierGreen, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text("Commande #${mission.reservationId.take(8)}", color = CourierInk.copy(alpha = .55f), fontSize = 10.sp)
                        }
                        Text(listOfNotNull(mission.district, mission.city).joinToString(" · ").ifBlank { "Adresse communiquée après acceptation" }, color = CourierInk, fontWeight = FontWeight.SemiBold)
                        mission.address?.let { Text(it, color = CourierInk.copy(alpha = .8f), fontSize = 13.sp) }
                        mission.landmark?.let { Text("Repère : $it", color = CourierInk.copy(alpha = .7f), fontSize = 12.sp) }
                        mission.phone?.let { Text("Téléphone : $it", color = CourierInk.copy(alpha = .8f), fontSize = 13.sp) }
                        if (mission.paymentMode != null) Text("Paiement : ${mission.paymentMode} · ${mission.paymentStatus ?: "à vérifier"}", color = CourierInk.copy(alpha = .72f), fontSize = 11.sp)
                        val total = mission.orderTotal
                        val fee = mission.deliveryFee
                        if (total != null || fee != null) {
                            Text("Commande : ${money(total)} FCFA · Livraison : ${money(fee)} FCFA", color = CourierInk, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        }

                        if (mission.status == "available") {
                            Button(
                                onClick = {
                                    scope.launch {
                                        busyMission = mission.id
                                        error = null
                                        try { repository.accept(mission.id); refresh() }
                                        catch (exception: Exception) { error = exception.message ?: "Acceptation impossible." }
                                        finally { busyMission = null }
                                    }
                                },
                                enabled = busyMission == null,
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = CourierGreen)
                            ) { Text(if (busyMission == mission.id) "Acceptation…" else "Accepter cette livraison") }
                        } else if (mission.status == "accepted") {
                            Button(
                                onClick = {
                                    scope.launch {
                                        busyMission = mission.id
                                        error = null
                                        try { repository.pickup(mission.id); refresh() }
                                        catch (exception: Exception) { error = exception.message ?: "Retrait impossible." }
                                        finally { busyMission = null }
                                    }
                                },
                                enabled = busyMission == null,
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = CourierGreen)
                            ) { Text(if (busyMission == mission.id) "Validation…" else "Confirmer le retrait du colis") }
                            Text("Le serveur vérifie la préparation et le paiement avant d’autoriser le retrait.", color = CourierInk.copy(alpha = .6f), fontSize = 11.sp)
                        }
                    }
                }
            }

            Text("Les transitions de mission et les droits d’accès sont contrôlés par les fonctions sécurisées NAXA.", color = CourierInk.copy(alpha = .55f), fontSize = 11.sp)
        }
    }
}

private fun statusLabel(status: String): String = when (status) {
    "available" -> "À accepter"
    "accepted" -> "Acceptée · en attente de retrait"
    "picked_up" -> "Colis récupéré"
    "arrived" -> "Arrivé chez le client"
    "delivered" -> "Livrée"
    "failed" -> "Incident signalé"
    "cancelled" -> "Annulée"
    else -> status.ifBlank { "Statut indisponible" }
}

private fun money(value: Long?): String = NumberFormat.getIntegerInstance(Locale.FRANCE).format(value ?: 0L)
