package cm.naxa.paymentcompanion

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.widget.*
import org.json.JSONObject
import java.util.concurrent.Executors

class PaymentShareActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var root: LinearLayout
    private lateinit var status: TextView
    private lateinit var payerNumber: EditText
    private lateinit var amount: EditText
    private lateinit var paidAt: EditText
    private lateinit var reference: EditText
    private lateinit var submitButton: Button
    private var adminChannelSpinner: Spinner? = null
    private var smsText = ""
    private var role = ""
    private var channel = "orange_money"
    private var selectedOrder: JSONObject? = null
    private var orders: List<JSONObject> = emptyList()
    private var amountDefault: Int? = null
    private val dateDefault = SmsPaymentParser.nowInDouala()
    private var parsed: PayerSmsData? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        smsText = if (intent?.action == android.content.Intent.ACTION_SEND) {
            intent.getCharSequenceExtra(android.content.Intent.EXTRA_TEXT)?.toString()?.trim().orEmpty()
        } else ""
        role = SecureVault.get(this, "companion_role").orEmpty()

        val scroll = ScrollView(this)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(22), dp(18), dp(28))
        }
        scroll.addView(root)
        root.addView(TextView(this).apply {
            text = "NAXA · Déclaration de paiement"
            textSize = 22f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        status = TextView(this).apply {
            textSize = 13f
            setPadding(0, dp(8), 0, dp(12))
        }
        root.addView(status)
        setContentView(scroll)

        if (role !in listOf("client", "promoteur", "pharmacie", "partenaire", "admin")) {
            status.text = "Aucun compte NAXA connecté. Ouvrez l'application, connectez votre compte, puis partagez de nouveau le SMS."
            root.addView(Button(this).apply { text = "Fermer"; setOnClickListener { finish() } })
            return
        }
        if (role == "client") loadClientOrders() else buildForm()
    }

    private fun loadClientOrders() {
        status.text = if (smsText.isNotBlank()) {
            "SMS partagé reçu. Chargement des commandes en attente de paiement…"
        } else {
            "Chargement de vos commandes de livraison à payer…"
        }
        executor.execute {
            try {
                val response = NaxaApi.clientPendingDeliveryPayments(this)
                val list = mutableListOf<JSONObject>()
                for (i in 0 until response.length()) response.optJSONObject(i)?.let(list::add)
                runOnUiThread {
                    orders = list
                    if (orders.isEmpty()) {
                        status.text = "Aucune commande de livraison n'attend une déclaration de paiement. Vérifiez que la pharmacie a accepté la commande."
                        root.addView(Button(this).apply { text = "Fermer"; setOnClickListener { finish() } })
                    } else buildForm()
                }
            } catch (error: Exception) {
                runOnUiThread { status.text = error.message ?: "Chargement des commandes impossible." }
            }
        }
    }

    private fun buildForm() {
        status.text = when (role) {
            "client" -> if (smsText.isNotBlank())
                "Choisissez la commande concernée, vérifiez les données extraites puis transmettez la déclaration à la pharmacie."
            else "Saisie manuelle : montant et date préremplis à partir de la commande et de l'heure locale du Cameroun."
            "promoteur" -> if (smsText.isNotBlank())
                "Vérifiez la preuve de débit. Elle sera confrontée au SMS de crédit reçu par NAXA."
            else "Saisie manuelle de secours. Sans SMS de débit partagé, le dossier restera à vérifier par l'Administrateur."
            "pharmacie" -> "Le SMS partagé est transmis à NAXA pour rapprochement d'un paiement Pharmacie."
            "partenaire" -> "Le SMS partagé est transmis comme élément à rapprocher par NAXA. Il ne confirme pas un abonnement Partenaire."
            else -> "Partage de secours du SMS de crédit Admin. Ce partage est soumis à vérification manuelle et ne confirme jamais seul un abonnement."
        }

        if (role == "partenaire") {
            buildPartnerShareForm()
            return
        }
        if (role == "pharmacie") {
            buildPharmacyShareForm()
            return
        }

        if (role == "client") {
            root.addView(TextView(this).apply {
                text = "Commande à rapprocher"
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            })
            val labels = orders.map { order ->
                "Commande " + order.optString("id").take(8).uppercase() + " · " +
                    order.optString("pharmacyName") + " · " +
                    order.optInt("expectedAmount").toString() + " FCFA"
            }
            root.addView(Spinner(this).apply {
                adapter = ArrayAdapter(this@PaymentShareActivity, android.R.layout.simple_spinner_dropdown_item, labels)
                onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                    override fun onNothingSelected(parent: AdapterView<*>?) {}
                    override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                        selectedOrder = orders.getOrNull(position)
                        channel = selectedOrder?.optString("channel", "orange_money") ?: "orange_money"
                        amountDefault = selectedOrder?.optInt("expectedAmount")
                        updateParsedFields()
                    }
                }
            })
        } else if (role == "promoteur") {
            channel = SecureVault.get(this, "promoteur_intent_channel").orEmpty()
            amountDefault = SecureVault.get(this, "promoteur_expected_amount")?.toIntOrNull()
            val intentId = SecureVault.get(this, "promoteur_intent_id")
            val expiresAt = SecureVault.get(this, "promoteur_intent_expires_at")
            if (channel !in listOf("orange_money", "mtn_momo") || amountDefault == null || intentId.isNullOrBlank()) {
                status.text = "Aucun paiement Promoteur n'est préparé. Revenez à l'écran principal et préparez le canal et le montant avant d'effectuer le transfert."
                root.addView(Button(this).apply { text = "Fermer"; setOnClickListener { finish() } })
                return
            }
            root.addView(TextView(this).apply {
                text = "Abonnement préparé : " + amountDefault + " FCFA · " +
                    (if (channel == "orange_money") "Orange Money" else "MTN Mobile Money") +
                    (if (expiresAt.isNullOrBlank()) "" else " · expiration " + expiresAt)
                setPadding(0, 0, 0, dp(12))
            })
        } else {
            root.addView(TextView(this).apply {
                text = "Canal du SMS reçu"
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            })
            val channelSpinner = Spinner(this)
            adminChannelSpinner = channelSpinner
            channelSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, arrayOf("Orange Money", "MTN Mobile Money"))
            channelSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) {}
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    channel = if (position == 0) "orange_money" else "mtn_momo"
                }
            }
            root.addView(channelSpinner)
            root.addView(TextView(this).apply {
                text = if (smsText.isBlank()) "Ouvrez le SMS de crédit dans votre messagerie, choisissez Partager puis NAXA Paiement. Aucun accès général aux SMS n'est accordé." else "Le texte original n'est pas conservé. NAXA conserve une empreinte technique et place ce partage en revue manuelle."
                textSize = 12f
                setPadding(0, dp(6), 0, dp(12))
            })
            root.addView(Button(this).apply {
                text = "Transmettre le SMS à la revue Admin"
                isEnabled = smsText.length >= 12
                setOnClickListener { submitAdminShare() }
            })
            return
        }

        if (smsText.isNotBlank()) {
            root.addView(TextView(this).apply {
                text = "SMS sélectionné · les informations reconnues sont préremplies ; complétez les champs absents."
                textSize = 12f
                setPadding(0, 0, 0, dp(8))
            })
        }

        payerNumber = addField("Numéro utilisé pour payer", "6XX XX XX XX")
        amount = addField("Montant payé (FCFA)", "Montant de la commande / abonnement")
        paidAt = addField("Date et heure du paiement", "AAAA-MM-JJ HH:MM ou ISO")
        reference = addField("ID / Référence de transaction", "Référence fournie par l'opérateur")
        updateParsedFields()

        submitButton = Button(this).apply {
            text = "Confirmer et transmettre les informations à NAXA"
            setOnClickListener { submitPayerDeclaration() }
        }
        root.addView(submitButton)
        root.addView(TextView(this).apply {
            text = "La transmission confirme uniquement la déclaration. La pharmacie doit vérifier le crédit reçu ; l'Administrateur doit rapprocher le débit Promoteur avec son SMS de crédit."
            textSize = 12f
            setPadding(0, dp(12), 0, 0)
        })
    }

    private fun buildPharmacyShareForm() {
        root.addView(TextView(this).apply {
            text = "Opérateur du SMS partagé"
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        val spinner = Spinner(this)
        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, arrayOf("Orange Money", "MTN Mobile Money"))
        root.addView(spinner)
        root.addView(Button(this).apply {
            text = "Transmettre le SMS à NAXA pour rapprochement"
            isEnabled = smsText.length >= 12
            setOnClickListener {
                val channel = if (spinner.selectedItemPosition == 0) "orange_money" else "mtn_momo"
                isEnabled = false
                status.text = "Transmission du SMS…"
                executor.execute {
                    try {
                        val result = NaxaApi.submitProfessionalSharedSms(this@PaymentShareActivity, channel, smsText)
                        runOnUiThread {
                            status.text = result.optString(
                                "message",
                                "SMS transmis. Il reste à rapprocher de l'intention de paiement ; aucun abonnement n'est confirmé par le partage seul."
                            )
                        }
                    } catch (error: Exception) {
                        runOnUiThread {
                            isEnabled = true
                            status.text = error.message ?: "Transmission du SMS impossible."
                        }
                    }
                }
            }
        })
        root.addView(TextView(this).apply {
            text = "Le partage Android ne permet pas à lui seul d'authentifier l'expéditeur. Le texte brut n'est pas conservé par NAXA."
            textSize = 12f
            setPadding(0, dp(12), 0, 0)
        })
    }

    private fun buildPartnerShareForm() {
        val raw = SecureVault.get(this, "partner_payment_devices") ?: "[]"
        val partnerDevices = try {
            val json = org.json.JSONArray(raw)
            (0 until json.length()).mapNotNull { json.optJSONObject(it) }
        } catch (_: Exception) { emptyList() }
        if (partnerDevices.isEmpty()) {
            status.text = "Aucun partenaire actif enrôlé pour ce compte. Reconnectez-vous avec un compte propriétaire ou gestionnaire."
            root.addView(Button(this).apply { text = "Fermer"; setOnClickListener { finish() } })
            return
        }
        if (smsText.isBlank()) {
            status.text = "Pour transmettre un SMS, ouvrez le message de transaction puis choisissez Partager → NAXA Paiement."
        }
        root.addView(TextView(this).apply {
            text = "Établissement concerné"
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        val partnerSpinner = Spinner(this)
        partnerSpinner.adapter = ArrayAdapter(
            this, android.R.layout.simple_spinner_dropdown_item,
            partnerDevices.map { it.optString("partnerName", "Partenaire") }
        )
        root.addView(partnerSpinner)
        root.addView(TextView(this).apply {
            text = "Opérateur du SMS"
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, dp(8), 0, dp(4))
        })
        val channelSpinner = Spinner(this)
        channelSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, arrayOf("Orange Money", "MTN Mobile Money"))
        root.addView(channelSpinner)
        root.addView(TextView(this).apply {
            text = "NAXA conserve les informations extraites et l'empreinte du message, pas son contenu brut. Le dossier reste en revue manuelle tant que le cycle d'abonnement Partenaire n'est pas raccordé."
            textSize = 12f
            setPadding(0, dp(8), 0, dp(12))
        })
        root.addView(Button(this).apply {
            text = "Transmettre le SMS à NAXA"
            isEnabled = smsText.length >= 12
            setOnClickListener {
                val device = partnerDevices.getOrNull(partnerSpinner.selectedItemPosition)
                if (device == null) {
                    status.text = "Sélectionnez le partenaire concerné."
                    return@setOnClickListener
                }
                val selectedChannel = if (channelSpinner.selectedItemPosition == 0) "orange_money" else "mtn_momo"
                isEnabled = false
                status.text = "Transmission du SMS en revue manuelle…"
                executor.execute {
                    try {
                        val result = NaxaApi.submitPartnerSmsCandidate(
                            this@PaymentShareActivity,
                            device.optString("partnerId"), device.optString("deviceId"), device.optString("deviceToken"),
                            selectedChannel, smsText, "voluntary_sms_share"
                        )
                        runOnUiThread {
                            status.text = result.optString("message", "Élément transmis à NAXA pour vérification.")
                        }
                    } catch (error: Exception) {
                        runOnUiThread {
                            isEnabled = true
                            status.text = error.message ?: "Transmission du SMS impossible."
                        }
                    }
                }
            }
        })
    }

    private fun updateParsedFields() {
        if (!::payerNumber.isInitialized || !::amount.isInitialized || !::paidAt.isInitialized || !::reference.isInitialized) return
        val parsedSms = if (smsText.isNotBlank()) SmsPaymentParser.parsePayer(smsText, channel) else null
        parsed = parsedSms
        amount.setText((parsedSms?.amount ?: amountDefault)?.toString().orEmpty())
        payerNumber.setText(parsedSms?.payerNumber.orEmpty())
        paidAt.setText(parsedSms?.occurredAt ?: dateDefault)
        reference.setText(parsedSms?.reference.orEmpty())
        if (smsText.isNotBlank() && parsedSms == null) {
            status.text = "SMS non reconnu automatiquement. Vous pouvez compléter les champs manuellement, mais la pharmacie ou l'Admin devra vérifier le paiement."
        }
    }

    private fun submitPayerDeclaration() {
        val enteredAmount = amount.text.toString().trim().toIntOrNull()
        val enteredNumber = payerNumber.text.toString().trim()
        val enteredReference = reference.text.toString().trim()
        val paidAtIso = try { SmsPaymentParser.toIsoDateTime(paidAt.text.toString()) } catch (_: Exception) { "" }
        if (enteredAmount == null || enteredAmount <= 0 || enteredReference.length < 5 || paidAtIso.isBlank()) {
            status.text = "Montant, date et référence valides requis. Les champs absents du SMS peuvent être saisis manuellement."
            return
        }
        if (role == "promoteur" && enteredNumber.replace(Regex("[^0-9]"), "").length !in 8..15) {
            status.text = "Le numéro réellement utilisé pour payer est requis pour le rapprochement Admin."
            return
        }
        if (role == "client" && selectedOrder == null) {
            status.text = "Sélectionnez la commande correspondant à ce transfert."
            return
        }

        submitButton.isEnabled = false
        status.text = "Transmission sécurisée de la déclaration…"
        executor.execute {
            try {
                val response = if (role == "client") {
                    val order = selectedOrder ?: error("Commande non sélectionnée.")
                    val smsAmount = parsed?.amount
                    val smsDate = parsed?.occurredAt
                    val smsReference = parsed?.reference
                    val smsPayer = parsed?.payerNumber
                    val sources = JSONObject()
                        .put("amount", if (smsAmount != null && smsAmount == enteredAmount) "sms_extracted" else if (enteredAmount == amountDefault) "generated_default" else "manual_entry")
                        .put("paidAt", if (smsDate != null && smsDate == paidAtIso) "sms_extracted" else if (paidAt.text.toString() == dateDefault) "generated_default" else "manual_entry")
                        .put("reference", if (smsReference != null && smsReference == enteredReference) "sms_extracted" else "manual_entry")
                        .put("payerNumber", if (smsPayer != null && smsPayer == enteredNumber) "sms_extracted" else if (enteredNumber.isBlank()) "not_provided" else "manual_entry")
                    NaxaApi.submitClientPayment(
                        this, order.getString("id"), channel, smsText, enteredNumber,
                        enteredAmount, paidAtIso, enteredReference, sources
                    )
                } else {
                    NaxaApi.submitPromoterPayment(
                        this, channel, smsText, enteredNumber, enteredAmount, paidAtIso, enteredReference
                    )
                }
                runOnUiThread {
                    status.text = response.optString(
                        "message",
                        if (role == "client") "Déclaration transmise à la pharmacie." else "Déclaration transmise à NAXA."
                    )
                    submitButton.text = "Déclaration transmise"
                    submitButton.isEnabled = false
                }
            } catch (error: Exception) {
                runOnUiThread {
                    submitButton.isEnabled = true
                    status.text = error.message ?: "Transmission impossible. Vérifiez les informations puis réessayez."
                }
            }
        }
    }

    private fun submitAdminShare() {
        val selectedChannel = if ((adminChannelSpinner?.selectedItemPosition ?: 0) == 0) "orange_money" else "mtn_momo"
        if (smsText.isBlank()) {
            status.text = "Ouvrez le SMS de crédit puis partagez-le avec NAXA Paiement."
            return
        }
        status.text = "Transmission du SMS à la revue manuelle Admin…"
        executor.execute {
            try {
                val response = NaxaApi.submitAdminSharedSms(this, selectedChannel, smsText)
                runOnUiThread {
                    status.text = response.optString("status", "manual_review") +
                        " · Ce partage ne déclenche aucune confirmation automatique."
                }
            } catch (error: Exception) {
                runOnUiThread { status.text = error.message ?: "Partage Admin impossible." }
            }
        }
    }

    private fun addField(label: String, hint: String): EditText {
        root.addView(TextView(this).apply {
            text = label
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, dp(9), 0, dp(3))
        })
        return EditText(this).apply {
            setSingleLine(true)
            textSize = 14f
            this.hint = hint
            root.addView(this)
        }
    }

    private fun dp(value: Int): Int = (resources.displayMetrics.density * value).toInt()

    override fun onDestroy() {
        super.onDestroy()
        executor.shutdown()
    }
}
