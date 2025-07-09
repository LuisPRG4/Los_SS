// js/inventario.js

let productos = [];
let editIndex = null;
let editId = null;
let terminoBusqueda = "";
let criterioOrden = "nombre";

// Mapeo de colores por categoría para cabecera
const categoriaColores = {
    "Lácteos": "#ff9aa2",
    "Bebidas": "#a0ced9",
    "Snacks": "#fbc687",
    "Cereales": "#ffb7b2",
    "Carnes": "#d4a5a5",
    "Vegetales": "#bde0c6",
    "Frutas": "#ffd97d",
    "Limpieza": "#c5c6c7",
    "Panadería": "#f6d6ad",
    "Abarrotes": "#c9cba3",
    "Congelados": "#9ec1cf",
    "Refrigerados": "#a2d2ff",
    "Otros": "#dec0f1"
};

document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB(); // Asegúrate de que abrirDB() esté definido en db.js y funcione correctamente.
    productos = await obtenerTodosLosProductos();
    aplicarFiltros();
    cargarProveedores();
    setupPreview();

    // *** NUEVO: Event Listeners para los botones de Exportar/Importar/Plantilla (ahora JSON) ***
    document.getElementById('exportarInventarioBtn').addEventListener('click', exportarInventarioJSON); // Cambiado a JSON
    document.getElementById('importarInventarioInput').addEventListener('change', importarInventarioJSON); // Cambiado a JSON
    document.getElementById('descargarPlantillaBtn').addEventListener('click', descargarPlantillaInventarioJSON); // Cambiado a JSON

    //ESTO ES PARA IR DE INICIO AL INVENTARIO A REPONER EL STOCK DEL PRODUCTO BAJO ALERTA
    // --- INICIO: CÓDIGO AÑADIDO PARA LA NAVEGACIÓN DESDE DASHBOARD ---
    const productoIdParaEditar = sessionStorage.getItem('productoParaEditar');
    if (productoIdParaEditar) {
        // Limpiar el sessionStorage inmediatamente para que no se active de nuevo al recargar
        sessionStorage.removeItem('productoParaEditar'); 
        
        // Llamar a tu función existente para cargar el producto en el formulario
        // Asegúrate de convertir el ID a número porque sessionStorage lo guarda como string
        await cargarProductoParaEdicion(Number(productoIdParaEditar)); 
    }
    // --- FIN: CÓDIGO AÑADIDO ---

    // --- INICIO: Asegurar que el botón de Cancelar tenga su evento ---
    // Ya tienes la función cancelarEdicion(), solo falta el listener si no lo tienes en tu HTML
    const btnCancelar = document.getElementById("btnCancelar");
    if (btnCancelar) { // Verifica que el botón existe en el DOM
        btnCancelar.addEventListener("click", cancelarEdicion);
    }
    // --- FIN: Asegurar que el botón de Cancelar tenga su evento ---

    // --- Buscador en tiempo real ---
    const busquedaInput = document.getElementById("busquedaInput");
    if (busquedaInput) {
        busquedaInput.addEventListener("input", (e) => {
            terminoBusqueda = e.target.value.toLowerCase();
            aplicarFiltros();
        });
    }

    // --- Selector de ordenamiento ---
    const ordenarSelect = document.getElementById("ordenarSelect");
    if (ordenarSelect) {
        ordenarSelect.addEventListener("change", (e) => {
            criterioOrden = e.target.value;
            aplicarFiltros();
        });
    }
});

function mostrarProductos(filtrados = productos) {
    const lista = document.getElementById("listaProductos");
    lista.innerHTML = "";

    if (filtrados.length === 0) {
        lista.innerHTML = `<p class="mensaje-lista">No hay productos registrados.</p>`;
        return;
    }

    filtrados.forEach((producto) => {
        const card = crearCardProducto(producto);
        lista.appendChild(card);
    });
}

function crearCardProducto(producto) {
    const card = document.createElement("div");
    card.className = "modern-card fade-in";

    // Determinar si el stock está por debajo del mínimo o por encima del máximo
    const tieneMin = producto.stockMin !== null && producto.stockMin !== undefined;
    const tieneMax = producto.stockMax !== null && producto.stockMax !== undefined;
    if (tieneMin && producto.stock <= producto.stockMin) {
        card.classList.add("stock-low");
    } else if (tieneMax && producto.stock >= producto.stockMax) {
        card.classList.add("stock-high");
    } else {
        // Umbrales por defecto cuando no hay mínimos/máximos definidos
        if (producto.stock <= 1) {
            card.classList.add("stock-low");
        } else if (producto.stock >= 10) {
            card.classList.add("stock-high");
        }
    }

    const imagenProductoUrl = producto.imagen || 'https://placehold.co/100x100/e0e0e0/5B2D90?text=Producto';

    const colorHeader = categoriaColores[producto.categoria] || "#d4af37";
    const headerStyle = `background: linear-gradient(90deg, ${colorHeader} 0%, transparent 100%);`;

    const stockMinDisplay = producto.stockMin ?? 'N/D';
    const stockMaxDisplay = producto.stockMax ?? 'N/D';

    const indicadorTexto = card.classList.contains("stock-low") ? " 🔴" : (card.classList.contains("stock-high") ? " 🟢" : "");

    card.innerHTML = `
        <div class="card-header" style="${headerStyle}">
            <h3 title="${producto.nombre}">${producto.nombre}${indicadorTexto}</h3>
            <span class="card-meta">Categoría: ${producto.categoria || 'Sin Categoría'}</span>
        </div>
        <div class="card-content">
            <p>
                <img src="${imagenProductoUrl}"
                     alt="Imagen de ${producto.nombre}"
                     style="width: 50px; height: 50px; border-radius: 8px; margin-right: 10px; object-fit: cover; vertical-align: middle; display: inline-block;">
                <strong>Stock:</strong> ${producto.stock} ${producto.unidadMedida || 'unidad(es)'}
            </p>
            <p><strong>Vendidos:</strong> ${producto.vendidos || 0} ${producto.unidadMedida || 'unidad(es)'}</p>
            <p><strong>Proveedor:</strong> ${producto.proveedor || "Propio"}</p>
            <p><strong>Costo:</strong> $${producto.costo?.toFixed(2) || '0.00'}</p>
            <p><strong>Precio Venta:</strong> $${producto.precio?.toFixed(2) || '0.00'}</p>
            <p><strong>Stock Mínimo:</strong> ${stockMinDisplay}</p>
            <p><strong>Stock Máximo:</strong> ${stockMaxDisplay}</p>
        </div>
        <div class="card-actions">
            <button onclick="ajustarStock(${producto.id}, -1)" class="btn-minus">➖ 1</button>
            <button onclick="ajustarStock(${producto.id}, 1)" class="btn-plus">➕ 1</button>
            <button onclick="cargarProductoParaEdicion(${producto.id})" class="btn-edit">✏️ Editar</button>
            <button onclick="eliminarProductoDesdeUI(${producto.id})" class="btn-delete">🗑️ Eliminar</button>
        </div>
    `;
    return card;
}

async function cargarProductoParaEdicion(idProducto) {
    const producto = productos.find(p => p.id === idProducto);

    if (!producto) {
        mostrarToast("Error: Producto no encontrado para edición.", "error");
        console.error("Producto con ID", idProducto, "no encontrado en el array local de productos.");
        return;
    }

    document.getElementById("nombre").value = producto.nombre;
    document.getElementById("stock").value = producto.stock;
    document.getElementById("vendidos").value = producto.vendidos;
    document.getElementById("costo").value = producto.costo;
    document.getElementById("precio").value = producto.precio;
    document.getElementById("proveedor").value = producto.proveedor || "";
    document.getElementById("stockMin").value = producto.stockMin ?? "";
    document.getElementById("stockMax").value = producto.stockMax ?? "";
    document.getElementById("unidadMedida").value = producto.unidadMedida || "unidad";
    document.getElementById("categoriaProducto").value = producto.categoria || "";

    const preview = document.getElementById("imagenPreview");
    preview.src = producto.imagen || "";
    preview.style.display = producto.imagen ? "block" : "none";

    editId = producto.id;
    editIndex = productos.indexOf(producto);

    document.getElementById("btnGuardar").textContent = "Actualizar";
    document.getElementById("btnCancelar").style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function eliminarProductoDesdeUI(idProducto) {
    console.log("Intentando eliminar producto. ID recibido:", idProducto);
    const confirmacion = await mostrarConfirmacion("¿Estás seguro de eliminar este producto?", "Eliminar Producto");
    if (confirmacion) {
        console.log("Confirmación aceptada para eliminar producto. ID a eliminar en DB:", idProducto);
        try {
            await eliminarProducto(Number(idProducto));
            mostrarToast("Producto eliminado 🗑️");
        } catch (error) {
            console.error("Error al eliminar el producto de la DB:", error);
            mostrarToast("Error al eliminar el producto. 😔");
        }
        productos = await obtenerTodosLosProductos();
        mostrarProductos();
    } else {
        console.log("Eliminación cancelada por el usuario.");
        mostrarToast("Eliminación cancelada ❌");
    }
}

function guardarProducto() {
    const nombre = document.getElementById("nombre").value.trim();
    const stock = parseInt(document.getElementById("stock").value) || 0;
    const unidadMedida = document.getElementById("unidadMedida").value.trim();
    const stockMin = document.getElementById("stockMin").value ? parseInt(document.getElementById("stockMin").value) : null;
    const stockMax = document.getElementById("stockMax").value ? parseInt(document.getElementById("stockMax").value) : null;
    const vendidos = parseInt(document.getElementById("vendidos").value) || 0;
    const costo = parseFloat(document.getElementById("costo").value) || 0;
    const precio = parseFloat(document.getElementById("precio").value) || 0;
    const proveedor = document.getElementById("proveedor").value.trim();
    const categoria = document.getElementById("categoriaProducto").value.trim();
    const imagenInput = document.getElementById("imagen");
    const archivo = imagenInput.files[0];

    if (!nombre) return mostrarToast("El nombre del producto es obligatorio ⚠️", "error");
    if (stock < 0 || vendidos < 0 || costo < 0 || precio < 0 || (stockMin !== null && stockMin < 0) || (stockMax !== null && stockMax < 0)) {
        return mostrarToast("Los valores no pueden ser negativos ⚠️", "error");
    }
    if (stockMin !== null && stockMax !== null && stockMin > stockMax) {
        return mostrarToast("El stock mínimo no puede ser mayor que el stock máximo ⚠️", "error");
    }

    const productoData = { nombre, stock, unidadMedida, vendidos, costo, precio, proveedor, stockMin, stockMax, categoria };

    if (archivo) {
        const lector = new FileReader();
        lector.onload = function (e) {
            productoData.imagen = e.target.result; // Base64 de la imagen
            guardarProductoFinal(productoData);
        };
        lector.readAsDataURL(archivo);
    } else {
        if (editId !== null) {
            const productoExistente = productos.find(p => p.id === editId);
            if (productoExistente && productoExistente.imagen) {
                productoData.imagen = productoExistente.imagen; // Mantener la imagen existente
            } else {
                productoData.imagen = ""; // Si no hay imagen previa en edición, queda vacía
            }
        } else {
            productoData.imagen = ""; // Si es un producto nuevo y no hay archivo, queda vacía
        }
        guardarProductoFinal(productoData);
    }
}

async function guardarProductoFinal(producto) {
    if (editId === null) {
        await agregarProducto(producto);
        mostrarToast("Producto guardado ✅");
    } else {
        producto.id = editId;
        await actualizarProducto(editId, producto);
        mostrarToast("Producto actualizado ✏️");

        editId = null;
        editIndex = null;
        document.getElementById("btnGuardar").textContent = "Guardar";
        document.getElementById("btnCancelar").style.display = "none";
    }

    productos = await obtenerTodosLosProductos();
    aplicarFiltros();
    limpiarCampos();
}

function limpiarCampos() {
    document.getElementById("nombre").value = "";
    document.getElementById("stock").value = "";
    document.getElementById("unidadMedida").value = "unidad";
    document.getElementById("stockMin").value = "";
    document.getElementById("stockMax").value = "";
    document.getElementById("vendidos").value = "";
    document.getElementById("costo").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("imagen").value = "";
    document.getElementById("proveedor").value = "";
    document.getElementById("categoriaProducto").value = "";
    document.getElementById("btnGuardar").textContent = "Guardar";
    document.getElementById("btnCancelar").style.display = "none";
    editIndex = null;
    editId = null;

    const preview = document.getElementById("imagenPreview");
    preview.src = "";
    preview.style.display = "none";
}

function mostrarToast(mensaje, tipo = "info") {
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) {
        console.warn("No se encontró el contenedor de toasts. Mensaje:", mensaje);
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`;
    toast.textContent = mensaje;
    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
}

// Se asume que mostrarConfirmacion viene de db.js ahora
// async function mostrarConfirmacion(mensaje, titulo = "Confirmar") {
//     return new Promise(resolve => {
//         const resultado = window.confirm(mensaje);
//         resolve(resultado);
//     });
// }


async function cargarProveedores() {
    const select = document.getElementById("proveedor");
    const proveedoresGuardados = await obtenerTodosLosProveedoresDB(); // Obtener desde IndexedDB

    select.innerHTML = '<option value="">Seleccione un proveedor</option>';
    const optionSS = document.createElement("option");
    optionSS.value = "Propio";
    optionSS.textContent = "Propio";
    select.appendChild(optionSS);

    proveedoresGuardados.forEach(p => {
        const option = document.createElement("option");
        option.value = p.nombre; // Asumo que el proveedor tiene una propiedad 'nombre'
        option.textContent = p.nombre;
        select.appendChild(option);
    });
}

function cancelarEdicion() {
    limpiarCampos();
    mostrarToast("Edición cancelada ❌");
}

function setupPreview() {
    document.getElementById("imagen").addEventListener("change", function () {
        const archivo = this.files[0];
        const preview = document.getElementById("imagenPreview");

        if (archivo) {
            const lector = new FileReader();
            lector.onload = function (e) {
                preview.src = e.target.result;
                preview.style.display = "block";
            };
            lector.readAsDataURL(archivo);
        } else {
            preview.src = "";
            preview.style.display = "none";
        }
    });
}

// --- FUNCIONES DE EXPORTACIÓN / IMPORTACIÓN (SÓLO JSON) ---

async function exportarInventarioJSON() {
    const productosAExportar = await obtenerTodosLosProductos(); // Obtiene productos directamente de IndexedDB
    if (productosAExportar.length === 0) {
        mostrarToast('No hay productos en el inventario para exportar.', "info");
        return;
    }

    const jsonContent = JSON.stringify(productosAExportar, null, 2); // Formatea el JSON con indentación para legibilidad

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'inventario_productos.json'); // Cambiado a .json
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast('Inventario exportado a inventario_productos.json ✅');
}

async function importarInventarioJSON(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (file.type !== 'application/json') { // Validar tipo de archivo
        mostrarToast('Por favor, selecciona un archivo JSON válido.', "error");
        event.target.value = ''; // Limpiar el input file
        return;
    }

    const confirmacion = await mostrarConfirmacion(
        "¿Estás seguro de importar estos datos? Esto puede agregar o actualizar productos existentes.",
        "Confirmar Importación JSON"
    );
    if (!confirmacion) {
        mostrarToast("Importación cancelada ❌");
        event.target.value = ''; // Limpiar el input file
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const jsonContent = e.target.result;
        let productosImportados = [];
        try {
            productosImportados = JSON.parse(jsonContent);
            if (!Array.isArray(productosImportados)) {
                throw new Error("El archivo JSON no contiene un array de productos válido.");
            }
        } catch (error) {
            console.error('Error al parsear el archivo JSON:', error);
            mostrarToast('Error al procesar el archivo JSON. Asegúrate de que el formato sea correcto. ' + error.message, "error");
            event.target.value = '';
            return;
        }

        if (productosImportados.length === 0) {
            mostrarToast('El archivo JSON no contiene datos de productos.', "info");
            event.target.value = '';
            return;
        }

        const productosActuales = await obtenerTodosLosProductos();
        let productosAgregados = 0;
        let productosActualizados = 0;
        const erroresImportacion = [];

        for (const nuevoProducto of productosImportados) {
            // Validación básica de datos importados (puedes ajustar según sea necesario)
            if (!nuevoProducto || typeof nuevoProducto !== 'object' || !nuevoProducto.nombre) {
                erroresImportacion.push(`Objeto de producto inválido o sin nombre. Saltando.`);
                continue;
            }

            // Asegurar que los tipos de datos sean correctos (JSON.parse no garantiza tipos numéricos)
            nuevoProducto.stock = typeof nuevoProducto.stock === 'number' ? nuevoProducto.stock : (parseInt(nuevoProducto.stock) || 0);
            nuevoProducto.stockMin = typeof nuevoProducto.stockMin === 'number' ? nuevoProducto.stockMin : (nuevoProducto.stockMin ? parseInt(nuevoProducto.stockMin) : null);
            nuevoProducto.stockMax = typeof nuevoProducto.stockMax === 'number' ? nuevoProducto.stockMax : (nuevoProducto.stockMax ? parseInt(nuevoProducto.stockMax) : null);
            nuevoProducto.vendidos = typeof nuevoProducto.vendidos === 'number' ? nuevoProducto.vendidos : (parseInt(nuevoProducto.vendidos) || 0);
            nuevoProducto.costo = typeof nuevoProducto.costo === 'number' ? nuevoProducto.costo : (parseFloat(nuevoProducto.costo) || 0);
            nuevoProducto.precio = typeof nuevoProducto.precio === 'number' ? nuevoProducto.precio : (parseFloat(nuevoProducto.precio) || 0);

            // Asegurar que las cadenas no sean "null" o "undefined" literales si vienen del JSON
            nuevoProducto.categoria = nuevoProducto.categoria === null || nuevoProducto.categoria === undefined ? '' : String(nuevoProducto.categoria);
            nuevoProducto.unidadMedida = nuevoProducto.unidadMedida === null || nuevoProducto.unidadMedida === undefined ? 'unidad' : String(nuevoProducto.unidadMedida);
            nuevoProducto.proveedor = nuevoProducto.proveedor === null || nuevoProducto.proveedor === undefined ? '' : String(nuevoProducto.proveedor);
            nuevoProducto.imagen = nuevoProducto.imagen === null || nuevoProducto.imagen === undefined ? '' : String(nuevoProducto.imagen);

            let productoExistenteDB = null;
            if (nuevoProducto.id) {
                productoExistenteDB = productosActuales.find(p => p.id === parseInt(nuevoProducto.id));
            }
            if (!productoExistenteDB) {
                productoExistenteDB = productosActuales.find(p => p.nombre === nuevoProducto.nombre);
            }

            if (productoExistenteDB) {
                const productoActualizado = { ...productoExistenteDB, ...nuevoProducto };
                productoActualizado.id = productoExistenteDB.id; // Mantener el ID original de IndexedDB
                await actualizarProducto(productoActualizado.id, productoActualizado);
                productosActualizados++;
            } else {
                const productoParaAgregar = { ...nuevoProducto };
                // Eliminar el ID si el producto es nuevo y el ID importado podría generar conflicto
                // IndexedDB asignará su propio ID autoIncrement.
                delete productoParaAgregar.id; 
                await agregarProducto(productoParaAgregar);
                productosAgregados++;
            }
        }

        productos = await obtenerTodosLosProductos();
        mostrarProductos();

        let mensajeFinal = `Importación completada:\n${productosAgregados} productos agregados.\n${productosActualizados} productos actualizados.`;
        if (erroresImportacion.length > 0) {
            mensajeFinal += `\n\nErrores (${erroresImportacion.length}):\n${erroresImportacion.join('\n')}`;
            mostrarToast(mensajeFinal, "error", 5000); // Duración extendida para errores
        } else {
            mostrarToast(mensajeFinal, "success");
        }

    };
    reader.readAsText(file);
}


async function descargarPlantillaInventarioJSON() {
    const plantillaProductos = [
        {
            "id": null, // Dejar en null para que IndexedDB asigne un nuevo ID
            "nombre": "Ejemplo Producto A",
            "categoria": "Electrónica",
            "stock": 100,
            "unidadMedida": "unidad",
            "stockMin": 10,
            "stockMax": 200,
            "vendidos": 50,
            "costo": 150.75,
            "precio": 220.50,
            "imagen": "https://placehold.co/100x100/e0e0e0/5B2D90?text=ProductoA",
            "proveedor": "Tech Supplies Inc."
        },
        {
            "id": null,
            "nombre": "Ejemplo Producto B",
            "categoria": "Hogar",
            "stock": 25,
            "unidadMedida": "unidad",
            "stockMin": 5,
            "stockMax": 50,
            "vendidos": 10,
            "costo": 25.00,
            "precio": 40.00,
            "imagen": "", // Imagen vacía
            "proveedor": "Propio"
        }
    ];

    const jsonContent = JSON.stringify(plantillaProductos, null, 2);

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'plantilla_inventario.json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast('Plantilla de inventario JSON descargada ✅');
}

// Filtra productos por nombre (puedes ampliar con otros criterios)
function aplicarFiltros() {
    let filtrados = productos.filter((p) =>
        p.nombre.toLowerCase().includes(terminoBusqueda)
    );
    filtrados = ordenarLista(filtrados);
    mostrarProductos(filtrados);
}

function ordenarLista(lista) {
    const copia = [...lista];
    switch (criterioOrden) {
        case "nombre":
            copia.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
            break;
        case "stock":
            copia.sort((a, b) => (a.stock || 0) - (b.stock || 0));
            break;
        case "precio":
            copia.sort((a, b) => (a.precio || 0) - (b.precio || 0));
            break;
        case "vendidos":
            copia.sort((a, b) => (a.vendidos || 0) - (b.vendidos || 0));
            break;
        default:
            break;
    }
    return copia;
}

// Ajustar stock en ±1 desde la tarjeta
async function ajustarStock(idProducto, delta) {
    const index = productos.findIndex(p => p.id === idProducto);
    if (index === -1) {
        mostrarToast("Producto no encontrado", "error");
        return;
    }
    const producto = { ...productos[index] };
    const nuevoStock = producto.stock + delta;
    if (nuevoStock < 0) {
        mostrarToast("El stock no puede ser negativo", "error");
        return;
    }

    producto.stock = nuevoStock;
    try {
        await actualizarProducto(producto.id, producto);
        productos[index] = producto;
        mostrarToast(delta > 0 ? "Stock incrementado ✅" : "Stock decrementado ✅");
        aplicarFiltros();
    } catch (error) {
        console.error("Error al ajustar stock:", error);
        mostrarToast("Error al actualizar stock", "error");
    }
}
