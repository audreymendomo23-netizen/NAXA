package cm.naxa.app

import android.os.Bundle
import android.os.Build
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
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
        val ageGate = AgeGateStore(this)
        val fcmRegistration = FcmRegistrationRepository(SecureTokenStore(this))
        setContent { NaxaTheme { NaxaRoot(repository, catalogue, ageGate, fcmRegistration, onExit = { finish() }) } }
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
private fun NaxaRoot(
    repository: AuthRepository,
    catalogue: CatalogueRepository,
    ageGate: AgeGateStore,
    fcmRegistration: FcmRegistrationRepository,
    onExit: () -> Unit
) {
    var profile by remember { mutableStateOf<NaxaProfile?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var adultDeclared by remember { mutableStateOf(ageGate.isAdultDeclared()) }
    var guestMode by remember { mutableStateOf(false) }
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
            !adultDeclared -> AgeDeclarationScreen(
                onConfirm = {
                    ageGate.declareAdult()
                    adultDeclared = true
                },
                onDecline = onExit
            )
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = NaxaGreen)
            }
            profile == null && !guestMode -> LoginScreen(
                busy = loading,
                error = error,
                onLogin = { email, password ->
                    loading = true
                    error = null
                    scope.launch {
                        try {
                            profile = repository.signIn(email, password).profile
                        } catch (e: Exception) {
                            error = e.message ?: "Connexion impossible."
                        } finally {
                            loading = false
                        }
                    }
                },
                onGuest = { guestMode = true }
            )
            else -> NativeHome(
                profile = profile,
                catalogue = catalogue,
                fcmRegistration = fcmRegistration,
                isGuest = profile == null,
                onSignIn = { guestMode = false },
                onLogout = {
                    loading = true
                    scope.launch {
                        repository.signOut()
                        profile = null
                        guestMode = false
                        error = null
                        loading = false
                    }
                }
            )
        }
    }
}

@Composable
private fun AgeDeclarationScreen(onConfirm: () -> Unit, onDecline: () -> Unit) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Bienvenue sur NAXA", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
        Spacer(Modifier.height(16.dp))
        Text(
            "L'accès public à NAXA est réservé aux personnes majeures. Avant d'ouvrir l'espace visiteur, confirmez avoir 18 ans ou plus.",
            color = Color(0xFF50645B), fontSize = 15.sp
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Cette déclaration est enregistrée localement sur cet appareil. Elle ne remplace pas la vérification de majorité du compte, qui reste contrôlée par NAXA.",
            color = Color(0xFF7A8982), fontSize = 12.sp
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onConfirm, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text("Je confirme avoir 18 ans ou plus")
        }
        TextButton(onClick = onDecline, modifier = Modifier.fillMaxWidth()) {
            Text("Je ne suis pas majeur(e)")
        }
    }
}

@Composable
private fun LoginScreen(
    busy: Boolean,
    error: String?,
    onLogin: (String, String) -> Unit,
    onGuest: () -> Unit
) {
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
        TextButton(onClick = onGuest, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
            Text("Continuer en visiteur")
        }
        Text("Connexion Supabase sécurisée. Les jetons sont chiffrés dans Android Keystore.", color = Color(0xFF718078), fontSize = 12.sp)
    }
}

@Composable
private fun NativeHome(
    profile: NaxaProfile?,
    catalogue: CatalogueRepository,
    fcmRegistration: FcmRegistrationRepository,
    isGuest: Boolean,
    onSignIn: () -> Unit,
    onLogout: () -> Unit
) {
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
            Text(if (isGuest) "Mode visiteur" else "Votre espace NAXA est connecté.", color = Color(0xFF65776F))
            Spacer(Modifier.height(20.dp))
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(18.dp)) {
                    Text(if (isGuest) "Accès public" else "Compte connecté", color = NaxaGreen, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Text(if (isGuest) "Catalogue et informations publiques" else profile?.role ?: "Compte NAXA",
                        fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    if (profile != null) {
                        Text("Vérification de majorité confirmée", color = Color(0xFF65776F))
                    } else {
                        Text("Connectez-vous pour accéder aux fonctions liées à votre compte.", color = Color(0xFF65776F))
                    }
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
                2 -> {
                    if (profile == null) {
                        FeatureCard("Achats et commandes", "Connectez-vous pour consulter vos achats et vos commandes.")
                        TextButton(onClick = onSignIn) { Text("Se connecter") }
                    } else {
                        FeatureCard("Achats et commandes", "Le suivi sera relié aux services métier autorisés pour votre compte.")
                    }
                }
                else -> {
                    if (profile == null) {
                        FeatureCard("Profil", "Vous naviguez sans compte connecté.")
                        TextButton(onClick = onSignIn) { Text("Se connecter") }
                    } else {
                        FeatureCard("Profil", "Identifiant : ${profile.userId}")
                        NativeNotificationSettings(fcmRegistration)
                        TextButton(onClick = onLogout) { Text("Se déconnecter") }
                    }
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
private fun NativeNotificationSettings(repository: FcmRegistrationRepository) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) registerFcmToken(context, repository, scope, { busy = it }, { message = it })
        else message = "Autorisation refusée. Activez les notifications NAXA dans les réglages Android."
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text("Notifications Android", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = NaxaInk)
            Spacer(Modifier.height(5.dp))
            Text(
                "Recevez les alertes et mises à jour NAXA sur cet appareil.",
                color = Color(0xFF65776F), fontSize = 12.sp
            )
            Spacer(Modifier.height(10.dp))
            Button(
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    message = null
                    if (FirebaseApp.getApps(context).isEmpty()) {
                        message = "Le service de notifications n’est pas configuré pour cette version."
                    } else if (
                        Build.VERSION.SDK_INT >= 33 &&
                        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                            != PackageManager.PERMISSION_GRANTED
                    ) {
                        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        registerFcmToken(context, repository, scope, { busy = it }, { message = it })
                    }
                }
            ) {
                if (busy) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
                else Text("Activer les notifications")
            }
            if (message != null) {
                Spacer(Modifier.height(8.dp))
                Text(message!!, color = if (message!!.startsWith("Notifications activées")) NaxaGreen else MaterialTheme.colorScheme.error,
                    fontSize = 12.sp)
            }
        }
    }
}

private fun registerFcmToken(
    context: android.content.Context,
    repository: FcmRegistrationRepository,
    scope: kotlinx.coroutines.CoroutineScope,
    setBusy: (Boolean) -> Unit,
    setMessage: (String) -> Unit
) {
    setBusy(true)
    FirebaseMessaging.getInstance().token
        .addOnSuccessListener { token ->
            scope.launch {
                try {
                    repository.register(token)
                    context.getSharedPreferences(NaxaFirebaseMessagingService.PREFS, 0)
                        .edit().putString(NaxaFirebaseMessagingService.TOKEN_KEY, token).apply()
                    setMessage("Notifications activées sur cet appareil.")
                } catch (e: Exception) {
                    setMessage(e.message ?: "Enregistrement des notifications impossible.")
                } finally {
                    setBusy(false)
                }
            }
        }
        .addOnFailureListener { error ->
            setMessage(error.message ?: "Impossible d’obtenir le jeton Firebase.")
            setBusy(false)
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
