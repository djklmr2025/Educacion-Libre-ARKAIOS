/**
 * Puente nativo de ARKAIOS.
 *
 * Este archivo NO va dentro del proyecto Android — se agrega a tu SITIO WEB real
 * (el que ya vive en el repo principal, ej. cárgalo en index.html u orquestador-html-plus.html).
 *
 * Cuando el sitio corre dentro de la app Android (envuelta con Capacitor), el propio
 * WebView inyecta automáticamente `window.Capacitor` — no hace falta instalar nada del
 * lado web. Cuando alguien visita el mismo sitio desde un navegador normal, `window.Capacitor`
 * simplemente no existe y estas funciones no hacen nada (fallback seguro).
 *
 * Uso típico desde cualquier módulo/plantilla:
 *   ArkaiosNative.isApp()                         -> true/false
 *   ArkaiosNative.guardarArchivo("hoja.html", texto)
 *   ArkaiosNative.notificar("Listo", "Tu plantilla se generó")
 *   ArkaiosNative.pedirMicrofono().then(stream => { ... usar stream con MediaRecorder ... })
 */
(function (global) {
  const Cap = global.Capacitor;
  const isApp = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());

  async function guardarArchivo(nombre, contenidoTexto, carpeta) {
    if (!isApp) {
      // Fuera de la app: usar la descarga normal del navegador
      const blob = new Blob([contenidoTexto], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
      return { ok: true, modo: 'navegador' };
    }
    const { Filesystem, Directory, Encoding } = Cap.Plugins;
    const res = await Filesystem.writeFile({
      path: nombre,
      data: contenidoTexto,
      directory: carpeta || Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true
    });
    return { ok: true, modo: 'nativo', uri: res.uri };
  }

  async function notificar(titulo, cuerpo) {
    if (!isApp) {
      // Fuera de la app: usar notificaciones web normales si el usuario ya dio permiso
      if ('Notification' in global && Notification.permission === 'granted') {
        new Notification(titulo, { body: cuerpo });
      }
      return { ok: true, modo: 'web' };
    }
    const { LocalNotifications } = Cap.Plugins;
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [{
        title: titulo,
        body: cuerpo,
        id: Date.now() % 100000,
        schedule: { at: new Date(Date.now() + 500) }
      }]
    });
    return { ok: true, modo: 'nativo' };
  }

  async function pedirMicrofono() {
    // getUserMedia funciona igual dentro y fuera de la app — el permiso nativo
    // (RECORD_AUDIO) ya se pidió al abrir la app, así que aquí solo se activa el micrófono.
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }

  global.ArkaiosNative = {
    isApp: () => isApp,
    guardarArchivo,
    notificar,
    pedirMicrofono
  };
})(window);
