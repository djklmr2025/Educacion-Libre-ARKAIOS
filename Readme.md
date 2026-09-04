![Banner ARKAIOS](https://github.com/djklmr2025/Eduacion-Libre-Proyecto-ARKAIOS/blob/MAIN/Gemini_Generated_Image_lzajvflzajvflzaj.png?raw=true)
# 🎓 Centro de Plantillas Educativas - Proyecto ARKAIOS

[![Proyecto ARKAIOS](https://img.shields.io/badge/Proyecto-ARKAIOS-orange?style=for-the-badge)](https://github.com/djklmr2025/Eduacion-Libre-Proyecto-ARKAIOS)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-green?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Educación Libre](https://img.shields.io/badge/Educaci%C3%B3n-Libre%20y%20Gratuita-red?style=for-the-badge)]()

## 📝 Descripción
El **Centro de Plantillas Educativas ARKAIOS** es una plataforma web de código abierto diseñada para empoderar a docentes y estudiantes. Proporciona una suite de herramientas interactivas para la creación, edición y gestión de documentos educativos listos para impresión, eliminando la complejidad técnica y facilitando el diseño profesional en el aula.

---

## ✨ Características Principales
- **🧩 Suite de Plantillas**: Diversidad de formatos para tareas, biografías, fotos infantiles y esquemas escolares.
- **🖨️ Optimización de Impresión**: Arquitectura CSS configurada para salida perfecta en formato Carta (MX/US).
- **📸 Integración de Multimedia**: Conexión directa con la API de Pexels para búsqueda de recursos visuales de alta calidad.
- **🏗️ Gestión de Proyectos**: Sistema local de guardado y recuperación de versiones de trabajo.
- **🧘 Modo Zen & Compacto**: Interfaz personalizable para maximizar el área de diseño.

---

## 🚀 Plantillas del Sistema

| Recurso | Descripción | Aplicación Pedagógica |
|:---:|---|---|
| ⚛️ **Tabla Periódica Interactiva** | Módulo interactivo de 118 elementos con órbitas de electrones, fichas informativas y consulta IA (Puter / Claude). | Química, ciencias naturales, laboratorio escolar e investigación. |
| 📄 **Carta MX** | Formato académico con áreas editables e índice automático. | Ensayos, reportes y tareas formales. |
| 🗺️ **Croquis Animado** | Ruta animada en mapa interactivo (OSRM/OSM), bitácora en vivo y exportación a PDF. | Geografía, orientación espacial, croquis casa-escuela. |
| 👶 **Fotos Infantiles** | Generador de grillas (2.5×3cm) con control posicional por renglón. | Identificaciones y registros escolares. |
| 👤 **Biografías** | Tarjetas de presentación profesional con ajuste de fotos. | Proyectos históricos y currículum escolar. |
| 📐 **Hoja Milimétrica** | Grilla interactiva de alta precisión. | Matemáticas, dibujo técnico y gráficas. |
| 🖼️ **Cuadros de Imagen** | Organizador dinámico de recursos visuales. | Collages, diagramas y portafolios. |
| ✏️ **Tiras de Calcomanías para Lápiz** | Genera tiras de calcomanías a la medida exacta del largo y grosor de lápices, colores y demás material escolar, con auto-ajuste por número de columnas y editor de imagen de fondo (tamaño, posición y opacidad). | Personalizar y rotular lápices, colores, marcadores y útiles escolares. |
| 🏷️ **Etiquetas para Libretas y Cuadernos** | Constructor libre de etiquetas profesionales sobre hoja carta: campos de texto que se agregan, quitan y arrastran a donde se necesiten, caja de datos para llenar a mano, e imagen decorativa en PNG con tamaño/posición/opacidad ajustables. | Rotular cuadernos, libretas y libros de texto con diseño propio. |

---

<p align="center">
  <img src="https://github.com/djklmr2025/Eduacion-Libre-Proyecto-ARKAIOS/blob/MAIN/tabla-periodica-demo.png?raw=true" width="900" alt="Tabla Periódica Interactiva e Integración Puter AI">
</p>

<p align="center">
  <img src="https://github.com/djklmr2025/Eduacion-Libre-Proyecto-ARKAIOS/blob/MAIN/ejemplo%20de%20archivo%20resultante.png?raw=true" width="800" height="600" alt="Ejemplo de archivo resultante">
</p>

## 🗺️ Guía de Uso: Croquis Animado Casa ⇄ Escuela (`croquis_animado_v3.html`)

Esta plantilla interactiva está diseñada para proyectos escolares de orientación espacial, geografía y mapas de trayecto (ej. *De mi Casa a mi Escuela*). Funciona 100% con datos abiertos (OpenStreetMap + OSRM + CARTO) **sin necesidad de API keys de Google ni tarjetas de crédito**.

### 📍 1. Modos de Búsqueda de Ubicación
Puedes definir el Origen y el Destino de dos formas en la barra de direcciones:
* **Por Nombre o Dirección Real**: Escribe cruces de calles, fraccionamientos o nombres de escuelas (ej. `Privada Rio Turia` o `Jardín de niños Jose Vasconcelos`). El motor geocodifica automáticamente usando Photon (Komoot) y Nominatim.
* **Por Coordenadas Geográficas (`lat,lon`)**: Pega valores exactos de latitud y longitud (ej. `19.6597,-99.0346` o `19.658532,-99.038007`). El mapa ubicará el punto preciso y lo etiquetará automáticamente como *"ese punto"*.

### ✏️ 2. Modo Previsualizador y Edición en Vivo
Al hacer clic en **👁 Previsualizar resultado**, la plantilla pasa al modo lienzo de impresión editable:
* **Textos 100% Editables**: Da clic sobre cualquier texto en la bitácora de giros, los datos de distancia/tiempo, las etiquetas del mapa o en los campos del encabezado (`Nombre:`, `Grado / Grupo:`, `Escuela:`) para redactar tus propios datos directamente.
* **Mover Objetos e Imágenes Libremente**: Arrastra las imágenes agregadas o los marcadores en el mapa usando el clic izquierdo o el **botón secundario (derecho) del mouse**.
* **Fijar con el Pin (`📌`)**: Haz clic en el botón del pin `📌` para congelar un objeto o imagen en su lugar definitivo (cambiará a `🔓` para soltarlo si deseas volverlo a mover).
* **Ajuste de Tamaño**: Arrastra el tirador azul en la esquina inferior derecha de cualquier imagen o icono flotante para redimensionarlo a gusto.
* **Limpieza de Tramos (`✕`)**: Quita imágenes o tramos sobrantes de la bitácora pasando el cursor sobre ellos y haciendo clic en el botón `✕`.

### 🖨️ 3. Exportación Limpia a PDF
Haz clic en el botón **⬇ Descargar / Guardar PDF** (o presiona `Ctrl+P`). La arquitectura CSS homologa de forma exacta las dimensiones del canvas al formato Carta Horizontal, evitando cortes de mosaicos o manchas oscuras en los bordes.

---

## ✏️ Guía de Uso: Tiras de Calcomanías para Lápiz (`tiras-calcomanias-lapiz.html`)

Genera automáticamente una hoja carta completa de calcomanías del tamaño exacto de un
lápiz (o cualquier útil escolar), calculando cuántas caben según su largo y grosor.

* **Medidas reales**: define el largo de la tira (a lo ancho del lápiz) y el alto del
  diseño (el grosor/espesor del lápiz) en milímetros; el sistema calcula cuántas
  calcomanías caben en la hoja y las centra automáticamente.
* **Columnas automáticas o fijas**: elige que el sistema calcule las columnas solas
  según el largo, o fija un número de columnas y deja que el largo se ajuste solo para
  llenar el ancho completo de la hoja.
* **Texto e imagen de fondo**: escribe el nombre o texto a mostrar, sube una imagen de
  fondo y ajústala con el mini editor — una ventana con la proporción real de la
  calcomanía donde puedes agrandarla/achicarla y moverla (posición horizontal y
  vertical) hasta encontrar el recorte exacto, más un control de opacidad para que el
  texto siempre se lea bien encima.

---

## 🏷️ Guía de Uso: Etiquetas para Libretas y Cuadernos (`etiquetas-libretas.html`)

Constructor libre de etiquetas escolares/profesionales (tipo "Asignatura / Nombre /
Grado") sobre hoja carta, pensado para que cada campo se acomode donde el usuario
quiera, sin diseños fijos.

* **Campos de texto libres**: agrega tantos campos como necesites con el botón
  "+ Agregar campo de texto", quítalos con la "×", edita su etiqueta y actívales o no
  una línea para llenar el dato a mano — cada campo se arrastra directamente en la
  vista previa a la posición exacta donde se quiera, incluso ya con texto escrito.
* **Caja de datos**: una caja de color (blanco por defecto) para el área de llenado,
  también arrastrable y redimensionable, que se dibuja por encima de la imagen de
  fondo y por debajo del texto — así nunca tapa lo que se necesita leer o escribir.
* **Imagen decorativa en PNG**: se sube y se coloca solo en la zona deseada (no cubre
  toda la etiqueta), con control de tamaño, posición y opacidad, igual que en la
  plantilla de calcomanías.
* **Hoja completa en vivo**: la vista previa de la hoja carta se actualiza en tiempo
  real con el número de etiquetas que caben (columnas × filas), lista para imprimir o
  guardar como PDF con el tamaño exacto.

---

## 🛠️ Stack Tecnológico
Para garantizar la máxima eficiencia y portabilidad:
- **Core**: HTML5 Semántico y JS Vanilla.
- **Estética**: CSS3 Moderno con variables dinámicas y Flexbox/Grid.
- **Deployment**: Configurado para **Vercel** mediante funciones Serverless.
- **APIs**: Integración segura con Pexels API (Sin exposición de llaves en cliente).

---

## ⚙️ Configuración y Despliegue
1. **GitHub**: Clona o haz fork del repositorio.
2. **Vercel**: Importa el proyecto.
3. **Seguridad**: Configura la variable de entorno `PEXELS_API_KEY` en el panel de Vercel.
4. **Listo**: El sistema funcionará automáticamente con el proxy de la carpeta `/api`.

---

## 🤝 Filosofía del Proyecto
ARKAIOS se rige por el principio de **Educación Libre**. El conocimiento debe ser accesible para todos, sin muros de pago ni barreras económicas. Este software es una herramienta de empoderamiento para la comunidad educativa global.

---

## 🛡️ Licencia
Este proyecto está bajo la **Licencia MIT**. Siéntete libre de usarlo, modificarlo y compartirlo para propósitos educativos.

---
**Desarrollado con ❤️ para maestros y estudiantes de todo el mundo.**  
**Proyecto ARKAIOS 2025**


<!-- Trigger deployment -->
