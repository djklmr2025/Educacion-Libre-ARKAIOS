# INSTRUCCIONES PARA CLAUDE // PUENTE BUZÓN DE TAREAS ARKAIOS WORLD & EDUCACIÓN LIBRE
**Emisor:** Antigravity (Sistema de Desarrollo y Mantenimiento)  
**Destinatario:** Claude AI (Arquitecto y Orquestador de ARKAIOS World)  
**Fecha:** 10 de Noviembre, 2026  
**Estado:** Activo y Desplegado en Producción  

---

## 1. Contexto y Requerimiento
El usuario solicitó un apartado en **Educación Libre ARKAIOS** (`https://educacion-libre-arkaios.vercel.app`) para que docentes, estudiantes y usuarios puedan **pedir una plantilla en específico** cuando no la encuentren entre las plantillas visibles.

En dicha área, el usuario ingresa:
1. **Título o tema** de la plantilla deseada.
2. **Nivel o área educativa** (Primaria, Secundaria, Preescolar, Preparatoria, Universidad, Docente, Adultos, General).
3. **Narración detallada** explicando cómo imagina la plantilla (tablas, campos rellenables, imágenes, formato carta o vertical/horizontal).
4. **Archivo de referencia adjunto** (foto de libreta, imagen o PDF de ejemplo hasta 15 MB).

---

## 2. Endpoint del Buzón de Tareas Habilitado
Se ha habilitado y enrutado el endpoint de ingestión y consulta en el backend serverless de Educación Libre:

- **URL de Producción:** `https://educacion-libre-arkaios.vercel.app/api/task-inbox`
- **Métodos Soportados:** `GET`, `POST`, `OPTIONS`
- **CORS:** Totalmente abierto (`Access-Control-Allow-Origin: *`)

### Payload enviado al Buzón (`POST /api/task-inbox`):
```json
{
  "id": "req_1794333600000",
  "title": "Control semanal de tareas con firmas para Primaria",
  "grade": "primaria",
  "author": "Prof. Mateo Morales",
  "narration": "Plantilla en hoja horizontal tamaño carta con tabla de lunes a viernes, casillas de verificación para tareas entregadas, firmas de padre/tutor y observaciones del docente.",
  "file": {
    "name": "ejemplo_boceto.png",
    "size": "245.3 KB",
    "type": "image/png"
  },
  "status": "queued_for_claude",
  "assignedTo": "Claude AI",
  "source": "Educación Libre - ARKAIOS",
  "createdAt": "2026-11-10T18:40:00.000Z"
}
```

---

## 3. ¿Cómo conectarlo al Buzón de Tareas de Arkaios World? (Recomendación para Claude)
Claude, como orquestador de **Arkaios World** (`Arkaios-Expo` / `arkaios-world.web.app`), tienes el control total para vincularlo donde mejor encaje sin alterar lo que ya funciona:

### Opción A (Recomendada: Firestore en `arkaios-world`):
Guardar cada solicitud en la colección:
- Colección: `solicitudes_plantillas` o `tasks`
- Escucha en tiempo real mediante `onSnapshot` para que aparezca en el Dashboard de Tareas o en el Buzón de Agentes sin necesidad de refrescar.

### Opción B (Integración con Google Tasks):
En `Arkaios-Expo/src/services/googleTasksService.ts`, se puede registrar o sincronizar dentro de la lista:
- Lista: `{ id: 'list_plantillas_educacion_libre', title: 'Plantillas Solicitadas por la Comunidad' }`
- Tareas: Cada una con el título y en `notes` la narración del usuario.

### Opción C (Consulta Directa bajo Demanda):
Puedes consultar en cualquier momento todas las tareas pendientes ejecutando:
```bash
curl -s https://educacion-libre-arkaios.vercel.app/api/task-inbox
```
O leerlas en el Foro de Educación Libre en el canal `#tareas`:
```bash
curl -s "https://educacion-libre-arkaios.vercel.app/api/v1/posts?subforum=tareas"
```

---

## 4. Estado de los Componentes
- `index.html` (Educación Libre): Modal, tarjeta interactiva y banner integrados y despachando a `/api/task-inbox`.
- `api/_task-inbox.js`: Desplegado y funcionando.
- No se modificó ningún archivo interno de `Arkaios-Expo` para preservar la estabilidad de lo que ya habías orquestado.
