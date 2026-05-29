/**
 * db.js - Gestión de IndexedDB para guardar el menú y las imágenes
 * IndexedDB es una base de datos NoSQL dentro del navegador.
 * Permite almacenar grandes cantidades de datos estructurados.
 */

// Nombre y versión de la base de datos (cambiar versión si se modifica estructura)
const DB_NAME = 'MenuDigitalDB';
const DB_VERSION = 2;  // Incrementar si cambias la estructura de las stores

// Nombres de las stores (tablas)
const STORE_MENU = 'menu';      // Guarda el JSON del menú
const STORE_IMAGENES = 'imagenes'; // Guarda las imágenes como Blob

/**
 * Abre (o crea) la base de datos.
 * Retorna una Promise con la conexión a la DB.
 */
function abrirDB() {
    return new Promise((resolve, reject) => {
        // Solicitar apertura de la base de datos
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        // Se ejecuta si la base es nueva o la versión cambió
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Crear store 'menu' si no existe (clave auto-incrementada)
            if (!db.objectStoreNames.contains(STORE_MENU)) {
                db.createObjectStore(STORE_MENU, { keyPath: 'id', autoIncrement: true });
            }
            
            // Crear store 'imagenes' para guardar imágenes por URL
            if (!db.objectStoreNames.contains(STORE_IMAGENES)) {
                db.createObjectStore(STORE_IMAGENES, { keyPath: 'url' });
            }
            console.log('📦 Base de datos creada/actualizada');
        };
        
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        
        request.onerror = (event) => {
            console.error('Error al abrir DB:', event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Guarda el menú completo (objeto JSON) en IndexedDB.
 * @param {object} menuData - Objeto con version, lastUpdate, platos[]
 */
async function guardarMenu(menuData) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_MENU], 'readwrite');
        const store = transaction.objectStore(STORE_MENU);
        
        // Limpiar store anterior (solo debe haber un registro)
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
            // Guardar el nuevo menú
            const addRequest = store.add({ id: 1, data: menuData });
            addRequest.onsuccess = () => resolve();
            addRequest.onerror = (e) => reject(e.target.error);
        };
        
        clearRequest.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Obtiene el menú guardado localmente.
 * @returns {object|null} El objeto del menú o null si no existe.
 */
async function obtenerMenu() {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_MENU], 'readonly');
        const store = transaction.objectStore(STORE_MENU);
        const getRequest = store.get(1);  // El registro con id=1
        
        getRequest.onsuccess = () => {
            const resultado = getRequest.result;
            resolve(resultado ? resultado.data : null);
        };
        
        getRequest.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Guarda una imagen en IndexedDB asociada a su URL.
 * @param {string} url - URL original de Drive
 * @param {Blob} blob - Datos binarios de la imagen
 */
async function guardarImagen(url, blob) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGENES], 'readwrite');
        const store = transaction.objectStore(STORE_IMAGENES);
        const request = store.put({ url: url, blob: blob });
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Obtiene una imagen desde IndexedDB (si existe).
 * @param {string} url - URL de la imagen
 * @returns {Blob|null} Blob de la imagen o null
 */
async function obtenerImagen(url) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGENES], 'readonly');
        const store = transaction.objectStore(STORE_IMAGENES);
        const request = store.get(url);
        
        request.onsuccess = () => {
            const resultado = request.result;
            resolve(resultado ? resultado.blob : null);
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Elimina una imagen de IndexedDB (útil si el plato ya no existe)
 * @param {string} url - URL de la imagen a eliminar
 */
async function eliminarImagen(url) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_IMAGENES], 'readwrite');
        const store = transaction.objectStore(STORE_IMAGENES);
        const request = store.delete(url);
        
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

/**
 * Limpia todas las imágenes huérfanas (las que no están en la lista actual de URLs)
 * @param {string[]} urlsActivas - Array de URLs que sí deben conservarse
 */
async function limpiarImagenesHuerfanas(urlsActivas) {
    const db = await abrirDB();
    const transaction = db.transaction([STORE_IMAGENES], 'readwrite');
    const store = transaction.objectStore(STORE_IMAGENES);
    
    // Obtener todas las claves (URLs) almacenadas
    const keysRequest = store.getAllKeys();
    
    keysRequest.onsuccess = () => {
        const todasLasURLs = keysRequest.result;
        const urlsAEliminar = todasLasURLs.filter(url => !urlsActivas.includes(url));
        
        urlsAEliminar.forEach(url => {
            store.delete(url);
            console.log(`🗑️ Imagen huérfana eliminada: ${url}`);
        });
    };
}
