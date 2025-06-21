// db.js (VERSION CORREGIDA Y COMPLETA - REEMPLAZA TU db.js ACTUAL CON ESTO)

let db;

const DB_NAME = 'miTiendaDB'; // Te sugiero unificar el nombre de la DB a 'miTiendaDB' para consistencia

const DB_VERSION = 8; // <--- ¡¡¡IMPORTANTE!!! CAMBIADO DE 3 A 4 PARA FORZAR LA ACTUALIZACIÓN DE LA ESTRUCTURA



// Nombres de los Object Stores

const STORES = {

    productos: { keyPath: 'id', autoIncrement: true },

    clientes: { keyPath: 'id', autoIncrement: true },

    pedidos: { keyPath: 'id', autoIncrement: true },

    ventas: { keyPath: 'id', autoIncrement: true },      // ¡NUEVO!

    movimientos: { keyPath: 'id', autoIncrement: true },  // ¡NUEVO!

    proveedores: { keyPath: 'id', autoIncrement: true }  // ¡NUEVO!

};



/**

 * Abre la base de datos IndexedDB y crea/actualiza los object stores.

 * @returns {Promise<IDBDatabase>} Una promesa que resuelve con la instancia de la DB.

 */

function abrirDB() {

    return new Promise((resolve, reject) => {

        if (db) { // Si la DB ya está abierta, la devolvemos directamente

            resolve(db);

            return;

        }



        const request = indexedDB.open(DB_NAME, DB_VERSION);



        request.onupgradeneeded = event => {

            db = event.target.result;

            console.log('onupgradeneeded ejecutado. Creando/Actualizando object stores...');



            for (const storeName in STORES) {

                if (!db.objectStoreNames.contains(storeName)) {

                    const store = db.createObjectStore(storeName, STORES[storeName]);

                    console.log(`Object Store '${storeName}' creado.`);



                    // Crear índices si son necesarios para los nuevos stores

                    // Los índices de productos, clientes y pedidos ya deberían existir si vienen de una versión anterior

                    // Esta lógica solo los creará si el store es NUEVO en esta upgrade

                    if (storeName === 'productos') {

                        store.createIndex('nombre', 'nombre', { unique: false });

                        store.createIndex('categoria', 'categoria', { unique: false });

                    }

                    if (storeName === 'clientes') {

                        store.createIndex('nombre', 'nombre', { unique: false });

                        store.createIndex('telefono', 'telefono', { unique: false });

                    }

                    if (storeName === 'pedidos') {

                        store.createIndex('fechaPedido', 'fechaPedido', { unique: false });

                        store.createIndex('estado', 'estado', { unique: false });

                    }

                    if (storeName === 'ventas') { // Índices para ventas

                        store.createIndex('clienteId', 'clienteId', { unique: false });

                        store.createIndex('fecha', 'fecha', { unique: false });

                        store.createIndex('tipoPago', 'tipoPago', { unique: false });

                    }

                    if (storeName === 'movimientos') { // Índices para movimientos

                        store.createIndex('fecha', 'fecha', { unique: false });

                        store.createIndex('tipo', 'tipo', { unique: false });

                    }

                }

            }

        };



        request.onsuccess = event => {

            db = event.target.result;

            console.log('IndexedDB abierta con éxito.');

            resolve(db);

        };



        request.onerror = event => {

            console.error('Error al abrir IndexedDB:', event.target.error);

            reject(event.target.error);

        };

    });

}



// === Funciones Genéricas CRUD (MEJOR ENFOQUE) ===

// Estas funciones operan sobre cualquier Object Store que les pases.

// Esto reduce la duplicación de código.



async function obtenerTodosItems(storeName) { // Renombrado a obtenerTodosItems para claridad

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction([storeName], 'readonly');

        const store = transaction.objectStore(storeName);

        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

    });

}



async function agregarItem(storeName, item) {

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction([storeName], 'readwrite');

        const store = transaction.objectStore(storeName);

        const request = store.add(item);

        request.onsuccess = () => resolve(request.result); // result es el ID de la clave

        request.onerror = () => reject(request.error);

    });

}



async function actualizarItem(storeName, id, item) {

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction([storeName], 'readwrite');

        const store = transaction.objectStore(storeName);

        // IndexedDB necesita el objeto completo, con el keyPath incluido

        // Asegúrate de que el 'id' del objeto que se va a 'put' coincida con el 'keyPath'

        const itemToUpdate = { ...item };

        // Si el item ya tiene la propiedad 'id' (keyPath), asegúrate de que sea el mismo id que pasas

        // Esto es importante para el método 'put'

        itemToUpdate[STORES[storeName].keyPath] = id;



        const request = store.put(itemToUpdate); // put() actualiza si existe, añade si no

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

    });

}



async function eliminarItem(storeName, id) {

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction([storeName], 'readwrite');

        const store = transaction.objectStore(storeName);

        // ¡CRÍTICO! Asegurarse de que el ID sea numérico si el keyPath es autoIncrement y lo generas con Date.now()

        const request = store.delete(Number(id));

        request.onsuccess = () => resolve();

        request.onerror = () => reject(request.error);

    });

}



async function obtenerItemPorId(storeName, id) {

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction([storeName], 'readonly');

        const store = transaction.objectStore(storeName);

        // ¡CRÍTICO! Asegurarse de que el ID sea numérico si el keyPath es autoIncrement

        const request = store.get(Number(id));

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);

    });

}



async function limpiarStore(storeName) {

    const db = await abrirDB();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction([storeName], 'readwrite');

        const store = transaction.objectStore(storeName);

        const request = store.clear();

        request.onsuccess = () => resolve();

        request.onerror = () => reject(request.error);

    });

}





// === Funciones Específicas (Wrappers que llaman a las genéricas para mayor legibilidad) ===

// Productos

async function agregarProducto(producto) { return agregarItem('productos', producto); }

async function obtenerTodosLosProductos() { return obtenerTodosItems('productos'); }

async function obtenerProductoPorId(id) { return obtenerItemPorId('productos', id); }

async function actualizarProducto(id, producto) { return actualizarItem('productos', id, producto); }

async function eliminarProducto(id) { return eliminarItem('productos', id); }



// Clientes

async function agregarCliente(cliente) { return agregarItem('clientes', cliente); }

async function obtenerTodosLosClientes() { return obtenerTodosItems('clientes'); }

async function obtenerClientePorId(id) { return obtenerItemPorId('clientes', id); }

async function actualizarCliente(id, cliente) { return actualizarItem('clientes', id, cliente); }

async function eliminarCliente(id) { return eliminarItem('clientes', id); }

async function obtenerClientePorNombre(nombre) {

    const clientes = await obtenerTodosItems('clientes');

    return clientes.find(c => c.nombre === nombre);

}





// Pedidos

async function agregarPedidoDB(pedido) { return agregarItem('pedidos', pedido); }

async function obtenerTodosLosPedidosDB() { return obtenerTodosItems('pedidos'); }

async function obtenerPedidoPorId(id) { return obtenerItemPorId('pedidos', id); }

async function actualizarPedidoDB(id, pedido) { return actualizarItem('pedidos', id, pedido); }

async function eliminarPedidoDB(id) { return eliminarItem('pedidos', id); }

async function limpiarTodosLosPedidosDB() { return limpiarStore('pedidos'); } // Usa la genérica





// Ventas (¡NUEVAS FUNCIONES!)

async function agregarVenta(venta) { return agregarItem('ventas', venta); }

async function obtenerTodasLasVentas() { return obtenerTodosItems('ventas'); }

async function obtenerVentaPorId(id) { return obtenerItemPorId('ventas', id); }

async function actualizarVenta(id, venta) { return actualizarItem('ventas', id, venta); }

async function eliminarVenta(id) { return eliminarItem('ventas', id); }

async function limpiarTodasLasVentas() { return limpiarStore('ventas'); } // Nueva función de limpieza





// Movimientos (¡NUEVAS FUNCIONES!)

// NOTA IMPORTANTE: La función 'agregarMovimiento' ya existía en tu finanzas.js,

// pero aquí la definimos para la DB. Asegúrate de que finanzas.js llame a

// 'agregarMovimientoDB' o 'agregarItem('movimientos', ...)' para evitar conflictos.

async function agregarMovimientoDB(movimiento) { return agregarItem('movimientos', movimiento); } // Renombrada para evitar conflicto

async function obtenerTodosLosMovimientos() { return obtenerTodosItems('movimientos'); }

async function obtenerMovimientoPorId(id) { return obtenerItemPorId('movimientos', id); }

async function actualizarMovimientoDB(id, movimiento) { return actualizarItem('movimientos', id, movimiento); } // Renombrada

async function eliminarMovimientoDB(id) { return eliminarItem('movimientos', id); }

async function limpiarTodosLosMovimientos() { return limpiarStore('movimientos'); } // Nueva función de limpieza





// Exportar las funciones para que estén disponibles globalmente

window.abrirDB = abrirDB;

window.limpiarStore = limpiarStore; // Exportar la función genérica de limpieza



// Exportar funciones CRUD de Productos

window.agregarProducto = agregarProducto;

window.obtenerTodosLosProductos = obtenerTodosLosProductos;

window.obtenerProductoPorId = obtenerProductoPorId;

window.actualizarProducto = actualizarProducto;

window.eliminarProducto = eliminarProducto;



// Exportar funciones CRUD de Clientes

window.agregarCliente = agregarCliente;

window.obtenerTodosLosClientes = obtenerTodosLosClientes;

window.obtenerClientePorId = obtenerClientePorId;

window.obtenerClientePorNombre = obtenerClientePorNombre;

window.actualizarCliente = actualizarCliente;

window.eliminarCliente = eliminarCliente;



// Exportar funciones CRUD de Pedidos

window.agregarPedidoDB = agregarPedidoDB;

window.obtenerTodosLosPedidosDB = obtenerTodosLosPedidosDB;

window.obtenerPedidoPorId = obtenerPedidoPorId;

window.actualizarPedidoDB = actualizarPedidoDB;

window.eliminarPedidoDB = eliminarPedidoDB;

window.limpiarTodosLosPedidosDB = limpiarTodosLosPedidosDB;



// Exportar funciones CRUD de Ventas

window.agregarVenta = agregarVenta;

window.obtenerTodasLasVentas = obtenerTodasLasVentas;

window.obtenerVentaPorId = obtenerVentaPorId;

window.actualizarVenta = actualizarVenta;

window.eliminarVenta = eliminarVenta;

window.limpiarTodasLasVentas = limpiarTodasLasVentas;



// Exportar funciones CRUD de Movimientos

window.agregarMovimientoDB = agregarMovimientoDB; // Exportar con el nuevo nombre

window.obtenerTodosLosMovimientos = obtenerTodosLosMovimientos;

window.obtenerMovimientoPorId = obtenerMovimientoPorId;

window.actualizarMovimientoDB = actualizarMovimientoDB; // Exportar con el nuevo nombre

window.eliminarMovimientoDB = eliminarMovimientoDB;

window.limpiarTodosLosMovimientos = limpiarTodosLosMovimientos;



// Proveedores

async function agregarProveedorDB(proveedor) { return agregarItem('proveedores', proveedor); }

async function obtenerTodosLosProveedoresDB() { return obtenerTodosItems('proveedores'); }

async function obtenerProveedorPorId(id) { return obtenerItemPorId('proveedores', id); }

async function actualizarProveedorDB(id, proveedor) { return actualizarItem('proveedores', id, proveedor); }

async function eliminarProveedorDB(id) { return eliminarItem('proveedores', id); }

async function limpiarTodosLosProveedoresDB() { return limpiarStore('proveedores'); }



window.agregarProveedorDB = agregarProveedorDB;

window.obtenerTodosLosProveedoresDB = obtenerTodosLosProveedoresDB;

window.obtenerProveedorPorId = obtenerProveedorPorId;

window.actualizarProveedorDB = actualizarProveedorDB;

window.eliminarProveedorDB = eliminarProveedorDB;

window.limpiarTodosLosProveedoresDB = limpiarTodosLosProveedoresDB;