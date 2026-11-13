package cm.naxa.paymentcompanion
import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object SecureVault {
    private const val PREFS = "naxa_payment_secure_v1"
    private const val KEY_ALIAS = "naxa.payment.companion.aes.v1"
    private const val IV_BYTES = 12
    private const val TAG_BITS = 128
    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun encryptionKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore")
        store.load(null)
        if (store.containsAlias(KEY_ALIAS)) {
            val entry = store.getEntry(KEY_ALIAS, null)
            if (entry is KeyStore.SecretKeyEntry) return entry.secretKey
        }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).build()
        generator.init(spec)
        return generator.generateKey()
    }
    @Synchronized fun put(context: Context, name: String, value: String) {
        require(name.isNotBlank() && value.isNotEmpty()) { "Secure storage key/value missing." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
        val encrypted = cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        val packed = ByteBuffer.allocate(cipher.iv.size + encrypted.size).put(cipher.iv).put(encrypted).array()
        val encoded = Base64.encodeToString(packed, Base64.NO_WRAP)
        check(prefs(context).edit().putString(name, encoded).commit()) { "Secure storage write failed." }
    }
    @Synchronized fun get(context: Context, name: String): String? {
        val encoded = prefs(context).getString(name, null) ?: return null
        return try {
            val packed = Base64.decode(encoded, Base64.NO_WRAP)
            if (packed.size <= IV_BYTES) return null
            val buffer = ByteBuffer.wrap(packed)
            val iv = ByteArray(IV_BYTES).also { buffer.get(it) }
            val encrypted = ByteArray(buffer.remaining()).also { buffer.get(it) }
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), GCMParameterSpec(TAG_BITS, iv))
            String(cipher.doFinal(encrypted), StandardCharsets.UTF_8)
        } catch (_: Exception) { null }
    }
    fun remove(context: Context, name: String) { prefs(context).edit().remove(name).apply() }
}
