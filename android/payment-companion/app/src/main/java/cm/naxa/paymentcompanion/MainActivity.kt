package cm.naxa.paymentcompanion

import android.Manifest
import android.app.Activity
import android.content.Intent
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
    private lateinit var statusText: TextView
    private lateinit var connectButton: Button
    private var smsConsent: CheckBox? = null
    private var channelSpinner: Spinner? = null
    private var promoterRadioId: Int = View.NO_ID
    private var clientRadioId: Int = View.NO_ID

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
                "Compagnon Client / Promoteur : partage volontaire du SMS de transaction. Aucun accès aux SMS en arrière-plan."
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
                text = "Promoteur · abonnement NAXA"
            }
            promoterRadioId = promoter.id
            roleGroup.addView(client)
            roleGroup.addView(promoter)
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
                text = "Partager manuellement un SMS de crédit"
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
            text = "Distribution privée : APK NAXA. La variante Client / Promoteur ne déclare pas RECEIVE_SMS. Seule la variante Administrateur demande cette permission restreinte."
            textSize = 12f
            setPadding(0, dp(18), 0, 0)
        })
        setContentView(scroll)
        if (BuildConfig.ADMIN_CAPTURE_ENABLED) refreshCaptureStatus()
        else statusText.text = "Connectez-vous avec votre compte Client ou Promoteur."
    }

    override fun onResume() {
        super.onResume()
        if (::statusText.isInitialized && BuildConfig.ADMIN_CAPTURE_ENABLED) refreshCaptureStatus()
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
                if (role == "client") SecureVault.put(this, "companion_role", "client")
                else NaxaApi.enroll(this, role)
                runOnUiThread {
                    connectButton.isEnabled = true
                    statusText.text = when (role) {
                        "client" -> "Compte Client connecté. Partagez un SMS de débit ou utilisez la saisie manuelle."
                        "promoteur" -> "Compte Promoteur enrôlé. Préparez un paiement avant de partager le SMS de débit."
                        else -> "Compte Administrateur enrôlé. La capture automatique reste désactivée tant que le consentement n'est pas accordé."
                    }
                    if (role == "admin" && SecureVault.get(this, "sms_consent_granted") == "true") requestSmsPermission()
                }
            } catch (error: Exception) {
                runOnUiThread {
                    connectButton.isEnabled = true
                    statusText.text = "Échec de la connexion / enrôlement : " + (error.message ?: "erreur inconnue")
                }
            }
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
