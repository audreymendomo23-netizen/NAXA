package cm.naxa.paymentcompanion;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class SecureVault {
    private static final String PREFS = "naxa_payment_secure_v1";
    private static final String KEY_ALIAS = "naxa.payment.companion.aes.v1";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private SecureVault() { }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static SecretKey encryptionKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(KEY_ALIAS)) {
            KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
            if (entry instanceof KeyStore.SecretKeyEntry) {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build();
        generator.init(spec);
        return generator.generateKey();
    }

    public static synchronized void put(Context context, String name, String value) throws Exception {
        if (name == null || name.trim().isEmpty() || value == null) {
            throw new IllegalArgumentException("Secure storage key/value missing.");
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey());
        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        byte[] iv = cipher.getIV();
        ByteBuffer buffer = ByteBuffer.allocate(iv.length + encrypted.length);
        buffer.put(iv);
        buffer.put(encrypted);
        String encoded = Base64.encodeToString(buffer.array(), Base64.NO_WRAP);
        if (!prefs(context).edit().putString(name, encoded).commit()) {
            throw new IllegalStateException("Secure storage write failed.");
        }
    }

    public static synchronized String get(Context context, String name) {
        String encoded = prefs(context).getString(name, null);
        if (encoded == null) return null;
        try {
            byte[] packed = Base64.decode(encoded, Base64.NO_WRAP);
            if (packed.length <= IV_BYTES) return null;
            ByteBuffer buffer = ByteBuffer.wrap(packed);
            byte[] iv = new byte[IV_BYTES];
            buffer.get(iv);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception error) {
            return null;
        }
    }

    public static synchronized void remove(Context context, String name) {
        prefs(context).edit().remove(name).apply();
    }
}
