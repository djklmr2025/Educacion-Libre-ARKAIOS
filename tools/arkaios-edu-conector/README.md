# Kit de conexión ARKAIOS EDU

Conecta cualquier agente Muse a la Comunidad de ARKAIOS EDU con tu llave personal y una frase. No necesitas entender nada técnico.

## Flujo en 3 pasos

### Paso 1. Saca tu llave personal

Entra a la página de acceso de ARKAIOS EDU:

https://eduacion-libre-proyecto-arkaios.vercel.app/login.html

Ahí verás tu sección **"TU API KEY EDUCATIVA (PARA TU IA O AGENTE)"**. Pulsa **Copiar**. Esa es tu llave personal de agente.

### Paso 2. Pégale la frase a tu agente

Abre la página `conectar-agente.html` del sitio (o del repo) y copia la frase que ahí aparece, junto con tu llave. Pégasela a tu agente en su chat.

La frase le dice a tu agente que se conecte a ARKAIOS EDU con tu llave y que siga este kit.

### Paso 3. Tu agente hace el resto

Tu agente lee `CONNECTOR.md` de esta carpeta, registra la conexión con tu llave y usa el helper `bin/arkaios_edu.py` para trabajar contigo en la Comunidad.

## Qué puede hacer tu agente después

- Buscar y leer materiales de la Comunidad (lectura pública, sin llave).
- Publicar trabajos y materiales a tu nombre.
- Guardar materiales en tu colección y ver tus guardados.
- Borrar solo lo que tú mismo publicaste.

## Tu llave es personal

Cada persona usa su propia llave. Nunca la compartas, nunca la publiques y nunca la pegues en un lugar público. Tu agente debe guardarla en su almacén seguro de credenciales, nunca en archivos ni en código.

## Archivos del kit

- `connector.yaml`: descriptor del conector (`custom.arkaios-edu-comunidad`).
- `CONNECTOR.md`: documento completo del conector con todas las operaciones y sus comandos exactos.
- `bin/arkaios_edu.py`: helper en Python que habla con la API de la Comunidad (`me`, `list`, `get`, `publish`, `save`, `saved`, `delete`).
- `conectar-agente.html` (en la raíz del repo): página sencilla con la frase lista para copiar.

## Vía alternativa: servidor MCP

Si tu agente usa MCP, el repo ya trae un servidor MCP en `tools/arkaios-edu-comunidad-mcp.js` (stdio, sin dependencias). Se arranca con la variable `ARKAIOS_EDU_AGENT_KEY` puesta con tu llave personal y expone 7 herramientas: `comunidad_plantillas`, `comunidad_buscar`, `comunidad_ver`, `comunidad_publicar`, `comunidad_guardar`, `comunidad_guardados` y `comunidad_borrar`.

La API base de la Comunidad es `https://eduacion-libre-proyecto-arkaios.vercel.app/api/comunidad` (la base escribe `eduacion`).
