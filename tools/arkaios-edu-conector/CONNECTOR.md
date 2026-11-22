# Arkaios Edu Comunidad

- `custom.arkaios-edu-comunidad` conecta a Muse con la Comunidad de ARKAIOS EDU a través de su API en `eduacion-libre-proyecto-arkaios.vercel.app`.
- Se autentica con la llave personal de agente registrada en la conexión y solo llama a ese host.
- El helper vive en `tools/arkaios-edu-conector/bin/arkaios_edu.py` dentro de este repo.

## Connect

- La conexión se registra con `credentials.request_api_access` y estos detalles. Reúsalos para reconectar.

```json
{
  "provider": "arkaios-edu-comunidad",
  "auth_scheme": "api_key",
  "placement": "bearer_header",
  "api_hosts": ["eduacion-libre-proyecto-arkaios.vercel.app"]
}
```

- Cada persona usa su propia llave personal de agente. Se saca en la página de acceso del sitio, en la sección "TU API KEY EDUCATIVA".
- Antes del primer cambio en una conversación, prueba el acceso con una lectura inofensiva.

```text
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py me
```

## Credentials

- La conexión registrada guarda la credencial. El helper importa `dynamic_credentials.py`, que devuelve un sustituto y lo coloca donde el proveedor lee la llave. Muse sustituye la credencial real solo en una petición aprobada a un host registrado.
- Nunca pongas una llave, token, contraseña o cookie en este documento, en un helper, en un argumento de comando, en una variable de entorno o en un registro. Nunca pidas al usuario que pegue una en el chat.
- Mantén los redirects desactivados en las peticiones autenticadas.
- Ante un 401 o 403, revisa primero la petición. Confirma que el helper adjuntó la credencial, que el host está registrado y que la colocación coincide.
- Solo cuando una petición que llevó la credencial sigue rechazada, llama a `credentials.request_api_access` con los detalles de arriba y `"reconnect": true`.

## Ver quién eres

- Devuelve tu identidad de agente en la Comunidad y tus guardados. Es la prueba de que la llave funciona.

```text
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py me
```

- La respuesta trae tu `uid`, tu `name` y tu lista `saved` con los ids guardados.

## Buscar materiales

- Busca materiales compartidos en la Comunidad. Todos son públicos y reutilizables.

```text
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py list
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py list --q historia
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py list --tpl biografia_profesional.html
```

- La lectura no necesita llave. Cada resultado trae `id`, `title`, `template`, `ownerName`, `tags` y `createdTime`.

## Ver un material

- Obtiene un material completo con sus metadatos y sus datos para reutilizarlo como base.

```text
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py get --id 1HWA-S0oOEeK9mOn4Md4BeR9GNTY4w4kt
```

- La lectura no necesita llave. La respuesta trae `item` con los metadatos y `data` con el contenido de la plantilla.

## Publicar un material

- Publica un material en la Comunidad para que maestros y estudiantes lo usen sin empezar de cero. Aparece a tu nombre.

```text
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py publish --body '{"title": "Mi material", "description": "Descripción corta", "tags": ["primaria", "historia"], "template": "plantilla-imagenes-v2.html", "data": {"__arkGeneric": 1, "images": ["https://ejemplo.com/imagen.jpg"]}}'
```

- El cuerpo necesita `title`, `template` y `data`. `description` y `tags` son opcionales y hay un máximo de 8 etiquetas.
- Antes de publicar en una plantilla, copia su formato exacto de datos con `get` sobre un material existente de esa misma plantilla.
- Todo lo publicado es público. No incluyas datos personales de estudiantes.
- La respuesta trae el `item` publicado con su `id` nuevo.

## Guardar un material

- Guarda un material en tu colección o quítalo de ella.

```text
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py save --id 1HWA-S0oOEeK9mOn4Md4BeR9GNTY4w4kt
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py save --id 1HWA-S0oOEeK9mOn4Md4BeR9GNTY4w4kt --saved false
```

## Ver guardados

- Lista los materiales que tienes guardados.

```text
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py saved
```

## Borrar un material

- Borra un material que tú mismo publicaste. Solo borra lo tuyo.

```text
python3 tools/arkaios-edu-conector/bin/arkaios_edu.py delete --id 1HWA-S0oOEeK9mOn4Md4BeR9GNTY4w4kt
```

## Recover from errors

- Un 401 significa que la llave falta o no es válida. Revisa que la conexión registrada tenga la llave personal correcta y vuelve a probar con `me`.
- Un 403 significa que la llave no tiene permiso para esa acción. Solo un administrador humano crea llaves de agente en la pestaña Agentes de la Comunidad.
- Después de una escritura fallida o con tiempo agotado, revisa el estado actual con una lectura antes de reintentar, porque la primera petición pudo completarse.

## Limits

- La lectura de la Comunidad es pública. La publicación, el guardado y el borrado exigen llave.
- La base de la API escribe `eduacion` y no `educacion`. Usa esa ortografía en cada llamada.
- La miniatura opcional al publicar debe pesar 700 KB o menos y ser PNG, JPG o WEBP.
- Este conector no crea llaves ni administra usuarios. Las llaves las crea un administrador humano en la Comunidad.

## Related skills

- [Custom Connector Setup](/opt/muse/skills/custom-connector-setup/SKILL.md) explica cómo registrar la conexión y construir el helper.
- El servidor MCP del repo en `tools/arkaios-edu-comunidad-mcp.js` ofrece la misma Comunidad como herramientas MCP para agentes que usan MCP.
- Use `muse.skill_search` to find other skills and `muse.connector_search` to find other connectors.
