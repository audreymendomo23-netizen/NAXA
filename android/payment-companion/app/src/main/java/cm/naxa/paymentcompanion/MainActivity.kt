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
    private var channelSpinner: Spinner? = null
    private var promoterRadioId: Int = View.NO_ID
    private var clientRadioId: Int = View.NO_ID
    private var partnerRadioId: Int = View.NO_ID
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
            text = if (BuildConfig.ADMIN_CAPTURE_ENABLED)
                "Compagnon Administrateur : réception automatique facultative des SMS de crédit NAXA."
            else
                "Client : partage volontaire uniquement. Promoteur / Partenaire : partage SMS et lecteur de notifications facultatif ; aucun accès RECEIVE_SMS."
            textSize = 14f
            setPadding(0, dp(8), 0, dp(18))
        })

        naxaUrl = addField(root, "URL de l'espace NAXA (HTTPS)", "https://votre-domaine-naxa")
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
        if (BuildConfig.ADMIN_CAPTURE_ENABLED) {
            val admin = RadioButton(this).apply {
                id = View.generateViewId()
                text = "Administrateur · téléphone bénéficiaire NAXA"
                isChecked = true
            }
            roleGroup.addView(admin)
        } else {
            val client = RadioButton(this).apply {
                id = View.generateViewId()
                text = "Client · paiement d'une commande pharmacie"
                isChecked = true
            }
            clientRadioId = client.id
            val promoter = RadioButton(this).apply {
                id = View.generateViewId()
                text = "Promoteur / Pharmacie · abonnement NAXA"
            }
            promoterRadioId = promoter.id
            val partner = RadioButton(this).apply {
                id = View.generateViewId()
                text = "Partenaire · paiement d'abonnement"
            }
            partnerRadioId = partner.id
            roleGroup.addView(client)
            roleGroup.addView(promoter)
            roleGroup.addView(partner)
        }
        root.addView(roleGroup)

        if (BuildConfig.ADMIN_CAPTURE_ENABLED) {
            root.addView(TextView(this).apply {
                text = "Autorisation de réception SMS"
                setTypeface(Typeface.DEFAULT, Typeface.BOLD)
                setPadding(0, dp(18), 0, dp(4))
            })
            root.addView(TextView(this).apply {
                text = "La réception automatique ne concerne que les SMS de crédit Orange Money ou MTN MoMo du téléphone Administrateur. Votre consentement dans NAXA et l'autorisation Android sont deux choix séparés. Vous pouvez retirer le consentement à tout moment."
                textSize = 13f
                setPadding(0, 0, 0, dp(8))
            })
            smsConsent = CheckBox(this).apply {
                text = "J'autorise explicitement NAXA à traiter les SMS de crédit sur ce téléphone Administrateur."
                isChecked = SecureVault.get(this@MainActivity, "sms_consent_granted") == "true"
            }
            root.addView(smsConsent)
            root.addView(TextView(this).apply {
                text = "Si la permission Android n'est pas accordée, vous pouvez partager manuellement le SMS de crédit depuis votre messagerie. Le partage manuel ne déclenche jamais une confirmation automatique."
                textSize = 12f
                setPadding(0, dp(4), 0, dp(12))
            })
            smsConsent?.setOnCheckedChangeListener { _, checked -> applySmsConsentChoice(checked) }
        }

        createNotificationControls(root, BuildConfig.ADMIN_CAPTURE_ENABLED)
        if (!BuildConfig.ADMIN_CAPTURE_ENABLED) {
            roleGroup.setOnCheckedChangeListener { _, checkedId ->
                if (checkedId == clientRadioId) {
                    SecureVault.put(this, "notification_consent_granted", "false")
                    syncNotificationListenerComponent()
                }
                notificationControls?.visibility = if (checkedId == clientRadioId) View.GONE else View.VISIBLE
            }
            notificationControls?.visibility = if (roleGroup.checkedRadioButtonId == clientRadioId) View.GONE else View.VISIBLE
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

        if (BuildConfig.ADMIN_CAPTURE_ENABLED) {
            root.addView(Button(this).apply {
                text = "Activer / réessayer l'autorisation SMS"
                setOnClickListener { requestSmsPermission() }
            })
            root.addView(Button(this).apply {
                text = "Aide : partager un SMS de crédit"
                setOnClickListener { openShareForm() }
            })
        } else {
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
                text = "Pour transmettre un SMS : ouvrez le SMS de débit, choisissez Partager, puis NAXA Paiement. NAXA n'a pas accès à votre historique SMS."
                textSize = 12f
                setPadding(0, dp(12), 0, 0)
            })
        }

        root.addView(TextView(this).apply {
            text = "Distribution privée : APK NAXA hors Play Store. Le Client n'a aucun lecteur de notifications ni accès SMS en arrière-plan. RECEIVE_SMS reste réservé à la variante Admin."
            textSize = 12f
            setPadding(0, dp(18), 0, 0)
        })
        setContentView(scroll)
        syncNotificationListenerComponent()
        if (BuildConfig.ADMIN_CAPTURE_ENABLED) refreshCaptureStatus()
        else statusText.text = "Connectez-vous avec votre compte Client, Promoteur ou Partenaire."
    }

    override fun onResume() {
        super.onResume()
        if (::statusText.isInitialized && BuildConfig.ADMIN_CAPTURE_ENABLED) refreshCaptureStatus()
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
        return when (roleGroup.checkedRadioButtonId) {
            promoterRadioId -> "promoteur"
            partnerRadioId -> "partenaire"
            else -> "client"
        }
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
                if (role == "client") {
                    SecureVault.put(this, "notification_consent_granted", "false")
                    SecureVault.put(this, "companion_role", "client")
                } else NaxaApi.enroll(this, role)
                runOnUiThread {
                    connectButton.isEnabled = true
                    statusText.text = when (role) {
                        "client" -> "Compte Client connecté. Partagez un SMS de débit ou utilisez la saisie manuelle."
                        "promoteur" -> "Compte Promoteur enrôlé. Le partage SMS et la lecture facultative des notifications sont disponibles."
                        "partenaire" -> "Compte Partenaire enrôlé. Partagez un SMS ou activez la lecture facultative des notifications."
                        else -> "Compte Administrateur enrôlé. Les mécanismes restent désactivés sans consentement et autorisations Android."
                    }
                    syncNotificationListenerComponent()
                    if (role == "admin" && SecureVault.get(this, "sms_consent_granted") == "true") requestSmsPermission()
                    if (role != "client" && SecureVault.get(this, "notification_consent_granted") == "true") openNotificationAccessSettings()
                }
            } catch (error: Exception) {
                runOnUiThread {
                    connectButton.isEnabled = true
                    statusText.text = "Échec de la connexion / enrôlement : " + (error.message ?: "erreur inconnue")
                }
            }
        }
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
            text = "Accès Android sensible : le système expose à NAXA le flux général des notifications. NAXA filtre localement les seuls titres exacts OrangeMoney et MobileMoney et n'envoie que les éléments de paiement reconnus. Le titre d'une notification n'authentifie jamais l'expéditeur SMS et ne confirme jamais un paiement."
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
            if (checked) openNotificationAccessSettings()
            else statusText.text = "Lecture automatique désactivée. Le partage volontaire du SMS reste disponible."
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
        val role = SecureVault.get(this, "companion_role")
        val consent = SecureVault.get(this, "notification_consent_granted") == "true"
        val allowed = consent && role in listOf("admin", "promoteur", "partenaire")
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
        if (role == "client" || role !in listOf("admin", "promoteur", "partenaire")) {
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
        if (!checked) {
            statusText.text = "Consentement retiré : la capture automatique est désactivée immédiatement."
        } else {
            requestSmsPermission()
        }
    }

    private fun requestSmsPermission() {
        if (!BuildConfig.ADMIN_CAPTURE_ENABLED || SecureVault.get(this, "companion_role") != "admin") return
        if (SecureVault.get(this, "sms_consent_granted") != "true") {
            statusText.text = "Capture désactivée : consentement Administrateur non accordé."
            return
        }
        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            refreshCaptureStatus()
            return
        }
        statusText.text = "Android va demander séparément l'autorisation de recevoir les SMS. Si elle est refusée, utilisez le partage manuel."
        requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), REQUEST_RECEIVE_SMS)
    }

    @Deprecated("Callback Android conservé pour compatibilité")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_RECEIVE_SMS) return
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) refreshCaptureStatus()
        else statusText.text = "Android n'a pas accordé RECEIVE_SMS. Vérifiez l'autorisation de l'installateur ; la capture automatique reste désactivée. Le partage manuel Admin reste disponible."
    }

    private fun refreshCaptureStatus() {
        if (!::statusText.isInitialized || !BuildConfig.ADMIN_CAPTURE_ENABLED) return
        val consent = SecureVault.get(this, "sms_consent_granted") == "true"
        val enrolled = SecureVault.get(this, "companion_role") == "admin"
        val permission = checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        val state = when {
            !consent -> "Capture automatique désactivée : consentement non accordé."
            !enrolled -> "Connectez un compte Administrateur actif."
            !permission -> "Consentement accepté, mais RECEIVE_SMS n'est pas accordée / autorisée par l'installateur."
            else -> "Capture Admin active : seuls les SMS OrangeMoney et MobileMoney sont traités."
        }
        statusText.text = state
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
