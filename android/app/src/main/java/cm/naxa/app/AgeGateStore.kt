package cm.naxa.app

import android.content.Context

/** A visitor's local adult declaration; it is not a substitute for account verification. */
class AgeGateStore(context: Context) {
    private val prefs = context.getSharedPreferences("naxa_age_declaration", Context.MODE_PRIVATE)

    fun isAdultDeclared(): Boolean = prefs.getBoolean(KEY_ADULT_DECLARED, false)

    fun declareAdult() {
        prefs.edit()
            .putBoolean(KEY_ADULT_DECLARED, true)
            .putLong(KEY_DECLARED_AT, System.currentTimeMillis())
            .apply()
    }

    private companion object {
        const val KEY_ADULT_DECLARED = "adult_declared"
        const val KEY_DECLARED_AT = "declared_at"
    }
}
