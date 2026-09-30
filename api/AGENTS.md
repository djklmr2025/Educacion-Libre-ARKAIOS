# API serverless

- Cada `api/*.js` es un handler serverless de Vercel: `export default async function handler(req, res)`.
- La ruta pública normal es `/api/<nombre-sin-.js>`; no agregues extensiones a los consumidores.
- Atiende `OPTIONS` antes de validar método y devuelve `405` para verbos no soportados.
- Conserva el formato de respuesta ya usado por cada endpoint (`ok`, `error`, `message`, etc.).
- No conviertas errores upstream en respuestas exitosas ni ocultes su código HTTP.

## Contrato Core/POS

- `client-login.js`, `pos-login.js` y `pos-accounts.js` dependen de `./_coreProxy.js`.
- Importa `setCors`, `getCoreConfig` y `forwardJson`; no reimplementes ese contrato por endpoint.
- `getCoreConfig()` normaliza la base Core y selecciona una clave interna solo desde entorno.
- `forwardJson()` manda JSON con `x-api-key` y retorna exactamente `{ status, data }`.
- Propaga `result.status` y `result.data` del Core; conserva sus nombres de campos.
- Codifica IDs interpolados con `encodeURIComponent` y construye query strings con `URLSearchParams`.
- `client-login` valida cuenta/NIP y aplica coincidencia opcional de tenant y caja.
- Roles admitidos hoy: `client`, `master_admin`, `box_admin` y `cashier`.
- `pos-login` delega la autenticación al Core; no dupliques reglas de roles en el frontend.
- `pos-accounts` es GET y acepta filtros de tenant, caja, `include_full` y `allow_master`.

## Grupos de endpoints

- IA: `arkaios`, `arkaios-image`, `arkaios-orquestador` y `apikey` usan proveedores remotos.
- Contenido: `pexels` busca imágenes con una clave mantenida exclusivamente en servidor.
- Puentes: `bridge` y `elemia-bridge` conectan o exponen capacidades de agentes externos.
- Persistencia: `publish-template` y `save-material` escriben mediante la API de GitHub.
- Plantillas: `arkaios-tools` es en gran parte demostrativo; varias operaciones son placeholders.
- POS/Core: `client-login`, `pos-login` y `pos-accounts` comparten el proxy indicado arriba.

## Secretos y entorno

- Nunca agregues claves, tokens, PAT, URLs privadas ni valores de respaldo literales al código o documentación.
- Usa `process.env`; las variables con prefijo `VITE_` se consideran expuestas al cliente y no deben guardar secretos nuevos.
- Reutiliza los nombres de entorno ya leídos por cada handler para evitar configuraciones Vercel divergentes.
- Si falta una credencial de servidor, falla sin revelar su valor ni detalles sensibles del proveedor.
- Los endpoints de publicación requieren token de GitHub y deben limitar destino, rama y ruta antes de escribir.
- `save-material` permite una clave compartida opcional; si está configurada, exige `x-arkaios-key`.

## CORS, autenticación e inputs

- Mantén los encabezados CORS coherentes con cada endpoint y declara los headers realmente usados.
- No combines `Access-Control-Allow-Credentials: true` con origen comodín en cambios nuevos; define un origen permitido si hay cookies o credenciales.
- CORS no autentica: verifica token, clave o identidad antes de acciones privilegiadas.
- Parsea y valida `req.body` antes de usarlo; impone tipos, campos requeridos, tamaños y rangos razonables.
- No uses rutas, nombres de archivo, prompts ni contenido del cliente sin normalizarlos y validarlos.
- En escritura GitHub, evita traversal, rutas vacías y sobreescrituras fuera del repositorio configurado.
- Nunca devuelvas tokens, encabezados Authorization, NIP completos ni datos de cuenta innecesarios.

## Red, tiempo y errores

- Todo `fetch` externo debe tener límite de tiempo con `AbortController` al modificar o crear flujos remotos.
- Trata JSON inválido, red caída y timeouts como errores controlados con respuesta segura.
- Registra contexto operativo sin secretos; no propagues `error.message` del proveedor al cliente en rutas sensibles.
- Respeta `maxDuration` de `vercel.json`; toda ruta lenta nueva debe declararse y justificarse allí.
- No asumas que una respuesta externa es JSON válido ni que contiene candidatos o campos opcionales.

## Consumidores y despliegue

- Al cambiar request, response, método o ruta, actualiza todos los consumidores con `rg '/api/'`.
- Los consumidores actuales incluyen `index.html`, `arkaios-orquestador.js`, `orquestador-html-plus.html`, `portal-empresarial.html` y `js/main.js`.
- Actualiza `vercel.json` al agregar duración, rewrite o comportamiento de ruta que Vercel deba conocer.
- Verifica localmente el preflight, un caso válido, un `400`, un `401/403` aplicable y un `405`.
- Riesgo actual: `js/main.js` llama `/api/pixabay`, `/api/freepik` y `/api/grok`, pero no existen handlers homónimos en `api/`.
- Riesgo actual: `apikey.js` contiene una credencial de respaldo en código; elimínala o rótala sin copiarla a documentación.
