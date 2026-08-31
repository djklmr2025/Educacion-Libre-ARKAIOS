package com.arkaios.educacionlibre;

import android.Manifest;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int PERMISSION_REQUEST_CODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestNeededPermissions();
    }

    // Pide de una vez los permisos de tiempo de ejecucion que la app puede necesitar:
    // microfono (hablar con la IA), camara y notificaciones (Android 13+).
    private void requestNeededPermissions() {
        List<String> toRequest = new ArrayList<>();

        addIfMissing(toRequest, Manifest.permission.RECORD_AUDIO);
        addIfMissing(toRequest, Manifest.permission.CAMERA);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            addIfMissing(toRequest, Manifest.permission.POST_NOTIFICATIONS);
        }

        if (!toRequest.isEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                toRequest.toArray(new String[0]),
                PERMISSION_REQUEST_CODE
            );
        }
    }

    private void addIfMissing(List<String> list, String permission) {
        if (ContextCompat.checkSelfPermission(this, permission)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            list.add(permission);
        }
    }
}
