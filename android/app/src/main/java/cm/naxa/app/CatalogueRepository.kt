package cm.naxa.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class NativeMedicine(
    val id: String,
    val name: String,
    val activeIngredient: String?,
    val form: String?,
    val definition: String?,
    val availability: String,
    val partnerPharmacyCount: Int?,
    val lowestPartnerPrice: Long?,
    val sources: List<String>
)

data class CatalogueSearchResult(
    val medicines: List<NativeMedicine>,
    val notice: String?,
    val barcodeLookup: Boolean
)

class CatalogueRepository {
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS)
        .build()

    suspend fun search(query: String): CatalogueSearchResult = withContext(Dispatchers.IO) {
        val term = query.trim()
        require(term.length >= 2) { "Saisissez au moins deux caractères." }
        val url = BuildConfig.NAXA_BASE_URL.trimEnd('/').toHttpUrl().newBuilder()
            .addPathSegments("api/medicaments/recherche")
            .addQueryParameter("q", term.take(100))
            .build()

        http.newCall(Request.Builder().url(url).header("Accept", "application/json").get().build())
            .execute().use { response ->
                val raw = response.body?.string().orEmpty()
                val payload = try {
                    if (raw.isBlank()) JSONObject() else JSONObject(raw)
                } catch (_: Exception) {
                    throw IOException("Réponse catalogue illisible.")
                }
                if (!response.isSuccessful) {
                    val message = payload.optString("message")
                        .ifBlank { payload.optString("error") }
                        .ifBlank { "Recherche indisponible (HTTP ${response.code})." }
                    throw IOException(message)
                }
                CatalogueSearchResult(
                    medicines = parseMedicines(payload),
                    notice = payload.optString("notice").takeIf { it.isNotBlank() },
                    barcodeLookup = payload.optBoolean("barcodeLookup", false)
                )
            }
    }

    internal fun parseMedicines(payload: JSONObject): List<NativeMedicine> {
        val rows = payload.optJSONArray("results") ?: return emptyList()
        return buildList {
            for (index in 0 until rows.length()) {
                val row = rows.optJSONObject(index) ?: continue
                val id = row.optString("id")
                val name = row.optString("name")
                if (id.isBlank() || name.isBlank()) continue
                val count = row.optIntOrNull("partnerPharmacyCount")
                val price = row.optLongOrNull("lowestPartnerPrice")
                val sources = row.optJSONArray("source")?.let { array ->
                    buildList {
                        for (i in 0 until array.length()) {
                            array.optString(i).takeIf { it.isNotBlank() }?.let(::add)
                        }
                    }
                }.orEmpty()
                add(
                    NativeMedicine(
                        id = id,
                        name = name,
                        activeIngredient = row.optNullableString("activeIngredient"),
                        form = row.optNullableString("form"),
                        definition = row.optNullableString("definition"),
                        availability = row.optString("availability", "non_verifiee"),
                        partnerPharmacyCount = count,
                        lowestPartnerPrice = price,
                        sources = sources
                    )
                )
            }
        }
    }
}

private fun JSONObject.optNullableString(key: String): String? =
    optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun JSONObject.optIntOrNull(key: String): Int? {
    if (isNull(key)) return null
    val number = optDouble(key, Double.NaN)
    return number.takeIf { it.isFinite() && it >= 0 }?.toInt()
}

private fun JSONObject.optLongOrNull(key: String): Long? {
    if (isNull(key)) return null
    val number = optDouble(key, Double.NaN)
    return number.takeIf { it.isFinite() && it >= 0 }?.toLong()
}
