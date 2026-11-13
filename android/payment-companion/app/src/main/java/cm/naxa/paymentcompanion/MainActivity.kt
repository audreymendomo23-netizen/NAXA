package cm.naxa.paymentcompanion

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Bundle
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
    private lateinit var smsConsent: CheckBox
    private lateinit var connectButton: Button
    private lateinit var permissionButton: Button
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(24), dp(20), dp(28))
        }
        scroll.addView(root)
        root.addView(TextView(this).apply {
            text = "NAXA · Compagnon de paiement"
            textSize = 23f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = "Le compagnon ne traite que les SMS provenant des identifiants exacts OrangeMoney ou MobileMoney. Il ne consulte ni les contacts, ni l'historique SMS, ni les messages d'autres expéditeurs."
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
            text = "Compte à enrôler"
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dp(16), 0, dp(6))
        })
        roleGroup = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        val promoter = RadioButton(this).apply {
            id = View.generateViewId()
            text = "Promoteur (téléphone du payeur)"
        }
        val admin = RadioButton(this).apply {
            id = View.generateViewId()
            text = "Administrateur (téléphone du bénéficiaire)"
        }
        roleGroup.addView(promoter)
        roleGroup.addView(admin)
        promoter.isChecked = true
        root.addView(roleGroup)

        root.addView(TextView(this).apply {
            text = "Consentement à la capture SMS"
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dp(18), 0, dp(4))
        })
        root.addView(TextView(this).apply {
            text = "La capture automatique est facultative. Si vous cochez la case ci-dessous, le compagnon pourra traiter les SMS reçus uniquement lorsque leur expéditeur est OrangeMoney ou MobileMoney, puis transmettre le texte du message à NAXA par HTTPS pour le rapprochement du paiement. Le message n'est pas conservé dans l'historique de l'application."
            textSize = 13f
            setPadding(0, 0, 0, dp(8))
        })
        smsConsent = CheckBox(this).apply {
            text = "J'autorise explicitement NAXA Paiement à traiter ces SMS de transaction."
            isChecked = SecureVault.get(this@MainActivity, "sms_consent_granted") == "true"
        }
        root.addView(smsConsent)
        root.addView(TextView(this).apply {
            text = "Vous pouvez retirer ce consentement à tout moment en décochant cette case. Dans ce cas, le compagnon ignore immédiatement les SMS, même si Android a déjà accordé la permission. Pour retirer aussi la permission système, ouvrez Paramètres Android > Applications > NAXA Paiement > Autorisations > SMS."
            textSize = 12f
            setPadding(0, dp(4), 0, dp(12))
        })

        connectButton = Button(this).apply {
            text = "Connecter et enrôler ce téléphone"
            setOnClickListener { connectAndEnroll() }
        }
        root.addView(connectButton)
        statusText = TextView(this).apply {
            textSize = 13f
            setPadding(0, dp(16), 0, dp(6))
        }
        root.addView(statusText)
        permissionButton = Button(this).apply {
            text = "Activer / réessayer l'autorisation SMS"
            setOnClickListener { requestSmsPermission() }
        }
        root.addView(permissionButton)

        smsConsent.setOnCheckedChangeListener { _, checked ->
            applySmsConsentChoice(checked)
        }

        root.addView(TextView(this).apply {
            text = "Distribution privée : l'application NAXA Paiement peut être transmise par Bluetooth, depuis le site NAXA ou directement sous forme d'APK. Après installation, Android peut demander séparément l'autorisation SMS. Le consentement dans l'application ne remplace pas cette autorisation système."
            textSize = 12f
            setPadding(0, dp(14), 0, 0)
        })
        setContentView(scroll)
        refreshCaptureStatus()
    }

    override fun onResume() {
        super.onResume()
        if (::statusText.isInitialized) refreshCaptureStatus()
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

    private fun connectAndEnroll() {
        val role = if (roleGroup.checkedRadioButtonId == (roleGroup.getChildAt(1) as RadioButton).id) "admin" else "promoteur"
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
        statusText.text = "Connexion Supabase et enrôlement en cours…"
        executor.execute {
            try {
                SecureVault.put(this, "naxa_base_url", naxa)
                SecureVault.put(this, "supabase_url", sb)
                SecureVault.put(this, "supabase_anon_key", key)
                SupabaseSession.login(this, sb, key, user, secret)
                NaxaApi.enroll(this, role)
                runOnUiThread {
                    connectButton.isEnabled = true
                    if (SecureVault.get(this, "sms_consent_granted") == "true") {
                        requestSmsPermission()
                    } else {
                        statusText.text = "Téléphone enrôlé pour le compte " + role + ". Aucun SMS ne sera lu : le consentement de capture n'a pas été accordé."
                    }
                }
            } catch (error: Exception) {
                runOnUiThread {
                    connectButton.isEnabled = true
                    statusText.text = "Échec de la connexion / enrôlement : " + (error.message ?: "erreur inconnue")
                }
            }
        }
    }

    private fun isDeviceEnrolled(): Boolean =
        !SecureVault.get(this, "companion_role").isNullOrBlank()

    private fun applySmsConsentChoice(checked: Boolean) {
        try {
            // Persist the revocation/grant before changing the visible state.
            SecureVault.put(this, "sms_consent_granted", checked.toString())
        } catch (_: Exception) {
            val persistedChoice = SecureVault.get(this, "sms_consent_granted") == "true"
            smsConsent.setOnCheckedChangeListener(null)
            smsConsent.isChecked = persistedChoice
            smsConsent.setOnCheckedChangeListener { _, value -> applySmsConsentChoice(value) }
            statusText.text = "Impossible d'enregistrer votre choix dans le coffre sécurisé. La capture ne change pas tant que le choix n'est pas sauvegardé."
            return
        }

        if (!checked) {
            statusText.text = "Consentement retiré. La capture automatique est désactivée immédiatement. La permission Android peut être retirée séparément dans les paramètres de l'application."
        } else if (isDeviceEnrolled()) {
            requestSmsPermission()
        } else {
            statusText.text = "Consentement enregistré sur cet appareil. Connectez et enrôlez le téléphone pour activer la capture automatique."
        }
    }

    private fun requestSmsPermission() {
        if (SecureVault.get(this, "sms_consent_granted") != "true") {
            statusText.text = "La capture SMS reste désactivée tant que le consentement n'est pas accordé."
            return
        }
        if (!isDeviceEnrolled()) {
            statusText.text = "Consentement enregistré. Connectez et enrôlez ce téléphone avant d'activer la capture SMS."
            return
        }
        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            refreshCaptureStatus()
            return
        }
        statusText.text = "Consentement enregistré. Android va maintenant demander séparément l'autorisation de recevoir les SMS."
        requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), REQUEST_RECEIVE_SMS)
    }

    @Deprecated("Callback Android conservé pour compatibilité")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_RECEIVE_SMS) return
        if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            refreshCaptureStatus()
        } else {
            statusText.text = "Consentement accepté, mais Android n'a pas accordé RECEIVE_SMS. L'installateur de cet APK doit aussi autoriser cette permission restreinte. Aucune capture automatique ne sera effectuée ; utilisez le parcours manuel NAXA sans désactiver les protections Android."
        }
    }

    private fun refreshCaptureStatus() {
        if (!::statusText.isInitialized) return
        val consent = SecureVault.get(this, "sms_consent_granted") == "true"
        val enrolled = isDeviceEnrolled()
        val permissionGranted = checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        val message = when {
            !consent -> "Capture automatique désactivée : consentement non accordé."
            !enrolled -> "Consentement enregistré ; connectez et enrôlez ce téléphone pour activer la capture."
            !permissionGranted -> "Consentement accepté, mais l'autorisation Android RECEIVE_SMS n'est pas accordée. Vérifiez que l'installateur de l'APK autorise cette permission restreinte."
            else -> "Capture SMS active : consentement explicite et permission Android accordés. Seuls les expéditeurs OrangeMoney et MobileMoney sont acceptés."
        }
        val lastState = SecureVault.get(this, "last_capture_status")
        val lastAt = SecureVault.get(this, "last_capture_at")
        statusText.text = message + if (lastState != null) {
            "\nDernière capture : " + lastState + (lastAt?.let { " · " + it } ?: "")
        } else ""
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
