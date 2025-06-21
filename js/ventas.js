// ventas.js adaptado para usar el nuevo db.js
// No necesitas definir 'db', 'DB_NAME', 'DB_VERSION' ni las funciones CRUD básicas aquí.
// Esas ahora vienen de tu archivo db.js.

// Arrays globales para almacenar los datos en memoria después de cargarlos de IndexedDB
let clientes = [];
let ventas = [];
let productos = [];
let movimientos = []; // Necesario para la función registrarVenta

let editVentaIndex = null; // Ahora almacenará el ID de la venta
let productosVenta = [];

// Las funciones 'guardarVentas', 'mostrarToast', 'limpiarFormulario', 'actualizarTablaProductos',
// 'eliminarProductoVenta', 'toggleExportOptions' no interactúan directamente con la DB
// y no necesitan cambios en su lógica interna (salvo la carga de datos que se hace al inicio).

async function guardarVentas() {
    // Las ventas ya se guardan/actualizan a través de las funciones de db.js en registrarVenta.
    // Esta función solo necesita recargar los gráficos si es necesario.
    if (location.href.includes("reportesGraficos.html")) {
        // Asegúrate de que esta función (actualizarTodosLosGraficos) también
        // cargue sus datos de IndexedDB si es necesario.
        if (typeof actualizarTodosLosGraficos === 'function') {
             actualizarTodosLosGraficos();
        } else {
            console.warn("La función actualizarTodosLosGraficos no está definida o no es accesible.");
        }
    }
}

async function cargarClientes() {
    try {
        // Usa la función de db.js para obtener clientes
        clientes = await obtenerTodosLosClientes();
        const select = document.getElementById("clienteVenta");
        select.innerHTML = '<option value="">Selecciona un cliente</option>';
        clientes.forEach(cliente => {
            const option = document.createElement("option");
            option.value = cliente.nombre; // Seguimos usando el nombre para el valor
            option.textContent = `${cliente.nombre} (${cliente.telefono || "sin número"})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        mostrarToast("Error al cargar clientes ❌");
    }
}

async function cargarProductos() {
    try {
        // Usa la función de db.js para obtener productos
        productos = await obtenerTodosLosProductos();
        const select = document.getElementById("productoVenta");
        select.innerHTML = '<option value="">Selecciona un producto</option>';
        productos.forEach(producto => {
            const option = document.createElement("option");
            option.value = producto.nombre;
            option.textContent = `${producto.nombre} (${producto.stock} en stock)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar productos:", error);
        mostrarToast("Error al cargar productos ❌");
    }
}

async function cargarClientesEnDatalist() {
    try {
        // Asegura que 'clientes' esté actualizado desde la DB
        clientes = await obtenerTodosLosClientes();
        const datalist = document.getElementById("clientesLista");
        datalist.innerHTML = "";
        clientes.forEach(cliente => {
            const option = document.createElement("option");
            option.value = cliente.nombre;
            datalist.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar clientes en datalist:", error);
    }
}

function mostrarOpcionesPago() {
    const tipo = document.getElementById("tipoPago").value;
    document.getElementById("opcionesContado").style.display = tipo === "contado" ? "block" : "none";
    document.getElementById("opcionesCredito").style.display = tipo === "credito" ? "block" : "none";
}

async function registrarVenta() {
    const clienteNombre = document.getElementById("clienteVenta").value.trim(); // Renombrado a clienteNombre
    const tipoPago = document.getElementById("tipoPago").value;

    // Asegurarse de que los datos de clientes y productos estén cargados y actualizados
    // antes de validar y manipular.
    clientes = await obtenerTodosLosClientes(); // Recarga clientes para la validación
    productos = await obtenerTodosLosProductos(); // Recarga productos para la actualización de stock

    const clienteExiste = clientes.some(c => c.nombre.toLowerCase() === clienteNombre.toLowerCase());

    if (!clienteNombre) {
        alert("Por favor ingresa o selecciona un cliente.");
        return;
    }

    if (!clienteExiste) {
        const confirmar = confirm(`El cliente "${clienteNombre}" no está registrado. ¿Quieres ir a registrar al cliente ahora?`);
        if (confirmar) {
            window.location.href = "clientes.html";
            return;
        }
    }

    if (productosVenta.length === 0 || !tipoPago) {
        alert("Completa todos los campos principales y agrega productos.");
        return;
    }

    let detallePago = {};

    if (tipoPago === "contado") {
        const metodo = document.getElementById("metodoContado").value;
        if (!metodo) {
            alert("Selecciona el método de pago.");
            return;
        }
        detallePago = { metodo };
    } else if (tipoPago === "credito") {
        const fechaVencimiento = document.getElementById("fechaVencimiento").value || "No especificada";
        detallePago = { acreedor: clienteNombre, fechaVencimiento };
    }

    let ingreso = 0;
    let ganancia = 0;

    productosVenta.forEach(p => {
        ingreso += p.subtotal;
        ganancia += (p.precio - p.costo) * p.cantidad;
    });

    const nuevaVenta = {
        cliente: clienteNombre, // Usamos el nombre del cliente
        productos: [...productosVenta],
        tipoPago,
        detallePago,
        ingreso,
        ganancia,
        fecha: new Date().toISOString().split("T")[0]
    };

    try {
        let productosActualizados = [...productos]; // Copia de los productos actuales en memoria

        // Cargar movimientos para la actualización
        movimientos = await obtenerTodosLosMovimientos();

        if (editVentaIndex !== null) {
            // Edición de venta existente
            // Usamos el ID almacenado en editVentaIndex para encontrar la venta original
            const ventaAnterior = ventas.find(v => v.id === editVentaIndex);
            if (ventaAnterior) {
                // Revertir stock de la venta anterior
                ventaAnterior.productos.forEach(p => {
                    const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                    if (prod) {
                        prod.stock += p.cantidad;
                        prod.vendidos = Math.max(0, (prod.vendidos || 0) - p.cantidad);
                    }
                });
            }

            // Aplicar stock de la nueva venta (cantidad vendida)
            productosVenta.forEach(p => {
                const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock = Math.max(0, prod.stock - p.cantidad);
                    prod.vendidos = (prod.vendidos || 0) + p.cantidad;
                }
            });

            // Actualizar la venta en IndexedDB usando su ID
            await actualizarVenta(editVentaIndex, nuevaVenta);
            mostrarToast("Venta actualizada ✅");

        } else {
            // Nueva venta
            await agregarVenta(nuevaVenta); // Añadir a IndexedDB

            productosVenta.forEach(p => {
                const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock = Math.max(0, prod.stock - p.cantidad);
                    prod.vendidos = (prod.vendidos || 0) + p.cantidad;
                }
            });

            const costoTotal = productosVenta.reduce((total, p) => total + (p.costo * p.cantidad), 0);

            // Añadir movimientos a IndexedDB
            await agregarMovimientoDB({
                tipo: "ingreso",
                monto: ingreso,
                fecha: nuevaVenta.fecha,
                descripcion: `Venta a ${clienteNombre}`
            });

            await agregarMovimientoDB({
                tipo: "gasto",
                monto: costoTotal,
                fecha: nuevaVenta.fecha,
                descripcion: `Costo de venta a ${clienteNombre}`
            });

            mostrarToast("Venta registrada con éxito ✅");
        }

        // Actualizar todos los productos modificados en IndexedDB
        for (const prod of productosActualizados) {
            await actualizarProducto(prod.id, prod); // Asegúrate de que 'prod' tenga un ID
        }

        // Recargar los datos en memoria después de las operaciones de DB
        ventas = await obtenerTodasLasVentas();
        productos = await obtenerTodosLosProductos();
        movimientos = await obtenerTodosLosMovimientos(); // Sincroniza movimientos

        editVentaIndex = null; // Resetea el índice de edición
        document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta";

        guardarVentas(); // Para actualizar gráficos si aplica
        mostrarVentas(); // Recarga la UI
        limpiarFormulario();
    } catch (error) {
        console.error("Error al registrar/actualizar venta:", error);
        mostrarToast("Error al registrar venta ❌");
    }
}

// Actualizada para cargar desde IndexedDB
async function mostrarVentas(filtradas) {
    // Si no hay un filtro específico, carga todas las ventas desde IndexedDB
    if (!filtradas) {
        ventas = await obtenerTodasLasVentas();
        filtradas = ventas;
    }

    const lista = document.getElementById("listaVentas");
    lista.innerHTML = "";

    if (filtradas.length === 0) {
        lista.innerHTML = `<p class="text-center text-gray-400">No hay ventas registradas.</p>`;
        return;
    }

    const grupoContado = {};
    const grupoCredito = [];

    filtradas.forEach((venta) => { // No necesitamos el 'index' aquí, usamos el 'id' de la venta
        if (venta.tipoPago === "contado") {
            const metodo = venta.detallePago.metodo || "Otro";
            if (!grupoContado[metodo]) grupoContado[metodo] = [];
            grupoContado[metodo].push({ venta, id: venta.id }); // Almacenamos el ID de IndexedDB
        } else {
            grupoCredito.push({ venta, id: venta.id });
        }
    });

    // Categoría: Contado
    if (Object.keys(grupoContado).length > 0) {
        const titulo = document.createElement("h2");
        titulo.textContent = "🟣 Ventas al Contado";
        titulo.className = "text-lg font-bold text-purple-700 mt-4";
        lista.appendChild(titulo);

        for (const metodo in grupoContado) {
            const subtitulo = document.createElement("h3");
            subtitulo.textContent = `💠 Método: ${metodo}`;
            subtitulo.className = "text-md font-semibold text-purple-600 mt-3";
            lista.appendChild(subtitulo);

            grupoContado[metodo].forEach(({ venta, id }) => {
                const card = crearCardVenta(venta, id); // Pasamos el ID
                lista.appendChild(card);
            });
        }
    }

    // Categoría: Crédito
    if (grupoCredito.length > 0) {
        const titulo = document.createElement("h2");
        titulo.textContent = "🔵 Ventas a Crédito";
        titulo.className = "text-lg font-bold text-blue-700 mt-6";
        lista.appendChild(titulo);

        grupoCredito.forEach(({ venta, id }) => {
            const card = crearCardVenta(venta, id); // Pasamos el ID
            lista.appendChild(card);
        });
    }
}

// Ya usa ID en lugar de index, no necesita cambios
function crearCardVenta(venta, id) {
    const productosTexto = venta.productos.map(p => `${p.nombre} x${p.cantidad}`).join(", ");

    const detallePago =
        venta.tipoPago === "contado"
            ? `<span class="text-sm text-gray-600">Método: ${venta.detallePago.metodo}</span>`
            : `<span class="text-sm text-gray-600">Acreedor: ${venta.detallePago.acreedor || "N/A"}<br>Vence: ${venta.detallePago.fechaVencimiento || "Sin fecha"}</span>`;

    const card = document.createElement("div");
    card.className = "bg-white border border-purple-200 rounded-2xl p-4 shadow-md mt-2";

    card.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-semibold text-purple-700">${venta.cliente}</h3>
            <span class="text-sm text-gray-500">${venta.fecha}</span>
        </div>
        <p class="text-sm text-gray-800"><strong>Productos:</strong> ${productosTexto}</p>
        <p class="text-sm text-gray-800"><strong>Total:</strong> $${venta.ingreso.toFixed(2)}</p>
        <p class="text-sm text-gray-800"><strong>Pago:</strong> ${venta.tipoPago}</p>
        ${detallePago}
        <div class="mt-3 flex gap-2">
            <button onclick="cargarVenta(${id})" class="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded-md text-sm transition">✏️ Editar</button>
            <button onclick="revertirVenta(${id})" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm transition">↩️ Revertir</button>
            <button onclick="eliminarVentaPermanente(${id})" class="bg-gray-500 hover:bg-gray-700 text-white px-3 py-1 rounded-md text-sm transition">🗑 Eliminar</button>
        </div>
    `;
    // Renombrado eliminarVenta a eliminarVentaPermanente para evitar conflictos con la función de db.js

    if (venta.tipoPago === "credito") {
        card.style.cursor = "pointer";
        card.addEventListener("click", async (event) => { // Agregado async aquí
            if (event.target.tagName.toLowerCase() === 'button') return;
            // Asegúrate de que 'ventas' global esté actualizada
            ventas = await obtenerTodasLasVentas();
            const ventaSeleccionada = ventas.find(v => v.id === id); // Buscar por ID
            if (ventaSeleccionada) {
                document.getElementById("detalleVentaModal").textContent = `Cliente: ${ventaSeleccionada.cliente}, Total: $${ventaSeleccionada.ingreso.toFixed(2)}, Vence: ${ventaSeleccionada.detallePago.fechaVencimiento || "Sin fecha"}`;
                document.getElementById("modalAbono").style.display = "flex";
            }
        });
    }
    return card;
}

// Actualizada
async function filtrarVentas() {
    const input = document.getElementById("buscadorVentas").value.toLowerCase().trim();
    ventas = await obtenerTodasLasVentas(); // Asegúrate de tener la lista completa y actualizada

    const filtradas = ventas.filter(v => {
        const productos = v.productos.map(p => p.nombre.toLowerCase()).join(" ");
        const cliente = v.cliente.toLowerCase();
        const fecha = v.fecha.toLowerCase();
        const metodo = (v.detallePago.metodo || "").toLowerCase();
        const acreedor = (v.detallePago.acreedor || "").toLowerCase();

        return (
            cliente.includes(input) ||
            fecha.includes(input) ||
            productos.includes(input) ||
            metodo.includes(input) ||
            acreedor.includes(input) ||
            v.ingreso.toString().includes(input) ||
            v.tipoPago.toLowerCase().includes(input)
        );
    });

    mostrarVentas(filtradas);
}

function limpiarFormulario() {
    document.getElementById("clienteVenta").value = "";
    document.getElementById("productoVenta").value = "";
    document.getElementById("tipoPago").value = "";
    document.getElementById("metodoContado").value = "";
    document.getElementById("fechaVencimiento").value = "";
    productosVenta = [];
    actualizarTablaProductos();
    mostrarOpcionesPago();
    editVentaIndex = null;
    document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta";
}

function mostrarToast(mensaje) {
    const toastContainer = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = mensaje;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Modificada para usar ID y actualizar IndexedDB con funciones de db.js
async function revertirVenta(id) {
    ventas = await obtenerTodasLasVentas(); // Asegura que 'ventas' esté actualizada
    productos = await obtenerTodosLosProductos(); // Asegura que 'productos' esté actualizada
    movimientos = await obtenerTodosLosMovimientos(); // Asegura que 'movimientos' esté actualizada

    const venta = ventas.find(v => v.id === id);
    if (!venta) return;

    const motivo = prompt("¿Por qué deseas revertir esta venta?");
    if (motivo === null || motivo.trim() === "") {
        alert("Debes ingresar un motivo para revertir la venta.");
        return;
    }

    if (confirm(`¿Seguro que quieres revertir la venta a ${venta.cliente}?\nMotivo: ${motivo}`)) {
        try {
            // Actualizar stock de productos
            for (const p of venta.productos) {
                const prod = productos.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock += p.cantidad;
                    prod.vendidos = Math.max(0, (prod.vendidos || 0) - p.cantidad);
                    await actualizarProducto(prod.id, prod); // Usa actualizarProducto de db.js
                }
            }

            // Eliminar la venta de IndexedDB
            await eliminarVenta(id); // Usa eliminarVenta de db.js

            // Re-sincronizar arrays globales después de las operaciones
            ventas = await obtenerTodasLasVentas();
            productos = await obtenerTodosLosProductos();

            guardarVentas(); // Para actualizar gráficos si aplica
            mostrarVentas();
            mostrarToast("Venta revertida y stock actualizado");
        } catch (error) {
            console.error("Error al revertir venta:", error);
            mostrarToast("Error al revertir venta ❌");
        }
    }
}

// Modificada para usar ID y actualizar IndexedDB con funciones de db.js
async function eliminarVentaPermanente(id) { // Renombrada para evitar conflicto con db.js
    ventas = await obtenerTodasLasVentas(); // Asegura que 'ventas' esté actualizada
    movimientos = await obtenerTodosLosMovimientos(); // Asegura que 'movimientos' esté actualizada

    const venta = ventas.find(v => v.id === id);
    if (!venta) return;

    if (!confirm(`¿Estás seguro de eliminar la venta a ${venta.cliente} sin revertir stock?`)) return;

    try {
        // Añadir movimiento de ajuste en Finanzas (a IndexedDB)
        await agregarMovimientoDB({ // Usa agregarMovimientoDB de db.js
            tipo: "ajuste",
            monto: -venta.ingreso,
            ganancia: -venta.ganancia,
            fecha: new Date().toISOString().split("T")[0],
            descripcion: `Eliminación manual de venta a ${venta.cliente}`
        });

        // Eliminar la venta de IndexedDB
        await eliminarVenta(id); // Usa eliminarVenta de db.js

        // Re-sincronizar arrays globales después de las operaciones
        ventas = await obtenerTodasLasVentas();
        movimientos = await obtenerTodosLosMovimientos();

        guardarVentas(); // Para actualizar gráficos si aplica
        mostrarVentas();
        mostrarToast("Venta eliminada permanentemente 🗑️");
    } catch (error) {
        console.error("Error al eliminar venta:", error);
        mostrarToast("Error al eliminar venta ❌");
    }
}

// Modificada para usar ID y cargar desde IndexedDB con funciones de db.js
async function cargarVenta(id) {
    ventas = await obtenerTodasLasVentas(); // Asegura que 'ventas' esté actualizada
    const venta = ventas.find(v => v.id === id);
    if (!venta) return;

    document.getElementById("clienteVenta").value = venta.cliente;
    document.getElementById("tipoPago").value = venta.tipoPago;
    mostrarOpcionesPago();

    if (venta.tipoPago === "contado") {
        document.getElementById("metodoContado").value = venta.detallePago.metodo;
    } else {
        document.getElementById("fechaVencimiento").value = venta.detallePago.fechaVencimiento;
    }

    productosVenta = [...venta.productos];
    actualizarTablaProductos();
    editVentaIndex = id; // Almacena el ID de la venta que se está editando
    document.getElementById("btnRegistrarVenta").textContent = "Actualizar Venta";

    setTimeout(() => {
        const formulario = document.getElementById("formularioVenta");
        if (formulario) {
            formulario.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, 100);
}

async function agregarProductoAVenta() {
    const productoNombre = document.getElementById("productoVenta").value;
    const cantidad = parseInt(document.getElementById("cantidadVenta").value);

    if (!productoNombre || isNaN(cantidad) || cantidad < 1) {
        alert("Selecciona un producto válido y una cantidad.");
        return;
    }

    // Asegura que los productos estén cargados antes de buscar
    productos = await obtenerTodosLosProductos(); // Usa obtenerTodosLosProductos de db.js
    const producto = productos.find(p => p.nombre === productoNombre);
    if (!producto) {
        alert("Producto no encontrado en el inventario.");
        return;
    }

    const existente = productosVenta.find(p => p.nombre === productoNombre);
    const totalCantidad = (existente ? existente.cantidad : 0) + cantidad;

    if (producto.stock < totalCantidad) {
        alert("Stock insuficiente para esta cantidad total.");
        return;
    }

    if (existente) {
        existente.cantidad += cantidad;
        existente.subtotal = existente.cantidad * producto.precio;
    } else {
        productosVenta.push({
            nombre: producto.nombre,
            precio: producto.precio,
            costo: producto.costo,
            cantidad,
            subtotal: cantidad * producto.precio
        });
    }

    actualizarTablaProductos();

    document.getElementById("productoVenta").value = "";
    document.getElementById("cantidadVenta").value = "";
}

function actualizarTablaProductos() {
    const tabla = document.getElementById("tablaProductosVenta");
    tabla.innerHTML = "";
    let total = 0;

    productosVenta.forEach((p, index) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
            <td>${p.nombre}</td>
            <td>${p.cantidad}</td>
            <td>$${p.precio.toFixed(2)}</td>
            <td>$${p.subtotal.toFixed(2)}</td>
            <td><button onclick="eliminarProductoVenta(${index})">❌</button></td>
        `;
        tabla.appendChild(fila);
        total += p.subtotal;
    });

    document.getElementById("totalVenta").textContent = total.toFixed(2);
}

function eliminarProductoVenta(index) {
    productosVenta.splice(index, 1);
    actualizarTablaProductos();
}

function toggleExportOptions() {
    const opciones = document.getElementById("opcionesExportacion");
    opciones.style.display = opciones.style.display === "none" ? "block" : "none";
}

async function exportarExcel() {
    ventas = await obtenerTodasLasVentas(); // Carga las ventas más recientes
    const data = ventas.map(venta => ({
        Cliente: venta.cliente,
        Productos: venta.productos.map(p => `${p.nombre} x${p.cantidad}`).join(", "),
        Ingreso: venta.ingreso.toFixed(2),
        Ganancia: venta.ganancia.toFixed(2),
        Fecha: venta.fecha,
        Pago: venta.tipoPago,
        Detalle: venta.tipoPago === "contado" ? venta.detallePago.metodo : `Vence: ${venta.detallePago.fechaVencimiento}`
    }));

    let csv = "Cliente,Productos,Ingreso,Ganancia,Fecha,Pago,Detalle\n";
    data.forEach(row => {
        csv += `${row.Cliente},"${row.Productos}",${row.Ingreso},${row.Ganancia},${row.Fecha},${row.Pago},"${row.Detalle}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ventas.csv";
    link.click();
    mostrarToast("📊 Excel exportado");
}

async function exportarPDF() {
    ventas = await obtenerTodasLasVentas(); // Carga las ventas más recientes
    const ventana = window.open('', '_blank');
    let contenido = `
        <html>
            <head><title>Reporte de Ventas</title></head>
            <body>
                <h2 style="color:#5b2d90;">📋 Historial de Ventas</h2>
                <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                    <tr>
                        <th>Cliente</th>
                        <th>Productos</th>
                        <th>Ingreso</th>
                        <th>Ganancia</th>
                        <th>Fecha</th>
                        <th>Pago</th>
                        <th>Detalle</th>
                    </tr>`;

    ventas.forEach(venta => {
        const productos = venta.productos.map(p => `${p.nombre} x${p.cantidad}`).join(", ");
        const detalle = venta.tipoPago === "contado"
            ? venta.detallePago.metodo
            : `Vence: ${venta.detallePago.fechaVencimiento}`;
        contenido += `
                    <tr>
                        <td>${venta.cliente}</td>
                        <td>${productos}</td>
                        <td>$${venta.ingreso.toFixed(2)}</td>
                        <td>$${venta.ganancia.toFixed(2)}</td>
                        <td>$${venta.fecha}</td>
                        <td>${venta.tipoPago}</td>
                        <td>${detalle}</td>
                    </tr>`;
    });

    contenido += `
                </table>
            </body>
        </html>`;

    ventana.document.write(contenido);
    ventana.document.close();
    ventana.print();
    mostrarToast("📄 PDF preparado para impresión");
}

// Muestra u oculta botón para agregar cliente si no está registrado
async function validarClienteIngresado() {
    // Asegura que los clientes estén cargados para la validación
    clientes = await obtenerTodosLosClientes(); // Usa obtenerTodosLosClientes de db.js

    const inputCliente = document.getElementById("clienteVenta");
    const texto = inputCliente.value.trim().toLowerCase();
    const existe = clientes.some(c => c.nombre.toLowerCase() === texto);

    let divAgregar = document.getElementById("agregarClientePendiente");
    if (!divAgregar) {
        divAgregar = document.createElement("div");
        divAgregar.id = "agregarClientePendiente";
        divAgregar.style.marginTop = "5px";
        divAgregar.style.display = "none";

        const btnAgregar = document.createElement("button");
        btnAgregar.textContent = "➕ Agregar cliente no registrado";
        btnAgregar.className = "btn-agregar-cliente";
        btnAgregar.onclick = () => window.location.href = "clientes.html";
        divAgregar.appendChild(btnAgregar);

        inputCliente.insertAdjacentElement("afterend", divAgregar);
    }

    if (texto !== "" && !existe) {
        divAgregar.style.display = "block";
    } else {
        divAgregar.style.display = "none";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await abrirDB(); // Abre la base de datos al cargar el DOM usando la función de db.js

        // Carga inicial de datos desde IndexedDB usando las funciones de db.js
        ventas = await obtenerTodasLasVentas();
        clientes = await obtenerTodosLosClientes();
        productos = await obtenerTodosLosProductos();
        movimientos = await obtenerTodosLosMovimientos(); // Carga inicial de movimientos

        mostrarVentas();
        mostrarOpcionesPago();
        cargarClientes(); // Carga el select de clientes
        cargarProductos(); // Carga el select de productos
        cargarClientesEnDatalist(); // Carga el datalist de clientes

        const inputCliente = document.getElementById("clienteVenta");
        inputCliente.addEventListener("input", validarClienteIngresado);

    } catch (error) {
        console.error("Error al inicializar la aplicación:", error);
        mostrarToast("Error grave al cargar datos 😥");
    }
});