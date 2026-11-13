package cm.naxa.app

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import kotlinx.coroutines.launch
import java.io.File

@Composable
internal fun NativeScannerScreen(onSearchCatalog: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = remember { ScannerRepository() }
    var pendingCameraUri by remember { mutableStateOf<Uri?>(null) }
    var pendingCameraFile by remember { mutableStateOf<File?>(null) }
    var scanning by remember { mutableStateOf(false) }
    var extractedText by remember { mutableStateOf("") }
    var medicineQuery by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var pageSummary by remember { mutableStateOf<String?>(null) }

    fun analyze(uri: Uri) {
        scanning = true
        message = null
        extractedText = ""
        medicineQuery = ""
        pageSummary = null
        scope.launch {
            try {
                val result = repository.scan(context, uri)
                extractedText = result.text
                pageSummary = if (result.pagesProcessed > 1) {
                    "${result.pagesProcessed} pages analysées localement."
                } else {
                    "Document analysé localement."
                }
                if (result.pageLimitReached) {
                    message = "Le PDF contient plus de 10 pages. Seules les 10 premières ont été analysées."
                } else if (result.text.isBlank()) {
                    message = "Aucun texte lisible détecté. Reprenez la photo avec davantage de lumière et une mise au point nette."
                }
            } catch (error: Exception) {
                message = error.message ?: "Lecture impossible. Essayez une image ou un PDF plus net."
            } finally {
                if (uri == pendingCameraUri) {
                    pendingCameraFile?.delete()
                    pendingCameraFile = null
                    pendingCameraUri = null
                }
                scanning = false
            }
        }
    }

    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { saved ->
        val uri = pendingCameraUri
        if (saved && uri != null) {
            analyze(uri)
        } else {
            pendingCameraFile?.delete()
            pendingCameraFile = null
            pendingCameraUri = null
            message = "La prise de photo a été annulée."
        }
    }

    val documentLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) analyze(uri)
    }

    Column(Modifier.fillMaxWidth()) {
        Text("Scanner une ordonnance ou une boîte", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
        Spacer(Modifier.height(6.dp))
        Text(
            "Photographiez le document ou choisissez une image / un PDF. Le texte est reconnu sur le téléphone.",
            color = Color(0xFF65776F), fontSize = 13.sp
        )
        Spacer(Modifier.height(14.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                enabled = !scanning,
                modifier = Modifier.weight(1f),
                onClick = {
                    try {
                        val folder = File(context.cacheDir, "scanner")
                        if (!folder.exists() && !folder.mkdirs()) {
                            throw IllegalStateException("Impossible de préparer la caméra.")
                        }
                        val photo = File.createTempFile("naxa-scan-", ".jpg", folder)
                        val uri = FileProvider.getUriForFile(
                            context,
                            context.packageName + ".fileprovider",
                            photo
                        )
                        pendingCameraFile = photo
                        pendingCameraUri = uri
                        cameraLauncher.launch(uri)
                    } catch (error: Exception) {
                        pendingCameraFile?.delete()
                        pendingCameraFile = null
                        pendingCameraUri = null
                        message = error.message ?: "Impossible d'ouvrir la caméra."
                    }
                }
            ) {
                Text("Prendre une photo")
            }
            Button(
                enabled = !scanning,
                modifier = Modifier.weight(1f),
                onClick = { documentLauncher.launch(arrayOf("image/*", "application/pdf")) }
            ) {
                Text("Galerie / PDF")
            }
        }

        if (scanning) {
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                Text("Reconnaissance du texte…", color = NaxaGreen, fontSize = 13.sp)
            }
        }

        if (message != null) {
            Spacer(Modifier.height(12.dp))
            Text(message!!, color = if (extractedText.isNotBlank()) Color(0xFF8A6B1C) else MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }

        if (pageSummary != null) {
            Spacer(Modifier.height(10.dp))
            Text(pageSummary!!, color = NaxaGreen, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }

        if (extractedText.isNotBlank()) {
            Spacer(Modifier.height(12.dp))
            Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(14.dp)) {
                    Text("Texte reconnu — conservé sur le téléphone", fontWeight = FontWeight.Bold, color = NaxaInk)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = extractedText,
                        onValueChange = { extractedText = it },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 5,
                        maxLines = 10
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Saisissez uniquement le nom du médicament à rechercher. Ne transmettez pas le texte personnel de l'ordonnance.",
                        color = Color(0xFF65776F), fontSize = 11.sp
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = medicineQuery,
                        onValueChange = { medicineQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Nom du médicament ou substance") },
                        singleLine = true
                    )
                    Spacer(Modifier.height(10.dp))
                    Button(
                        enabled = !scanning && medicineQuery.trim().length >= 2,
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { onSearchCatalog(medicineQuery.trim().take(100)) }
                    ) {
                        Text("Rechercher ce médicament")
                    }
                }
            }
        }

        Spacer(Modifier.height(10.dp))
        Text(
            "Confidentialité : le document original et le texte OCR ne sont pas envoyés automatiquement. Seul le nom que vous saisissez dans le champ de recherche est transmis au catalogue.",
            color = Color(0xFF87948E), fontSize = 11.sp
        )
    }
}
