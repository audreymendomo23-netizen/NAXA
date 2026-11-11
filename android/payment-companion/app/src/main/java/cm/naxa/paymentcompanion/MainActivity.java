package cm.naxa.paymentcompanion;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int REQUEST_RECEIVE_SMS = 401;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private EditText naxaUrl;
    private EditText supabaseUrl;
    private EditText anonKey;
    private EditText email;
    private EditText password;
    private RadioGroup roleGroup;
    private Button connectButton;
    private TextView statusText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(24), dp(20), dp(28));
        scroll.addView(root);

        TextView title = new TextView(this);
        title.setText("NAXA · Compagnon de paiement");
        title.setTextSize(23);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        root.addView(title);

        TextView explanation = new TextView(this);
        explanation.setText("Le compagnon transmet uniquement les SMS dont l'expediteur brut est exactement OrangeMoney ou MobileMoney. Aucun contact, PIN, OTP ou historique de messagerie n'est lu.");
        explanation.setTextSize(14);
        explanation.setPadding(0, dp(8), 0, dp(18));
        root.addView(explanation);

        naxaUrl = addField(root, "URL de l'espace NAXA (HTTPS)", "https://votre-domaine-naxa");
        supabaseUrl = addField(root, "URL Supabase", "https://votre-projet.supabase.co");
        anonKey = addField(root, "Clé publique Supabase (anon / publishable)", "");
        email = addField(root, "Adresse e-mail NAXA", "");
        password = addField(root, "Mot de passe", "");
        password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);

        TextView roleLabel = new TextView(this);
        roleLabel.setText("Compte à enrôler");
        roleLabel.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        roleLabel.setPadding(0, dp(16), 0, dp(6));
        root.addView(roleLabel);

        roleGroup = new RadioGroup(this);
        roleGroup.setOrientation(RadioGroup.VERTICAL);
        RadioButton promoter = new RadioButton(this);
        promoter.setId(View.generateViewId());
        promoter.setText("Promoteur (téléphone du payeur)");
        roleGroup.addView(promoter);
        RadioButton admin = new RadioButton(this);
        admin.setId(View.generateViewId());
        admin.setText("Administrateur (téléphone du bénéficiaire)");
        roleGroup.addView(admin);
        promoter.setChecked(true);
        root.addView(roleGroup);

        connectButton = new Button(this);
        connectButton.setText("Connecter et enrôler ce téléphone");
        connectButton.setOnClickListener(view -> connectAndEnroll());
        root.addView(connectButton);

        statusText = new TextView(this);
        statusText.setTextSize(13);
        statusText.setPadding(0, dp(16), 0, dp(6));
        root.addView(statusText);

        TextView warning = new TextView(this);
        warning.setText("Important : Android classe RECEIVE_SMS comme permission restreinte. Play Protect peut bloquer une application qui la demande lorsqu'elle est téléchargée depuis un navigateur ou une autre source Internet. Ne désactivez pas Play Protect pour contourner ce contrôle. La distribution doit être autorisée pour cette permission.");
        warning.setTextSize(12);
        warning.setPadding(0, dp(16), 0, 0);
        root.addView(warning);

        setContentView(scroll);
        showLastStatus();
    }

    private EditText addField(LinearLayout parent, String label, String hint) {
        TextView title = new TextView(this);
        title.setText(label);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setPadding(0, dp(10), 0, dp(4));
        parent.addView(title);

        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setTextSize(14);
        input.setHint(hint);
        parent.addView(input);
        return input;
    }

    private void connectAndEnroll() {
        String role = roleGroup.getCheckedRadioButtonId() == roleGroup.getChildAt(1).getId()
                ? "admin" : "promoteur";
        String naxa = trim(naxaUrl.getText().toString());
        String sb = trim(supabaseUrl.getText().toString());
        String key = anonKey.getText().toString().trim();
        String user = email.getText().toString().trim();
        String secret = password.getText().toString();

        if (!naxa.startsWith("https://") || !sb.startsWith("https://") ||
                key.isEmpty() || user.isEmpty() || secret.isEmpty()) {
            statusText.setText("Saisissez deux URL HTTPS, la clé publique Supabase, l'e-mail et le mot de passe.");
            return;
        }

        connectButton.setEnabled(false);
        statusText.setText("Connexion Supabase et enrôlement en cours…");
        executor.execute(() -> {
            try {
                SecureVault.put(this, "naxa_base_url", naxa);
                SecureVault.put(this, "supabase_url", sb);
                SecureVault.put(this, "supabase_anon_key", key);
                SupabaseSession.login(this, sb, key, user, secret);
                NaxaApi.enroll(this, role);
                runOnUiThread(() -> {
                    connectButton.setEnabled(true);
                    statusText.setText("Téléphone enrôlé pour le compte " + role +
                            ". Demande de permission SMS en cours. Le jeton de l'appareil est stocké chiffré.");
                    requestSmsPermission();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    connectButton.setEnabled(true);
                    statusText.setText("Échec de la connexion / enrôlement : " +
                            (error.getMessage() == null ? "erreur inconnue" : error.getMessage()));
                });
            }
        });
    }

    private void requestSmsPermission() {
        if (Build.VERSION.SDK_INT >= 23 &&
                checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECEIVE_SMS}, REQUEST_RECEIVE_SMS);
            return;
        }
        statusText.setText(statusText.getText() + "\nCapture SMS autorisée par Android.");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_RECEIVE_SMS) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            statusText.setText(statusText.getText() + "\nPermission SMS accordée. Les expéditeurs autorisés seront traités automatiquement.");
        } else {
            statusText.setText(statusText.getText() + "\nPermission SMS refusée / non autorisée par l'installateur. Aucun SMS ne sera capturé ; utilisez le circuit manuel NAXA.");
        }
    }

    private void showLastStatus() {
        String state = SecureVault.get(this, "last_capture_status");
        String at = SecureVault.get(this, "last_capture_at");
        if (state != null) {
            statusText.setText("Dernière capture : " + state + (at == null ? "" : " · " + at));
        }
    }

    private static String trim(String value) {
        String out = value == null ? "" : value.trim();
        while (out.endsWith("/")) out = out.substring(0, out.length() - 1);
        return out;
    }

    private int dp(int value) {
        return Math.round(getResources().getDisplayMetrics().density * value);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdown();
    }
}
