# 📚 SISTEMA DE MATERIAL EDUCATIVO REUTILIZABLE - DOCUMENTACIÓN TÉCNICA

## 🎯 DESCRIPCIÓN GENERAL

Sistema completo de biblioteca de materiales educativos con:
- ✅ Subida y catalogación de PDFs
- ✅ Preview visual automático
- ✅ Sistema de nomenclatura automática
- ✅ Reutilización en plantillas correspondientes
- ✅ Filtros y organización

---

## 🔧 INTEGRACIÓN EN INDEX.HTML

### PASO 1: Agregar botón en el menú

Agrega esta sección al final del sidebar en `index.html` (después de "Base PDFs"):

```html
<div class="nav-section">
    <div class="nav-title">
        <span>📚</span>
        <span>Biblioteca</span>
    </div>
    <button class="btn" data-target="material-educativo-reutilizable.html">
        <span class="btn-icon">📖</span>
        <span>Material Reutilizable</span>
    </button>
</div>
```

---

## 🚀 FUNCIONALIDADES IMPLEMENTADAS

### 1. SUBIDA DE ARCHIVOS
- Drag & drop
- Click para seleccionar
- Solo acepta PDFs
- Preview automático de primera página

### 2. CATALOGACIÓN
```javascript
{
    id: timestamp único,
    title: "Título del usuario",
    description: "Descripción del usuario",
    type: "circular|images|text|photos|other",
    code: "CIR-250207-001", // Auto-generado
    fileName: "archivo-original.pdf",
    fileData: "data:application/pdf;base64,...",
    preview: "data:image/png;base64,...",
    uploadDate: "2025-02-07T..."
}
```

### 3. NOMENCLATURA AUTOMÁTICA

**Formato:** `PREFIJO-FECHA-CONSECUTIVO`

Ejemplo: `CIR-250207-001`

```javascript
function generateCode(type) {
    const prefixes = {
        'circular': 'CIR',
        'images': 'IMG',
        'text': 'TXT',
        'photos': 'FOT',
        'other': 'GEN'
    };
    
    const prefix = prefixes[type] || 'GEN';
    const count = materials.filter(m => m.type === type).length + 1;
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    
    return `${prefix}-${date}-${String(count).padStart(3, '0')}`;
}
```

### 4. MAPEO PLANTILLA ↔ TIPO

```javascript
const TEMPLATE_MAP = {
    'circular': 'plantilla_circulos_jack.html',
    'images': 'plantilla-cuadros-imagenes-v2.html',
    'text': 'plantilla_escolar_carta_mx_autoajuste_y_areas_editables.html',
    'photos': 'generador-fotos-infantiles.html',
    'other': null
};
```

---

## 🔄 SISTEMA DE REUTILIZACIÓN

### Flujo cuando se hace click en "Reutilizar":

1. **Se guarda en localStorage temporal:**
```javascript
localStorage.setItem('arkaios_pending_load', JSON.stringify({
    type: 'circular',
    data: 'data:application/pdf;base64,...',
    metadata: {
        title: 'Diploma Honor 2024',
        code: 'CIR-250207-001'
    }
}));
```

2. **Se abre la plantilla correspondiente:**
```javascript
if (window.parent && window.parent.loadTemplate) {
    window.parent.loadTemplate(template); // En iframe ARKAIOS
} else {
    window.location.href = template; // Standalone
}
```

3. **La plantilla debe leer el dato pendiente:**

Cada plantilla debe agregar al inicio:

```javascript
// En cada plantilla .html (circular, imágenes, etc.)
window.onload = function() {
    // Código existente...
    
    // NUEVO: Cargar desde biblioteca
    const pending = localStorage.getItem('arkaios_pending_load');
    if (pending) {
        const data = JSON.parse(pending);
        localStorage.removeItem('arkaios_pending_load');
        
        if (data.type === 'circular') { // Ajustar según plantilla
            loadFromPDF(data.data, data.metadata);
        }
    }
};

function loadFromPDF(pdfData, metadata) {
    // AQUÍ VA LA LÓGICA DE CONVERSIÓN PDF → PLANTILLA
    // Depende de cada plantilla
}
```

---

## 🤖 AUTO-GUARDADO DESDE PLANTILLAS

### Integrar en botón "Imprimir" de cada plantilla:

```javascript
// En cada plantilla, modificar el botón de exportar/imprimir
async function exportarPDF() {
    // Código existente de generación PDF...
    const pdfData = generatePDF(); // Tu código actual
    
    // NUEVO: Preguntar si guardar en biblioteca
    const save = confirm('¿Guardar también en Biblioteca de Material Reutilizable?');
    
    if (save && window.parent && window.parent.ARKAIOS_MaterialLibrary) {
        window.parent.ARKAIOS_MaterialLibrary.addFromPDF(pdfData, {
            preview: await generatePreview(),
            name: 'documento_' + Date.now() + '.pdf',
            size: pdfData.length
        });
    }
}
```

---

## 🔍 AUTO-DETECCIÓN DE TIPO (AVANZADO)

### Opción A: Análisis de contenido PDF

```javascript
async function detectTemplateType(pdfData) {
    try {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        
        // Buscar patrones
        const text = textContent.items.map(i => i.str).join(' ');
        
        // Detectar circular si hay formas circulares
        if (text.includes('Jack') || hasCircularShapes(page)) {
            return 'circular';
        }
        
        // Detectar imágenes si hay grid 4x4
        if (hasImageGrid(page)) {
            return 'images';
        }
        
        // Detectar fotos 2.5x3
        if (hasPhotoLayout(page)) {
            return 'photos';
        }
        
        // Por defecto, texto
        return 'text';
        
    } catch (error) {
        return 'other';
    }
}
```

### Opción B: Análisis visual con Canvas

```javascript
async function analyzeLayoutPattern(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Detectar patrones circulares
    if (detectCircles(imageData)) {
        return 'circular';
    }
    
    // Detectar grid de imágenes
    if (detectGrid(imageData, 4, 4)) {
        return 'images';
    }
    
    return 'other';
}

function detectCircles(imageData) {
    // Implementar detección de bordes circulares
    // Usar algoritmo de Hough Circle Transform simplificado
}
```

---

## 📦 CONVERSIÓN PDF → PLANTILLA EDITABLE

### Estrategia recomendada por plantilla:

#### 1. PLANTILLA CIRCULAR
```javascript
async function loadCircularFromPDF(pdfData) {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const page = await pdf.getPage(1);
    
    // Extraer texto
    const textContent = await page.getTextContent();
    
    // Extraer imágenes (si las hay)
    const images = await extractImagesFromPage(page);
    
    // Aplicar a la plantilla
    document.getElementById('textoCirculo').value = textContent.items[0].str;
    if (images.length > 0) {
        aplicarImagenCircular(images[0]);
    }
}
```

#### 2. PLANTILLA IMÁGENES 4x4
```javascript
async function loadImagesGridFromPDF(pdfData) {
    const images = await extractAllImages(pdfData);
    
    // Aplicar a los 16 slots
    images.forEach((img, index) => {
        if (index < 16) {
            document.getElementById(`imagen-${index}`).src = img;
        }
    });
}
```

#### 3. PLANTILLA TEXTO
```javascript
async function loadTextFromPDF(pdfData) {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const text = await page.getTextContent();
        fullText += text.items.map(item => item.str).join(' ') + '\n\n';
    }
    
    // Aplicar a editor
    document.getElementById('contenidoEditable').innerHTML = fullText;
}
```

---

## 🎨 MEJORAS FUTURAS SUGERIDAS

### 1. OCR para PDFs escaneados
```javascript
// Usar Tesseract.js
import Tesseract from 'tesseract.js';

async function extractTextWithOCR(pdfCanvas) {
    const { data: { text } } = await Tesseract.recognize(
        pdfCanvas,
        'spa',
        { logger: m => console.log(m) }
    );
    return text;
}
```

### 2. Etiquetas y categorías personalizadas
```javascript
tags: ['matemáticas', '3er grado', 'geometría']
```

### 3. Búsqueda full-text
```javascript
function searchMaterials(query) {
    return materials.filter(m => 
        m.title.toLowerCase().includes(query.toLowerCase()) ||
        m.description.toLowerCase().includes(query.toLowerCase()) ||
        m.tags.some(t => t.includes(query))
    );
}
```

### 4. Compartir vía URL
```javascript
function generateShareLink(materialId) {
    const base = window.location.origin;
    return `${base}/material-educativo-reutilizable.html?id=${materialId}`;
}
```

---

## ⚙️ CONFIGURACIÓN RECOMENDADA EN INDEX.HTML

### Modificar función de exportar PDF global:

```javascript
// En index.html, función global de exportar
async function exportarPDFGlobal() {
    const iframe = document.getElementById('plantillaFrame');
    
    // Generar PDF (código existente)
    const pdfBlob = await generarPDF(iframe);
    
    // Convertir a base64
    const reader = new FileReader();
    reader.onload = async function(e) {
        const pdfData = e.target.result;
        
        // Preguntar si guardar en biblioteca
        if (confirm('✅ PDF generado\n\n¿Guardar en Biblioteca de Material Reutilizable?')) {
            const preview = await generatePreviewFromIframe(iframe);
            
            const bibliotecaFrame = document.querySelector('iframe[src*="material-educativo"]');
            if (bibliotecaFrame && bibliotecaFrame.contentWindow.ARKAIOS_MaterialLibrary) {
                bibliotecaFrame.contentWindow.ARKAIOS_MaterialLibrary.addFromPDF(pdfData, {
                    preview: preview,
                    name: `documento_${Date.now()}.pdf`
                });
            }
        }
    };
    reader.readAsDataURL(pdfBlob);
}
```

---

## 🐛 TROUBLESHOOTING

### Problema: Los PDFs no se cargan en las plantillas
**Solución:** Verificar que cada plantilla tenga el código de lectura de `arkaios_pending_load`

### Problema: Auto-detección no funciona
**Solución:** Implementar detección manual primero, luego agregar IA/ML

### Problema: Archivos muy grandes
**Solución:** Comprimir PDFs antes de guardar en localStorage
```javascript
// Usar pako.js para comprimir
const compressed = pako.deflate(pdfData);
localStorage.setItem('material', compressed);
```

---

## 📋 CHECKLIST DE INTEGRACIÓN

- [ ] Agregar botón en sidebar de index.html
- [ ] Colocar archivo material-educativo-reutilizable.html en raíz
- [ ] Modificar cada plantilla para leer `arkaios_pending_load`
- [ ] Agregar opción "Guardar en Biblioteca" en botones de exportar
- [ ] Implementar conversión PDF → plantilla en cada .html
- [ ] Probar flujo completo: subir → catalogar → reutilizar
- [ ] (Opcional) Implementar auto-detección de tipo
- [ ] (Opcional) Agregar OCR para PDFs escaneados

---

## 🎯 EJEMPLO DE USO COMPLETO

1. Usuario crea diploma en plantilla circular
2. Click en "Exportar PDF" → genera diploma.pdf
3. Sistema pregunta: "¿Guardar en Biblioteca?"
4. Usuario dice SÍ
5. Se abre modal de catalogación auto-llenado:
   - Tipo: Circular (detectado automáticamente)
   - Código: CIR-250207-001 (generado)
6. Usuario agrega título y descripción
7. Guardar
8. Aparece en biblioteca con preview
9. Usuario puede:
   - Descargar el PDF original
   - Reutilizar → se abre en plantilla circular con datos cargados
   - Modificar y re-exportar

---

## 🚀 PRÓXIMOS PASOS PARA IA BUILDER

1. **Implementar conversión PDF → Plantilla específica**
   - Extraer elementos de cada PDF según tipo
   - Aplicar a campos editables de plantilla

2. **Auto-detección con ML**
   - Entrenar modelo pequeño para clasificar tipos
   - O usar API de visión (Google Cloud Vision, Azure)

3. **Sincronización en la nube**
   - Guardar en Firebase/Supabase en lugar de localStorage
   - Compartir entre dispositivos

4. **Versionado de materiales**
   - Guardar historial de modificaciones
   - Restaurar versiones anteriores

---

FIN DE LA DOCUMENTACIÓN
