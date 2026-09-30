# Android App: reglas de trabajo

## Propósito

- Esta carpeta es un contenedor Android Capacitor, no una segunda implementación del sitio.
- La interfaz y el contenido provienen del sitio remoto cargado en un `WebView`.
- Un cambio publicado en Vercel se refleja sin recompilar el APK.
- Recompila solo para cambios nativos, de permisos, plugins, ícono, splash o configuración Capacitor.

## Archivos editables

- Edita manualmente `capacitor.config.json`, `package.json`, `arkaios-native-bridge.js` y `www/` cuando aplique.
- `android/` mezcla fuentes nativas manuales y cableado generado por Capacitor; distingue ambos antes de editar.
- No edites `android/capacitor.settings.gradle` ni `android/app/capacitor.build.gradle`: `cap sync` los regenera.
- Tras cambiar plugins o configuración Capacitor, ejecuta `npm run sync`.
- Revisa el diff de `android/` después de sincronizar: puede actualizar archivos generados.
- No uses `npx cap add android` si `android/` ya existe.

## Navegación remota

- `server.url` debe apuntar al origen HTTPS real de la plataforma.
- Mantén `server.allowNavigation` alineado con `server.url` y con cada origen remoto indispensable.
- Al cambiar dominio, actualiza ambas claves en el mismo cambio.
- No agregues comodines, HTTP ni dominios de terceros sin una necesidad documentada.
- Conserva `server.androidScheme` en `https` y `cleartext` en `false`.
- La navegación fuera de `allowNavigation` se bloquea deliberadamente.
- Comprueba redirecciones de login, API y enlaces de pago antes de ampliar la lista.

## Puente web–nativo

- `arkaios-native-bridge.js` define la API pública `window.ArkaiosNative`.
- Mantén métodos con la misma semántica en app y navegador web normal.
- Antes de usar un plugin, verifica `ArkaiosNative.isApp()` o deja que el puente aplique su fallback.
- Conserva los nombres y contratos de `guardarArchivo`, `notificar` y `pedirMicrofono` salvo migración coordinada.
- El sitio remoto debe cargar el puente para acceder a capacidades nativas.
- No expongas secretos, tokens ni permisos administrativos mediante el puente.

## Permisos y plugins

- Solicita el permiso mínimo y solo justo antes de la acción del usuario.
- Micrófono requiere `RECORD_AUDIO` y consentimiento claro antes de iniciar captura.
- Cámara, archivos, compartir y notificaciones deben justificarse por una función visible.
- Añadir un plugin exige dependencia npm, sincronización y validación de permisos/manifiesto Android.
- Push remoto requiere Firebase y `google-services.json`; no confundas esto con notificaciones locales.
- Mantén `allowMixedContent` desactivado.

## Comandos y validación

- Instala dependencias desde esta carpeta con `npm install`.
- Sincroniza Capacitor con `npm run sync`.
- Abre el proyecto nativo mediante `npm run open:android`.
- Genera APK de pruebas con `npm run build:apk`.
- En Windows, `./gradlew` puede requerir `gradlew.bat assembleDebug` desde `android/`.
- Ejecuta Gradle desde `android/`, no desde la raíz del repositorio.
- Prueba en dispositivo Android una carga remota, navegación permitida y cada permiso cambiado.

## Entregables

- El workflow de GitHub Actions publica el APK debug en una prerelease de GitHub.
- Ese APK no es una compilación firmada para Play Store.
- La publicación exige una keystore y un APK/AAB firmado de producción.
- No incluyas keystores ni `google-services.json` con credenciales en commits públicos.
