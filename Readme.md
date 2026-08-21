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
| 📄 **Carta MX** | Formato académico con áreas editables e índice automático. | Ensayos, reportes y tareas formales. |
| 🗺️ **Croquis Animado** | Ruta animada en mapa interactivo (OSRM/OSM), bitácora en vivo y exportación a PDF. | Geografía, orientación espacial, croquis casa-escuela. |
| 👶 **Fotos Infantiles** | Generador de grillas (2.5×3cm) con control posicional por renglón. | Identificaciones y registros escolares. |
| 👤 **Biografías** | Tarjetas de presentación profesional con ajuste de fotos. | Proyectos históricos y currículum escolar. |
| 📐 **Hoja Milimétrica** | Grilla interactiva de alta precisión. | Matemáticas, dibujo técnico y gráficas. |
| 🖼️ **Cuadros de Imagen** | Organizador dinámico de recursos visuales. | Collages, diagramas y portafolios. |

---

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
