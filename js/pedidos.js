// js/pedidos.js

// Las funciones de db.js son globales y se asume que están cargadas antes de este script.
// (e.g., abrirDB, obtenerTodosLosProductos, obtenerProductoPorId, actualizarProducto,
// agregarPedidoDB, obtenerTodosLosPedidosDB, actualizarPedidoDB, eliminarPedidoDB,
// limpiarTodosLosPedidosDB, mostrarToast, mostrarConfirmacion, reemplazarTodosLosDatos)

let editPedidoId = null; // Mantiene el ID del pedido en modo edición

// Arrays temporales para almacenar datos de IndexedDB en memoria para fácil acceso.
// Se cargarán al inicio.
let pedidos = [];
let productos = [];
let clientes = [];

// Cargar productos para el <select> de productos desde IndexedDB
async function cargarProductosSelect() {
    const select = document.getElementById("producto");
    select.innerHTML = "<option value=''>Selecciona un producto</option>"; // Opción por defecto
    try {
        productos = await obtenerTodosLosProductos(); // Obtiene todos los productos de IndexedDB
        if (productos && productos.length > 0) {
            productos.forEach(p => {
                let option = document.createElement("option");
                option.value = p.id; // Usamos el ID del producto como valor
                option.textContent = `${p.nombre} (Stock: ${p.stock} ${p.unidadMedida || 'unidad(es)'})`;
                select.appendChild(option);
            });
        } else {
            mostrarToast("No hay productos en el inventario. Agrega productos primero. 🚫", "info");
        }
    } catch (error) {
        console.error("Error al cargar productos:", error);
        mostrarToast("Error al cargar productos. 😔", "error");
    }
}

// Cargar lista de clientes para autocompletar input desde IndexedDB
async function cargarClientesDatalist() {
    const dataList = document.getElementById("clientesList");
    // Asegúrate de que el datalist existe en tu HTML. Si no, necesitarías añadirlo:
    // <input type="text" id="cliente" list="clientesList" placeholder="Selecciona o escribe el nombre..." />
    // <datalist id="clientesList"></datalist>
    if (!dataList) {
        console.warn("Datalist con ID 'clientesList' no encontrado. La función de autocompletar clientes no funcionará.");
        return;
    }
    dataList.innerHTML = "";
    try {
        clientes = await obtenerTodosLosClientes(); // Obtiene todos los clientes de IndexedDB
        clientes.forEach(c => {
            const option = document.createElement("option");
            option.value = c.nombre;
            dataList.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        mostrarToast("Error al cargar clientes. 😔", "error");
    }
}

// Limpiar campos del formulario
function limpiarCampos() {
    document.getElementById("cliente").value = "";
    document.getElementById("producto").selectedIndex = 0;
    document.getElementById("cantidad").value = "";
    document.getElementById("precioUnitario").value = "";
    // Asegurarse de que el precio unitario se resetea correctamente
    document.getElementById("precioUnitario").removeAttribute('readonly'); 
}

// Agregar o actualizar pedido
async function agregarPedido() {
    const clienteNombre = document.getElementById("cliente").value.trim();
    const productoId = parseInt(document.getElementById("producto").value); // Ahora es ID, no index
    const cantidad = parseInt(document.getElementById("cantidad").value);

    if (!clienteNombre || isNaN(productoId) || isNaN(cantidad) || cantidad <= 0) {
        mostrarToast("Completa todos los campos correctamente ⚠️", "error");
        return;
    }

    let productoSeleccionado;
    try {
        productoSeleccionado = await obtenerProductoPorId(productoId); // Obtener producto por su ID
        if (!productoSeleccionado) {
            mostrarToast("Producto no encontrado en el inventario. 😢", "error");
            return;
        }
    } catch (error) {
        console.error("Error al obtener producto por ID:", error);
        mostrarToast("Error al procesar el producto. 😔", "error");
        return;
    }

    // Verificar si el cliente existe o si necesitamos agregarlo (opcional, pero buena práctica)
    let clienteExistente = clientes.find(c => c.nombre === clienteNombre);
    if (!clienteExistente) {
        // Podríamos preguntar al usuario si desea agregar este nuevo cliente
        mostrarToast(`Cliente "${clienteNombre}" no encontrado. Considera agregarlo en el módulo de Clientes. 🤔`, "info");
        // Opcionalmente: return; si el cliente debe existir previamente
    }

    const precioUnitarioProducto = productoSeleccionado.precio;

    if (editPedidoId !== null) {
        // Modo edición
        const pedidoAnterior = pedidos.find(p => p.id === editPedidoId);
        if (!pedidoAnterior) {
            mostrarToast("Error: Pedido anterior no encontrado para edición. 😢", "error");
            return;
        }

        // Restaurar stock del producto original del pedido anterior
        let productoAnterior;
        try {
            productoAnterior = await obtenerProductoPorId(pedidoAnterior.productoId);
            if (productoAnterior) {
                productoAnterior.stock += pedidoAnterior.cantidad; // Revertir stock original
                await actualizarProducto(productoAnterior.id, productoAnterior);
                // Actualizar la lista global de productos para reflejar el stock revertido
                productos = await obtenerTodosLosProductos(); 
            }
        } catch (error) {
            console.error("Error al revertir stock de producto anterior:", error);
            mostrarToast("Error al revertir stock del pedido anterior. 😔", "error");
            return;
        }

        // Verificar stock disponible para el NUEVO pedido con el stock actualizado
        // Es importante re-obtener el producto seleccionado si su stock pudo haber sido afectado
        // por la reversión del producto anterior (en caso de que sea el mismo producto).
        const productoActualizado = await obtenerProductoPorId(productoSeleccionado.id);

        if (productoActualizado.stock < cantidad) {
            mostrarToast(`No hay suficiente stock (${productoActualizado.stock} ${productoActualizado.unidadMedida || 'unidad(es)'}) para la cantidad solicitada (${cantidad}) 😢`, "error");
            // Si el stock no es suficiente, revertimos el stock del producto afectado por este intento de edición
            if(productoAnterior && productoAnterior.id === productoActualizado.id) {
                // Si es el mismo producto, necesitamos volver a descontar el stock revertido
                productoActualizado.stock -= pedidoAnterior.cantidad;
                await actualizarProducto(productoActualizado.id, productoActualizado);
            }
            return;
        }

        // Descontar stock para el nuevo pedido
        productoActualizado.stock -= cantidad;
        try {
            await actualizarProducto(productoActualizado.id, productoActualizado);
            // Actualizar la lista global de productos
            productos = await obtenerTodosLosProductos();
        } catch (error) {
            console.error("Error al actualizar stock de producto:", error);
            mostrarToast("Error al actualizar stock del producto. 😔", "error");
            return;
        }

        // Actualizar el pedido en IndexedDB
        const pedidoActualizado = {
            id: editPedidoId, // Mantenemos el mismo ID
            cliente: clienteNombre,
            producto: productoActualizado.nombre, // Usar el nombre del producto actualizado
            productoId: productoActualizado.id, // Guardamos el ID para futuras referencias
            cantidad,
            precioUnitario: precioUnitarioProducto,
            total: precioUnitarioProducto * cantidad,
            estado: pedidoAnterior.estado // Mantiene el estado anterior
        };
        try {
            await actualizarPedidoDB(editPedidoId, pedidoActualizado);
            mostrarToast("Pedido actualizado ✏️", "success");
        } catch (error) {
            console.error("Error al actualizar pedido en DB:", error);
            mostrarToast("Error al actualizar el pedido. 😔", "error");
            return;
        }

        editPedidoId = null;
        document.getElementById("btnAgregarPedido").textContent = "Agregar Pedido";
        document.getElementById("btnCancelarEdicion").style.display = "none";
    } else {
        // Modo nuevo pedido
        if (productoSeleccionado.stock < cantidad) {
            mostrarToast(`No hay suficiente stock (${productoSeleccionado.stock} ${productoSeleccionado.unidadMedida || 'unidad(es)'}) para la cantidad solicitada (${cantidad}) 😢`, "error");
            return;
        }

        productoSeleccionado.stock -= cantidad;
        try {
            await actualizarProducto(productoSeleccionado.id, productoSeleccionado);
            // Actualizar la lista global de productos
            productos = await obtenerTodosLosProductos();
        } catch (error) {
            console.error("Error al actualizar stock de producto:", error);
            mostrarToast("Error al actualizar stock del producto. 😔", "error");
            return;
        }

        const nuevoPedido = {
            cliente: clienteNombre,
            producto: productoSeleccionado.nombre, // Guardamos el nombre para mostrar
            productoId: productoSeleccionado.id, // Guardamos el ID para futuras referencias
            cantidad,
            precioUnitario: precioUnitarioProducto,
            total: precioUnitarioProducto * cantidad,
            estado: "Pendiente"
        };
        try {
            await agregarPedidoDB(nuevoPedido);
            mostrarToast("Pedido agregado y stock actualizado 🧾", "success");
        } catch (error) {
            console.error("Error al agregar pedido en DB:", error);
            mostrarToast("Error al agregar el pedido. 😔", "error");
            return;
        }
    }

    await mostrarPedidos(); // Refrescar lista de pedidos
    limpiarCampos();
}

// Eliminar pedido y revertir stock solo si NO está entregado
async function eliminarPedido(id) { 
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) {
        mostrarToast("Pedido no encontrado para eliminar. ❌", "error");
        return;
    }

    // Usar mostrarConfirmacion en lugar de confirm() nativo
    const confirmacion = await mostrarConfirmacion(
        `¿Seguro que quieres eliminar el pedido de ${pedido.cliente} para ${pedido.producto}?`,
        "Eliminar Pedido"
    );

    if (confirmacion) {
        if (pedido.estado !== "Entregado") {
            try {
                let productoEncontrado = await obtenerProductoPorId(pedido.productoId); 
                if (productoEncontrado) {
                    productoEncontrado.stock += pedido.cantidad;
                    await actualizarProducto(productoEncontrado.id, productoEncontrado); 
                    productos = await obtenerTodosLosProductos(); // Recargar productos para actualizar stock visual
                    mostrarToast("Stock del producto revertido. ✅", "info");
                }
            } catch (error) {
                console.error("Error al revertir stock al eliminar pedido:", error);
                mostrarToast("Error al revertir stock. 😔", "error");
            }
        }

        try {
            await eliminarPedidoDB(id); // Eliminar de IndexedDB
            mostrarToast("Pedido eliminado" + (pedido.estado !== "Entregado" ? " y stock revertido ❌" : " ❌"), "success");
        } catch (error) {
            console.error("Error al eliminar pedido en DB:", error);
            mostrarToast("Error al eliminar el pedido. 😔", "error");
            return;
        }
        await mostrarPedidos(); // Refrescar lista de pedidos
    } else {
        mostrarToast("Eliminación de pedido cancelada.", "info");
    }
}

// Editar pedido: rellena formulario, cambia botones, y sube scroll
async function editarPedido(id) { 
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) {
        mostrarToast("Pedido no encontrado para edición. 😢", "error");
        return;
    }

    document.getElementById("cliente").value = pedido.cliente;
    document.getElementById("cantidad").value = pedido.cantidad;

    const selectProducto = document.getElementById("producto");
    selectProducto.value = pedido.productoId; 

    // Actualizar el precio unitario y total al cargar el pedido
    document.getElementById("precioUnitario").value = (pedido.precioUnitario * pedido.cantidad).toFixed(2);
    document.getElementById("precioUnitario").setAttribute('readonly', true); 

    editPedidoId = id; // Guardamos el ID del pedido que estamos editando
    document.getElementById("btnAgregarPedido").textContent = "Actualizar Pedido";
    document.getElementById("btnCancelarEdicion").style.display = "inline-block";

    document.querySelector('section').scrollIntoView({ behavior: "smooth", block: "start" });
}

// Cancelar edición: limpia, restablece botones y estado
function cancelarEdicion() {
    editPedidoId = null;
    limpiarCampos();
    document.getElementById("btnAgregarPedido").textContent = "Agregar Pedido";
    document.getElementById("btnCancelarEdicion").style.display = "none";
    mostrarToast("Edición cancelada ❌", "info");
}

// Función para crear la tarjeta HTML de un pedido con el estilo "modern-card"
function crearCardPedido(pedido) {
    const card = document.createElement("div");
    card.className = "modern-card"; // Aplica la clase general de tarjeta

    // Determinar la clase de color para el estado
    let estadoClass = '';
    switch (pedido.estado) {
        case 'Pendiente':
            estadoClass = 'text-red-600 font-bold'; // Rojo para pendiente
            break;
        case 'Preparado':
            estadoClass = 'text-yellow-600 font-bold'; // Amarillo/naranja para preparado
            break;
        case 'Entregado':
            estadoClass = 'text-green-600 font-bold'; // Verde para entregado
            break;
        default:
            estadoClass = 'text-gray-600 font-bold'; // Gris por defecto
    }

    card.innerHTML = `
        <div class="card-header">
            <h3 title="Pedido de ${pedido.cliente}">Pedido de ${pedido.cliente}</h3>
            <span class="card-meta">Total: $${pedido.total?.toFixed(2) || '0.00'}</span>
        </div>
        <div class="card-content">
            <p><strong>Producto:</strong> ${pedido.producto} (${pedido.cantidad} unid.)</p>
            <p><strong>Precio Unitario:</strong> $${pedido.precioUnitario?.toFixed(2) || '0.00'}</p>
            <p><strong>Estado:</strong> 
                <select class="estado-select ${estadoClass}" onchange="cambiarEstado(${pedido.id}, this.value)">
                    <option value="Pendiente" ${pedido.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
                    <option value="Preparado" ${pedido.estado === "Preparado" ? "selected" : ""}>Preparado</option>
                    <option value="Entregado" ${pedido.estado === "Entregado" ? "selected" : ""}>Entregado</option>
                </select>
            </p>
        </div>
        <div class="card-actions">
            <button onclick="editarPedido(${pedido.id})" class="btn-edit">✏️ Editar</button> 
            <button onclick="eliminarPedido(${pedido.id})" class="btn-delete">🗑️ Eliminar</button>
        </div>
    `;
    return card;
}

// Mostrar pedidos en lista desde IndexedDB (ahora usa crearCardPedido)
async function mostrarPedidos() {
    const lista = document.getElementById("listaPedidos");
    lista.innerHTML = "";
    try {
        pedidos = await obtenerTodosLosPedidosDB(); // Obtiene todos los pedidos de IndexedDB
        if (pedidos && pedidos.length > 0) {
            // Opcional: Ordenar pedidos por estado o fecha para una mejor visualización
            pedidos.sort((a, b) => {
                // Priorizar pendientes > preparados > entregados
                const estadoOrder = { "Pendiente": 1, "Preparado": 2, "Entregado": 3 };
                return estadoOrder[a.estado] - estadoOrder[b.estado];
            });

            pedidos.forEach(p => {
                const card = crearCardPedido(p); // Crea la tarjeta usando la nueva función
                lista.appendChild(card);
            });
        } else {
            lista.innerHTML = `<p class="mensaje-lista">No hay pedidos registrados.</p>`;
        }
    } catch (error) {
        console.error("Error al mostrar pedidos:", error);
        mostrarToast("Error al mostrar la lista de pedidos. 😔", "error");
    }
}

// Cambiar estado del pedido
async function cambiarEstado(id, nuevoEstado) {
    const pedido = pedidos.find(p => p.id === id);
    if (!pedido) { // Agregamos esta verificación para evitar errores si el pedido no se encuentra
        mostrarToast("Pedido no encontrado para actualizar estado. 😢", "error");
        return;
    }

    // Guardar el estado anterior para revertir si hay un error
    const estadoAnterior = pedido.estado;

    try {
        // Actualizar el estado en el objeto local (pedidos array)
        pedido.estado = nuevoEstado;
        
        // Actualizar en IndexedDB
        await actualizarPedidoDB(id, pedido);

        // Actualizar el array global 'pedidos' para que refleje el cambio
        // Esto es importante si otras funciones dependen de este array actualizado sin recargar toda la lista
        pedidos = await obtenerTodosLosPedidosDB(); 

        mostrarToast(`Estado actualizado a "${nuevoEstado}" ✅`, "success"); // Primer toast de éxito

        // Actualizar las clases CSS directamente en el elemento SELECT en el DOM
        // Sin que esto provoque un nuevo 'onchange'
        const cardElement = document.querySelector(`.modern-card .card-actions button[onclick="editarPedido(${id})"]`).closest('.modern-card');
        if (cardElement) {
            const estadoSelect = cardElement.querySelector('.estado-select');
            if (estadoSelect) {
                // Eliminar todas las clases de estado previas
                estadoSelect.classList.remove('text-red-600', 'text-yellow-600', 'text-green-600');
                
                // Añadir la clase de color basada en el nuevo estado
                let estadoClass = '';
                switch (nuevoEstado) {
                    case 'Pendiente': estadoClass = 'text-red-600'; break;
                    case 'Preparado': estadoClass = 'text-yellow-600'; break;
                    case 'Entregado': estadoClass = 'text-green-600'; break;
                }
                if (estadoClass) {
                    estadoSelect.classList.add(estadoClass);
                }
                estadoSelect.classList.add('font-bold'); // Mantener la negrita
            }
        }

    } catch (error) {
        console.error("Error al cambiar estado del pedido:", error);
        mostrarToast("Error al actualizar el estado del pedido. 😔", "error");
        // Opcional: Revertir el estado local si la actualización de la DB falla
        const index = pedidos.findIndex(p => p.id === id);
        if (index !== -1) {
            pedidos[index].estado = estadoAnterior;
            // Si también actualizaste el select visualmente, podrías necesitar revertirlo
            // O simplemente hacer una llamada a mostrarPedidos() si el error es crítico y quieres forzar un redibujo.
            // Para simplicidad, por ahora solo revertimos el estado local.
        }
    }
}

// Limpiar todos los pedidos de IndexedDB
async function limpiarTodosLosPedidos() {
    // Usar mostrarConfirmacion en lugar de confirm() nativo
    const confirmacion = await mostrarConfirmacion(
        "¿Seguro quieres borrar TODOS los pedidos? Esta acción no afectará el inventario pero es IRREVERSIBLE.",
        "Limpiar Todos los Pedidos"
    );

    if (confirmacion) {
        try {
            await limpiarTodosLosPedidosDB(); // Función en db.js
            pedidos = []; // Limpiar el array en memoria
            mostrarPedidos(); // Actualizar la vista
            mostrarToast("Todos los pedidos borrados sin afectar inventario 🧹", "success");
        } catch (error) {
            console.error("Error al limpiar todos los pedidos:", error);
            mostrarToast("Error al limpiar todos los pedidos. 😔", "error");
        }
    } else {
        mostrarToast("Limpieza de pedidos cancelada.", "info");
    }
}

// Función para actualizar el precio unitario en el formulario
async function actualizarPrecioUnitario() {
    const productoId = parseInt(document.getElementById("producto").value);
    const cantidad = parseInt(document.getElementById("cantidad").value);
    const precioInput = document.getElementById("precioUnitario");

    if (!isNaN(productoId) && !isNaN(cantidad) && cantidad > 0) {
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
            const total = producto.precio * cantidad;
            precioInput.value = total.toFixed(2);
        } else {
            precioInput.value = "";
        }
    } else {
        precioInput.value = "";
    }
    // No queremos que el usuario edite el precio unitario directamente
    precioInput.setAttribute('readonly', true);
}


// --- Funciones de Exportación, Importación y Plantilla para Pedidos ---

async function exportarPedidosJSON() {
    try {
        const allPedidos = await obtenerTodosLosPedidosDB();
        if (allPedidos.length === 0) {
            mostrarToast("No hay pedidos para exportar. 😔", "info");
            return;
        }
        const dataStr = JSON.stringify(allPedidos, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "pedidos_registro.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        mostrarToast("Pedidos exportados con éxito. ✅", "success");
    } catch (error) {
        console.error("Error al exportar pedidos:", error);
        mostrarToast("Error al exportar pedidos. 😔", "error");
    }
}

async function importarPedidosJSON(event) {
    const file = event.target.files[0];
    if (!file) {
        mostrarToast("No se seleccionó ningún archivo. ❌", "info");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) {
                mostrarToast("El archivo JSON no contiene un array de pedidos válido. 🚫", "error");
                return;
            }

            const confirmacion = await mostrarConfirmacion(
                "¿Estás seguro de importar estos pedidos? Esto REEMPLAZARÁ todos los pedidos actuales en el sistema.",
                "Confirmar Importación de Pedidos"
            );

            if (!confirmacion) {
                mostrarToast("Importación de pedidos cancelada. ❌", "info");
                return;
            }

            // Aquí llamamos a la función genérica de db.js para reemplazar datos
            await reemplazarTodosLosDatos({ pedidos: importedData }); 
            mostrarToast("Pedidos importados con éxito y base de datos actualizada. ✨", "success");
            await mostrarPedidos(); // Recargar la lista de pedidos después de la importación
            // Es importante también recargar clientes y productos si el archivo de respaldo contuviera esos datos,
            // pero para esta importación específica de pedidos, solo recargamos la lista de pedidos.
            // Si el cliente necesita importar todo (clientes, productos, etc.) debería ser a través de una función de respaldo/restauración global.

        } catch (error) {
            console.error("Error al importar pedidos:", error);
            mostrarToast("Error al importar pedidos. Asegúrate de que el archivo es un JSON válido. 😔", "error");
        }
    };
    reader.readAsText(file);
}

function descargarPlantillaPedidos() {
    const plantilla = [
        {
            id: 1, // Auto-generado por IndexedDB si keyPath es autoIncrement
            cliente: "Nombre del Cliente",
            producto: "Nombre del Producto",
            productoId: 101, // ID del producto de tu inventario
            cantidad: 5,
            precioUnitario: 10.50,
            total: 52.50,
            estado: "Pendiente" // o "Preparado", "Entregado"
        },
        // Puedes añadir más ejemplos aquí
    ];
    const dataStr = JSON.stringify(plantilla, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_pedidos.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast("Plantilla de pedidos descargada. 📝", "info");
}


// Código que corre cuando la página termina de cargar (inicialización)
document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB(); 

    // Cargar datos iniciales
    await cargarProductosSelect();
    await cargarClientesDatalist();
    await mostrarPedidos();

    // Event Listeners para el formulario principal y los selectores
    document.getElementById("btnAgregarPedido").addEventListener("click", agregarPedido); // Asegúrate de que este ID coincida con tu HTML
    document.getElementById("btnCancelarEdicion").addEventListener("click", cancelarEdicion); // Asegúrate de que este ID coincida con tu HTML
    document.getElementById("btnLimpiarPedidos").addEventListener("click", limpiarTodosLosPedidos); 
    document.getElementById("producto").addEventListener("change", actualizarPrecioUnitario);
    document.getElementById("cantidad").addEventListener("input", actualizarPrecioUnitario);

    // Event Listeners para las nuevas herramientas de pedidos (Exportar/Importar/Plantilla)
    const exportarPedidosBtn = document.getElementById("exportarPedidosBtn");
    if (exportarPedidosBtn) {
        exportarPedidosBtn.addEventListener("click", exportarPedidosJSON);
    } else {
        console.warn("Botón 'exportarPedidosBtn' no encontrado. Asegúrate de que el HTML está actualizado.");
    }

    const importarPedidosInput = document.getElementById("importarPedidosInput");
    if (importarPedidosInput) {
        importarPedidosInput.addEventListener("change", importarPedidosJSON);
    } else {
        console.warn("Input 'importarPedidosInput' no encontrado. Asegúrate de que el HTML está actualizado.");
    }

    const descargarPlantillaPedidosBtn = document.getElementById("descargarPlantillaPedidosBtn");
    if (descargarPlantillaPedidosBtn) {
        descargarPlantillaPedidosBtn.addEventListener("click", descargarPlantillaPedidos);
    } else {
        console.warn("Botón 'descargarPlantillaPedidosBtn' no encontrado. Asegúrate de que el HTML está actualizado.");
    }
    
    // Inicializar el toggle del formulario de pedidos
    inicializarToggleFormularioPedidos();
});

// Script para el botón flotante de ayuda (ya lo tenías en el HTML)
function mostrarAyuda() {
    const ayuda = document.getElementById("ayuda");
    ayuda.classList.add("visible");
    ayuda.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("cerrarAyuda").addEventListener("click", () => {
    document.getElementById("ayuda").classList.remove("visible");
});

// Función para inicializar el toggle del formulario de pedidos
function inicializarToggleFormularioPedidos() {
  const toggleBtn = document.getElementById('toggleFormPedidosBtn');
  const formulario = document.getElementById('formularioPedido');
  
  if (toggleBtn && formulario) {
    toggleBtn.addEventListener('click', function() {
      if (formulario.style.display === 'none') {
        // Mostrar formulario con animación
        formulario.style.display = 'block';
        formulario.classList.add('formulario-animado', 'slide-down');
        toggleBtn.textContent = '➖ Ocultar Formulario';
        
        // Remover la clase después de la animación para permitir repetirla
        setTimeout(() => {
          formulario.classList.remove('slide-down');
        }, 500);
      } else {
        // Ocultar formulario con animación
        formulario.classList.add('slide-up');
        toggleBtn.textContent = '➕ Nuevo Pedido';
        
        // Después de la animación, ocultar el formulario
        setTimeout(() => {
          formulario.style.display = 'none';
          formulario.classList.remove('slide-up');
        }, 500);
      }
    });
  }
}

// Modificar la función editarPedido para mostrar el formulario con animación al editar
function editarPedido(id) {
  const pedido = pedidos.find(p => p.id === id);
  if (pedido) {
    // Mostrar el formulario con animación si está oculto
    const formulario = document.getElementById('formularioPedido');
    const toggleBtn = document.getElementById('toggleFormPedidosBtn');
    
    if (formulario && formulario.style.display === 'none') {
      formulario.style.display = 'block';
      formulario.classList.add('formulario-animado', 'slide-down');
      if (toggleBtn) {
        toggleBtn.textContent = '➖ Ocultar Formulario';
      }
      
      // Remover la clase después de la animación
      setTimeout(() => {
        formulario.classList.remove('slide-down');
      }, 500);
    }
    
    // Llenar los campos del formulario con los datos del pedido
    document.getElementById("cliente").value = pedido.cliente;
    document.getElementById("producto").value = pedido.productoId;
    document.getElementById("cantidad").value = pedido.cantidad;
    document.getElementById("precioUnitario").value = pedido.precioUnitario;
    
    // Configurar el modo de edición
    editPedidoId = id;
    document.getElementById("btnAgregarPedido").textContent = "Actualizar Pedido";
    document.getElementById("btnCancelarEdicion").style.display = "block";
    
    // Desplazar hacia el formulario
    formulario.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// Redirección si la sesión no está iniciada (ya la tenías en el HTML)
if (sessionStorage.getItem("sesionIniciada") !== "true") {
    window.location.href = "login.html";
}
