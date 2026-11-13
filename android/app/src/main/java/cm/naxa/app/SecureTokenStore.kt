package cm.naxa.app

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Stores Supabase credentials encrypted with a non-exportable Android Keystore key. */
class SecureTokenStore(context: Context) {
    private val prefs = context.getSharedPreferences("naxa_secure_session", Context.MODE_PRIVATE)

    fun save(accessToken: String, refreshToken: String) {
        val plain = "$accessToken\n$refreshToken".toByteArray(Charsets.UTF_8)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getKey())
        val encrypted = cipher.doFinal(plain)
        prefs.edit().putString("session", Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP)).apply()
    }

    fun read(): Pair<String, String>? {
        return try {
            val raw = prefs.getString("session", null) ?: return null
            val bytes = Base64.decode(raw, Base64.NO_WRAP)
            if (bytes.size <= 12) return null
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, getKey(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
            val parts = String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8).split("\n", limit = 2)
            if (parts.size != 2 || parts.any { it.isBlank() }) null else parts[0] to parts[1]
        } catch (_: Exception) { null }
    }

    fun clear() { prefs.edit().remove("session").apply() }

    private fun getKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build())
        return generator.generateKey()
    }

    private companion object { const val KEY_ALIAS = "naxa_supabase_session_v1" }
}
