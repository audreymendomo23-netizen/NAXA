package cm.naxa.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun NativeClientHistoryScreen(repository: ClientHistoryRepository, clientId: String) {
    var snapshot by remember(clientId) { mutableStateOf<ClientHistorySnapshot?>(null) }
    var loading by remember(clientId) { mutableStateOf(true) }
    var error by remember(clientId) { mutableStateOf<String?>(null) }
    var showPurchases by remember(clientId) { mutableStateOf(false) }

    LaunchedEffect(clientId) {
        loading = true
        error = null
        try {
            snapshot = repository.load(clientId)
        } catch (exception: Exception) {
            error = exception.message ?: "Historique indisponible. Réessayez."
        } finally {
            loading = false
        }
    }

    Column(Modifier.fillMaxWidth()) {
        Text("Mes achats et commandes", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
        Spacer(Modifier.height(5.dp))
        Text(
            "Données de votre compte NAXA. Les états reflètent les informations enregistrées par la pharmacie.",
            fontSize = 12.sp, color = Color(0xFF65776F)
        )
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = !showPurchases, onClick = { showPurchases = false }, label = { Text("Commandes") })
            FilterChip(selected = showPurchases, onClick = { showPurchases = true }, label = { Text("Achats confirmés") })
        }
        if (loading) {
            Spacer(Modifier.height(20.dp))
            CircularProgressIndicator()
        } else if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        } else {
            val data = snapshot ?: ClientHistorySnapshot(emptyList(), emptyList(), false)
            if (!showPurchases) {
                val visible = data.reservations.take(50)
                if (visible.isEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    Text("Aucune commande ou réservation enregistrée.", color = Color(0xFF65776F), fontSize = 13.sp)
                }
                visible.forEach { ReservationHistoryCard(it) }
                if (data.reservations.size > visible.size) {
                    Text("50 dernières commandes affichées sur ${data.reservations.size}.", color = Color(0xFF87948E), fontSize = 11.sp)
                }
            } else if (data.purchasesUnavailable) {
                Spacer(Modifier.height(12.dp))
                Text(
                    "Le détail des achats n'est pas disponible dans cet environnement. Les réservations restent consultables dans l'onglet Commandes.",
                    color = Color(0xFF8A6B1C), fontSize = 12.sp
                )
            } else {
                val visible = data.purchases.filter { it.status == "payee" || it.status == "retiree" }.take(60)
                if (visible.isEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    Text("Aucun achat payé ou retiré n'est enregistré.", color = Color(0xFF65776F), fontSize = 13.sp)
                }
                visible.forEach { PurchaseHistoryCard(it) }
                if (data.purchases.size > visible.size) {
                    Text("Les 60 dernières lignes d'achat sont affichées.", color = Color(0xFF87948E), fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun ReservationHistoryCard(item: ClientReservationHistory) {
    Card(Modifier.fillMaxWidth().padding(vertical = 5.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(14.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(item.pharmacy, color = NaxaInk, fontWeight = FontWeight.Bold)
                    Text("${if (item.mode == "commande") "Commande" else "Réservation"} · ${shortId(item.id)}", color = Color(0xFF65776F), fontSize = 11.sp)
                }
                Text(statusLabel(item.orderStatus ?: item.status), color = NaxaGreen, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
            }
            Spacer(Modifier.height(6.dp))
            Text("${formatDate(item.createdAt)} · ${money(item.total)}", color = Color(0xFF65776F), fontSize = 12.sp)
            Text("Paiement : ${statusLabel(item.paymentStatus)}", color = Color(0xFF65776F), fontSize = 12.sp)
            item.paymentReference?.takeIf { it.isNotBlank() }?.let {
                Text("Référence : $it", color = Color(0xFF65776F), fontSize = 11.sp)
            }
            if (item.events.isNotEmpty()) {
                Spacer(Modifier.height(9.dp))
                Text("Chronologie", color = NaxaInk, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                item.events.take(5).forEach { event ->
                    Text(
                        "• ${eventLabel(event.eventType)} · ${formatDate(event.occurredAt)}" +
                            (event.toStatus?.let { " · ${statusLabel(it)}" } ?: ""),
                        color = Color(0xFF65776F), fontSize = 11.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun PurchaseHistoryCard(item: ClientPurchaseLine) {
    Card(Modifier.fillMaxWidth().padding(vertical = 5.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(14.dp)) {
            Text(item.pharmacy, color = NaxaInk, fontWeight = FontWeight.Bold)
            Text("${item.medicine}${item.dosage?.let { " · $it" } ?: ""}${item.form?.let { " · $it" } ?: ""}", color = NaxaInk, fontSize = 14.sp)
            Text("Quantité : ${item.quantity} · ${money(item.lineTotal)}", color = Color(0xFF65776F), fontSize = 12.sp)
            Text("${formatDate(item.purchasedAt ?: item.createdAt)} · ${statusLabel(item.status)}", color = Color(0xFF65776F), fontSize = 11.sp)
            item.paymentReference?.takeIf { it.isNotBlank() }?.let {
                Text("Référence paiement : $it", color = Color(0xFF65776F), fontSize = 11.sp)
            }
        }
    }
}

private fun money(value: Long): String = NumberFormat.getIntegerInstance(Locale.FRANCE).format(value) + " FCFA"
private fun shortId(value: String): String = value.take(8).uppercase(Locale.ROOT)
private fun statusLabel(value: String): String = when (value.lowercase(Locale.ROOT)) {
    "en_attente" -> "En attente"
    "confirmee" -> "Confirmée"
    "payee", "effectue" -> "Payée"
    "retiree" -> "Retirée"
    "annulee", "annule", "cancelled" -> "Annulée"
    "expiree", "expired" -> "Expirée"
    "preparation" -> "En préparation"
    "prete" -> "Prête au retrait"
    "a_verifier", "pending" -> "À vérifier"
    else -> value.replace('_', ' ').replaceFirstChar { it.uppercase(Locale.FRENCH) }
}
private fun eventLabel(value: String): String = when (value) {
    "reservation_created" -> "Réservation créée"
    "status_changed" -> "Statut modifié"
    "payment_declared" -> "Paiement signalé"
    "payment_verified" -> "Paiement vérifié"
    "delivery_status_changed" -> "Commande mise à jour"
    else -> statusLabel(value)
}
private fun formatDate(value: String): String {
    if (value.isBlank()) return "Date non renseignée"
    return try {
        val instant = runCatching { Instant.parse(value) }.getOrElse { java.time.OffsetDateTime.parse(value).toInstant() }
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.FRANCE)
            .withZone(ZoneId.systemDefault()).format(instant)
    } catch (_: Exception) {
        value.take(16).replace('T', ' ')
    }
}
