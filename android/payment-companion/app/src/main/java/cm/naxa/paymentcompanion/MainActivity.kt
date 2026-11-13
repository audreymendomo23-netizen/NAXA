package cm.naxa.paymentcompanion
import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.os.Build
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
    private lateinit var connectButton: Button
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
            text = "NAXA · Compagnon de paiement"; textSize = 23f
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
        })
        root.addView(TextView(this).apply {
            text = "Le compagnon transmet uniquement les SMS dont l'expéditeur brut est exactement OrangeMoney ou MobileMoney. Aucun contact, PIN, OTP ou historique de messagerie n'est lu."
            textSize = 14f; setPadding(0, dp(8), 0, dp(18))
        })
        naxaUrl = addField(root, "URL de l'espace NAXA (HTTPS)", "https://votre-domaine-naxa")
        supabaseUrl = addField(root, "URL Supabase", "https://votre-projet.supabase.co")
        anonKey = addField(root, "Clé publique Supabase (anon / publishable)", "")
        email = addField(root, "Adresse e-mail NAXA", "")
        password = addField(root, "Mot de passe", "").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        root.addView(TextView(this).apply {
            text = "Compte à enrôler"; setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dp(16), 0, dp(6))
        })
        roleGroup = RadioGroup(this).apply { orientation = RadioGroup.VERTICAL }
        val promoter = RadioButton(this).apply {
            id = View.generateViewId(); text = "Promoteur (téléphone du payeur)"
        }
        val admin = RadioButton(this).apply {
            id = View.generateViewId(); text = "Administrateur (téléphone du bénéficiaire)"
        }
        roleGroup.addView(promoter); roleGroup.addView(admin); promoter.isChecked = true
        root.addView(roleGroup)
        connectButton = Button(this).apply {
            text = "Connecter et enrôler ce téléphone"; setOnClickListener { connectAndEnroll() }
        }
        root.addView(connectButton)
        statusText = TextView(this).apply { textSize = 13f; setPadding(0, dp(16), 0, dp(6)) }
        root.addView(statusText)
        root.addView(TextView(this).apply {
            text = "Important : Android classe RECEIVE_SMS comme permission restreinte. Play Protect peut bloquer une application téléchargée depuis un navigateur. Ne désactivez pas Play Protect pour contourner ce contrôle. La distribution doit être autorisée pour cette permission."
            textSize = 12f; setPadding(0, dp(16), 0, 0)
        })
        setContentView(scroll)
        showLastStatus()
    }

    private fun addField(parent: LinearLayout, label: String, hint: String): EditText {
        parent.addView(TextView(this).apply {
            text = label; setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dp(10), 0, dp(4))
        })
        return EditText(this).apply {
            setSingleLine(true); textSize = 14f; this.hint = hint; parent.addView(this)
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
                    statusText.text = "Téléphone enrôlé pour le compte " + role + ". Demande de permission SMS en cours. Le jeton de l'appareil est stocké chiffré."
                    requestSmsPermission()
                }
            } catch (error: Exception) {
                runOnUiThread {
                    connectButton.isEnabled = true
                    statusText.text = "Échec de la connexion / enrôlement : " + (error.message ?: "erreur inconnue")
                }
            }
        }
    }

    private fun requestSmsPermission() {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), REQUEST_RECEIVE_SMS); return
        }
        statusText.text = statusText.text.toString() + "\nCapture SMS autorisée par Android."
    }

    @Deprecated("Callback Android conservé pour compatibilité")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_RECEIVE_SMS) return
        statusText.text = if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            statusText.text.toString() + "\nPermission SMS accordée. Les expéditeurs autorisés seront traités automatiquement."
        } else {
            statusText.text.toString() + "\nPermission SMS refusée / non autorisée par l'installateur. Aucun SMS ne sera capturé ; utilisez le circuit manuel NAXA."
        }
    }

    private fun showLastStatus() {
        val state = SecureVault.get(this, "last_capture_status")
        val at = SecureVault.get(this, "last_capture_at")
        if (state != null) statusText.text = "Dernière capture : " + state + (at?.let { " · " + it } ?: "")
    }
    private fun trim(value: String?): String {
        var out = value?.trim().orEmpty()
        while (out.endsWith("/")) out = out.dropLast(1)
        return out
    }
    private fun dp(value: Int): Int = (resources.displayMetrics.density * value).toInt()
    override fun onDestroy() { super.onDestroy(); executor.shutdown() }
}
