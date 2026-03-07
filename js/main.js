// ========== INTEGRACIÓN PIXABAY ==========
const PIXABAY_CONFIG = {
    useBackend: true,
    endpoint: '/api/pixabay',
    directKey: ''
};

async function fetchPixabayImages(topic, count = 8) {
    const per_page = Math.min(Math.max(count, 3), 50);
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';

    if (PIXABAY_CONFIG.useBackend) {
        const localBase = location.protocol === 'file:' ? 'http://localhost:3000' : location.origin;
        const endpoint = isLocal ? (localBase + PIXABAY_CONFIG.endpoint) : PIXABAY_CONFIG.endpoint;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: topic, per_page })
            });

            if (!res.ok) throw new Error('Error al llamar /api/pixabay');
            const data = await res.json();
            return (data.hits || []).map((h) => h.webformatURL || h.previewURL).filter(Boolean);
        } catch (err) {
            console.warn('Fallo backend /api/pixabay, intentando llamado directo...', err);
            if (!PIXABAY_CONFIG.directKey) throw err;
        }
    }

    const url = 'https://pixabay.com/api/?' + new URLSearchParams({
        key: PIXABAY_CONFIG.directKey,
        q: topic,
        image_type: 'photo',
        safesearch: 'true',
        per_page: String(per_page)
    }).toString();

    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al llamar Pixabay directo');
    const data = await res.json();
    return (data.hits || []).map((h) => h.webformatURL || h.previewURL).filter(Boolean);
}

function sendImagesToActiveTemplate(topic, imageUrls, source = 'pixabay') {
    const frame = document.getElementById('plantillaFrame');
    if (!frame || !frame.contentWindow) return;

    let messageType = 'ARKAIOS_PIXABAY_IMAGES';
    if (source === 'freepik') messageType = 'ARKAIOS_FREEPIK_IMAGES';
    else if (source === 'pexels') messageType = 'ARKAIOS_PEXELS_IMAGES';

    frame.contentWindow.postMessage({
        type: messageType,
        images: imageUrls,
        topic: topic
    }, '*');
}

// ========== INTEGRACIÓN FREEPIK ==========
const FREEPIK_CONFIG = { endpoint: '/api/freepik' };

async function fetchFreepikImages(topic, count = 8) {
    const limit = Math.min(Math.max(count, 3), 50);
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
    const localBase = location.protocol === 'file:' ? 'http://localhost:3000' : location.origin;
    const endpoint = isLocal ? (localBase + FREEPIK_CONFIG.endpoint) : FREEPIK_CONFIG.endpoint;

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: topic, limit })
        });

        if (!res.ok) {
            const errorBody = await res.json();
            throw new Error(`Error al llamar /api/freepik: ${errorBody.error || res.statusText}`);
        }

        const data = await res.json();
        return (data.data || []).map(item => item.urls.regular).filter(Boolean);
    } catch (err) {
        console.error('Fallo el backend /api/freepik', err);
        throw err;
    }
}

// ========== INTEGRACIÓN PEXELS ==========
const PEXELS_CONFIG = { endpoint: '/api/pexels' };

async function fetchPexelsImages(topic, count = 8) {
    const per_page = Math.min(Math.max(count, 3), 50);
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
    const localBase = location.protocol === 'file:' ? 'http://localhost:3000' : location.origin;
    const endpoint = isLocal ? (localBase + PEXELS_CONFIG.endpoint) : PEXELS_CONFIG.endpoint;

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: topic, per_page })
        });

        if (!res.ok) {
            const errorBody = await res.json();
            throw new Error(`Error al llamar /api/pexels: ${errorBody.error || res.statusText}`);
        }

        const data = await res.json();
        return (data.photos || []).map(p => p.src.large).filter(Boolean);
    } catch (err) {
        console.error('Fallo el backend /api/pexels', err);
        throw err;
    }
}

// ========== SISTEMA UNIVERSAL ARKAIOS ==========
const ARKAIOS = {
    version: '2.0',
    autoSaveInterval: null,

    init() {
        console.log('🚀 Sistema Universal ARKAIOS v' + this.version);
        this.startAutoSave();
        this.loadAutoSave();

        window.addEventListener('message', (event) => {
            if (event.data.type === 'ARKAIOS_DATA_UPDATE') {
                this.handleDataUpdate(event.data);
            }
        });
    },

    saveProject() {
        try {
            const frame = document.getElementById('plantillaFrame');
            const projectData = {
                version: this.version,
                timestamp: new Date().toISOString(),
                template: currentTemplate,
                templateData: null
            };

            try {
                if (frame.contentWindow && frame.contentWindow.ARKAIOS_getData) {
                    projectData.templateData = frame.contentWindow.ARKAIOS_getData();
                }
            } catch (e) {
                console.warn('No se pudieron obtener datos del iframe:', e);
            }

            const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proyecto-arkaios-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            this.showSaveIndicator('Proyecto guardado correctamente');
        } catch (error) {
            console.error('Error al guardar proyecto:', error);
            alert('Error al guardar el proyecto');
        }
    },

    loadProject() {
        const input = document.getElementById('projectLoader');
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const projectData = JSON.parse(event.target.result);
                    if (projectData.template) {
                        currentTemplate = projectData.template;
                        const frame = document.getElementById('plantillaFrame');
                        frame.src = projectData.template;

                        frame.onload = () => {
                            if (projectData.templateData && frame.contentWindow.ARKAIOS_setData) {
                                frame.contentWindow.ARKAIOS_setData(projectData.templateData);
                            }
                            this.showSaveIndicator('Proyecto cargado correctamente');
                        };
                    }
                } catch (error) {
                    console.error('Error al cargar proyecto:', error);
                    alert('Error al cargar el proyecto. Archivo inválido.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    },

    async exportToPDF() {
        const frame = document.getElementById('plantillaFrame');
        try {
            this.showSaveIndicator('Generando PDF, por favor espera...');

            if (frame.contentWindow && frame.contentWindow.ARKAIOS_exportPDF) {
                await frame.contentWindow.ARKAIOS_exportPDF();
                this.showSaveIndicator('PDF generado correctamente');
                return;
            }

            const { jsPDF } = window.jspdf;
            const canvas = await html2canvas(frame.contentDocument.body, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'letter'
            });

            const imgWidth = 215.9;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`plantilla-arkaios-${Date.now()}.pdf`);

            this.showSaveIndicator('PDF generado correctamente');
        } catch (error) {
            console.error('Error al exportar PDF:', error);
            alert('Error al generar el PDF. Intenta usar el botón de imprimir de la plantilla.');
        }
    },

    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            this.autoSave();
        }, 30000);
    },

    autoSave() {
        try {
            const frame = document.getElementById('plantillaFrame');
            if (frame.contentWindow && frame.contentWindow.ARKAIOS_getData) {
                const data = frame.contentWindow.ARKAIOS_getData();
                localStorage.setItem('arkaios_autosave', JSON.stringify({
                    template: currentTemplate,
                    data: data,
                    timestamp: Date.now()
                }));
                this.showSaveIndicator('Guardado automático');
            }
        } catch (e) {
            // Ignorar errores silenciosamente
        }
    },

    loadAutoSave() {
        const saved = localStorage.getItem('arkaios_autosave');
        if (saved) {
            console.log('Auto-save encontrado');
        }
    },

    showSaveIndicator(msg) {
        const indicator = document.getElementById('autoSaveIndicator');
        indicator.textContent = '✓ ' + msg;
        indicator.classList.add('show');
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 3000);
    },

    handleDataUpdate(data) {
        console.log('Datos actualizados desde iframe:', data);
    },

    async autoFillImagesPrompt() {
        const topic = prompt('¿Sobre qué tema quieres imágenes de Pixabay? (Ej: "sistema solar")');
        if (!topic) return;

        const countStr = prompt('¿Cuántas imágenes quieres? (Máx 50)', '12');
        const count = parseInt(countStr) || 12;

        this.showSaveIndicator('Buscando imágenes en Pixabay...');
        try {
            const images = await fetchPixabayImages(topic, count);
            if (images.length === 0) {
                alert('No se encontraron imágenes para: ' + topic);
                return;
            }
            sendImagesToActiveTemplate(topic, images, 'pixabay');
            this.showSaveIndicator(`Enviadas ${images.length} imágenes de Pixabay`);
        } catch (err) {
            console.error(err);
            alert('Error al buscar imágenes: ' + err.message);
        }
    },

    async autoFillImagesFreepikPrompt() {
        const topic = prompt('¿Sobre qué tema quieres imágenes de Freepik?');
        if (!topic) return;

        const countStr = prompt('¿Cuántas imágenes quieres? (Máx 50)', '12');
        const count = parseInt(countStr) || 12;

        this.showSaveIndicator('Buscando imágenes en Freepik...');
        try {
            const images = await fetchFreepikImages(topic, count);
            if (images.length === 0) {
                alert('No se encontraron imágenes para: ' + topic);
                return;
            }
            sendImagesToActiveTemplate(topic, images, 'freepik');
            this.showSaveIndicator(`Enviadas ${images.length} imágenes de Freepik`);
        } catch (err) {
            console.error(err);
            alert('Error al buscar imágenes: ' + err.message);
        }
    },

    async autoFillImagesPexelsPrompt() {
        const topic = prompt('¿Sobre qué tema quieres imágenes de Pexels?');
        if (!topic) return;

        const countStr = prompt('¿Cuántas imágenes quieres? (Máx 50)', '12');
        const count = parseInt(countStr) || 12;

        this.showSaveIndicator('Buscando imágenes en Pexels...');
        try {
            const images = await fetchPexelsImages(topic, count);
            if (images.length === 0) {
                alert('No se encontraron imágenes para: ' + topic);
                return;
            }
            sendImagesToActiveTemplate(topic, images, 'pexels');
            this.showSaveIndicator(`Enviadas ${images.length} imágenes de Pexels`);
        } catch (err) {
            console.error(err);
            alert('Error al buscar imágenes: ' + err.message);
        }
    },

    async generateImageWithGrok() {
        const topic = prompt('Describe la imagen que quieres generar con Grok:');
        if (!topic) return;

        const countStr = prompt('¿Cuántas imágenes quieres generar? (1-4)', '1');
        const count = parseInt(countStr) || 1;

        let apiKey = localStorage.getItem('grok_api_key');
        if (!apiKey) {
            apiKey = prompt('Ingresa tu API Key de Grok (xAI):');
            if (apiKey) localStorage.setItem('grok_api_key', apiKey);
        }
        if (!apiKey) return;

        this.showSaveIndicator('Generando imágenes con Grok...');

        try {
            const images = await fetchGrokImages(topic, count, apiKey);
            if (images.length === 0) {
                alert('No se pudieron generar imágenes. Asegúrate de que tu API Key tenga permisos.');
                return;
            }
            sendImagesToActiveTemplate(topic, images, 'grok');
            this.showSaveIndicator(`Generadas ${images.length} imágenes con Grok`);
        } catch (err) {
            console.error(err);
            alert('Error al generar imágenes: ' + err.message);
        }
    }
};

async function fetchGrokImages(prompt, count, apiKey) {
    // Usar el backend proxy para evitar CORS
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:';
    const localBase = location.protocol === 'file:' ? 'http://localhost:3000' : location.origin;
    const endpoint = isLocal ? (localBase + '/api/grok') : '/api/grok';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: apiKey,
                prompt: prompt,
                count: count
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || response.statusText);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';

        // Buscar URLs en la respuesta (Markdown o texto plano)
        const urlRegex = /(https?:\/\/[^\s)]+)/g;
        const matches = content.match(urlRegex);

        return matches ? matches.slice(0, count) : [];
    } catch (err) {
        console.error('Error fetching Grok images:', err);
        throw err;
    }
}

// Variable global para la plantilla actual
let currentTemplate = 'plantilla_escolar_carta_mx_autoajuste_y_areas_editables.html';

// Inicializar al cargar
window.addEventListener('DOMContentLoaded', () => {
    ARKAIOS.init();

    // Manejo de navegación
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.target;
            if (target) {
                currentTemplate = target;
                const frame = document.getElementById('plantillaFrame');
                frame.src = target;
            }
        });
    });
});
