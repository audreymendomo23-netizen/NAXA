package cm.naxa.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import android.webkit.ValueCallback

/**
 * Android parity shell: the Android app displays the same responsive NAXA
 * application as Web/PWA instead of maintaining a reduced, divergent set of
 * native business pages. Native Android capabilities remain in the app and
 * can be integrated progressively without duplicating the business UI.
 */
class ParityWebActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var baseHost: String = ""

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileChooserCallback
        fileChooserCallback = null
        if (result.resultCode == RESULT_OK) {
            val data = result.data
            val selected = when {
                data?.clipData != null -> Array(data.clipData!!.itemCount) { index ->
                    data.clipData!!.getItemAt(index).uri
                }
                data?.data != null -> arrayOf(data.data!!)
                else -> null
            }
            callback?.onReceiveValue(selected)
        } else {
            callback?.onReceiveValue(null)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val baseUrl = BuildConfig.NAXA_BASE_URL.trimEnd('/')
        val baseUri = Uri.parse(baseUrl)
        if (baseUri.scheme != "https" || baseUri.host.isNullOrBlank()) {
            showFatal("L’adresse sécurisée de NAXA n’est pas configurée.")
            return
        }
        baseHost = baseUri.host!!

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.rgb(245, 248, 246))
        }
        val toolbar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(8), dp(12), dp(8))
            setBackgroundColor(android.graphics.Color.WHITE)
        }
        val brand = TextView(this).apply {
            text = "NAXA"
            textSize = 21f
            setTextColor(android.graphics.Color.rgb(8, 122, 85))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val reload = Button(this).apply {
            text = "Actualiser"
            setOnClickListener { webView.reload() }
        }
        toolbar.addView(brand, LinearLayout.LayoutParams(0, dp(48), 1f))
        toolbar.addView(reload, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, dp(44)
        ))
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = 0
        }
        webView = WebView(this)
        status = TextView(this).apply {
            text = "Connexion à NAXA…"
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
            setTextColor(android.graphics.Color.rgb(23, 52, 43))
            visibility = View.GONE
        }

        root.addView(toolbar)
        root.addView(progress, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(3)
        ))
        val content = FrameLayout(this)
        content.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        content.addView(status, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        root.addView(content, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f
        ))
        setContentView(root)

        CookieManager.getInstance().setAcceptCookie(true)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            builtInZoomControls = false
            displayZoomControls = false
            loadsImagesAutomatically = true
            if (android.os.Build.VERSION.SDK_INT >= 26) safeBrowsingEnabled = true
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progress.progress = newProgress
                progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "application/pdf"))
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, false)
                }
                return try {
                    filePicker.launch(intent)
                    true
                } catch (_: Exception) {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    false
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean = handleNavigation(request?.url)

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                status.visibility = View.GONE
                webView.visibility = View.VISIBLE
                progress.visibility = View.VISIBLE
                progress.progress = 0
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                status.visibility = View.GONE
                webView.visibility = View.VISIBLE
                progress.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    webView.visibility = View.GONE
                    status.text = "NAXA est momentanément inaccessible. Vérifiez votre connexion puis actualisez la page."
                    status.visibility = View.VISIBLE
                }
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: android.net.http.SslError?
            ) {
                handler?.cancel()
                webView.visibility = View.GONE
                status.text = "Connexion sécurisée impossible. L’accès a été bloqué."
                status.visibility = View.VISIBLE
            }
        }
        webView.setDownloadListener { url, _, _, _, _ ->
            openExternal(Uri.parse(url))
        }

        val requestedPath = intent.getStringExtra("openPath")
        val safePath = requestedPath?.takeIf {
            it.startsWith("/") && !it.startsWith("//") && !it.contains("\\")
        }
        webView.loadUrl(baseUrl + (safePath ?: "/"))
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
                else finish()
            }
        })
    }

    private fun handleNavigation(uri: Uri?): Boolean {
        if (uri == null) return true
        if (uri.scheme == "https" && uri.host == baseHost) return false
        if (uri.scheme == "https" || uri.scheme == "http" ||
            uri.scheme == "tel" || uri.scheme == "mailto"
        ) {
            openExternal(uri)
        }
        return true
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: Exception) {
            status.text = "Aucune application disponible pour ouvrir ce lien."
            status.visibility = View.VISIBLE
        }
    }

    private fun showFatal(message: String) {
        setContentView(TextView(this).apply {
            text = message
            gravity = Gravity.CENTER
            textSize = 16f
            setPadding(dp(24), dp(24), dp(24), dp(24))
        })
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.destroy()
        }
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        super.onDestroy()
    }
}
