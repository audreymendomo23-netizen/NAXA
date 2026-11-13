package cm.naxa.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repository = AuthRepository(SecureTokenStore(this))
        val catalogue = CatalogueRepository()
        setContent { NaxaTheme { NaxaRoot(repository, catalogue) } }
    }
}

private val NaxaGreen = Color(0xFF087A55)
private val NaxaInk = Color(0xFF17342B)
private val NaxaBackground = Color(0xFFF5F8F6)

@Composable
private fun NaxaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = lightColorScheme(
        primary = NaxaGreen, onPrimary = Color.White, secondary = Color(0xFFF2C94C),
        background = NaxaBackground, surface = Color.White, onSurface = NaxaInk
    ), content = content)
}

@Composable
private fun NaxaRoot(repository: AuthRepository, catalogue: CatalogueRepository) {
    var profile by remember { mutableStateOf<NaxaProfile?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        try {
            profile = repository.restoreSession()
        } catch (e: Exception) {
            error = e.message ?: "Impossible de vérifier la session. Vérifiez votre connexion."
        } finally {
            loading = false
        }
    }
    Surface(Modifier.fillMaxSize(), color = NaxaBackground) {
        when {
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = NaxaGreen)
            }
            profile == null -> LoginScreen(busy = loading, error = error, onLogin = { email, password ->
                loading = true
                error = null
                scope.launch {
                    try { profile = repository.signIn(email, password).profile }
                    catch (e: Exception) { error = e.message ?: "Connexion impossible." }
                    finally { loading = false }
                }
            })
            else -> NativeHome(profile!!, catalogue, onLogout = {
                loading = true
                scope.launch {
                    repository.signOut()
                    profile = null
                    error = null
                    loading = false
                }
            })
        }
    }
}

@Composable
private fun LoginScreen(busy: Boolean, error: String?, onLogin: (String, String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Box(Modifier.size(64.dp).background(NaxaGreen, RoundedCornerShape(20.dp)), contentAlignment = Alignment.Center) {
            Text("N", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(24.dp))
        Text("Bienvenue sur NAXA", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
        Spacer(Modifier.height(8.dp))
        Text("Votre espace santé, pharmacie et services de proximité.", color = Color(0xFF60736B))
        Spacer(Modifier.height(32.dp))
        OutlinedTextField(email, { email = it }, Modifier.fillMaxWidth(), label = { Text("Adresse e-mail") }, singleLine = true)
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("Mot de passe") },
            singleLine = true, visualTransformation = PasswordVisualTransformation())
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(20.dp))
        Button(onClick = { onLogin(email, password) },
            enabled = !busy && email.contains("@") && password.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(52.dp)) {
            if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
            else Text("Se connecter")
        }
        Spacer(Modifier.height(20.dp))
        Text("Connexion Supabase sécurisée. Les jetons sont chiffrés dans Android Keystore.", color = Color(0xFF718078), fontSize = 12.sp)
    }
}

@Composable
private fun NativeHome(profile: NaxaProfile, catalogue: CatalogueRepository, onLogout: () -> Unit) {
    var selected by remember { mutableIntStateOf(0) }
    val labels = listOf("Accueil", "Rechercher", "Achats", "Profil")
    val icons = listOf(Icons.Default.Home, Icons.Default.Search, Icons.Default.ShoppingBag, Icons.Default.Person)
    Scaffold(bottomBar = {
        NavigationBar(containerColor = Color.White) {
            labels.forEachIndexed { index, label ->
                NavigationBarItem(selected == index, { selected = index },
                    icon = { Icon(icons[index], contentDescription = label) }, label = { Text(label) })
            }
        }
    }, containerColor = NaxaBackground) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("NAXA", fontSize = 25.sp, fontWeight = FontWeight.ExtraBold, color = NaxaGreen)
                Spacer(Modifier.weight(1f))
                Text("FCFA", color = Color(0xFF66756E), fontSize = 12.sp)
            }
            Spacer(Modifier.height(24.dp))
            Text("Bonjour 👋", fontSize = 27.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
            Text("Votre espace NAXA est connecté.", color = Color(0xFF65776F))
            Spacer(Modifier.height(20.dp))
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(18.dp)) {
                    Text("Compte connecté", color = NaxaGreen, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Text(profile.role.ifBlank { "Compte NAXA" }, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Text(if (profile.ageVerified) "Vérification d’âge confirmée" else "Vérification d’âge à compléter",
                        color = Color(0xFF65776F))
                }
            }
            Spacer(Modifier.height(18.dp))
            when (selected) {
                0 -> {
                    Text("Vos services", fontSize = 19.sp, fontWeight = FontWeight.Bold)
                    FeatureCard("Pharmacies", "Accès aux pharmacies partenaires et disponibilités.")
                    FeatureCard("Dispositifs médicaux", "Catalogue des dispositifs médicaux.")
                    FeatureCard("Scanner", "Le scanner natif caméra et ordonnance sera intégré dans le prochain lot.")
                }
                1 -> CatalogueScreen(catalogue)
                2 -> FeatureCard("Achats et commandes", "Le suivi sera relié aux services métier autorisés pour votre compte.")
                else -> {
                    FeatureCard("Profil", "Identifiant : ${profile.userId}")
                    TextButton(onClick = onLogout) { Text("Se déconnecter") }
                }
            }
            Spacer(Modifier.height(20.dp))
            Text("Android natif · première version", color = Color(0xFF87948E), fontSize = 11.sp)
        }
    }
}


@Composable
private fun CatalogueScreen(repository: CatalogueRepository) {
    var query by remember { mutableStateOf("") }
    var medicines by remember { mutableStateOf<List<NativeMedicine>>(emptyList()) }
    var notice by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var searched by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(Modifier.fillMaxWidth()) {
        Text("Catalogue médicaments", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
        Spacer(Modifier.height(6.dp))
        Text("Recherche dans les référentiels NAXA et les fiches publiques vérifiées.", color = Color(0xFF65776F), fontSize = 13.sp)
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = query,
            onValueChange = { query = it; error = null },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Nom du médicament ou substance") },
            singleLine = true
        )
        Spacer(Modifier.height(10.dp))
        Button(
            onClick = {
                loading = true
                error = null
                searched = true
                scope.launch {
                    try {
                        val response = repository.search(query)
                        medicines = response.medicines
                        notice = response.notice
                        if (response.barcodeLookup) {
                            error = "Code-barres détecté. Utilisez le scanner dédié pour rechercher ce code."
                        }
                    } catch (e: Exception) {
                        medicines = emptyList()
                        error = e.message ?: "Recherche indisponible. Réessayez."
                    } finally {
                        loading = false
                    }
                }
            },
            enabled = !loading && query.trim().length >= 2,
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            if (loading) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
            else Text("Rechercher")
        }
        if (error != null) {
            Spacer(Modifier.height(12.dp))
            Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
        if (searched && !loading && error == null && medicines.isEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text("Aucun résultat retourné pour cette recherche.", color = Color(0xFF65776F), fontSize = 13.sp)
        }
        Spacer(Modifier.height(14.dp))
        medicines.forEach { medicine -> MedicineCard(medicine) }
        if (notice != null && medicines.isNotEmpty()) {
            Spacer(Modifier.height(10.dp))
            Text(notice!!, color = Color(0xFF7A8982), fontSize = 11.sp)
        }
    }
}

@Composable
private fun MedicineCard(medicine: NativeMedicine) {
    val availabilityLabel = when (medicine.availability) {
        "disponible" -> "Stock partenaire confirmé"
        "indisponible" -> "Aucun stock partenaire confirmé"
        else -> "Disponibilité non vérifiée"
    }
    val priceLabel = medicine.lowestPartnerPrice?.let {
        "À partir de " + NumberFormat.getIntegerInstance(Locale("fr", "CM")).format(it) + " FCFA"
    }
    Card(
        modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(medicine.name, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = NaxaInk)
            medicine.activeIngredient?.let {
                Spacer(Modifier.height(3.dp))
                Text("Substance : $it", color = Color(0xFF65776F), fontSize = 12.sp)
            }
            medicine.form?.let {
                Spacer(Modifier.height(2.dp))
                Text("Forme : $it", color = Color(0xFF65776F), fontSize = 12.sp)
            }
            medicine.definition?.let {
                Spacer(Modifier.height(7.dp))
                Text(it, color = Color(0xFF50645B), fontSize = 13.sp)
            }
            Spacer(Modifier.height(10.dp))
            Text(availabilityLabel, color = if (medicine.availability == "disponible") NaxaGreen else Color(0xFF8A6B1C),
                fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
            if (medicine.partnerPharmacyCount != null) {
                Text("${medicine.partnerPharmacyCount} pharmacie(s) partenaire(s)", color = Color(0xFF65776F), fontSize = 12.sp)
            }
            if (priceLabel != null && medicine.availability == "disponible") {
                Spacer(Modifier.height(4.dp))
                Text(priceLabel, color = NaxaGreen, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
            Text("Les prix et stocks ne sont affichés que lorsqu'ils sont vérifiés côté NAXA.",
                color = Color(0xFF87948E), fontSize = 10.sp)
        }
    }
}

@Composable
private fun FeatureCard(title: String, description: String) {
    Card(Modifier.fillMaxWidth().padding(top = 10.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp, color = NaxaInk)
            Spacer(Modifier.height(5.dp))
            Text(description, color = Color(0xFF65776F), fontSize = 13.sp)
        }
    }
}
