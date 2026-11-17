package com.arkaios.educacionlibre;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final String SITE = "https://eduacion-libre-proyecto-arkaios.vercel.app";
    private static final String AUTH_SCHEME = "arkaios-edu";
    private static final String AUTH_SCHEME_ALT = "com.arkaios.educacionlibre";
    private static final String AUTH_HOST = "auth";
    private static final Pattern ID_TOKEN = Pattern.compile("^[A-Za-z0-9._~+/-]{20,16384}={0,2}$");
    private static final Pattern FRAGMENT_TOKEN = Pattern.compile("(?:^|&)t=([^&]+)");
    private static final long COLD_START_DELAY_MS = 700L;
    private static final long WARM_START_DELAY_MS = 60L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ArkaiosPlugin.class);
        super.onCreate(savedInstanceState);
        configureWebView();
        requestNeededPermissions();
        handleAuthIntent(getIntent(), COLD_START_DELAY_MS);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthIntent(intent, WARM_START_DELAY_MS);
    }

    private void configureWebView() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
    }

    // Regreso del login hecho en el navegador: arkaios-edu://auth?t=<Google ID token>.
    // Guardamos el token en ArkaiosPlugin (para consumePendingAuth) y además lo entregamos
    // directamente al WebView sin depender de un cambio de solo-hash (que WebView ignora).
    private void handleAuthIntent(Intent intent, long delayMs) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null || !AUTH_HOST.equals(data.getHost())) return;
        String scheme = data.getScheme();
        if (!AUTH_SCHEME.equals(scheme) && !AUTH_SCHEME_ALT.equals(scheme)) return;

        String token = data.getQueryParameter("t");
        if (token == null && data.getFragment() != null) {
            Matcher m = FRAGMENT_TOKEN.matcher(data.getFragment());
            if (m.find()) token = Uri.decode(m.group(1));
        }
        intent.setData(null);
        if (token == null || !ID_TOKEN.matcher(token).matches()) return;

        ArkaiosPlugin.setPendingAuthToken(token);
        deliverPendingAuthToWebView(delayMs);
    }

    private void deliverPendingAuthToWebView(long delayMs) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        webView.postDelayed(() -> {
            String token = ArkaiosPlugin.peekPendingAuthToken();
            if (token == null || token.isEmpty()) return;
            String quotedToken = JSONObject.quote(token);
            String js = "(function(){try{if(typeof window.__arkCompleteNativeAuth==='function'){window.__arkCompleteNativeAuth("
                + quotedToken + ");return 'HANDLED';}}catch(e){}return 'NAVIGATE';})()";
            webView.evaluateJavascript(js, result -> {
                if ("\"HANDLED\"".equals(result)) return;
                String stillPending = ArkaiosPlugin.peekPendingAuthToken();
                if (stillPending == null || stillPending.isEmpty()) return;
                String target = SITE + "/login.html?native_auth=" + System.currentTimeMillis()
                    + "#ark_id_token=" + Uri.encode(stillPending);
                webView.loadUrl(target);
            });
        }, delayMs);
    }

    // Permisos para trabajar bien en teléfono y tableta: micrófono (agente de voz), cámara,
    // ubicación, fotos/archivos y notificaciones. Si alguno se niega, la app sigue funcionando.
    private void requestNeededPermissions() {
        List<String> toRequest = new ArrayList<>();
        addIfMissing(toRequest, Manifest.permission.RECORD_AUDIO);
        addIfMissing(toRequest, Manifest.permission.CAMERA);
        addIfMissing(toRequest, Manifest.permission.ACCESS_FINE_LOCATION);
        addIfMissing(toRequest, Manifest.permission.ACCESS_COARSE_LOCATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            addIfMissing(toRequest, Manifest.permission.POST_NOTIFICATIONS);
            addIfMissing(toRequest, Manifest.permission.READ_MEDIA_IMAGES);
            addIfMissing(toRequest, Manifest.permission.READ_MEDIA_VIDEO);
        } else {
            addIfMissing(toRequest, Manifest.permission.READ_EXTERNAL_STORAGE);
        }
        if (!toRequest.isEmpty()) {
            ActivityCompat.requestPermissions(this, toRequest.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    private void addIfMissing(List<String> list, String permission) {
        if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
            list.add(permission);
        }
    }
}
