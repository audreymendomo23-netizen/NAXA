package cm.naxa.paymentcompanion

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.URL
import java.nio.charset.StandardCharsets
import javax.net.ssl.HttpsURLConnection

object HttpClient {
    fun post(
        urlText: String,
        bearer: String?,
        apiKey: String?,
        body: JSONObject,
        headers: Map<String, String> = emptyMap()
    ): JSONObject {
        val url = URL(urlText)
        require(url.protocol.equals("https", ignoreCase = true)) { "HTTPS is mandatory." }
        val connection = url.openConnection() as HttpsURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 8000
        connection.readTimeout = 12000
        connection.doOutput = true
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
        connection.setRequestProperty("Cache-Control", "no-store")
        if (!bearer.isNullOrEmpty()) connection.setRequestProperty("Authorization", "Bearer " + bearer)
        if (!apiKey.isNullOrEmpty()) connection.setRequestProperty("apikey", apiKey)
        headers.forEach { (name, value) -> connection.setRequestProperty(name, value) }
        val payload = body.toString().toByteArray(StandardCharsets.UTF_8)
        connection.setFixedLengthStreamingMode(payload.size)
        connection.outputStream.use { it.write(payload) }
        return readResponse(connection)
    }

    fun get(urlText: String, bearer: String?, apiKey: String? = null): JSONObject {
        val url = URL(urlText)
        require(url.protocol.equals("https", ignoreCase = true)) { "HTTPS is mandatory." }
        val connection = url.openConnection() as HttpsURLConnection
        connection.requestMethod = "GET"
        connection.connectTimeout = 8000
        connection.readTimeout = 12000
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Cache-Control", "no-store")
        if (!bearer.isNullOrEmpty()) connection.setRequestProperty("Authorization", "Bearer " + bearer)
        if (!apiKey.isNullOrEmpty()) connection.setRequestProperty("apikey", apiKey)
        return readResponse(connection)
    }

    private fun readResponse(connection: HttpsURLConnection): JSONObject {
        try {
            val status = connection.responseCode
            val input: InputStream? = if (status in 200..299) connection.inputStream else connection.errorStream
            val responseText = input?.let { readFully(it) }.orEmpty()
            val response = try {
                if (responseText.isEmpty()) JSONObject() else JSONObject(responseText)
            } catch (_: Exception) { JSONObject().put("raw", responseText.take(500)) }
            if (status !in 200..299) {
                val message = response.optString("msg", response.optString("message",
                    response.optString("error_description", response.optString("error", "HTTP " + status))))
                throw HttpException(status, message)
            }
            return response
        } finally {
            connection.disconnect()
        }
    }

    private fun readFully(input: InputStream): String = input.use { stream ->
        ByteArrayOutputStream().use { output ->
            val buffer = ByteArray(4096)
            while (true) {
                val count = stream.read(buffer)
                if (count == -1) break
                output.write(buffer, 0, count)
            }
            String(output.toByteArray(), StandardCharsets.UTF_8)
        }
    }

    class HttpException(val status: Int, message: String) : Exception(message)
}
