package cm.naxa.app

import androidx.compose.foundation.background
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

private val NotificationGreen = Color(0xFF087A55)
private val NotificationInk = Color(0xFF17342B)
private val NotificationBackground = Color(0xFFF3F7F4)

@Composable
internal fun NativeNotificationsScreen(
    repository: NativeNotificationsRepository,
    onBack: () -> Unit
) {
    var items by remember { mutableStateOf<List<NaxaNotificationItem>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val unreadCount = items.count { it.readAt == null }

    suspend fun refresh() {
        loading = true
        error = null
        try {
            items = repository.load()
        } catch (exception: Exception) {
            error = exception.message ?: "Notifications indisponibles."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(Unit) { refresh() }

    Surface(modifier = Modifier.fillMaxSize(), color = NotificationBackground) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "NAXA  /  MESSAGES",
                        color = NotificationGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.1.sp
                    )
                    Text(
                        "Notifications",
                        color = NotificationInk,
                        fontSize = 27.sp,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
                OutlinedButton(onClick = onBack) { Text("Retour") }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "$unreadCount non lue(s)",
                    color = NotificationInk.copy(alpha = 0.72f),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
                OutlinedButton(onClick = { scope.launch { refresh() } }, enabled = !loading) {
                    Text("Actualiser")
                }
            }

            error?.let { message ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFFE9E7)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(message, color = Color(0xFF8A2018), fontSize = 13.sp)
                        Button(
                            onClick = { scope.launch { refresh() } },
                            enabled = !loading,
                            colors = ButtonDefaults.buttonColors(containerColor = NotificationGreen)
                        ) { Text("Réessayer") }
                    }
                }
            }

            if (loading && items.isEmpty()) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 34.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    CircularProgressIndicator(color = NotificationGreen)
                }
            } else if (items.isEmpty() && error == null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(Modifier.padding(18.dp)) {
                        Text("Aucune notification", color = NotificationInk, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Les messages et mises à jour liés à votre compte ou à votre périmètre autorisé apparaîtront ici.",
                            color = NotificationInk.copy(alpha = 0.68f),
                            fontSize = 13.sp
                        )
                    }
                }
            }

            items.forEach { item ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(15.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(15.dp),
                        verticalArrangement = Arrangement.spacedBy(7.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                item.title,
                                modifier = Modifier.weight(1f),
                                color = NotificationInk,
                                fontWeight = FontWeight.Bold
                            )
                            if (item.readAt == null) {
                                Surface(
                                    color = Color(0xFFFFF0B8),
                                    shape = RoundedCornerShape(50)
                                ) {
                                    Text(
                                        "Non lue",
                                        modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                                        color = Color(0xFF6B5000),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                        Text(item.body, color = NotificationInk.copy(alpha = 0.82f), fontSize = 13.sp)
                        Text(
                            item.createdAt,
                            color = NotificationInk.copy(alpha = 0.55f),
                            fontSize = 10.sp
                        )
                        if (item.readAt == null) {
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        try {
                                            val marked = repository.markRead(item.id)
                                            if (marked) {
                                                items = items.map { row ->
                                                    if (row.id == item.id) row.copy(readAt = "lu") else row
                                                }
                                                error = null
                                            } else {
                                                error = "La notification n’a pas pu être marquée comme lue."
                                            }
                                        } catch (exception: Exception) {
                                            error = exception.message ?: "Mise à jour impossible."
                                        }
                                    }
                                }
                            ) {
                                Text("Marquer comme lue")
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            Text(
                "Les données affichées sont limitées par les autorisations du compte connecté.",
                color = NotificationInk.copy(alpha = 0.55f),
                fontSize = 11.sp
            )
        }
    }
}
