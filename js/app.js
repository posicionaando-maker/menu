/**
 * app.js - Lógica completa del menú digital
 * Maneja: Carga inicial, actualización manual desde Drive, renderizado de UI
 */

// ===== CONFIGURACIÓN =====
// ⚠️ IMPORTANTE: CAMBIA ESTA URL POR LA DE TU JSON EN GOOGLE DRIVE
// Para obtener la URL: Sube menu.json a Drive, hazlo público (cualquiera con enlace)
// Luego copia el ID del archivo y pégalo aquí:
const GOOGLE_DRIVE_FILE_ID = 'TU_ID_DEL_ARCHIVO_AQUI';  // 🔴 CAMBIAR ESTO 🔴
const MENU_JSON_URL = `https://drive.google.com/uc?export=download&id=${GOOGLE_DRIVE_FILE_ID}`;

// Mapeo de categorías para mostrar nombres bonitos en los tabs
const CATEGORIAS_MAP = {
    'entradas': '🍢 Entradas',
    'principales': '🍛 Principales',
    'acompaniamientos': '🥗 Acompañamientos',
    'postres': '🍰 Postres',
    'bebidas': '🥤 Bebidas'
};

// Estado global de la aplicación
let menuActual = null;          // Objeto del menú actual (JSON)
let categoriaSeleccionada = 'todos';  // Filtro activo

// ===== FUNCIONES AUXILIARES =====

/**
 * Muestra un mensaje temporal en la snackbar
 * @param {string} mensaje - Texto a mostrar
 * @param {string} tipo - 'info', 'success', 'error'
 */
function mostrarNotificacion(mensaje, tipo = 'info') {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = mensaje;
    snackbar.classList.add('show');
    
    // Cambiar color de borde según el tipo
    if (tipo === 'error') snackbar.style.borderLeftColor = '#CF6679';
    else if (tipo === 'success') snackbar.style.borderLeftColor = '#03DAC6';
    else snackbar.style.borderLeftColor = '#BB86FC';
    
    setTimeout(() => {
        snackbar.classList.remove('show');
    }, 2500);
}

/**
 * Obtiene un Blob de imagen desde una URL (descarga binaria)
 * @param {string} url - URL pública de la imagen en Drive
 * @returns {Promise<Blob>}
 */
async function descargarImagenComoBlob(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
    return await response.blob();
}

/**
 * Carga el menú desde Google Drive (remoto)
 * @returns {Promise<object>} El JSON del menú
 */
async function cargarMenuRemoto() {
    mostrarNotificacion('🔄 Buscando nueva versión...', 'info');
    const response = await fetch(MENU_JSON_URL);
    if (!response.ok) throw new Error(`No se pudo descargar menu.json (${response.status})`);
    const data = await response.json();
    
    // Validar estructura mínima
    if (!data.version || !data.platos || !Array.isArray(data.platos)) {
        throw new Error('El JSON no tiene la estructura esperada');
    }
    return data;
}

/**
 * Sincroniza las imágenes: descarga las nuevas, elimina las que ya no se usan
 * @param {Array} platos - Array de platos del nuevo menú
 */
async function sincronizarImagenes(platos) {
    // Extraer todas las URLs de imágenes del nuevo menú
    const urlsNecesarias = platos.map(p => p.imagenUrl).filter(url => url && url !== '');
    
    // Verificar qué imágenes ya tenemos en caché
    const urlsExistentes = [];
    for (const url of urlsNecesarias) {
        const imagenExistente = await obtenerImagen(url);
        if (imagenExistente) {
            urlsExistentes.push(url);
        } else {
            // Descargar imagen nueva
            try {
                mostrarNotificacion(`📸 Descargando imagen nueva...`, 'info');
                const blob = await descargarImagenComoBlob(url);
                await guardarImagen(url, blob);
                console.log(`✅ Imagen guardada: ${url}`);
            } catch (error) {
                console.error(`❌ Error al descargar imagen ${url}:`, error);
            }
        }
    }
    
    // Limpiar imágenes huérfanas (las que ya no están en el nuevo menú)
    await limpiarImagenesHuerfanas(urlsNecesarias);
}

/**
 * Actualiza el menú desde Drive (descarga, compara versiones, guarda)
 * @returns {Promise<boolean>} true si hubo actualización, false si ya estaba actualizado
 */
async function actualizarMenuDesdeDrive() {
    try {
        const nuevoMenu = await cargarMenuRemoto();
        
        // Comparar versiones
        if (menuActual && menuActual.version === nuevoMenu.version) {
            mostrarNotificacion('✅ El menú ya está actualizado', 'success');
            return false;
        }
        
        // Sincronizar imágenes antes de guardar el nuevo menú
        await sincronizarImagenes(nuevoMenu.platos);
        
        // Guardar nuevo menú en IndexedDB
        await guardarMenu(nuevoMenu);
        
        // Actualizar variable global
        menuActual = nuevoMenu;
        
        // Actualizar UI
        actualizarFechaUI(nuevoMenu.lastUpdate);
        renderizarTabs(nuevoMenu.platos);
        renderizarPlatos(nuevoMenu.platos);
        
        mostrarNotificacion(`✨ Menú actualizado a versión ${nuevoMenu.version}`, 'success');
        return true;
        
    } catch (error) {
        console.error('Error al actualizar:', error);
        mostrarNotificacion(`❌ Error: ${error.message}`, 'error');
        return false;
    }
}

/**
 * Actualiza el texto de la última actualización en el header
 * @param {string} fechaTexto - Fecha legible
 */
function actualizarFechaUI(fechaTexto) {
    const fechaElement = document.getElementById('lastUpdate');
    fechaElement.textContent = `📅 Última actualización: ${fechaTexto || 'desconocida'}`;
}

/**
 * Genera dinámicamente los tabs (pestañas de categorías)
 * @param {Array} platos - Lista de platos
 */
function renderizarTabs(platos) {
    // Obtener categorías únicas de los platos
    const categoriasUnicas = [...new Set(platos.map(p => p.categoria))];
    const tabsContainer = document.getElementById('tabs');
    
    // Construir HTML de tabs
    let html = `<button class="tab-btn active" data-categoria="todos">📋 Todos</button>`;
    
    categoriasUnicas.forEach(cat => {
        const nombreBonito = CATEGORIAS_MAP[cat] || cat;
        html += `<button class="tab-btn" data-categoria="${cat}">${nombreBonito}</button>`;
    });
    
    tabsContainer.innerHTML = html;
    
    // Agregar event listeners a los nuevos botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Cambiar clase active
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Filtrar platos
            categoriaSeleccionada = btn.dataset.categoria;
            renderizarPlatos(menuActual.platos);
        });
    });
}

/**
 * Convierte una URL de imagen (Drive) a un objeto URL de blob si está en caché
 * @param {string} urlOriginal - URL de Drive
 * @returns {Promise<string|null>} URL de blob o null si no se encuentra
 */
async function obtenerURLImagenLocal(urlOriginal) {
    const blob = await obtenerImagen(urlOriginal);
    if (blob) {
        return URL.createObjectURL(blob);
    }
    return null;
}

/**
 * Renderiza los platos en el grid según la categoría seleccionada
 * @param {Array} platos - Lista completa de platos
 */
async function renderizarPlatos(platos) {
    const grid = document.getElementById('menuGrid');
    
    // Filtrar por categoría
    let platosFiltrados = platos;
    if (categoriaSeleccionada !== 'todos') {
        platosFiltrados = platos.filter(p => p.categoria === categoriaSeleccionada);
    }
    
    if (platosFiltrados.length === 0) {
        grid.innerHTML = '<div class="loading-spinner">🍽️ No hay platos en esta categoría</div>';
        return;
    }
    
    // Mostrar loading mientras se construyen las tarjetas
    grid.innerHTML = '<div class="loading-spinner">Cargando imágenes...</div>';
    
    // Construir HTML de cada tarjeta (con imágenes locales)
    let tarjetasHTML = '';
    
    for (const plato of platosFiltrados) {
        const imagenLocalURL = await obtenerURLImagenLocal(plato.imagenUrl);
        
        tarjetasHTML += `
            <div class="card">
                <img class="card-img" 
                     src="${imagenLocalURL || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100%25\' height=\'100%25\'%3E%3Crect width=\'100%25\' height=\'100%25\' fill=\'%232A2A2A\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' fill=\'%23666\' dy=\'.3em\' text-anchor=\'middle\'%3ESin imagen%3C/text%3E%3C/svg%3E'}" 
                     alt="${plato.nombre}"
                     loading="lazy">
                <div class="card-content">
                    <h3 class="card-title">${plato.nombre}</h3>
                    <p class="card-description">${plato.descripcion || ''}</p>
                    <div class="card-price">${plato.precio}</div>
                </div>
            </div>
        `;
    }
    
    grid.innerHTML = tarjetasHTML;
}

/**
 * Carga el menú inicial: primero desde IndexedDB, luego intenta actualizar
 */
async function iniciarApp() {
    try {
        // 1. Intentar cargar menú guardado localmente
        const menuGuardado = await obtenerMenu();
        
        if (menuGuardado) {
            menuActual = menuGuardado;
            actualizarFechaUI(menuGuardado.lastUpdate);
            renderizarTabs(menuGuardado.platos);
            await renderizarPlatos(menuGuardado.platos);
            mostrarNotificacion('📱 Menú cargado desde caché', 'info');
        } else {
            mostrarNotificacion('📡 Primera carga, descargando menú...', 'info');
            // No hay menú local, hay que descargar desde Drive
            await actualizarMenuDesdeDrive();
        }
        
        // 2. En segundo plano, verificar si hay nueva versión (sin molestar)
        // Esto es opcional: se puede hacer al inicio siempre para estar al día
        // Lo descomentamos para que intente actualizar silenciosamente
        setTimeout(async () => {
            try {
                const menuRemoto = await cargarMenuRemoto();
                if (!menuActual || menuActual.version !== menuRemoto.version) {
                    mostrarNotificacion('🆕 Nueva versión disponible. Presiona 🔄 para actualizar', 'info');
                }
            } catch (e) {
                console.log('No se pudo verificar versión remota (sin internet?)');
            }
        }, 2000);
        
    } catch (error) {
        console.error('Error fatal al iniciar app:', error);
        document.getElementById('menuGrid').innerHTML = `
            <div class="loading-spinner" style="color: #CF6679">
                ❌ Error al cargar el menú.<br>
                Verifica tu conexión y que la URL de Drive sea correcta.
            </div>
        `;
    }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    iniciarApp();
    
    // Botón de actualización manual
    const btnActualizar = document.getElementById('btnActualizar');
    btnActualizar.addEventListener('click', async () => {
        btnActualizar.style.transform = 'scale(0.9)';
        setTimeout(() => { btnActualizar.style.transform = ''; }, 200);
        await actualizarMenuDesdeDrive();
    });
});
