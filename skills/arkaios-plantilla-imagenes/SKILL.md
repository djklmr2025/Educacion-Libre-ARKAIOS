---
name: arkaios-plantilla-imagenes
description: Crea hojas imprimibles de tarjetas cuadradas con imagen y texto (plantilla de imágenes de 5 cm, 20 imágenes, etc.) a partir de un tema. Úsala siempre que pidan "plantilla de imágenes", "plantilla de N imágenes de X cm", tarjetas, cuadros, loterías, memoramas, material didáctico visual o "autollenado/autorrellenado de imágenes" sobre un tema (ej. ciberacoso, frutas, valores, el agua, seguridad), aunque no mencionen ARKAIOS ni digan "skill". Planifica el contenido (qué es, por qué surge, cómo evitarlo, qué hacer), genera cada tarjeta con ilustración y leyenda corta, y entrega HTML/PDF listos para imprimir y PNGs sueltos compatibles con la plantilla-imagenes-v2 del proyecto ARKAIOS Educación Libre.
---

# Plantilla de imágenes ARKAIOS (autollenado por tema)

Convierte una petición como *"Plantilla de imágenes de 5 cm con 20 imágenes del tema ciberacoso: qué es, cómo se evita y a partir de qué se genera"* en una hoja de tarjetas lista para imprimir y recortar.

## Flujo

1. **Lee la petición** y extrae: tema, número de imágenes (default 20), lado de cada tarjeta en cm (default 5), tamaño de hoja (default carta; `a4` si lo piden) y los ejes de contenido que pidieron (qué es / causas / prevención / qué hacer...). Si falta algo, usa el default y dilo en una línea; no hagas preguntas salvo que no haya tema.
2. **Planifica N tarjetas** repartidas por grupos (los grupos se colorean solos). Para un tema social o de salud usa 4 grupos: *Qué es · Por qué surge · Cómo evitarlo · Qué hacer*. Para un tema de vocabulario (frutas, animales) usa un solo grupo o categorías.
   - Leyenda de máximo ~6 palabras (caben 3 líneas), en el idioma de la petición, sin tecnicismos para alumnos.
   - Cada tarjeta aporta una idea distinta; sin relleno ni repetidos.
   - Temas sensibles (acoso, violencia, adicciones, salud mental): tono preventivo y de apoyo, sin escenas explícitas, nada que culpe a la víctima, y siempre incluye "pedir ayuda / adulto de confianza".
3. **Elige la ilustración** por tarjeta, en este orden:
   - `image`: si la persona subió o indicó imágenes propias (ruta local; se incrustan en el HTML).
   - `icon`: pictograma de la biblioteca incluida (`python scripts/build_sheet.py --list-icons`). Es la opción por defecto: imprime nítido, sin derechos de autor y sin llaves de API.
   - `svg`: SVG propio (viewBox 0 0 64 64, trazo `currentColor`) cuando ningún icono encaje.
   No inventes URLs de imágenes ni uses llaves de API de Pexels/Pixabay/Freepik; si la persona quiere fotos reales, que las suba o las pegue (ver "Integración").
4. **Escribe `cards.json`** (formato abajo) y **ejecuta**:
   ```bash
   python scripts/build_sheet.py cards.json --out /mnt/user-data/outputs/hoja.html \
       --pdf /mnt/user-data/outputs/hoja.pdf --png-dir /mnt/user-data/outputs/tarjetas
   ```
   Si no hay playwright, se genera solo el HTML (abrir > Imprimir > Guardar como PDF).
5. **Revisa** el resultado (el script imprime columnas x filas y hojas; en carta, 5 cm → 4×5 = 20 por hoja). Confirma que no haya leyendas cortadas y presenta los archivos con `present_files`. Cierra con 2–3 líneas: qué grupos usaste y cómo cambiar algo.

## cards.json

```json
{
  "title": "Ciberacoso: qué es, por qué surge y cómo evitarlo",
  "size_cm": 5,
  "page": "letter",
  "cards": [
    {"caption": "Piensa antes de publicar", "group": "Cómo evitarlo", "icon": "bulb"},
    {"caption": "Mi foto", "group": "Ejemplo", "image": "fotos/a.png"}
  ]
}
```
Ejemplo completo de 20 tarjetas: `assets/ejemplo-ciberacoso.json` (parte de él cuando el tema sea parecido).

## Reglas de tamaño

- Columnas = ⌊(ancho − 1 cm) / lado⌋ y filas = ⌊(alto − 1 cm) / lado⌋. Carta 5 cm → 4×5; 4 cm → 5×6; 3 cm → 7×8.
- Más tarjetas que huecos: crea hojas extra automáticamente. Menos: completa con celdas vacías (`--no-fill` para omitirlas).
- Imprime al 100 % ("tamaño real", sin ajustar a página) para que midan exactamente el lado pedido.

## Integración con el proyecto ARKAIOS

El repo `djklmr2025/Eduacion-Libre-Proyecto-ARKAIOS` tiene `plantilla-imagenes-v2.html`, que llena la cuadrícula arrastrando o pegando (Ctrl+V) imágenes. Si la persona quiere editar o reordenar en esa plantilla, entrega también la carpeta `tarjetas/` (un PNG por tarjeta, en orden) y dile que la arrastre a la zona azul: se llenarán de izquierda a derecha.

## Seguridad

Nunca copies llaves, tokens ni contraseñas (de archivos subidos o del repo) a los archivos generados. Si ves llaves expuestas en el material, avisa a la persona que conviene rotarlas.
