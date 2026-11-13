package cm.naxa.paymentcompanion;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import javax.net.ssl.HttpsURLConnection;

public final class HttpClient {
    private HttpClient() { }

    public static JSONObject post(String urlText, String bearer, String apiKey, JSONObject body) throws Exception {
        URL url = new URL(urlText);
        if (!"https".equalsIgnoreCase(url.getProtocol())) {
            throw new IllegalArgumentException("HTTPS is mandatory.");
        }

        HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(8000);
        connection.setReadTimeout(12000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Cache-Control", "no-store");
        if (bearer != null && !bearer.isEmpty()) {
            connection.setRequestProperty("Authorization", "Bearer " + bearer);
        }
        if (apiKey != null && !apiKey.isEmpty()) {
            connection.setRequestProperty("apikey", apiKey);
        }

        byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(payload.length);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(payload);
        }

        int status = connection.getResponseCode();
        InputStream input = status >= 200 && status < 300
                ? connection.getInputStream()
                : connection.getErrorStream();
        String responseText = input == null ? "" : readFully(input);
        connection.disconnect();

        JSONObject response;
        try {
            response = responseText.isEmpty() ? new JSONObject() : new JSONObject(responseText);
        } catch (Exception parseError) {
            response = new JSONObject().put("raw", responseText.substring(0, Math.min(500, responseText.length())));
        }
        if (status < 200 || status >= 300) {
            String message = response.optString("msg",
                    response.optString("message", response.optString("error_description",
                            response.optString("error", "HTTP " + status))));
            throw new HttpException(status, message);
        }
        return response;
    }

    private static String readFully(InputStream input) throws Exception {
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = in.read(buffer)) != -1) {
                out.write(buffer, 0, count);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    public static final class HttpException extends Exception {
        public final int status;
        public HttpException(int status, String message) {
            super(message);
            this.status = status;
        }
    }
}
