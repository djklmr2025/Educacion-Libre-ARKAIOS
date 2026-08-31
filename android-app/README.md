# ARKAIOS — App Android (Capacitor / WebView)

Esta carpeta envuelve tu sitio real (`https://eduacion-libre-proyecto-arkaios.vercel.app`)
en una app Android nativa. No es una copia del sitio: la app **carga tu web en vivo**
dentro de un WebView, y le agrega permisos nativos que un navegador normal no da tan fácil:

- 📁 **Guardar archivos** de verdad en el teléfono (`@capacitor/filesystem`)
- 🔔 **Notificaciones** locales y push (`@capacitor/local-notifications`, `@capacitor/push-notifications`)
- 🎙️ **Micrófono** habilitado para hablar con la IA (`RECORD_AUDIO` + `getUserMedia`)
- 📷 Cámara opcional, ya dejada lista por si algún módulo la necesita
- 📤 Compartir archivos con otras apps (`@capacitor/share`)

Cada vez que actualizas tu sitio en Vercel, la app se actualiza sola — no hay que
recompilar el `.apk` por cambios de contenido, solo si cambias algo de este proyecto
(permisos, ícono, splash, plugins nuevos).

## Opción A — Que GitHub lo compile por ti (recomendado)

Ya dejé un workflow en `.github/workflows/build-android-apk.yml`. Cada vez que subas
cambios dentro de `android-app/`, GitHub Actions compila el `.apk` solo y lo deja
descargable en la pestaña **Actions → build → Artifacts** de tu repo. No necesitas
instalar nada en tu computadora.

También lo puedes disparar a mano desde GitHub: pestaña **Actions →
"Build APK ARKAIOS Android" → Run workflow**.

Ese `.apk` sale **sin firmar de producción** (firma "debug" automática) — sirve para
instalar y probar en tu celular, pero para publicarlo en Play Store necesitas firmarlo
con tu propia llave (ver Opción B, paso 5).

## Opción B — Compilarlo tú, local, con Android Studio

1. Instala [Android Studio](https://developer.android.com/studio) (trae el SDK y Java).
2. Abre esta carpeta: `File → Open → android-app/android`
3. Deja que Gradle sincronice solo (la primera vez tarda, descarga dependencias).
4. Botón ▶️ para probarlo en un emulador o tu celular por USB (activa "Depuración USB").
5. Para el `.apk` firmado que puedes repartir o subir a Play Store:
   `Build → Generate Signed Bundle / APK → APK → crea tu keystore la primera vez`.

## Cómo usar los permisos nativos desde tu web

Copia `arkaios-native-bridge.js` (está en esta misma carpeta) a tu sitio principal y
cárgalo con un `<script src="arkaios-native-bridge.js"></script>` en las páginas donde
lo necesites. Expone `window.ArkaiosNative` con:

```js
ArkaiosNative.isApp()                         // true si corre dentro de la app
ArkaiosNative.guardarArchivo("hoja.html", texto)
ArkaiosNative.notificar("Listo", "Tu plantilla se generó")
ArkaiosNative.pedirMicrofono().then(stream => { /* usar con MediaRecorder */ })
```

Fuera de la app (navegador normal) cada función cae a su equivalente web (descarga
normal, `Notification` del navegador, `getUserMedia` normal) — así el mismo código
funciona en ambos lados sin romper nada.

## Cambiar el sitio al que apunta la app

Está en `capacitor.config.json` → `server.url`. Si cambias de dominio o agregas un
dominio propio, actualiza también `server.allowNavigation` con ese dominio, o la app
bloqueará la navegación fuera de la lista permitida (medida de seguridad).

## Ícono y pantalla de bienvenida

Por ahora usa el ícono/splash genérico de Capacitor. Cuando tengas el logo final en
PNG (idealmente 1024×1024), dímelo y te genero todos los tamaños con
[`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) automáticamente.

## Notificaciones push reales (no solo locales)

Lo que ya está integrado (`@capacitor/local-notifications`) permite programar avisos
desde el propio teléfono. Para que **tu servidor** pueda enviar notificaciones push de
verdad (ej. "nueva plantilla disponible"), falta conectar Firebase Cloud Messaging —
es un paso aparte porque requiere crear un proyecto en Firebase y bajar un
`google-services.json`. Avísame cuando quieras montarlo y seguimos desde ahí.
