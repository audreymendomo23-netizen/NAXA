package cm.naxa.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class ClientReservationHistory(
    val id: String, val mode: String, val status: String, val orderStatus: String?,
    val paymentStatus: String, val paymentReference: String?, val total: Long,
    val createdAt: String, val pharmacy: String, val city: String?, val district: String?,
    val events: List<ClientReservationEvent>
)
data class ClientReservationEvent(val id: String, val eventType: String, val toStatus: String?, val occurredAt: String)
data class ClientPurchaseLine(
    val reservationId: String, val productId: String, val medicine: String, val dosage: String?,
    val form: String?, val quantity: Int, val lineTotal: Long, val transactionTotal: Long?,
    val paymentReference: String?, val purchasedAt: String?, val createdAt: String,
    val pharmacy: String, val city: String?, val status: String
)
data class ClientHistorySnapshot(
    val reservations: List<ClientReservationHistory>,
    val purchases: List<ClientPurchaseLine>,
    val purchasesUnavailable: Boolean
)

/** Reads only the signed-in Client's history through RLS-scoped Supabase PostgREST. */
class ClientHistoryRepository(private val tokenStore: SecureTokenStore) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS).build()

    suspend fun load(clientId: String): ClientHistorySnapshot = withContext(Dispatchers.IO) {
        require(clientId.isNotBlank()) { "Identité Client absente." }
        val accessToken = tokenStore.read()?.first
            ?: throw IOException("Reconnectez-vous pour consulter vos achats.")

        val reservations = parseClientReservationRows(getArray(
            "reservations",
            listOf(
                "select" to "id,client_id,pharmacie_id,statut,mode,total,created_at,expires_at,commande_statut,paiement_statut,paiement_ref,pharmacies(nom,ville,quartier,adresse)",
                "client_id" to "eq.$clientId", "order" to "created_at.desc", "limit" to "1000"
            ), accessToken
        ))

        val purchasesResult = runCatching {
            getArray(
                "client_achats",
                listOf(
                    "select" to "reservation_id,produit_id,medicament,dci,dosage,forme,quantite,prix_unitaire,total_ligne,total_transaction,reference_paiement,reservation_creee_le,pharmacie_id,pharmacie,ville,quartier,adresse,confirmee_le,paiement_declare_le,payee_le,retiree_le,achat_le,horodatage_achat_exact,statut",
                    "client_id" to "eq.$clientId", "order" to "achat_le.desc.nullslast", "limit" to "2000"
                ), accessToken
            )
        }
        val purchasesUnavailable = purchasesResult.isFailure
        val purchases = purchasesResult.getOrNull()?.let(::parseClientPurchaseRows).orEmpty()

        val ids = reservations.take(200).map { it.id }.filter(::isNaxaUuid)
        val events = if (ids.isEmpty()) emptyList() else runCatching {
            parseClientReservationEvents(getArray(
                "reservation_events",
                listOf(
                    "select" to "id,reservation_id,event_type,from_statut,to_statut,paiement_ref,occurred_at,detail",
                    "reservation_id" to "in.(${ids.joinToString(",")})",
                    "order" to "occurred_at.desc", "limit" to "1000"
                ), accessToken
            ))
        }.getOrNull().orEmpty()
        val grouped = events.groupBy { it.first }
        ClientHistorySnapshot(
            reservations.map { row -> row.copy(events = grouped[row.id].orEmpty().map { it.second }) },
            purchases, purchasesUnavailable
        )
    }

    private fun getArray(resource: String, parameters: List<Pair<String, String>>, token: String): JSONArray {
        val base = BuildConfig.SUPABASE_URL.trimEnd('/')
        if (base.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
            throw IOException("Configuration Supabase Android indisponible.")
        }
        val url = base.toHttpUrl().newBuilder().addPathSegments("rest/v1/$resource")
            .apply { parameters.forEach { (name, value) -> addQueryParameter(name, value) } }.build()
        val request = Request.Builder().url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-store").get().build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = when (response.code) {
                    401 -> "Session expirée. Reconnectez-vous."
                    403 -> "Accès à vos données refusé par les règles de sécurité NAXA."
                    404 -> "Données d'historique indisponibles dans cet environnement."
                    else -> "Consultation de l'historique impossible (HTTP ${response.code})."
                }
                throw IOException(message)
            }
            return try { JSONArray(raw) } catch (_: Exception) {
                throw IOException("Réponse d'historique NAXA illisible.")
            }
        }
    }
}

internal fun parseClientReservationRows(rows: JSONArray): List<ClientReservationHistory> = buildList {
    for (index in 0 until rows.length()) {
        val row = rows.optJSONObject(index) ?: continue
        val id = row.optString("id")
        if (!isNaxaUuid(id)) continue
        val pharmacy = row.optJSONObject("pharmacies")
        add(ClientReservationHistory(
            id, row.optString("mode", "reservation"), row.optString("statut", "inconnu"),
            row.nullableString("commande_statut"), row.optString("paiement_statut", "inconnu"),
            row.nullableString("paiement_ref"), row.longOrZero("total"), row.optString("created_at"),
            pharmacy?.optString("nom").orEmpty().ifBlank { "Pharmacie" },
            pharmacy?.nullableString("ville"), pharmacy?.nullableString("quartier"), emptyList()
        ))
    }
}

internal fun parseClientPurchaseRows(rows: JSONArray): List<ClientPurchaseLine> = buildList {
    for (index in 0 until rows.length()) {
        val row = rows.optJSONObject(index) ?: continue
        val reservationId = row.optString("reservation_id")
        val productId = row.optString("produit_id")
        val medicine = row.optString("medicament")
        if (!isNaxaUuid(reservationId) || productId.isBlank() || medicine.isBlank()) continue
        add(ClientPurchaseLine(
            reservationId, productId, medicine, row.nullableString("dosage"), row.nullableString("forme"),
            row.optInt("quantite", 0).coerceAtLeast(0), row.longOrZero("total_ligne"),
            row.nullableLong("total_transaction"), row.nullableString("reference_paiement"),
            row.nullableString("achat_le") ?: row.nullableString("payee_le") ?: row.nullableString("retiree_le"),
            row.optString("reservation_creee_le"), row.optString("pharmacie").ifBlank { "Pharmacie" },
            row.nullableString("ville"), row.optString("statut", "inconnu")
        ))
    }
}

internal fun parseClientReservationEvents(rows: JSONArray): List<Pair<String, ClientReservationEvent>> = buildList {
    for (index in 0 until rows.length()) {
        val row = rows.optJSONObject(index) ?: continue
        val reservationId = row.optString("reservation_id")
        val id = row.optString("id")
        if (!isNaxaUuid(reservationId) || id.isBlank()) continue
        add(reservationId to ClientReservationEvent(
            id, row.optString("event_type", "mise_a_jour"),
            row.nullableString("to_statut"), row.optString("occurred_at")
        ))
    }
}

internal fun isNaxaUuid(value: String): Boolean =
    value.matches(Regex("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
private fun JSONObject.nullableString(key: String): String? = optString(key).takeIf { it.isNotBlank() && it != "null" }
private fun JSONObject.longOrZero(key: String): Long = if (isNull(key)) 0L else optLong(key, 0L).coerceAtLeast(0L)
private fun JSONObject.nullableLong(key: String): Long? = if (isNull(key)) null else optLong(key, Long.MIN_VALUE).takeIf { it >= 0L }
