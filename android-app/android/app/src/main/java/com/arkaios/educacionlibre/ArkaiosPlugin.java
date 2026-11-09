package com.arkaios.educacionlibre;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;

/**
 * Funciones nativas que la web de ARKAIOS usa dentro de la app (window.Capacitor.Plugins.Arkaios):
 * login en el navegador, imprimir/guardar PDF, guardar descargas y dictado por voz.
 */
@CapacitorPlugin(name = "Arkaios")
public class ArkaiosPlugin extends Plugin {

    private static final String SITE_HOST = "eduacion-libre-proyecto-arkaios.vercel.app";
    private static final int MAX_PRINT_HTML_CHARS = 40_000_000;
    private static final long PRINT_SETTLE_MS = 600;

    // Se conserva hasta que termina la impresión para que el recolector de basura no lo destruya.
    private WebView printWebView;

    @PluginMethod
    public void openAuth(PluginCall call) {
        String url = call.getString("url", "");
        Uri uri = Uri.parse(url);
        if (!"https".equals(uri.getScheme()) || !SITE_HOST.equals(uri.getHost())) {
            call.reject("URL de inicio de sesión no permitida");
            return;
        }
        openInBrowser(call, uri);
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        Uri uri = Uri.parse(call.getString("url", ""));
        if (!"https".equals(uri.getScheme())) {
            call.reject("Solo se permiten enlaces https");
            return;
        }
        openInBrowser(call, uri);
    }

    private void openInBrowser(PluginCall call, Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No hay un navegador instalado");
        }
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html", "");
        String baseUrl = call.getString("baseUrl", "https://" + SITE_HOST + "/");
        String title = call.getString("title", "ARKAIOS");
        boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", false));
        if (html.isEmpty() || html.length() > MAX_PRINT_HTML_CHARS) {
            call.reject("Documento vacío o demasiado grande para imprimir");
            return;
        }
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            WebView wv = new WebView(activity);
            wv.getSettings().setJavaScriptEnabled(false);
            wv.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    view.postDelayed(() -> {
                        PrintManager pm = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                        PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(title);
                        PrintAttributes.MediaSize size = landscape
                            ? PrintAttributes.MediaSize.NA_LETTER.asLandscape()
                            : PrintAttributes.MediaSize.NA_LETTER;
                        PrintAttributes attrs = new PrintAttributes.Builder()
                            .setMediaSize(size)
                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            .build();
                        pm.print(title, adapter, attrs);
                        call.resolve();
                    }, PRINT_SETTLE_MS);
                }
            });
            printWebView = wv;
            wv.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null);
        });
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = sanitizeName(call.getString("name", "archivo"));
        String mime = call.getString("mime", "application/octet-stream");
        String data = call.getString("data", "");
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Archivo dañado");
            return;
        }
        try {
            String where;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ARKAIOS");
                Uri item = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (item == null) throw new IllegalStateException("No se pudo crear el archivo");
                try (OutputStream out = resolver.openOutputStream(item)) {
                    if (out == null) throw new IllegalStateException("No se pudo escribir el archivo");
                    out.write(bytes);
                }
                where = "Descargas/ARKAIOS";
            } else {
                File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "ARKAIOS");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("No se pudo crear la carpeta");
                File file = new File(dir, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                }
                where = file.getParent();
            }
            final String msg = "Guardado en " + where + ": " + name;
            getActivity().runOnUiThread(() -> Toast.makeText(getContext(), msg, Toast.LENGTH_LONG).show());
            JSObject ret = new JSObject();
            ret.put("folder", where);
            ret.put("name", name);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("No se pudo guardar: " + e.getMessage());
        }
    }

    @PluginMethod
    public void listen(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, call.getString("lang", "es-MX"));
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, call.getString("prompt", "Habla con tu agente ARKAIOS"));
        try {
            startActivityForResult(call, intent, "onSpeechResult");
        } catch (ActivityNotFoundException e) {
            call.reject("Este dispositivo no tiene reconocimiento de voz (instala la app de Google)");
        }
    }

    @ActivityCallback
    private void onSpeechResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.reject("Dictado cancelado");
            return;
        }
        ArrayList<String> matches = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        JSObject ret = new JSObject();
        ret.put("text", matches != null && !matches.isEmpty() ? matches.get(0) : "");
        call.resolve(ret);
    }

    private static String sanitizeName(String raw) {
        String clean = raw.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (clean.isEmpty()) clean = "archivo";
        return clean.length() > 120 ? clean.substring(clean.length() - 120) : clean;
    }
}
