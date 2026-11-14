package cm.naxa.app

import android.os.Bundle
import android.content.Intent
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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Notifications
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
import org.json.JSONArray

class MainActivity : ComponentActivity() {
    private var pendingOpenPath by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingOpenPath = intent?.getStringExtra("openPath")
        val tokenStore = SecureTokenStore(this)
        val repository = AuthRepository(tokenStore)
        val clientHistory = ClientHistoryRepository(tokenStore)
        val adminDashboard = AdminDashboardRepository(tokenStore)
        val notifications = NativeNotificationsRepository(tokenStore)
        val catalogue = CatalogueRepository()
        val pharmacies = PharmacyRepository(this)
        val ageGate = AgeGateStore(this)
        val fcmRegistration = FcmRegistrationRepository(this, tokenStore)
        setContent {
            NaxaTheme {
                NaxaRoot(
                    repository, clientHistory, adminDashboard, notifications, catalogue,
                    pharmacies, ageGate, fcmRegistration,
                    openPath = pendingOpenPath,
                    onOpenPathHandled = { pendingOpenPath = null },
                    onExit = { finish() }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pendingOpenPath = intent.getStringExtra("openPath")
    }
}

internal val NaxaGreen = Color(0xFF087A55)
internal val NaxaInk = Color(0xFF17342B)
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
    clientHistory: ClientHistoryRepository,
    adminDashboard: AdminDashboardRepository,
    notificationsRepository: NativeNotificationsRepository,
    catalogue: CatalogueRepository,
    pharmacies: PharmacyRepository,
    ageGate: AgeGateStore,
    fcmRegistration: FcmRegistrationRepository,
    openPath: String?,
    onOpenPathHandled: () -> Unit,
    onExit: () -> Unit
) {
    val appContext = LocalContext.current
    var profile by remember { mutableStateOf<NaxaProfile?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var adultDeclared by remember { mutableStateOf(ageGate.isAdultDeclared()) }
    var guestMode by remember { mutableStateOf(false) }
    var showingNotifications by remember { mutableStateOf(false) }
    var showingSuiviBluetooth by remember { mutableStateOf(false) }
    var selectedClientTab by remember { mutableIntStateOf(0) }
    var searchPrefill by remember { mutableStateOf<String?>(null) }
    var deepLinkNavigationId by remember { mutableIntStateOf(0) }
    var deepLinkNotice by remember { mutableStateOf<String?>(null) }
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
    val currentProfile = profile
    LaunchedEffect(openPath, loading, currentProfile, guestMode, adultDeclared) {
        val path = openPath ?: return@LaunchedEffect
        if (!adultDeclared || loading) return@LaunchedEffect
        if (currentProfile == null && !guestMode) return@LaunchedEffect

        when (val destination = NaxaNativeDeepLinks.resolve(
            path, currentProfile?.activeWorkspace ?: "guest"
        )) {
            NaxaNativeDeepLink.Notifications -> {
                if (currentProfile != null) {
                    showingNotifications = true
                    deepLinkNotice = null
                } else {
                    deepLinkNotice = "Connectez-vous pour consulter vos notifications."
                }
            }
            NaxaNativeDeepLink.AdminDashboard -> {
                if (currentProfile != null &&
                    NaxaNativeRole.supportsAdminWorkspace(
                        currentProfile.effectiveRole, currentProfile.activeWorkspace
                    )
                ) {
                    showingNotifications = false
                    deepLinkNotice = null
                } else {
                    deepLinkNotice = "Le poste Admin n’est pas actif sur ce compte."
                }
            }
            is NaxaNativeDeepLink.ClientTab -> {
                if (currentProfile != null &&
                    NaxaNativeRole.supportsClientWorkspace(
                        currentProfile.effectiveRole, currentProfile.activeWorkspace
                    )
                ) {
                    showingNotifications = false
                    selectedClientTab = destination.index
                    searchPrefill = destination.query
                    deepLinkNavigationId += 1
                    deepLinkNotice = null
                } else {
                    deepLinkNotice = "Cette destination n’appartient pas à votre espace actif."
                }
            }
            is NaxaNativeDeepLink.Unsupported -> {
                showingNotifications = false
                deepLinkNotice = destination.reason
            }
        }
        onOpenPathHandled()
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
            currentProfile != null && showingNotifications ->
                NativeNotificationsScreen(
                    repository = notificationsRepository,
                    currentUserId = currentProfile.userId,
                    onBack = {
                        showingNotifications = false
                        deepLinkNotice = null
                    }
                )
            currentProfile != null && showingSuiviBluetooth ->
                NativeSuiviBluetoothScreen(
                    ownerUserId = currentProfile.userId,
                    onBack = { showingSuiviBluetooth = false }
                )
            currentProfile != null && NaxaNativeRole.supportsAdminWorkspace(currentProfile.effectiveRole, currentProfile.activeWorkspace) ->
                NativeAdminDashboardScreen(
                    repository = adminDashboard,
                    deepLinkNotice = deepLinkNotice,
                    onOpenNotifications = { showingNotifications = true },
                    onLogout = {
                        loading = true
                        scope.launch {
                            try { fcmRegistration.unregisterCurrentDevice() } catch (_: Exception) { }
                            NaxaBleForegroundService.stopForLogout(appContext)
                            repository.signOut()
                            profile = null
                            guestMode = false
                            error = null
                            loading = false
                        }
                    }
                )
            currentProfile != null && !NaxaNativeRole.supportsClientWorkspace(currentProfile.effectiveRole, currentProfile.activeWorkspace) ->
                UnsupportedNativeRoleScreen(
                    role = currentProfile.effectiveRole,
                    deepLinkNotice = deepLinkNotice,
                    onOpenNotifications = { showingNotifications = true },
                    onLogout = {
                        loading = true
                        scope.launch {
                            try { fcmRegistration.unregisterCurrentDevice() } catch (_: Exception) { }
                            NaxaBleForegroundService.stopForLogout(appContext)
                            repository.signOut()
                            profile = null
                            guestMode = false
                            error = null
                            loading = false
                        }
                    }
                )
            else -> NativeHome(
                profile = profile,
                clientHistory = clientHistory,
                catalogue = catalogue,
                pharmacies = pharmacies,
                fcmRegistration = fcmRegistration,
                initialTab = selectedClientTab,
                initialQuery = searchPrefill,
                navigationRequestId = deepLinkNavigationId,
                deepLinkNotice = deepLinkNotice,
                onOpenNotifications = {
                    if (profile != null) showingNotifications = true
                    else deepLinkNotice = "Connectez-vous pour consulter vos notifications."
                },
                isGuest = profile == null,
                onSignIn = { guestMode = false },
                onOpenSuiviBluetooth = {
                    if (profile != null) showingSuiviBluetooth = true
                    else deepLinkNotice = "Connectez-vous pour associer un dispositif Bluetooth à votre espace de suivi."
                },
                onLogout = {
                    loading = true
                    scope.launch {
                        try { fcmRegistration.unregisterCurrentDevice() } catch (_: Exception) { }
                        NaxaBleForegroundService.stopForLogout(appContext)
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
    clientHistory: ClientHistoryRepository,
    catalogue: CatalogueRepository,
    pharmacies: PharmacyRepository,
    fcmRegistration: FcmRegistrationRepository,
    initialTab: Int,
    initialQuery: String?,
    navigationRequestId: Int,
    deepLinkNotice: String?,
    onOpenNotifications: () -> Unit,
    isGuest: Boolean,
    onSignIn: () -> Unit,
    onOpenSuiviBluetooth: () -> Unit,
    onLogout: () -> Unit
) {
    var selected by remember { mutableIntStateOf(initialTab.coerceIn(0, 4)) }
    var cataloguePrefill by remember { mutableStateOf(initialQuery.orEmpty()) }
    LaunchedEffect(navigationRequestId) {
        selected = initialTab.coerceIn(0, 4)
        cataloguePrefill = initialQuery.orEmpty()
    }
    val labels = listOf("Accueil", "Rechercher", "Scanner", "Achats", "Profil")
    val icons = listOf(Icons.Default.Home, Icons.Default.Search, Icons.Default.CameraAlt, Icons.Default.ShoppingBag, Icons.Default.Person)
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
                IconButton(onClick = onOpenNotifications) {
                    Icon(Icons.Default.Notifications, contentDescription = "Notifications")
                }
                Text("FCFA", color = Color(0xFF66756E), fontSize = 12.sp)
            }
            deepLinkNotice?.let {
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF4D5))) {
                    Text(
                        it,
                        modifier = Modifier.padding(12.dp),
                        color = Color(0xFF694B00),
                        fontSize = 12.sp
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
            Text("Bonjour 👋", fontSize = 27.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
            Text(if (isGuest) "Mode visiteur" else "Votre espace NAXA est connecté.", color = Color(0xFF65776F))
            Spacer(Modifier.height(20.dp))
            Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(18.dp)) {
                    Text(if (isGuest) "Accès public" else "Compte connecté", color = NaxaGreen, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Text(if (isGuest) "Catalogue et informations publiques" else profile?.effectiveRole ?: "Compte NAXA",
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
                    PharmaciesScreen(pharmacies)
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable(enabled = !isGuest, onClick = onOpenSuiviBluetooth),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        shape = RoundedCornerShape(18.dp)
                    ) {
                        Column(Modifier.padding(16.dp)) {
                            Text("Suivi connecté", color = NaxaGreen, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Spacer(Modifier.height(5.dp))
                            Text("Associer un tensiomètre, oxymètre, thermomètre ou autre appareil Bluetooth compatible.", color = Color(0xFF65776F), fontSize = 13.sp)
                            if (isGuest) Text("Connexion requise", color = Color(0xFF9A6B00), fontSize = 12.sp)
                        }
                    }
                    FeatureCard("Dispositifs médicaux", "Catalogue des dispositifs médicaux.")
                }
                1 -> CatalogueScreen(
                    catalogue,
                    initialQuery = cataloguePrefill,
                    onInitialQueryConsumed = { cataloguePrefill = "" }
                )
                2 -> NativeScannerScreen(onSearchCatalog = { query ->
                    cataloguePrefill = query
                    selected = 1
                })
                3 -> {
                    if (profile == null) {
                        FeatureCard("Achats et commandes", "Connectez-vous pour consulter vos achats et vos commandes.")
                        TextButton(onClick = onSignIn) { Text("Se connecter") }
                    } else {
                        NativeClientHistoryScreen(clientHistory, profile.userId)
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



private data class NativeBleDevice(val id: String, val name: String, val rssi: Int)

@Composable
private fun NativeSuiviBluetoothScreen(ownerUserId: String, onBack: () -> Unit) {
    val context = LocalContext.current
    var selectedDeviceKey by remember { mutableStateOf("capteur_cardiaque_bluetooth") }
    var devices by remember { mutableStateOf<List<NativeBleDevice>>(emptyList()) }
    var connectedDevices by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var consentFamilies by remember { mutableStateOf<Set<String>>(emptySet()) }
    var consentLoaded by remember { mutableStateOf(false) }
    var consentBusy by remember { mutableStateOf(false) }
    val trackingRepository = remember { SuiviBluetoothRepository(SecureTokenStore(context)) }
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf("Vérification du consentement de suivi…") }
    var scanning by remember { mutableStateOf(false) }
    var pendingMeasurements by remember { mutableIntStateOf(0) }
    val seenMeasurementEvents = remember { mutableSetOf<String>() }
    var showDeviceTypes by remember { mutableStateOf(false) }
    val deviceTypes = listOf(
        "capteur_cardiaque_bluetooth" to "Fréquence cardiaque",
        "tensiometre" to "Tensiomètre",
        "thermometre" to "Thermomètre",
        "oxymetre" to "Oxymètre",
        "glucometre" to "Glucomètre",
        "balance" to "Balance connectée",
        "balance_impedance" to "Balance impédancemètre",
        "montre_connectee" to "Montre connectée",
        "bracelet_activite" to "Bracelet d’activité",
        "podometre" to "Podomètre"
    )
    val selectedFamily = when (selectedDeviceKey) {
        "tensiometre", "thermometre", "oxymetre", "capteur_cardiaque_bluetooth" -> "constantes"
        "glucometre", "balance", "balance_impedance" -> "metabolisme"
        "podometre", "montre_connectee", "bracelet_activite" -> "activite"
        else -> "constantes"
    }
    LaunchedEffect(ownerUserId) {
        try {
            consentFamilies = trackingRepository.loadGrantedFamilies(ownerUserId)
            consentLoaded = true
            status = "Consentements vérifiés. Choisissez une famille de mesures."
        } catch (error: Exception) {
            consentLoaded = false
            status = error.message ?: "Impossible de vérifier les consentements. Le Bluetooth reste bloqué."
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.all { it }) {
            devices = emptyList()
            scanning = true
            status = "Recherche Bluetooth en cours…"
            NaxaBleForegroundService.requestScan(context, ownerUserId)
        } else {
            scanning = false
            status = "Autorisation Bluetooth refusée. Autorisez la recherche et la connexion Bluetooth dans Android."
        }
    }

    LaunchedEffect(ownerUserId) {
        while (true) {
            try {
                val events = JSONArray(NaxaBleForegroundService.pendingEvents(context))
                for (index in 0 until events.length()) {
                    val event = events.optJSONObject(index) ?: continue
                    val eventId = event.optString("eventId")
                    val eventType = event.optString("type")
                    val eventOwner = event.optString("ownerUserId")
                    if (eventOwner.isNotBlank() && eventOwner != ownerUserId) continue
                    if (eventOwner.isBlank() && eventType != "queueOverflow") continue
                    when (eventType) {
                        "scanning" -> {
                            scanning = true
                            status = "Recherche Bluetooth en cours…"
                        }
                        "deviceFound" -> {
                            if (event.optString("ownerUserId") == ownerUserId) {
                                val id = event.optString("deviceId")
                                if (id.isNotBlank() && devices.none { it.id == id }) {
                                    devices = devices + NativeBleDevice(
                                        id, event.optString("deviceName", "Appareil Bluetooth"),
                                        event.optInt("rssi", 0)
                                    )
                                }
                            }
                        }
                        "scanFinished" -> {
                            scanning = false
                            status = if (devices.isEmpty()) "Aucun appareil détecté. Vérifiez qu’il est allumé et à proximité."
                                else "${devices.size} appareil(s) détecté(s). Sélectionnez celui à associer."
                        }
                        "connecting" -> status = "Connexion à ${event.optString("deviceName", "l’appareil")}…"
                        "connected" -> {
                            if (event.optString("ownerUserId") == ownerUserId) {
                                connectedDevices = connectedDevices + (event.optString("deviceId") to event.optString("deviceKey"))
                                status = "Connexion Bluetooth établie. Vérification des profils GATT en cours."
                            }
                        }
                        "profiles" -> {
                            if (event.optString("ownerUserId") == ownerUserId) {
                                status = if (event.optInt("profileCount") > 0) "Profils Bluetooth détectés. La liaison est active."
                                    else "Aucun profil GATT compatible avec cette famille. L’appareil va être déconnecté."
                                if (event.optInt("profileCount") <= 0) {
                                    NaxaBleForegroundService.requestDisconnect(context, event.optString("deviceId"))
                                    connectedDevices = connectedDevices - event.optString("deviceId")
                                }
                            }
                        }
                        "measurement" -> {
                            if (eventId.isNotBlank() && seenMeasurementEvents.add(eventId)) {
                                pendingMeasurements += 1
                            }
                        }
                        "reconnecting" -> status = "Reconnexion Bluetooth automatique en cours…"
                        "disconnected" -> {
                            connectedDevices = connectedDevices - event.optString("deviceId")
                            status = "Appareil déconnecté."
                        }
                        "error" -> status = event.optString("message", "Erreur Bluetooth.")
                        "queueOverflow" -> status = "Attention : la file Bluetooth a débordé. Vérifiez l’historique des mesures."
                    }
                    if (eventId.isNotBlank() && event.optString("type") != "measurement") {
                        NaxaBleForegroundService.acknowledgeEvents(context, setOf(eventId))
                    }
                }
            } catch (_: Exception) {
                status = "Lecture des événements Bluetooth impossible. Les événements non acquittés sont conservés."
            }
            kotlinx.coroutines.delay(1000)
        }
    }

    Column(
        Modifier.fillMaxSize().background(NaxaBackground).verticalScroll(rememberScrollState()).padding(20.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("Retour") }
            Spacer(Modifier.weight(1f))
            Text("SUIVI CONNECTÉ", color = NaxaGreen, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        }
        Spacer(Modifier.height(12.dp))
        Text("Appareils Bluetooth", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
        Text("La connexion est gérée par Android et le service Bluetooth natif de NAXA.", color = Color(0xFF65776F), fontSize = 13.sp)
        Spacer(Modifier.height(18.dp))
        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.padding(16.dp)) {
                Text("Consentement : ${selectedFamily}", fontWeight = FontWeight.SemiBold, color = NaxaInk)
                Text(
                    if (selectedFamily in consentFamilies) "Consentement actif pour cette famille de mesures."
                    else "Le consentement explicite est obligatoire avant toute recherche ou connexion Bluetooth.",
                    color = Color(0xFF65776F), fontSize = 12.sp
                )
                Spacer(Modifier.height(8.dp))
                if (selectedFamily !in consentFamilies) {
                    Button(
                        onClick = {
                            consentBusy = true
                            scope.launch {
                                try {
                                    trackingRepository.setFamilyConsent(ownerUserId, selectedFamily, true)
                                    consentFamilies = consentFamilies + selectedFamily
                                    status = "Consentement enregistré. Vous pouvez rechercher les appareils."
                                } catch (error: Exception) {
                                    status = error.message ?: "Le consentement n’a pas pu être enregistré."
                                } finally { consentBusy = false }
                            }
                        },
                        enabled = consentLoaded && !consentBusy,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(if (consentBusy) "Enregistrement…" else "Donner mon consentement") }
                } else {
                    TextButton(
                        onClick = {
                            consentBusy = true
                            scope.launch {
                                try {
                                    trackingRepository.setFamilyConsent(ownerUserId, selectedFamily, false)
                                    connectedDevices.filterValues { key ->
                                        when (key) {
                                            "tensiometre", "thermometre", "oxymetre", "capteur_cardiaque_bluetooth" -> "constantes"
                                            "glucometre", "balance", "balance_impedance" -> "metabolisme"
                                            else -> "activite"
                                        } == selectedFamily
                                    }.keys.forEach { NaxaBleForegroundService.requestDisconnect(context, it) }
                                    connectedDevices = connectedDevices.filterValues { key ->
                                        when (key) {
                                            "tensiometre", "thermometre", "oxymetre", "capteur_cardiaque_bluetooth" -> "constantes"
                                            "glucometre", "balance", "balance_impedance" -> "metabolisme"
                                            else -> "activite"
                                        } != selectedFamily
                                    }
                                    consentFamilies = consentFamilies - selectedFamily
                                    status = "Consentement retiré. Les connexions de cette famille sont arrêtées."
                                } catch (error: Exception) {
                                    status = error.message ?: "Le retrait du consentement n’a pas abouti."
                                } finally { consentBusy = false }
                            }
                        },
                        enabled = !consentBusy,
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Retirer mon consentement") }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Card(colors = CardDefaults.cardColors(containerColor = Color.White), shape = RoundedCornerShape(18.dp)) {
            Column(Modifier.padding(16.dp)) {
                Text("Famille de mesures", fontWeight = FontWeight.SemiBold, color = NaxaInk)
                Box {
                    OutlinedButton(onClick = { showDeviceTypes = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(deviceTypes.firstOrNull { it.first == selectedDeviceKey }?.second ?: "Choisir un appareil")
                    }
                    DropdownMenu(expanded = showDeviceTypes, onDismissRequest = { showDeviceTypes = false }) {
                        deviceTypes.forEach { (key, label) ->
                            DropdownMenuItem(text = { Text(label) }, onClick = {
                                selectedDeviceKey = key
                                showDeviceTypes = false
                            })
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = {
                        val permissions = if (Build.VERSION.SDK_INT >= 31) {
                            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
                        } else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
                        val missing = permissions.filter {
                            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
                        }
                        if (missing.isEmpty()) {
                            devices = emptyList()
                            scanning = true
                            status = "Recherche Bluetooth en cours…"
                            NaxaBleForegroundService.requestScan(context, ownerUserId)
                        } else permissionLauncher.launch(missing.toTypedArray())
                    },
                    enabled = !scanning && consentLoaded && selectedFamily in consentFamilies,
                    modifier = Modifier.fillMaxWidth()
                ) { Text(if (scanning) "Recherche en cours…" else "Rechercher les appareils") }
                Spacer(Modifier.height(10.dp))
                Text(status, color = Color(0xFF65776F), fontSize = 13.sp)
            }
        }
        Spacer(Modifier.height(16.dp))
        Text("Appareils détectés", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = NaxaInk)
        if (devices.isEmpty()) {
            Text("Les appareils compatibles apparaîtront ici après la recherche.", color = Color(0xFF65776F), fontSize = 13.sp, modifier = Modifier.padding(vertical = 12.dp))
        } else {
            devices.forEach { device ->
                Card(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(device.name, fontWeight = FontWeight.SemiBold, color = NaxaInk)
                            Text("Signal Bluetooth : ${device.rssi} dBm", color = Color(0xFF65776F), fontSize = 12.sp)
                        }
                        Button(
                            onClick = {
                                NaxaBleForegroundService.requestConnect(context, device.id, selectedDeviceKey, ownerUserId)
                                status = "Demande de connexion envoyée à Android…"
                            },
                            enabled = device.id !in connectedDevices
                        ) { Text(if (device.id in connectedDevices) "Connecté" else "Associer") }
                    }
                }
            }
        }
        if (pendingMeasurements > 0) {
            Spacer(Modifier.height(12.dp))
            Text(
                "$pendingMeasurements événement(s) de mesure attendent encore le moteur de synchronisation NAXA.",
                color = Color(0xFF9A6B00), fontSize = 12.sp
            )
        }
        Spacer(Modifier.height(12.dp))
        Text(
            "La détection et l’association Android sont raccordées. Le traitement et l’enregistrement des événements de mesure dans l’historique doivent encore être validés avant activation complète.",
            color = Color(0xFF65776F), fontSize = 12.sp
        )
    }
}

@Composable
private fun CatalogueScreen(
    repository: CatalogueRepository,
    initialQuery: String = "",
    onInitialQueryConsumed: () -> Unit = {}
) {
    var query by remember { mutableStateOf("") }
    var medicines by remember { mutableStateOf<List<NativeMedicine>>(emptyList()) }
    var notice by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var searched by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(initialQuery) {
        if (initialQuery.isNotBlank()) {
            query = initialQuery
            onInitialQueryConsumed()
        }
    }

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
private fun PharmaciesScreen(repository: PharmacyRepository) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var pharmacies by remember { mutableStateOf<List<NearbyPharmacy>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var searched by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var routeMessage by remember { mutableStateOf<String?>(null) }

    fun searchNearby() {
        loading = true
        searched = true
        error = null
        routeMessage = null
        scope.launch {
            try {
                val coordinates = repository.currentLocation()
                pharmacies = repository.nearby(coordinates)
                if (pharmacies.isEmpty()) {
                    routeMessage = "Aucune pharmacie partenaire géolocalisée n'est disponible dans ce secteur."
                }
            } catch (e: Exception) {
                pharmacies = emptyList()
                error = e.message ?: "Recherche des pharmacies impossible."
            } finally {
                loading = false
            }
        }
    }

    val locationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) searchNearby()
        else error = "La localisation est nécessaire pour rechercher les pharmacies proches."
    }

    Column(Modifier.fillMaxWidth()) {
        Text("Pharmacies proches", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
        Spacer(Modifier.height(6.dp))
        Text("Pharmacies partenaires réelles, sans établissements de démonstration.", color = Color(0xFF65776F), fontSize = 13.sp)
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = {
                val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                if (fine || coarse) searchNearby()
                else locationPermission.launch(arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ))
            },
            enabled = !loading,
            modifier = Modifier.fillMaxWidth().height(48.dp)
        ) {
            if (loading) CircularProgressIndicator(Modifier.size(18.dp), color = Color.White, strokeWidth = 2.dp)
            else Text("Rechercher autour de moi")
        }
        if (error != null) {
            Spacer(Modifier.height(10.dp))
            Text(error!!, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
        }
        if (routeMessage != null) {
            Spacer(Modifier.height(10.dp))
            Text(routeMessage!!, color = Color(0xFF65776F), fontSize = 12.sp)
        }
        if (searched && !loading && error == null && pharmacies.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Text("${pharmacies.size} pharmacie(s) trouvée(s)", color = NaxaGreen, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        }
        pharmacies.forEach { pharmacy -> NearbyPharmacyCard(pharmacy) }
    }
}

@Composable
private fun NearbyPharmacyCard(pharmacy: NearbyPharmacy) {
    val distance = pharmacy.distanceRoadKm?.let { "${"%.1f".format(Locale.FRENCH, it)} km par la route" }
        ?: pharmacy.distanceStraightKm?.let { "${"%.1f".format(Locale.FRENCH, it)} km à vol d'oiseau" }
        ?: "Distance indisponible"
    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(18.dp)
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(pharmacy.name, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = NaxaInk)
            val place = listOfNotNull(pharmacy.district, pharmacy.city).joinToString(" · ")
            if (place.isNotBlank()) Text(place, color = Color(0xFF65776F), fontSize = 12.sp)
            pharmacy.address?.let { Text(it, color = Color(0xFF65776F), fontSize = 12.sp) }
            Spacer(Modifier.height(8.dp))
            Text(distance, color = NaxaGreen, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            pharmacy.travelMinutes?.let { Text("Environ $it min de trajet", color = Color(0xFF65776F), fontSize = 12.sp) }
            pharmacy.openingHours?.let { Text("Horaires : $it", color = Color(0xFF65776F), fontSize = 12.sp) }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (pharmacy.onDuty) Text("De garde", color = Color(0xFF8A6B1C), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                if (pharmacy.deliveryAvailable) Text("Livraison proposée", color = NaxaGreen, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
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

@Composable
private fun UnsupportedNativeRoleScreen(
    role: String,
    deepLinkNotice: String?,
    onOpenNotifications: () -> Unit,
    onLogout: () -> Unit
) {
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("Espace professionnel NAXA", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = NaxaInk)
        Spacer(Modifier.height(12.dp))
        Text("Votre compte est authentifié avec le rôle « $role », mais cet espace professionnel n’est pas encore disponible dans cette version Android.", color = Color(0xFF50645B))
        deepLinkNotice?.let {
            Spacer(Modifier.height(10.dp))
            Text(it, color = Color(0xFF8A4B00), fontSize = 13.sp)
        }
        Spacer(Modifier.height(10.dp))
        Text("Par sécurité, aucun écran Client ni aucune donnée d’un autre espace ne sont affichés. Vos autorisations restent contrôlées par le serveur NAXA.", color = Color(0xFF65776F), fontSize = 13.sp)
        Spacer(Modifier.height(24.dp))
        OutlinedButton(onClick = onOpenNotifications, modifier = Modifier.fillMaxWidth()) {
            Text("Ouvrir les notifications")
        }
        Spacer(Modifier.height(8.dp))
        Button(onClick = onLogout, modifier = Modifier.fillMaxWidth().height(50.dp)) {
            Text("Se déconnecter")
        }
    }
}
