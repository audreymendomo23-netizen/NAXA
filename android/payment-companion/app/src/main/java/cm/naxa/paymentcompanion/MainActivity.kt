package cm.naxa.paymentcompanion

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.ComponentName
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.widget.*
import java.util.concurrent.Executors

class MainActivity : Activity() {
    companion object { private const val REQUEST_RECEIVE_SMS = 401 }
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var naxaUrl: EditText
    private lateinit var supabaseUrl: EditText
    private lateinit var anonKey: EditText
    private lateinit var email: EditText
    private lateinit var password: EditText
    private lateinit var roleGroup: RadioGroup
    private lateinit var statusText: TextView
    private lateinit var connectButton: Button
    private var smsConsent: CheckBox? = null
    private var smsStatusText: TextView? = null
    private var channelSpinner: Spinner? = null
    private var promoterRadioId: Int = View.NO_ID
    private var clientRadioId: Int = View.NO_ID
    private var partnerRadioId: Int = View.NO_ID
    private var pharmacyRadioId: Int = View.NO_ID
    private var notificationConsent: CheckBox? = null
    private var notificationControls: LinearLayout? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(28))
        }
        scroll.addView(root)
        root.addView(TextView(this).apply {
            text = "NAXA · Paiement"
            textSize = 23f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = when {
                BuildConfig.ADMIN_CAPTURE_ENABLED ->
                    "Compagnon Administrateur : collecte facultative des SMS de crédit NAXA."
                BuildConfig.PROFESSIONAL_CAPTURE_ENABLED ->
                    "Pharmacie / Partenaire : collecte facultative des SMS reçus sur le téléphone marchand, en plus des notifications applicatives."
                else ->
                    "Client / Promoteur : partage volontaire des SMS uniquement ; aucun accès SMS ou notifications en arrière-plan."
            }
            textSize = 14f
            setPadding(0, dp(8), 0, dp(18))
        })

        naxaUrl = addField(root, "URL de l'espace NAXA (HTTPS)", "https://votre-domaine-naxa")
        naxaUrl.setText("https://nnaxa.vercel.app")
        supabaseUrl = addField(root, "URL Supabase", "https://votre-projet.supabase.co")
        anonKey = addField(root, "Clé publique Supabase (anon / publishable)", "")
        email = addField(root, "Adresse e-mail NAXA", "")
        password = addField(root, "Mot de passe", "").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }

        root.addView(TextView(this).apply {
            text = "Profil NAXA"
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dp(16), 0, dp(6))
        })
        roleGroup = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        when {
            BuildConfig.ADMIN_CAPTURE_ENABLED -> {
                roleGroup.addView(RadioButton(this).apply {
                    id = View.generateViewId()
                    text = "Administrateur · téléphone bénéficiaire NAXA"
                    isChecked = true
                })
            }
            BuildConfig.PROFESSIONAL_CAPTURE_ENABLED -> {
                val pharmacy = RadioButton(this).apply {
                    id = View.generateViewId()
                    text = "Pharmacie · paiement / réception de l'établissement"
                    isChecked = true
                }
                pharmacyRadioId = pharmacy.id
                val partner = RadioButton(this).apply {
                    id = View.generateViewId()
                    text = "Partenaire · paiement d'abonnement"
                }
                partnerRadioId = partner.id
                roleGroup.addView(pharmacy)
                roleGroup.addView(partner)
            }
            else -> {
                val client = RadioButton(this).apply {
                    id = View.generateViewId()
                    text = "Client · paiement d'une commande pharmacie"
                    isChecked = true
                }
                clientRadioId = client.id
                val promoter = RadioButton(this).apply {
                    id = View.generateViewId()
                    text = "Promoteur · abonnement NAXA"
                }
                promoterRadioId = promoter.id
                roleGroup.addView(client)
                roleGroup.addView(promoter)
            }
        }
        root.addView(roleGroup)

        if (BuildConfig.ADMIN_CAPTURE_ENABLED || BuildConfig.PROFESSIONAL_CAPTURE_ENABLED) {
            createSmsConsentControls(root)
        }

        if (BuildConfig.ADMIN_CAPTURE_ENABLED || BuildConfig.PROFESSIONAL_CAPTURE_ENABLED) {
            createNotificationControls(root, alwaysVisible = true)
        }

        connectButton = Button(this).apply {
            text = "Connecter et enrôler ce téléphone"
            setOnClickListener { connectAndEnroll() }
        }
        root.addView(connectButton)

        statusText = TextView(this).apply {
            textSize = 13f
            setPadding(0, dp(16), 0, dp(8))
        }
        root.addView(statusText)

        if (BuildConfig.ADMIN_CAPTURE_ENABLED || BuildConfig.PROFESSIONAL_CAPTURE_ENABLED) {
            root.addView(Button(this).apply {
                text = "Activer / réessayer l'autorisation Android SMS"
                setOnClickListener { requestSmsPermission() }
            })
            if (BuildConfig.ADMIN_CAPTURE_ENABLED) {
                root.addView(Button(this).apply {
                    text = "Aide : partager un SMS de crédit"
                    setOnClickListener { openShareForm() }
                })
            }
        }
        if (!BuildConfig.ADMIN_CAPTURE_ENABLED) {
            if (promoterRadioId != View.NO_ID) {
                root.addView(TextView(this).apply {
                    text = "Préparer un abonnement Promoteur"
                    setTypeface(Typeface.DEFAULT, Typeface.BOLD)
                    setPadding(0, dp(18), 0, dp(4))
                })
                val channels = arrayOf("Orange Money", "MTN Mobile Money")
                channelSpinner = Spinner(this).apply {
                    adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, channels)
                }
                root.addView(channelSpinner)
                root.addView(Button(this).apply {
                    text = "Préparer le montant et le bénéficiaire NAXA"
                    setOnClickListener { preparePromoterPayment() }
                })
            }
            root.addView(Button(this).apply {
                text = "Ouvrir la saisie / le partage volontaire"
                setOnClickListener { openShareForm() }
            })
            root.addView(TextView(this).apply {
                text = if (BuildConfig.PROFESSIONAL_CAPTURE_ENABLED)
                    "La réception automatique des SMS nécessite votre consentement et la permission Android. Le partage volontaire reste disponible en secours."
                else
                    "Pour transmettre un SMS : ouvrez le SMS de débit, choisissez Partager, puis NAXA Paiement. NAXA n'a pas accès à votre historique SMS."
                textSize = 12f
                setPadding(0, dp(12), 0, 0)
            })
        }

        root.addView(TextView(this).apply {
            text = "Distribution privée : APK NAXA hors Play Store. Client et Promoteur : partage volontaire uniquement. Pharmacie / Partenaire / Admin : collecte SMS facultative après consentement et permission Android."
            textSize = 12f
            setPadding(0, dp(18), 0, 0)
        })
        setContentView(scroll)
        syncNotificationListenerComponent()
        if (BuildConfig.ADMIN_CAPTURE_ENABLED || BuildConfig.PROFESSIONAL_CAPTURE_ENABLED) refreshCaptureStatus()
        else statusText.text = "Connectez-vous avec votre compte Client ou Promoteur."
    }

    override fun onResume() {
        super.onResume()
        if (::statusText.isInitialized && (BuildConfig.ADMIN_CAPTURE_ENABLED || BuildConfig.PROFESSIONAL_CAPTURE_ENABLED)) refreshCaptureStatus()
        if (::statusText.isInitialized) refreshNotificationStatus()
    }

    private fun addField(parent: LinearLayout, label: String, hint: String): EditText {
        parent.addView(TextView(this).apply {
            text = label
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dp(10), 0, dp(4))
        })
        return EditText(this).apply {
            setSingleLine(true)
            textSize = 14f
            this.hint = hint
            parent.addView(this)
        }
    }

    private fun selectedRole(): String {
        if (BuildConfig.ADMIN_CAPTURE_ENABLED) return "admin"
        if (BuildConfig.PROFESSIONAL_CAPTURE_ENABLED) {
            return if (roleGroup.checkedRadioButtonId == partnerRadioId) "partenaire" else "pharmacie"
        }
        return if (roleGroup.checkedRadioButtonId == promoterRadioId) "promoteur" else "client"
    }

    private fun connectAndEnroll() {
        val role = selectedRole()
        val naxa = trim(naxaUrl.text.toString())
        val sb = trim(supabaseUrl.text.toString())
        val key = anonKey.text.toString().trim()
        val user = email.text.toString().trim()
        val secret = password.text.toString()
        if (!naxa.startsWith("https://") || !sb.startsWith("https://") || key.isEmpty() || user.isEmpty() || secret.isEmpty()) {
            statusText.text = "Saisissez deux URL HTTPS, la clé publique Supabase, l'e-mail et le mot de passe."
            return
        }
        connectButton.isEnabled = false
        statusText.text = "Connexion et vérification du profil NAXA…"
        executor.execute {
            try {
                SecureVault.put(this, "naxa_base_url", naxa)
                SecureVault.put(this, "supabase_url", sb)
                SecureVault.put(this, "supabase_anon_key", key)
                SupabaseSession.login(this, sb, key, user, secret)
                if (role == "partenaire") {
                    val partners = NaxaApi.partnerWorkspaceOptions(this)
                    runOnUiThread { showPartnerWorkspacePicker(partners) }
                } else {
                    completeEnrollment(role)
                }
            } catch (error: Exception) {
                runOnUiThread {
                    connectButton.isEnabled = true
                    statusText.text = "Échec de la connexion / enrôlement : " + (error.message ?: "erreur inconnue")
                }
            }
        }
    }

    private fun showPartnerWorkspacePicker(partners: org.json.JSONArray) {
        if (partners.length() == 0) {
            connectButton.isEnabled = true
            statusText.text = "Aucun espace Partenaire actif ne vous est affecté comme propriétaire ou gestionnaire."
            return
        }
        val ids = ArrayList<String>()
        val labels = ArrayList<String>()
        for (index in 0 until partners.length()) {
            val partner = partners.optJSONObject(index) ?: continue
            val id = partner.optString("id")
            if (id.isBlank()) continue
            ids.add(id)
            labels.add(partner.optString("name").ifBlank { "Partenaire " + (ids.size) })
        }
        if (ids.isEmpty()) {
            connectButton.isEnabled = true
            statusText.text = "Aucun espace Partenaire exploitable."
            return
        }
        if (ids.size == 1) {
            statusText.text = "Enrôlement de l'espace " + labels[0] + "…"
            executor.execute { completeEnrollment("partenaire", ids[0]) }
            return
        }
        var selected = 0
        android.app.AlertDialog.Builder(this)
            .setTitle("Choisir l'espace Partenaire de ce téléphone")
            .setSingleChoiceItems(labels.toTypedArray(), selected) { _, which -> selected = which }
            .setNegativeButton("Annuler") { _, _ ->
                connectButton.isEnabled = true
                statusText.text = "Enrôlement annulé. Aucun SMS ne sera transmis à un espace Partenaire."
            }
            .setPositiveButton("Continuer") { _, _ ->
                connectButton.isEnabled = false
                statusText.text = "Enrôlement de l'espace " + labels[selected] + "…"
                executor.execute { completeEnrollment("partenaire", ids[selected]) }
            }
            .setCancelable(false)
            .show()
    }

    private fun completeEnrollment(role: String, partnerId: String? = null) {
        try {
            if (role == "client") {
                SecureVault.put(this, "notification_consent_granted", "false")
                SecureVault.put(this, "companion_role", "client")
            } else {
                NaxaApi.enroll(this, role, partnerId)
            }
            if (BuildConfig.PROFESSIONAL_CAPTURE_ENABLED && role in listOf("pharmacie", "partenaire")) {
                NaxaApi.setSmsConsent(this, SecureVault.get(this, "sms_consent_granted") == "true")
            }
            runOnUiThread {
                connectButton.isEnabled = true
                statusText.text = when (role) {
                    "client" -> "Compte Client connecté. Partagez un SMS de débit ou utilisez la saisie manuelle."
                    "promoteur" -> "Compte Promoteur enrôlé. Le partage volontaire du SMS reste disponible ; aucun lecteur de notifications."
                    "pharmacie" -> "Compte Pharmacie enrôlé. Lecteur de notifications et collecte SMS facultatifs selon vos consentements."
                    "partenaire" -> "Espace Partenaire sélectionné et enrôlé. Les SMS reçus ne seront transmis qu'à cet espace."
                    else -> "Compte Administrateur enrôlé. Les mécanismes restent désactivés sans consentement et autorisations Android."
                }
                syncNotificationListenerComponent()
                if (role in listOf("admin", "pharmacie", "partenaire") &&
                    SecureVault.get(this, "sms_consent_granted") == "true") requestSmsPermission()
                if (role in listOf("admin", "pharmacie", "partenaire") &&
                    SecureVault.get(this, "notification_consent_granted") == "true") openNotificationAccessSettings()
            }
        } catch (error: Exception) {
            runOnUiThread {
                connectButton.isEnabled = true
                statusText.text = "Échec de l'enrôlement : " + (error.message ?: "erreur inconnue")
            }
        }
    }

    private fun createSmsConsentControls(parent: LinearLayout) {
        parent.addView(TextView(this).apply {
            text = "Autorisation de réception des SMS de paiement"
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dp(18), 0, dp(4))
        })
        parent.addView(TextView(this).apply {
            text = if (BuildConfig.ADMIN_CAPTURE_ENABLED)
                "Sur le téléphone Admin, NAXA peut collecter les SMS de crédit Orange Money et MTN MoMo. Le libellé expéditeur sert uniquement au filtrage ; la transaction n'est confirmée qu'après rapprochement avec le SMS de débit correspondant."
            else
                "Sur le téléphone Pharmacie / Partenaire, NAXA peut collecter les SMS reçus Orange Money et MTN MoMo. Le libellé expéditeur sert uniquement au filtrage. Le SMS reçu seul ne confirme jamais le paiement ; il doit être rapproché du SMS de débit du payeur."
            textSize = 13f
            setPadding(0, 0, 0, dp(8))
        })
        smsConsent = CheckBox(this).apply {
            text = "J'autorise explicitement NAXA à détecter et traiter les SMS de paiement sur ce téléphone."
            isChecked = SecureVault.get(this@MainActivity, "sms_consent_granted") == "true"
        }
        parent.addView(smsConsent)
        parent.addView(TextView(this).apply {
            text = "Le consentement NAXA et la permission Android RECEIVE_SMS sont deux autorisations séparées. Sans les deux, aucune collecte automatique n'est transmise. Le partage volontaire reste disponible."
            textSize = 12f
            setPadding(0, dp(4), 0, dp(8))
        })
        smsStatusText = TextView(this).apply {
            textSize = 12f
            setPadding(0, dp(2), 0, dp(10))
        }
        parent.addView(smsStatusText)
        smsConsent?.setOnCheckedChangeListener { _, checked -> applySmsConsentChoice(checked) }
    }

    private fun createNotificationControls(parent: LinearLayout, alwaysVisible: Boolean) {
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(18), 0, dp(8))
        }
        panel.addView(TextView(this).apply {
            text = "Lecture automatique des notifications de paiement"
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
        })
        panel.addView(TextView(this).apply {
            text = "Accès Android sensible : Android expose techniquement à NAXA le flux général des notifications. Le lecteur reste réservé à Pharmacie, Partenaire et Admin et filtre localement les applications de paiement reconnues. Une notification ne confirme jamais seule un paiement."
            textSize = 12f
            setPadding(0, dp(4), 0, dp(8))
        })
        notificationConsent = CheckBox(this).apply {
            text = "J'autorise NAXA à détecter les notifications de paiement sur ce téléphone."
            isChecked = SecureVault.get(this@MainActivity, "notification_consent_granted") == "true"
        }
        panel.addView(notificationConsent)
        notificationConsent?.setOnCheckedChangeListener { _, checked ->
            SecureVault.put(this, "notification_consent_granted", checked.toString())
            syncNotificationListenerComponent()
            if (checked) {
                executor.execute { runCatching { NaxaApi.setNotificationConsent(this, true) } }
                openNotificationAccessSettings()
            } else {
                executor.execute { runCatching { NaxaApi.setNotificationConsent(this, false) } }
                statusText.text = "Lecture automatique désactivée. Le partage volontaire du SMS reste disponible."
            }
        }
        panel.addView(Button(this).apply {
            text = "Gérer l'accès Android aux notifications"
            setOnClickListener {
                if (SecureVault.get(this@MainActivity, "notification_consent_granted") != "true") {
                    statusText.text = "Cochez d'abord le consentement NAXA."
                } else openNotificationAccessSettings()
            }
        })
        notificationControls = panel
        parent.addView(panel)
        panel.visibility = if (alwaysVisible) View.VISIBLE else View.GONE
    }

    private fun syncNotificationListenerComponent(): Boolean {
        if (!BuildConfig.ADMIN_CAPTURE_ENABLED && !BuildConfig.PROFESSIONAL_CAPTURE_ENABLED) return false
        val role = SecureVault.get(this, "companion_role")
        val consent = SecureVault.get(this, "notification_consent_granted") == "true"
        val allowed = consent && role in listOf("admin", "pharmacie", "partenaire")
        packageManager.setComponentEnabledSetting(
            ComponentName(this, NaxaNotificationListenerService::class.java),
            if (allowed) PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP
        )
        return allowed
    }

    private fun openNotificationAccessSettings() {
        if (!syncNotificationListenerComponent()) return
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    private fun refreshNotificationStatus() {
        if (!::statusText.isInitialized) return
        val role = SecureVault.get(this, "companion_role")
        if (role == "client" || role !in listOf("admin", "partenaire", "pharmacie")) {
            notificationControls?.visibility = View.GONE
            syncNotificationListenerComponent()
            return
        }
        val consent = SecureVault.get(this, "notification_consent_granted") == "true"
        val component = ComponentName(this, NaxaNotificationListenerService::class.java)
        val enabled = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
            ?.split(':')
            ?.any { ComponentName.unflattenFromString(it) == component } == true
        if (!consent) {
            statusText.text = "Lecture automatique non autorisée dans NAXA. Le partage SMS reste disponible."
        } else if (!enabled) {
            statusText.text = "Consentement NAXA enregistré, mais l'accès spécial Android aux notifications n'est pas activé."
        } else {
            statusText.text = "Détection des notifications activée. Les éléments reconnus restent soumis au rapprochement NAXA."
        }
    }

    private fun preparePromoterPayment() {
        if (SecureVault.get(this, "companion_role") != "promoteur") {
            statusText.text = "Connectez-vous d'abord avec un compte Promoteur."
            return
        }
        val channel = if ((channelSpinner?.selectedItemPosition ?: 0) == 0) "orange_money" else "mtn_momo"
        statusText.text = "Préparation du paiement Promoteur…"
        executor.execute {
            try {
                val intent = NaxaApi.preparePromoterPayment(this, channel)
                runOnUiThread {
                    statusText.text = "Paiement préparé : " + intent.optInt("expected_amount").toString() +
                        " FCFA · " + (if (channel == "orange_money") "Orange Money" else "MTN MoMo") +
                        ". Effectuez le transfert puis partagez le SMS de débit avec NAXA Paiement."
                }
            } catch (error: Exception) {
                runOnUiThread { statusText.text = error.message ?: "Préparation du paiement impossible." }
            }
        }
    }

    private fun openShareForm() {
        startActivity(Intent(this, PaymentShareActivity::class.java).apply {
            action = "cm.naxa.paymentcompanion.MANUAL_ENTRY"
        })
    }

    private fun applySmsConsentChoice(checked: Boolean) {
        try {
            SecureVault.put(this, "sms_consent_granted", checked.toString())
        } catch (_: Exception) {
            val saved = SecureVault.get(this, "sms_consent_granted") == "true"
            smsConsent?.setOnCheckedChangeListener(null)
            smsConsent?.isChecked = saved
            smsConsent?.setOnCheckedChangeListener { _, value -> applySmsConsentChoice(value) }
            statusText.text = "Impossible d'enregistrer le consentement dans le coffre sécurisé."
            return
        }

        val role = SecureVault.get(this, "companion_role")
        val hasProfessionalDevice = when (role) {
            "pharmacie" ->
                !SecureVault.get(this, "notification_device_id").isNullOrBlank() &&
                !SecureVault.get(this, "notification_device_token").isNullOrBlank()
            "partenaire" ->
                runCatching {
                    org.json.JSONArray(SecureVault.get(this, "notification_partner_devices") ?: "[]").length() > 0
                }.getOrDefault(false)
            else -> false
        }
        if (BuildConfig.PROFESSIONAL_CAPTURE_ENABLED && hasProfessionalDevice) {
            executor.execute {
                try {
                    NaxaApi.setSmsConsent(this, checked)
                    runOnUiThread {
                        if (!checked) smsStatusText?.text = "Consentement retiré côté NAXA ; collecte SMS désactivée."
                    }
                } catch (error: Exception) {
                    runOnUiThread {
                        smsStatusText?.text = error.message ?: "Mise à jour du consentement SMS impossible."
                    }
                }
            }
        }

        if (!checked) {
            smsStatusText?.text = "Consentement retiré : la capture SMS est désactivée immédiatement."
        } else {
            requestSmsPermission()
        }
    }

    private fun requestSmsPermission() {
        val role = SecureVault.get(this, "companion_role")
        val allowedBuildAndRole =
            (BuildConfig.ADMIN_CAPTURE_ENABLED && role == "admin") ||
            (BuildConfig.PROFESSIONAL_CAPTURE_ENABLED && role in listOf("pharmacie", "partenaire"))
        if (!allowedBuildAndRole) return
        if (SecureVault.get(this, "sms_consent_granted") != "true") {
            smsStatusText?.text = "Capture désactivée : consentement NAXA non accordé."
            return
        }
        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            refreshCaptureStatus()
            return
        }
        smsStatusText?.text = "Android va demander séparément l'autorisation RECEIVE_SMS. Si elle est refusée, utilisez le partage volontaire."
        requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), REQUEST_RECEIVE_SMS)
    }

    @Deprecated("Callback Android conservé pour compatibilité")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_RECEIVE_SMS) return
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) refreshCaptureStatus()
        else smsStatusText?.text = "Android n'a pas accordé RECEIVE_SMS. Vérifiez l'installateur ; la collecte automatique reste désactivée. Le partage volontaire reste disponible."
    }

    private fun refreshCaptureStatus() {
        if (!::statusText.isInitialized) return
        val role = SecureVault.get(this, "companion_role")
        val allowedBuildAndRole =
            (BuildConfig.ADMIN_CAPTURE_ENABLED && role == "admin") ||
            (BuildConfig.PROFESSIONAL_CAPTURE_ENABLED && role in listOf("pharmacie", "partenaire"))
        if (!allowedBuildAndRole) return
        val consent = SecureVault.get(this, "sms_consent_granted") == "true"
        val permission = checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        val label = if (role == "admin") "Admin" else "Pharmacie / Partenaire"
        val state = when {
            !consent -> "Capture SMS " + label + " désactivée : consentement non accordé."
            !permission -> "Consentement accepté, mais RECEIVE_SMS n'est pas accordée par Android."
            else -> "Capture SMS " + label + " active : seuls les messages OrangeMoney / MobileMoney sont filtrés et transmis pour rapprochement."
        }
        smsStatusText?.text = state
    }

    private fun trim(value: String?): String {
        var out = value?.trim().orEmpty()
        while (out.endsWith("/")) out = out.dropLast(1)
        return out
    }

    private fun dp(value: Int): Int = (resources.displayMetrics.density * value).toInt()

    override fun onDestroy() {
        super.onDestroy()
        executor.shutdown()
    }
}
