package cm.naxa.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class NaxaCoordinates(val latitude: Double, val longitude: Double)

data class NearbyPharmacy(
    val id: String,
    val name: String,
    val city: String?,
    val district: String?,
    val address: String?,
    val onDuty: Boolean,
    val deliveryAvailable: Boolean,
    val distanceRoadKm: Double?,
    val distanceStraightKm: Double?,
    val travelMinutes: Int?,
    val openingHours: String?,
    val mapsUrl: String?
)

class PharmacyRepository(context: Context) {
    private val appContext = context.applicationContext
    private val locationClient = LocationServices.getFusedLocationProviderClient(appContext)
    private val http = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS)
        .build()

    suspend fun currentLocation(): NaxaCoordinates {
        val fine = ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(appContext, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) throw IOException("Autorisez la localisation pour rechercher les pharmacies proches.")

        return suspendCancellableCoroutine { continuation ->
            val cancellation = CancellationTokenSource()
            continuation.invokeOnCancellation { cancellation.cancel() }
            try {
                locationClient.getCurrentLocation(
                    if (fine) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                    cancellation.token
                ).addOnSuccessListener { location ->
                    if (location == null) {
                        if (continuation.isActive) continuation.resumeWithException(
                            IOException("Position indisponible. Activez le GPS et réessayez.")
                        )
                    } else if (continuation.isActive) {
                        continuation.resume(NaxaCoordinates(location.latitude, location.longitude))
                    }
                }.addOnFailureListener { error ->
                    if (continuation.isActive) continuation.resumeWithException(
                        IOException(error.message ?: "Lecture de la position impossible.")
                    )
                }
            } catch (error: SecurityException) {
                if (continuation.isActive) continuation.resumeWithException(
                    IOException("Autorisation de localisation refusée.")
                )
            }
        }
    }

    suspend fun nearby(coordinates: NaxaCoordinates): List<NearbyPharmacy> = withContext(Dispatchers.IO) {
        val url = BuildConfig.NAXA_BASE_URL.trimEnd('/').toHttpUrl().newBuilder()
            .addPathSegments("api/pharmacies/proches")
            .addQueryParameter("lat", coordinates.latitude.toString())
            .addQueryParameter("lng", coordinates.longitude.toString())
            .build()

        http.newCall(Request.Builder().url(url).header("Accept", "application/json").get().build())
            .execute().use { response ->
                val payload = try {
                    JSONObject(response.body?.string().orEmpty())
                } catch (_: Exception) {
                    throw IOException("Réponse pharmacies illisible.")
                }
                if (!response.isSuccessful || !payload.optBoolean("ok", false)) {
                    throw IOException(
                        payload.optString("error").ifBlank {
                            payload.optString("message").ifBlank {
                                "Recherche de pharmacies indisponible (HTTP ${response.code})."
                            }
                        }
                    )
                }

                parsePharmacies(payload)
            }
    }

    internal fun parsePharmacies(payload: JSONObject): List<NearbyPharmacy> {
        val rows = payload.optJSONArray("pharmacies") ?: return emptyList()
        return buildList {
            for (index in 0 until rows.length()) {
                val item = rows.optJSONObject(index) ?: continue
                val id = item.optString("id")
                val name = item.optString("nom")
                if (id.isBlank() || name.isBlank()) continue
                add(
                    NearbyPharmacy(
                        id = id,
                        name = name,
                        city = item.stringOrNull("ville"),
                        district = item.stringOrNull("quartier"),
                        address = item.stringOrNull("adresse"),
                        onDuty = item.optBoolean("de_garde", false),
                        deliveryAvailable = item.optBoolean("livraison_active", false),
                        distanceRoadKm = item.doubleOrNull("distanceRoutiereKm"),
                        distanceStraightKm = item.doubleOrNull("distanceKm")?.takeIf { it >= 0 },
                        travelMinutes = item.intOrNull("dureeTrajetMinutes"),
                        openingHours = item.stringOrNull("horaires"),
                        mapsUrl = item.stringOrNull("googleMapsUrl")
                    )
                )
            }
        }
    }
}

private fun JSONObject.stringOrNull(key: String): String? =
    optString(key).takeIf { it.isNotBlank() && it != "null" }

private fun JSONObject.doubleOrNull(key: String): Double? {
    if (isNull(key)) return null
    return optDouble(key, Double.NaN).takeIf { it.isFinite() }
}

private fun JSONObject.intOrNull(key: String): Int? {
    if (isNull(key)) return null
    return optInt(key, Int.MIN_VALUE).takeIf { it >= 0 }
}
