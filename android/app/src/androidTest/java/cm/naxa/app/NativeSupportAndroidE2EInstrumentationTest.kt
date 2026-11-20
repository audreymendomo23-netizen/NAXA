package cm.naxa.app

import android.os.SystemClock
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import org.junit.Assert.assertNotNull
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeSupportAndroidE2EInstrumentationTest {
    @Test
    fun nativeClientCompletesAudioAndExplicitScreenShareWithSupportAgent() {
        val args = InstrumentationRegistry.getArguments()
        val accessToken = args.getString("naxaSupportE2EAccessToken").orEmpty()
        val refreshToken = args.getString("naxaSupportE2ERefreshToken").orEmpty()
        val subject = args.getString("naxaSupportE2ESubject").orEmpty()
        assumeTrue(
            "La recette native Support est réservée au workflow Replay.",
            accessToken.isNotBlank() && refreshToken.isNotBlank() && subject.isNotBlank()
        )

        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        AgeGateStore(context).declareAdult()
        SecureTokenStore(context).save(accessToken, refreshToken)

        val device = UiDevice.getInstance(instrumentation)
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        try {
            val supportCard = findOrScroll(device, "Assistance NAXA")
            assertNotNull("La carte Assistance NAXA doit être disponible dans l’espace Client.", supportCard)
            supportCard!!.click()

            assertNotNull(
                "Le ticket Replay authentifié doit être visible dans le Support natif.",
                findOrScroll(device, subject)
            )
            val audioRequest = findOrScroll(device, "Demander un appel audio")
            assertNotNull("Le dossier doit proposer l’appel audio natif.", audioRequest)
            audioRequest!!.click()

            // Keep the Android microphone permission prompt real and explicit.
            val microphoneChoice = device.wait(
                Until.findObject(By.textContains("While using the app")),
                10_000
            ) ?: device.wait(Until.findObject(By.textContains("Allow")), 3_000)
            assertNotNull("Le dialogue système Android du microphone doit être présenté.", microphoneChoice)
            microphoneChoice!!.click()

            assertNotNull(
                "Le transport audio natif doit être connecté à l’Agent Support.",
                waitForText(device, "Audio connecté via le canal sécurisé.", 90_000)
            )

            val consent = device.wait(
                Until.findObject(By.desc("NAXA consentement partage écran")),
                15_000
            )
            assertNotNull("Le consentement explicite NAXA au partage doit être accessible.", consent)
            consent!!.click()

            val shareButton = findOrScroll(device, "Partager mon écran")
            assertNotNull("Le partage doit être disponible après consentement.", shareButton)
            shareButton!!.click()

            // Android MediaProjection remains the authority for the capture grant.
            device.wait(Until.findObject(By.textContains("Entire screen")), 3_000)?.click()
            val startCapture = device.wait(
                Until.findObject(By.textContains("Start now")),
                15_000
            ) ?: device.wait(Until.findObject(By.textContains("Start")), 3_000)
            assertNotNull("Le dialogue MediaProjection doit exiger une confirmation système.", startCapture)
            startCapture!!.click()

            assertNotNull(
                "La capture native doit devenir active après confirmation système.",
                waitForText(device, "Arrêter le partage d’écran", 30_000)
            )
            SystemClock.sleep(8_000) // The Agent independently checks decoded frames and RTP.

            val stopButton = findOrScroll(device, "Arrêter le partage d’écran")
            assertNotNull("Le Client doit pouvoir arrêter le partage lui-même.", stopButton)
            stopButton!!.click()
            assertNotNull(
                "L’arrêt explicite doit être visible dans l’application Android.",
                waitForText(device, "Le partage d’écran a été arrêté.", 20_000)
            )

            val hangup = findOrScroll(device, "Raccrocher")
            assertNotNull("La commande de raccrochage doit rester accessible.", hangup)
            hangup!!.click()
            assertNotNull(
                "La fin de l’appel doit être confirmée dans l’interface native.",
                waitForText(device, "Appel terminé", 30_000)
            )
        } finally {
            scenario.close()
        }
    }

    private fun waitForText(device: UiDevice, text: String, timeoutMs: Long): UiObject2? =
        device.wait(Until.findObject(By.text(text)), timeoutMs)

    private fun findOrScroll(device: UiDevice, text: String): UiObject2? {
        repeat(16) {
            device.wait(Until.findObject(By.text(text)), 1_500)?.let { return it }
            device.swipe(
                device.displayWidth / 2,
                (device.displayHeight * 0.80).toInt(),
                device.displayWidth / 2,
                (device.displayHeight * 0.28).toInt(),
                12
            )
            SystemClock.sleep(350)
        }
        return device.findObject(By.text(text))
    }
}
