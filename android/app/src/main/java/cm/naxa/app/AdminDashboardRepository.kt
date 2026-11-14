package cm.naxa.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class AdminDashboardSummary(
    val pharmaciesTotal: Int?,
    val stockTimestamped: Int?,
    val stockNeedsUpdate: Int?,
    val neighborhoodsCovered: Int?,
    val stockProgressPercent: Int?,
    val inactivePharmacies: Int?,
    val promoterAlerts: Int?,
    val alertsTotal: Int?,
    val lastStockUpdate: String?
)

data class AdminActivityEntry(
    val id: String,
    val action: String,
    val entityType: String,
    val createdAt: String
)

data class AdminDashboardSnapshot(
    val summary: AdminDashboardSummary,
    val recentActivity: List<AdminActivityEntry>,
    val partial: Boolean
)

/** Loads the Admin 360 overview only through the authenticated, RLS-scoped NAXA API. */
class AdminDashboardRepository(private val tokenStore: SecureTokenStore) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun load(): AdminDashboardSnapshot = withContext(Dispatchers.IO) {
        val accessToken = tokenStore.read()?.first
            ?: throw IOException("Reconnectez-vous pour consulter l’administration.")

        if (BuildConfig.NAXA_BASE_URL.isBlank()) {
            throw IOException("Adresse du service NAXA indisponible.")
        }

        val request = Request.Builder()
            .url("${BuildConfig.NAXA_BASE_URL.trimEnd('/')}/api/v1/admin/dashboard")
            .header("Authorization", "Bearer $accessToken")
            .header("Accept", "application/json")
            .header("Cache-Control", "no-store")
            .get()
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            val payload = try {
                if (raw.isBlank()) JSONObject() else JSONObject(raw)
            } catch (_: Exception) {
                throw IOException("Réponse du tableau de bord Admin illisible.")
            }

            if (!response.isSuccessful || !payload.optBoolean("ok", false)) {
                val message = when (payload.optString("code")) {
                    "AUTH_REQUIRED", "AUTH_INVALID" -> "Session expirée. Reconnectez-vous."
                    "ADMIN_REQUIRED" -> "Le poste Admin doit être actif sur ce compte."
                    "ADMIN_CONTEXT_UNAVAILABLE", "AUTH_UNAVAILABLE" ->
                        "Vérification des droits Admin indisponible. Réessayez."
                    else -> "Chargement du tableau de bord impossible (HTTP ${response.code})."
                }
                throw IOException(message)
            }

            val summaryJson = payload.optJSONObject("summary")
                ?: throw IOException("Indicateurs Admin absents.")
            val summary = AdminDashboardSummary(
                pharmaciesTotal = summaryJson.intOrNull("pharmaciesTotal"),
                stockTimestamped = summaryJson.intOrNull("stockTimestamped"),
                stockNeedsUpdate = summaryJson.intOrNull("stockNeedsUpdate"),
                neighborhoodsCovered = summaryJson.intOrNull("neighborhoodsCovered"),
                stockProgressPercent = summaryJson.intOrNull("stockProgressPercent"),
                inactivePharmacies = summaryJson.intOrNull("inactivePharmacies"),
                promoterAlerts = summaryJson.intOrNull("promoterAlerts"),
                alertsTotal = summaryJson.intOrNull("alertsTotal"),
                lastStockUpdate = summaryJson.stringOrNull("lastStockUpdate")
            )

            val activity = payload.optJSONArray("recentActivity").toAdminActivityEntries()
            val partialJson = payload.optJSONObject("partial")
            val partial = partialJson?.let {
                it.optBoolean("pharmacies") ||
                    it.optBoolean("promoterValidity") ||
                    it.optBoolean("auditLog")
            } ?: true

            AdminDashboardSnapshot(summary, activity, partial)
        }
    }
}

private fun JSONArray?.toAdminActivityEntries(): List<AdminActivityEntry> {
    if (this == null) return emptyList()
    return buildList {
        for (index in 0 until length()) {
            val item = optJSONObject(index) ?: continue
            val id = item.optString("id")
            if (id.isBlank()) continue
            add(
                AdminActivityEntry(
                    id = id,
                    action = item.optString("action").ifBlank { "Action" },
                    entityType = item.optString("entityType").ifBlank { "Élément" },
                    createdAt = item.optString("createdAt")
                )
            )
        }
    }
}

private fun JSONObject.intOrNull(key: String): Int? =
    if (isNull(key) || !has(key)) null else optInt(key)

private fun JSONObject.stringOrNull(key: String): String? =
    if (isNull(key) || !has(key)) null else optString(key).takeIf { it.isNotBlank() }
