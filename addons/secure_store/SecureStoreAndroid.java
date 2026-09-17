// SecureStoreAndroid — issue #1095.
//
// Bridges GDScript calls into Android's Keystore-backed
// EncryptedSharedPreferences so the session/refresh tokens never sit in
// plaintext on disk and the master key is non-extractable from the
// Android Keystore (hardware-backed when the device supports it).
//
// GDScript-facing API (see addons/secure_store/SecureStoreAndroid.gdap):
//   bool hasBlob(String name);
//   boolean saveBlob(String name, byte[] plaintext);
//   byte[] loadBlob(String name);
//   boolean eraseBlob(String name);
//
// All four methods are safe to call on the main thread because
// EncryptedSharedPreferences performs synchronous file I/O; we accept
// the (small) latency to keep the GDScript wrapper simple.

package com.armoredarcher.game.securestore;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

public class SecureStoreAndroid {

    private static final String PREF_FILE = "armored_archer_secure_store";
    private final SharedPreferences prefs;

    public SecureStoreAndroid(@NonNull Context context) {
        MasterKey masterKey;
        try {
            masterKey = new MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build();
        } catch (Exception e) {
            throw new RuntimeException("SecureStore: failed to build Android Keystore master key", e);
        }
        SharedPreferences created;
        try {
            created = EncryptedSharedPreferences.create(
                context,
                PREF_FILE,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception e) {
            // Surface as a runtime error; the GDScript wrapper will fall back
            // to the desktop path. NEVER log plaintext token values.
            throw new RuntimeException("SecureStore: EncryptedSharedPreferences unavailable", e);
        }
        this.prefs = created;
    }

    public boolean hasBlob(@NonNull String name) {
        return prefs.contains(name);
    }

    public boolean saveBlob(@NonNull String name, @NonNull byte[] plaintext) {
        // Encode bytes as Base64 so SharedPreferences can store them
        // without a type-tag dance; GDScript decodes the same way.
        String encoded = android.util.Base64.encodeToString(plaintext, android.util.Base64.NO_WRAP);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString(name, encoded);
        return editor.commit();
    }

    @Nullable
    public byte[] loadBlob(@NonNull String name) {
        String encoded = prefs.getString(name, null);
        if (encoded == null) {
            return null;
        }
        return android.util.Base64.decode(encoded, android.util.Base64.NO_WRAP);
    }

    public boolean eraseBlob(@NonNull String name) {
        SharedPreferences.Editor editor = prefs.edit();
        editor.remove(name);
        return editor.commit();
    }
}
