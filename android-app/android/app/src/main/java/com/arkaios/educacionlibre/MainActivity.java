package com.arkaios.educacionlibre;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final String SITE = "https://eduacion-libre-proyecto-arkaios.vercel.app";
    private static final String AUTH_SCHEME = "arkaios-edu";
    private static final String AUTH_HOST = "auth";
    private static final Pattern ID_TOKEN = Pattern.compile("^[A-Za-z0-9._-]{20,4096}$");
    private static final long COLD_START_DELAY_MS = 800;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ArkaiosPlugin.class);
        super.onCreate(savedInstanceState);
        requestNeededPermissions();
        handleAuthIntent(getIntent(), COLD_START_DELAY_MS);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthIntent(intent, 0);
    }

    // Regreso del login hecho en el navegador: arkaios-edu://auth?t=<Google ID token>.
    // La web (login.html) completa el inicio de sesión de Firebase con esa credencial.
    private void handleAuthIntent(Intent intent, long delayMs) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null || !AUTH_SCHEME.equals(data.getScheme()) || !AUTH_HOST.equals(data.getHost())) return;
        String token = data.getQueryParameter("t");
        intent.setData(null);
        if (token == null || !ID_TOKEN.matcher(token).matches()) return;
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        webView.postDelayed(() -> webView.loadUrl(SITE + "/login.html#ark_id_token=" + token), delayMs);
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
