package cm.naxa.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit

data class NativeScanResult(
    val text: String,
    val pagesProcessed: Int,
    val pageLimitReached: Boolean
)

/**
 * Local-only OCR for prescription images and PDFs.
 * The original document is never sent to the NAXA API by this repository.
 */
class ScannerRepository {
    companion object {
        private const val MAX_PDF_PAGES = 10
        private const val MAX_PDF_BYTES = 40L * 1024L * 1024L
        private const val MAX_IMAGE_SIDE = 2200
        private const val OCR_TIMEOUT_SECONDS = 45L
    }

    suspend fun scan(context: Context, uri: Uri): NativeScanResult = withContext(Dispatchers.IO) {
        val mimeType = context.contentResolver.getType(uri)?.lowercase()
        val fileName = uri.lastPathSegment.orEmpty().lowercase()
        val isPdf = mimeType == "application/pdf" || fileName.endsWith(".pdf")

        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        try {
            if (isPdf) scanPdf(context, uri, recognizer) else scanImage(context, uri, recognizer)
        } finally {
            recognizer.close()
        }
    }

    private fun scanImage(
        context: Context,
        uri: Uri,
        recognizer: com.google.mlkit.vision.text.TextRecognizer
    ): NativeScanResult {
        val mimeType = context.contentResolver.getType(uri)?.lowercase().orEmpty()
        if (mimeType.isNotBlank() && !mimeType.startsWith("image/")) {
            throw IOException("Format non pris en charge. Choisissez une image ou un PDF.")
        }
        val image = InputImage.fromFilePath(context, uri)
        val result = Tasks.await(
            recognizer.process(image),
            OCR_TIMEOUT_SECONDS,
            TimeUnit.SECONDS
        )
        return NativeScanResult(result.text.trim(), 1, false)
    }

    private fun scanPdf(
        context: Context,
        uri: Uri,
        recognizer: com.google.mlkit.vision.text.TextRecognizer
    ): NativeScanResult {
        val file = copyPdfToCache(context, uri)
        try {
            val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            descriptor.use { pfd ->
                PdfRenderer(pfd).use { renderer ->
                    if (renderer.pageCount <= 0) throw IOException("Le PDF ne contient aucune page.")
                    val pageCount = minOf(renderer.pageCount, MAX_PDF_PAGES)
                    val text = StringBuilder()
                    for (index in 0 until pageCount) {
                        renderer.openPage(index).use { page ->
                            val scale = minOf(
                                1f,
                                MAX_IMAGE_SIDE.toFloat() / maxOf(page.width, page.height).toFloat()
                            )
                            val width = (page.width * scale).toInt().coerceAtLeast(1)
                            val height = (page.height * scale).toInt().coerceAtLeast(1)
                            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                            try {
                                page.render(
                                    bitmap,
                                    null,
                                    null,
                                    PdfRenderer.Page.RENDER_MODE_FOR_PRINT
                                )
                                val recognized = Tasks.await(
                                    recognizer.process(InputImage.fromBitmap(bitmap, 0)),
                                    OCR_TIMEOUT_SECONDS,
                                    TimeUnit.SECONDS
                                )
                                if (recognized.text.isNotBlank()) {
                                    if (text.isNotEmpty()) text.append("\n\n")
                                    text.append("Page ").append(index + 1).append("\n")
                                        .append(recognized.text.trim())
                                }
                            } finally {
                                bitmap.recycle()
                            }
                        }
                    }
                    return NativeScanResult(
                        text = text.toString().take(16000),
                        pagesProcessed = pageCount,
                        pageLimitReached = renderer.pageCount > MAX_PDF_PAGES
                    )
                }
            }
        } finally {
            file.delete()
        }
    }

    private fun copyPdfToCache(context: Context, uri: Uri): File {
        val input = context.contentResolver.openInputStream(uri)
            ?: throw IOException("Impossible d'ouvrir le PDF sélectionné.")
        val target = File.createTempFile("naxa-scan-", ".pdf", context.cacheDir)
        try {
            input.use { source ->
                FileOutputStream(target).use { output ->
                    val buffer = ByteArray(16 * 1024)
                    var total = 0L
                    while (true) {
                        val count = source.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > MAX_PDF_BYTES) {
                            throw IOException("Le PDF dépasse la limite de 40 Mo.")
                        }
                        output.write(buffer, 0, count)
                    }
                }
            }
            if (target.length() == 0L) throw IOException("Le PDF sélectionné est vide.")
            return target
        } catch (error: Exception) {
            target.delete()
            throw error
        }
    }
}
