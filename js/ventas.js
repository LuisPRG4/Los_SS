// js/ventas.js (CÓDIGO CORREGIDO Y RECOMENDADO)

let clientes = [];
let ventas = [];
let productos = []; // Ahora 'productos' globalmente contendrá la unidad de medida
let movimientos = [];
let abonos = []; // ¡NUEVO! Para cargar los abonos

let editVentaId = null; // Cambiado de editVentaIndex a editVentaId para usar el ID de la DB
let productosVenta = []; // Array temporal para los productos de la venta actual

// Añadir esta variable global al inicio del archivo
let abonoEnProceso = false;

let currentPageVentas = 1;
const rowsPerPageVentas = 10;

const sortOptionsVentas = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'ingreso', label: 'Monto' }
];
let sortKeyVentas = 'fecha';
let sortAscVentas = false;

let mostrarArchivadas = false; // Controla si se muestran ventas archivadas

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
        clientes = await obtenerTodosLosClientes();
        const select = document.getElementById("clienteVenta");
        // select.innerHTML = '<option value="">Selecciona un cliente</option>'; // Ya no es un select, es un datalist input
        // Clientes para la datalist ya se cargan en cargarClientesEnDatalist
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        mostrarToast("Error al cargar clientes ❌");
    }
}

async function cargarProductos() {
    try {
        productos = await obtenerTodosLosProductos(); // Asegúrate de que esto carga la unidad de medida
        const select = document.getElementById("productoVenta");
        select.innerHTML = '<option value="">Selecciona un producto</option>';
        productos.forEach(producto => {
            const option = document.createElement("option");
            option.value = producto.nombre;
            // ¡MODIFICADO! Mostrar la unidad de medida también en el select de producto
            option.textContent = `${producto.nombre} (${producto.stock} ${producto.unidadMedida || 'unidad(es)'} en stock)`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar productos:", error);
        mostrarToast("Error al cargar productos ❌");
    }
}

async function cargarClientesEnDatalist() {
    try {
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

    // Si se cambia a crédito, hacer la fecha de vencimiento requerida; de lo contrario, no.
    const inputFechaVencimiento = document.getElementById("fechaVencimiento");
    if (tipo === "credito") {
        inputFechaVencimiento.setAttribute('required', 'true');
    } else {
        inputFechaVencimiento.removeAttribute('required');
        inputFechaVencimiento.value = ''; // Limpiar si se cambia a contado
    }
}

function obtenerFechaVenta() {
    const usarFechaPersonalizada = document.getElementById("activarFechaManual")?.checked;
    const fechaPersonalizada = document.getElementById("fechaVentaPersonalizada")?.value;
    const horaPersonalizada = document.getElementById("horaVentaPersonalizada")?.value;

    if (usarFechaPersonalizada && fechaPersonalizada) {
        return horaPersonalizada ? `${fechaPersonalizada}T${horaPersonalizada}:00` : `${fechaPersonalizada}T00:00:00`;
    }

    // Fijar la fecha actual al momento de crear la venta
    const ahora = new Date();
    const fechaStr = ahora.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    const horaStr = ahora.toTimeString().split(' ')[0].slice(0, 8); // Formato HH:MM:SS

    return `${fechaStr}T${horaStr}`;
}

// Nueva función para el toggle de fecha manual
function toggleFechaManual() {
    const mostrar = document.getElementById("activarFechaManual").checked;
    document.getElementById("opcionFechaManual").style.display = mostrar ? "block" : "none";
}

async function registrarVenta() {
    const clienteNombre = document.getElementById("clienteVenta").value.trim();
    const tipoPago = document.getElementById("tipoPago").value;

    clientes = await obtenerTodosLosClientes();
    productos = await obtenerTodosLosProductos(); // Recargar productos para stock y unidad

    const clienteExiste = clientes.some(c => c.nombre.toLowerCase() === clienteNombre.toLowerCase());

    if (!clienteNombre) {
        mostrarToast("Por favor ingresa o selecciona un cliente. 🚫");
        return;
    }

    if (!clienteExiste) {
        const confirmarRegistro = await mostrarConfirmacion(
            `El cliente "${clienteNombre}" no está registrado. ¿Quieres ir a registrarlo ahora?`,
            "Cliente no encontrado"
        );
        if (confirmarRegistro) {
            window.location.href = "clientes.html";
            return;
        }
        mostrarToast("Cliente no registrado. Por favor, regístralo antes de proceder. 🚫");
        return;
    }

    if (productosVenta.length === 0 || !tipoPago) {
        mostrarToast("Completa todos los campos principales y agrega productos. 🚫");
        return;
    }

    let detallePago = {};
    let montoPendiente = 0;
    let estadoPago = 'Pagado Total'; // Default para contado y al iniciar

    let ingreso = 0;
    productosVenta.forEach(p => {
        ingreso += p.subtotal;
    });

    if (tipoPago === "contado") {
        const metodo = document.getElementById("metodoContado").value;
        if (!metodo) {
            mostrarToast("Selecciona el método de pago. 🚫");
            return;
        }
        // CORRECCIÓN AQUÍ: Asegurar que el método no se guarde como un string vacío
        detallePago = { metodo: metodo || "Efectivo/Otro" }; // <-- Cambié la línea aquí
        montoPendiente = 0; // Contado, no hay monto pendiente
        estadoPago = 'Pagado Total';
    } else if (tipoPago === "credito") {
        const fechaVencimiento = document.getElementById("fechaVencimiento").value;
        if (!fechaVencimiento) {
            mostrarToast("Por favor, selecciona una fecha de vencimiento para la venta a crédito. 🚫");
            return;
        }
        const metodo = document.getElementById("metodoCredito").value;
        detallePago = {
            acreedor: clienteNombre,
            fechaVencimiento,
            metodo: metodo || "No especificado"
        };
        montoPendiente = ingreso; // Al inicio, el monto pendiente es el total del ingreso
        estadoPago = 'Pendiente'; // Estado inicial para crédito
    }

    let ganancia = 0;
    productosVenta.forEach(p => {
        ganancia += (p.precio - p.costo) * p.cantidad;
    });

    const nuevaVenta = {
        cliente: clienteNombre,
        productos: [...productosVenta],
        tipoPago,
        detallePago,
        ingreso,
        ganancia,
        fecha: obtenerFechaVenta(),
        montoPendiente: montoPendiente,
        estadoPago: estadoPago,
        observaciones: document.getElementById('observacionesVenta').value.trim(),
        archivado: false
    };

    try {
        let productosActualizados = [...productos];

        movimientos = await obtenerTodosLosMovimientos();

        if (editVentaId !== null) {
            const ventaAnterior = ventas.find(v => v.id === editVentaId);
            if (ventaAnterior) {
                ventaAnterior.productos.forEach(p => {
                    const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                    if (prod) {
                        prod.stock += p.cantidad;
                        prod.vendidos = Math.max(0, (prod.vendidos || 0) - p.cantidad);
                    }
                });
            }

            productosVenta.forEach(p => {
                const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock = Math.max(0, prod.stock - p.cantidad);
                    prod.vendidos = (prod.vendidos || 0) + p.cantidad;
                }
            });

            nuevaVenta.id = editVentaId;
            await actualizarVenta(editVentaId, nuevaVenta);
            mostrarToast("Venta actualizada ✅");

        } else {
            const idGenerado = await agregarVenta(nuevaVenta);

            productosVenta.forEach(p => {
                const prod = productosActualizados.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock = Math.max(0, prod.stock - p.cantidad);
                    prod.vendidos = (prod.vendidos || 0) + p.cantidad;
                }
            });

            const costoTotal = productosVenta.reduce((total, p) => total + (p.costo * p.cantidad), 0);

            await agregarMovimientoDB({
                tipo: "ingreso",
                monto: ingreso,
                fecha: nuevaVenta.fecha,
                descripcion: `Venta a ${clienteNombre} (${tipoPago})`
            });

            await agregarMovimientoDB({
                tipo: "gasto",
                monto: costoTotal,
                fecha: nuevaVenta.fecha,
                descripcion: `Costo de venta a ${clienteNombre}`
            });

            mostrarToast("Venta registrada con éxito ✅");
        }

        for (const prod of productosActualizados) {
            await actualizarProducto(prod.id, prod);
        }

        ventas = await obtenerTodasLasVentas();
        productos = await obtenerTodosLosProductos();
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos();

        editVentaId = null;
        document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta";

        guardarVentas();
        mostrarVentas();
        await cargarProductos();

        limpiarFormulario();
    } catch (error) {
        console.error("Error al registrar/actualizar venta:", error);
        mostrarToast("Error al registrar venta ❌");
    }
}

// Actualizada para cargar desde IndexedDB
// Actualizada para cargar desde IndexedDB
async function mostrarVentas(filtradas) {
    if (!filtradas) {
        ventas = await obtenerTodasLasVentas();
        // Para cada venta, calcular el monto pendiente actualizando desde abonos
        for (const venta of ventas) {
            if (venta.tipoPago === 'credito') {
                const abonosDeVenta = await obtenerAbonosPorPedidoId(venta.id); // Usamos obtenerAbonosPorPedidoId
                // ¡CORRECCIÓN AQUÍ! abonosDeVenta en lugar de abonosDeVnta
                const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0); 
                venta.montoPendiente = Math.max(0, venta.ingreso - totalAbonado); // Recalcular monto pendiente

                if (venta.montoPendiente === 0) {
                    venta.estadoPago = 'Pagado Total';
                } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
                    venta.estadoPago = 'Pagado Parcial';
                } else {
                    venta.estadoPago = 'Pendiente';
                }
                // Si la venta se actualizó, persistir el cambio en la DB (opcional, pero buena práctica si el estado cambia)
                await actualizarVenta(venta.id, venta);
            }
        }
        filtradas = ventas;
    }

    // Aplicar orden antes de continuar
    filtradas.sort((a,b)=>{
        let valA, valB;
        switch(sortKeyVentas){
          case 'cliente': valA = (a.cliente||'').toLowerCase(); valB=(b.cliente||'').toLowerCase(); break;
          case 'ingreso': valA = a.ingreso||0; valB=b.ingreso||0; break;
          case 'fecha': default:
            valA = new Date(a.fecha);
            valB = new Date(b.fecha);
        }
        if (valA < valB) return sortAscVentas? -1: 1;
        if (valA > valB) return sortAscVentas? 1: -1;
        return 0;
    });

    const lista = document.getElementById("listaVentas");
    lista.innerHTML = "";

    // Filtrar según archivado
    if (!mostrarArchivadas) {
        filtradas = filtradas.filter(v=>!v.archivado);
    } else {
        filtradas = filtradas.filter(v=>v.archivado);
    }

    if (filtradas.length === 0) {
        lista.innerHTML = `<p class="text-center text-gray-400">No hay ventas registradas.</p>`;
        // Limpiar paginación si no hay datos
        const pagCont = document.getElementById('paginacionVentas');
        if (pagCont) pagCont.innerHTML = '';
        return;
    }

    const grupoContado = {};
    const grupoCredito = [];

    filtradas.forEach((venta) => {
        if (venta.tipoPago === "contado") {
            // ¡CORRECCIÓN DE SEGURIDAD AQUÍ! Añadimos ?. para evitar errores si detallePago es undefined
            const metodo = venta.detallePago?.metodo || "Efectivo"; 
            if (!grupoContado[metodo]) grupoContado[metodo] = [];
            grupoContado[metodo].push({ venta, id: venta.id });
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
                const card = crearCardVenta(venta, id);
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

        // Opcional: Ordenar ventas a crédito por fecha de vencimiento
        // Dentro de mostrarVentas, en el sort para ventas a crédito
        grupoCredito.sort((a, b) => {
            const fechaA = a.venta.detallePago?.fechaVencimiento ?? '9999-12-31';
            const fechaB = b.venta.detallePago?.fechaVencimiento ?? '9999-12-31';

            const dateA = new Date(fechaA);
            const dateB = new Date(fechaB);

            return dateA - dateB;
        });


        grupoCredito.forEach(({ venta, id }) => {
            const card = crearCardVenta(venta, id);
            lista.appendChild(card);
        });
    }

    // Al final de mostrarVentas, aplicar paginación (se llama tras crear todos los elementos)
    setTimeout(() => {
        if (window.PaginacionUtils?.paginarDOM) {
            PaginacionUtils.paginarDOM('#listaVentas', '.venta-card, .venta-credito-card', currentPageVentas, rowsPerPageVentas, 'paginacionVentas', (nuevaPag) => {
                currentPageVentas = nuevaPag;
            });
        }
    }, 0);

    // --- Si hay botón de toggle archivadas, actualizar contador ---
    if (document.getElementById('btnToggleArchivadas')) {
        document.getElementById('btnToggleArchivadas').textContent = mostrarArchivadas ? '📂 Ocultar archivadas' : '📂 Mostrar archivadas';
    }
    if (document.getElementById('btnEliminarArchivadas')) {
        document.getElementById('btnEliminarArchivadas').style.display = mostrarArchivadas ? '' : 'none';
    }
}

// Function to create the HTML card for each sale in the history
function crearCardVenta(venta, id) {
    let productosTexto = "";

    try {
        // Si productos es un string que no empieza con '[' o '{', es probablemente un texto ya formateado
        if (typeof venta.productos === 'string' && 
            !venta.productos.trim().startsWith('[') && 
            !venta.productos.trim().startsWith('{')) {
            // Ya está en formato texto, usarlo directamente
            productosTexto = venta.productos;
        } else {
            // Si es array o JSON válido, procesarlo normalmente
            const productosVentaArray = Array.isArray(venta.productos)
                ? venta.productos
                : JSON.parse(venta.productos || '[]');

            productosTexto = productosVentaArray.map(p => {
                const unidad = p.unidadMedida || 'unidad(es)';
                return `${p.nombre} x${p.cantidad} ${unidad}`;
            }).join(", ");
        }
    } catch (e) {
        console.warn("⚠️ Error procesando productos de la venta:", e);
        // Si hay error, mostrar los productos como texto o "Error" si no es posible
        productosTexto = typeof venta.productos === 'string' ? venta.productos : "Error al cargar productos";
    }

    // Formatear fecha y hora
    let fechaObj;
    try {
        fechaObj = new Date(venta.fecha);
        if (isNaN(fechaObj)) {
            const [fecha, hora] = venta.fecha.split("T");
            const [anio, mes, dia] = fecha.split("-");
            const [horas, minutos, segundos = "00"] = (hora || "00:00").split(":");
            fechaObj = new Date(anio, mes - 1, dia, horas, minutos, segundos);
        }
    } catch (e) {
        fechaObj = new Date();
    }

    const fechaVenta = fechaObj.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const horaVenta = fechaObj.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    let detallePagoHTML = '';
    let estadoPagoHTML = '';
    let estadoClase = '';

    if (venta.tipoPago === "contado") {
        detallePagoHTML = `<p><strong>Método:</strong> ${venta.detallePago?.metodo || 'N/A'}</p>`;
        estadoPagoHTML = `<span class="estado-pago pagado-total">(Pagado)</span>`;
    } else {
        const fechaVencimiento = venta.detallePago?.fechaVencimiento || "N/A";
        detallePagoHTML = `
            <p><strong>Acreedor:</strong> ${venta.detallePago?.acreedor || "N/A"}</p>
            <p><strong>Vence:</strong> ${fechaVencimiento}</p>
        `;

        switch (venta.estadoPago) {
            case 'Pendiente':
                estadoPagoHTML = `<span class="estado-pago pendiente">(Pendiente: $${typeof venta.montoPendiente === 'number' ? venta.montoPendiente.toFixed(2) : (parseFloat(venta.montoPendiente) || 0).toFixed(2)})</span>`;
                estadoClase = 'border-red-400';
                break;
            case 'Pagado Parcial':
                estadoPagoHTML = `<span class="estado-pago parcial">(Parcial: $${typeof venta.montoPendiente === 'number' ? venta.montoPendiente.toFixed(2) : (parseFloat(venta.montoPendiente) || 0).toFixed(2)} restantes)</span>`;
                estadoClase = 'border-orange-400';
                break;
            case 'Pagado Total':
                estadoPagoHTML = `<span class="estado-pago pagado-total">(Pagado)</span>`;
                estadoClase = 'border-green-400';
                break;
            default:
                estadoPagoHTML = `<span class="estado-pago">(Estado desconocido)</span>`;
                estadoClase = 'border-gray-300';
        }

        if (venta.tipoPago === 'credito' && venta.estadoPago !== 'Pagado Total' && fechaVencimiento && new Date(fechaVencimiento) < new Date()) {
            estadoClase = 'border-red-700 ring-2 ring-red-500';
            estadoPagoHTML = `<span class="estado-pago vencido">(OVERDUE: $${typeof venta.montoPendiente === 'number' ? venta.montoPendiente.toFixed(2) : (parseFloat(venta.montoPendiente) || 0).toFixed(2)})</span>`;
        }
    }

    const card = document.createElement("div");
    card.classList.add("venta-card");
    if (estadoClase) card.classList.add(...estadoClase.split(' '));

    // Aseguramos que detallePago exista
    if (!venta.detallePago) {
        venta.detallePago = { metodo: 'N/A' };
    }
    
    card.innerHTML = `
        <div class="header-venta">
            <h3>${venta.cliente}</h3>
        </div>
        <div class="detalle-venta">
            <p><strong>Productos:</strong> ${productosTexto}</p>
            <p><strong>Total:</strong> $${typeof venta.ingreso === 'number' ? venta.ingreso.toFixed(2) : (parseFloat(venta.ingreso) || 0).toFixed(2)}</p>
            <p><strong>Condición:</strong> ${venta.tipoPago} ${estadoPagoHTML}</p>
            <p><strong>Método:</strong> ${venta.detallePago?.metodo || 'N/A'}</p>
            <p><strong>Fecha y hora de registro:</strong> ${fechaVenta} ${horaVenta}</p>
            ${venta.tipoPago === 'credito' ? `<p><strong>Fecha de vencimiento:</strong> ${formatearFecha(venta.detallePago?.fechaVencimiento) || 'No establecida'}</p>` : ''}
        </div>
        <div class="acciones-venta">
            <button onclick="cargarVenta(${id})" class="btn-editar">✏️ Editar</button>
            <button onclick="revertirVenta(${id})" class="btn-revertir">↩️ Revertir</button>
            <button onclick="eliminarVentaPermanente(${id})" class="btn-eliminar">🗑 Eliminar</button>
            ${venta.archivado ? `<button onclick="restaurarVenta(${id})" class="btn-restaurar">↩️ Restaurar</button>` : `<button onclick="archivarVenta(${id})" class="btn-archivar">🗄️ Archivar</button>`}
            ${venta.tipoPago === 'credito' && venta.estadoPago !== 'Pagado Total' 
                ? `<button onclick="abrirModalAbono(${id})" class="btn-abonar">💰 Abonar</button>` : ''}
            <button onclick="mostrarRecibo(${id})" class="btn-recibo">🧾 Recibo</button>
        </div>
    `;

    return card;
}

//FECHA PERSONALIZADA - Corregido para usar IDs correctos del HTML
function toggleFechaManual() {
    const mostrar = document.getElementById("activarFechaManual").checked;
    document.getElementById("opcionFechaManual").style.display = mostrar ? "block" : "none";
}

async function filtrarVentas() {
    const input = document.getElementById("buscadorVentas").value.toLowerCase().trim();
    ventas = await obtenerTodasLasVentas(); // Asegúrate de tener la lista completa y actualizada

    // Recalcular montos pendientes antes de filtrar
    for (const venta of ventas) {
        if (venta.tipoPago === 'credito') {
            const abonosDeVenta = await obtenerAbonosPorPedidoId(venta.id);
            const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
            venta.montoPendiente = Math.max(0, venta.ingreso - totalAbonado);
            if (venta.montoPendiente === 0) {
                venta.estadoPago = 'Pagado Total';
            } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
                venta.estadoPago = 'Pagado Parcial';
            } else {
                venta.estadoPago = 'Pendiente';
            }
            await actualizarVenta(venta.id, venta); // Persistir el estado actualizado
        }
    }

    const filtradas = ventas.filter(v => {
        // Asegurarnos que los datos existen y son válidos antes de procesarlos
        let productos = "";
        try {
            if (Array.isArray(v.productos)) {
                productos = v.productos.map(p => `${(p.nombre || '').toLowerCase()} ${p.cantidad} ${p.unidadMedida || ''}`).join(" ");
            } else if (typeof v.productos === 'string') {
                productos = v.productos.toLowerCase();
            }
        } catch (e) {
            console.warn("Error procesando productos para filtrar:", e);
        }
        
        const cliente = (v.cliente || "").toLowerCase();
        const fecha = (v.fecha || "").toLowerCase();
        const detallePago = v.detallePago || {};
        const metodo = (detallePago.metodo || "").toLowerCase();
        const acreedor = (detallePago.acreedor || "").toLowerCase();
        const tipoVenta = (v.tipoPago || "").toLowerCase();
        const estadoPago = (v.estadoPago || "").toLowerCase();
        const fechaVencimiento = (detallePago.fechaVencimiento || "").toLowerCase();

        return (
            cliente.includes(input) ||
            fecha.includes(input) ||
            productos.includes(input) ||
            metodo.includes(input) ||
            acreedor.includes(input) ||
            v.ingreso.toString().includes(input) ||
            tipoVenta.includes(input) ||
            estadoPago.includes(input) ||
            fechaVencimiento.includes(input)
        );
    });

    mostrarVentas(filtradas);
}

function limpiarFormulario() {
    document.getElementById("clienteVenta").value = "";
    document.getElementById("productoVenta").value = "";
    document.getElementById("cantidadVenta").value = ""; // Limpiar cantidad
    document.getElementById("totalVenta").textContent = "0.00"; // Resetear total
    document.getElementById("tipoPago").value = "";
    document.getElementById("metodoContado").value = "";
    document.getElementById("fechaVencimiento").value = "";
    // Limpiar campos de fecha y hora personalizadas si estaban activos
    document.getElementById("activarFechaManual").checked = false;
    document.getElementById("opcionFechaManual").style.display = "none";
    document.getElementById("fechaVentaPersonalizada").value = "";
    document.getElementById("horaVentaPersonalizada").value = "";

    productosVenta = [];
    actualizarTablaProductos();
    mostrarOpcionesPago(); // Restablece la visibilidad de opciones de pago
    editVentaId = null; // Resetea el ID de edición
    document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta";
}

// Se movió la definición de mostrarToast aquí arriba para que siempre esté disponible.
// Si ya tienes un mostrarToast global en otro lado (ej. db.js), asegúrate de que no haya conflicto.
function mostrarToast(mensaje, tipo = "info") { // Añadido 'tipo' para posibles estilos (error, éxito)
    const toastContainer = document.getElementById("toastContainer");
    if (!toastContainer) { // Crea el contenedor si no existe
        const body = document.querySelector('body');
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.style.position = 'fixed';
        newContainer.style.bottom = '20px';
        newContainer.style.right = '20px';
        newContainer.style.zIndex = '1000';
        newContainer.style.display = 'flex';
        newContainer.style.flexDirection = 'column';
        newContainer.style.alignItems = 'flex-end';
        newContainer.style.gap = '10px';
        body.appendChild(newContainer);
        // Aplica estilos básicos para las notificaciones (solo si no existen)
        if (!document.head.querySelector('style[data-toast-style]')) {
            const style = document.createElement('style');
            style.setAttribute('data-toast-style', true); // Marcador para evitar duplicados
            style.textContent = `
                .toast {
                    background-color: #333;
                    color: #fff;
                    padding: 10px 20px;
                    border-radius: 5px;
                    opacity: 0;
                    transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
                    transform: translateY(20px);
                }
                .toast.show {
                    opacity: 1;
                    transform: translateY(0);
                }
            `;
            document.head.appendChild(style);
        }
    }

    const toast = document.createElement("div");
    toast.className = `toast ${tipo}`; // Agrega clase de tipo (info, error, success)
    toast.textContent = mensaje;
    // Re-obtener la referencia al contenedor después de su posible creación
    const actualToastContainer = document.getElementById("toastContainer");
    if (actualToastContainer) {
        actualToastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add("show"), 100);
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }
}

// ¡NUEVA FUNCIÓN! Para reemplazar los confirm/alert del navegador
function mostrarConfirmacion(mensaje, titulo = "Confirmar") {
    return new Promise((resolve) => {
        // Eliminar cualquier modal existente antes de crear uno nuevo
        const existingModal = document.getElementById('customConfirmModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHtml = `
            <div id="customConfirmModal" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center;
                z-index: 10000; /* Asegurar que esté por encima de todo */
            ">
                <div style="
                    background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    max-width: 400px; text-align: center; font-family: 'Inter', sans-serif;
                ">
                    <h3 style="margin-top: 0; color: #333; font-size: 1.4em;">${titulo}</h3>
                    <p style="margin-bottom: 25px; color: #555; font-size: 1em;">${mensaje}</p>
                    <div style="display: flex; justify-content: center; gap: 15px;">
                        <button id="confirmYes" style="
                            background-color: #4CAF50; color: white; padding: 10px 20px; border: none;
                            border-radius: 8px; cursor: pointer; font-size: 1em; transition: background-color 0.3s;
                        ">Sí</button>
                        <button id="confirmNo" style="
                            background-color: #f44336; color: white; padding: 10px 20px; border: none;
                            border-radius: 8px; cursor: pointer; font-size: 1em; transition: background-color 0.3s;
                        ">No</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('customConfirmModal');
        document.getElementById('confirmYes').onclick = () => {
            modal.remove();
            resolve(true);
        };
        document.getElementById('confirmNo').onclick = () => {
            modal.remove();
            resolve(false);
        };
    });
}

async function revertirVenta(id) {
    ventas = await obtenerTodasLasVentas();
    productos = await obtenerTodosLosProductos(); // Recargar para tener la unidad de medida
    movimientos = await obtenerTodosLosMovimientos();
    abonos = await obtenerTodosLosAbonos(); // Cargar abonos

    const venta = ventas.find(v => v.id === id);
    if (!venta) {
        mostrarToast("Venta no encontrada para revertir. 🚫");
        return;
    }

    // ¡MODIFICADO! Usar modal de confirmación
    const motivo = await mostrarPromptPersonalizado("¿Por qué deseas revertir esta venta?", "Motivo de Reversión", "Motivo:");
    if (motivo === null || motivo.trim() === "") {
        mostrarToast("Debes ingresar un motivo para revertir la venta. 🚫");
        return;
    }

    const confirmacion = await mostrarConfirmacion(
        `¿Seguro que quieres revertir la venta a ${venta.cliente}?\nMotivo: ${motivo}`,
        "Confirmar Reversión"
    );

    if (confirmacion) {
        try {
            // Revertir stock de productos
            for (const p of venta.productos) {
                const prod = productos.find(prod => prod.nombre === p.nombre);
                if (prod) {
                    prod.stock += p.cantidad;
                    prod.vendidos = Math.max(0, (prod.vendidos || 0) - p.cantidad);
                    await actualizarProducto(prod.id, prod);
                }
            }

            // Si es una venta a crédito, eliminar los abonos asociados
            if (venta.tipoPago === 'credito') {
                const abonosDeVenta = abonos.filter(ab => ab.pedidoId === venta.id);
                for (const abono of abonosDeVenta) {
                    await eliminarAbonoDB(abono.id); // Usamos eliminarAbonoDB
                }
                mostrarToast(`Eliminados ${abonosDeVenta.length} abonos de la venta a crédito.`);
            }

            // Eliminar la venta de IndexedDB
            await eliminarVenta(id);

            // Recargar los datos después de las operaciones
            ventas = await obtenerTodasLasVentas();
            productos = await obtenerTodosLosProductos(); // Recargar para que el stock se muestre actualizado
            movimientos = await obtenerTodosLosMovimientos();
            abonos = await obtenerTodosLosAbonos();

            guardarVentas(); // Para actualizar gráficos si aplica
            mostrarVentas();
            mostrarToast("Venta revertida y stock actualizado ✅");
        } catch (error) {
            console.error("Error al revertir venta:", error);
            mostrarToast("Error al revertir venta ❌");
        }
    } else {
        mostrarToast("Reversión de venta cancelada ❌");
    }
}

// ¡NUEVA FUNCIÓN! Para reemplazar prompt()
function mostrarPromptPersonalizado(mensaje, titulo = "Entrada Requerida", inputLabel = "Valor:") {
    return new Promise((resolve) => {
        // Eliminar cualquier modal existente antes de crear uno nuevo
        const existingModal = document.getElementById('customPromptModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHtml = `
            <div id="customPromptModal" style="
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center;
                z-index: 10001; /* Mayor z-index para prompts */
            ">
                <div style="
                    background: #fff; padding: 25px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    max-width: 400px; text-align: center; font-family: 'Inter', sans-serif;
                ">
                    <h3 style="margin-top: 0; color: #333; font-size: 1.4em;">${titulo}</h3>
                    <p style="margin-bottom: 15px; color: #555; font-size: 1em;">${mensaje}</p>
                    <label for="promptInput" style="display: block; text-align: left; margin-bottom: 5px; color: #444;">${inputLabel}</label>
                    <input type="text" id="promptInput" style="
                        width: calc(100% - 20px); padding: 10px; margin-bottom: 20px; border: 1px solid #ccc;
                        border-radius: 8px; font-size: 1em;
                    ">
                    <div style="display: flex; justify-content: center; gap: 15px;">
                        <button id="promptOk" style="
                            background-color: #4CAF50; color: white; padding: 10px 20px; border: none;
                            border-radius: 8px; cursor: pointer; font-size: 1em; transition: background-color 0.3s;
                        ">Aceptar</button>
                        <button id="promptCancel" style="
                            background-color: #f44336; color: white; padding: 10px 20px; border: none;
                            border-radius: 8px; cursor: pointer; font-size: 1em; transition: background-color 0.3s;
                        ">Cancelar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('customPromptModal');
        const input = document.getElementById('promptInput');
        input.focus(); // Enfocar el input automáticamente

        document.getElementById('promptOk').onclick = () => {
            modal.remove();
            resolve(input.value);
        };
        document.getElementById('promptCancel').onclick = () => {
            modal.remove();
            resolve(null); // Retorna null si se cancela
        };

        // Permite cerrar con Enter en el input
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('promptOk').click();
            }
        });
    });
}

async function eliminarVentaPermanente(id) {
    ventas = await obtenerTodasLasVentas();
    movimientos = await obtenerTodosLosMovimientos();
    abonos = await obtenerTodosLosAbonos(); // Cargar abonos

    const venta = ventas.find(v => v.id === id);
    if (!venta) {
        mostrarToast("Venta no encontrada para eliminar. 🚫");
        return;
    }

    // ¡MODIFICADO! Usar modal de confirmación en lugar de confirm
    const confirmacion = await mostrarConfirmacion(
        `¿Estás seguro de eliminar la venta a ${venta.cliente} sin revertir stock? Esta acción es irreversible.`,
        "Eliminar Venta Permanentemente"
    );
    
    if (!confirmacion) {
        mostrarToast("Eliminación de venta cancelada ❌");
        return;
    }

    try {
        // Añadir movimiento de ajuste en Finanzas (a IndexedDB)
        await agregarMovimientoDB({
            tipo: "ajuste",
            monto: -venta.ingreso,
            ganancia: -venta.ganancia, // Ojo, esta ganancia podría ser negativa en un ajuste
            fecha: new Date().toISOString().split("T")[0], // Usar fecha actual para el ajuste
            descripcion: `Eliminación manual de venta a ${venta.cliente} (ID: ${id})`
        });

        // Si es una venta a crédito, eliminar los abonos asociados
        if (venta.tipoPago === 'credito') {
            const abonosDeVenta = abonos.filter(ab => ab.pedidoId === venta.id);
            for (const abono of abonosDeVenta) {
                await eliminarAbonoDB(abono.id);
            }
            mostrarToast(`Eliminados ${abonosDeVenta.length} abonos de la venta eliminada.`);
        }

        // Eliminar la venta de IndexedDB
        await eliminarVenta(id);

        // Re-sincronizar arrays globales después de las operaciones
        ventas = await obtenerTodasLasVentas();
        productos = await obtenerTodosLosProductos(); // Recargar para que el stock se muestre actualizado
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos();

        guardarVentas(); // Para actualizar gráficos si aplica
        mostrarVentas();
        mostrarToast("Venta eliminada permanentemente 🗑️");
    } catch (error) {
        console.error("Error al eliminar venta:", error);
        mostrarToast("Error al eliminar venta ❌");
    }
}

// La función cargarVenta (dentro de js/ventas.js)
// Esta versión asume que los datos de productos en la venta ya contienen 'unidadMedida'
// para evitar llamadas individuales a la DB para cada producto.
async function cargarVenta(id) {
    try {
        ventas = await obtenerTodasLasVentas(); // Asegurarse de tener las ventas más recientes
        const venta = ventas.find(v => v.id === id);

        if (!venta) {
            mostrarToast("Venta no encontrada para editar. 😞");
            return;
        }

        editVentaId = id; // Establecer el ID de la venta que estamos editando
        document.getElementById("btnRegistrarVenta").textContent = "Actualizar Venta";
        document.getElementById("btnCancelarEdicion").style.display = "inline-block"; // ¡MOSTRAR EL BOTÓN CANCELAR!

        // 1. Cargar datos de la venta al formulario
        document.getElementById("clienteVenta").value = venta.cliente;
        document.getElementById("tipoPago").value = venta.tipoPago;

        // Mostrar/ocultar opciones de pago y cargar detalles de pago
        mostrarOpcionesPago(); // Esto asegurará que los campos correctos estén visibles

        if (venta.tipoPago === "contado") {
            document.getElementById("metodoContado").value = (venta.detallePago && venta.detallePago.metodo) ? venta.detallePago.metodo : '';
            // Desactivar fecha manual si se edita una venta al contado (opcional, pero lógico)
            document.getElementById("activarFechaManual").checked = false;
            toggleFechaManual(); // Para ocultar los inputs de fecha manual
        } else { // Venta a crédito
            document.getElementById("fechaVencimiento").value = (venta.detallePago && venta.detallePago.fechaVencimiento) ? venta.detallePago.fechaVencimiento : '';
            document.getElementById("metodoCredito").value = (venta.detallePago && venta.detallePago.metodo) ? venta.detallePago.metodo : '';
            // Si hay una fecha de venta personalizada guardada, cargarla y activar
            if (venta.fecha) {
                const fechaParte = venta.fecha.slice(0, 10); // Formato YYYY-MM-DD
                const horaParte = venta.fecha.length > 10 ? venta.fecha.slice(11, 16) : ''; // Formato HH:mm
                document.getElementById("activarFechaManual").checked = true;
                toggleFechaManual(); // Para mostrar los inputs de fecha manual
                document.getElementById("fechaVentaPersonalizada").value = fechaParte;
                document.getElementById("horaVentaPersonalizada").value = horaParte;
            } else {
                document.getElementById("activarFechaManual").checked = false;
                toggleFechaManual();
            }
        }

        // 2. Cargar productos de la venta al array temporal 'productosVenta'
        // IMPORTANTE: Aquí NO necesitamos 'obtenerProductoPorNombre'.
        // Asumimos que los 'productos' guardados en 'venta.productos' ya tienen
        // toda la información necesaria, incluyendo 'unidadMedida' y 'costo',
        // ya que así se guardaron en 'registrarVenta'.
        // CORRECCIÓN ADICIONAL AQUÍ: Verificar si venta.productos es un array
        if (Array.isArray(venta.productos)) { // <--- NUEVA LÍNEA CLAVE
            productosVenta = venta.productos.map(p => ({
                nombre: p.nombre,
                precio: p.precio,
                costo: p.costo, // Asegurarse de que el costo esté en el objeto del producto guardado
                cantidad: p.cantidad,
                subtotal: p.subtotal,
                unidadMedida: p.unidadMedida || 'unidad(es)' // Fallback por si acaso la unidad de medida no se guardó
            }));
        } else {
            productosVenta = []; // Si no es un array, inicializar como array vacío para evitar errores
        }
        actualizarTablaProductos(); // Volver a renderizar la tabla con los productos cargados

        // 3. Desplazarse al formulario de registro para editar
        const formulario = document.getElementById("formularioVenta"); // Asegúrate de que tu formulario principal tiene este ID
        if (formulario) {
            formulario.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        mostrarToast(`Cargando venta de ${venta.cliente} para edición...`);

    } catch (error) {
        console.error("Error al cargar venta para edición:", error);
        mostrarToast("Error al cargar venta para edición 😥");
    }
}

async function agregarProductoAVenta() {
    const productoNombre = document.getElementById("productoVenta").value;
    const cantidad = parseInt(document.getElementById("cantidadVenta").value);

    if (!productoNombre || isNaN(cantidad) || cantidad < 1) {
        mostrarToast("Selecciona un producto válido y una cantidad. 🚫");
        return;
    }

    productos = await obtenerTodosLosProductos(); // Recargar productos para obtener la unidad de medida
    const producto = productos.find(p => p.nombre === productoNombre);

    if (!producto) {
        mostrarToast("Producto no encontrado en el inventario. 🚫");
        return;
    }

    const existente = productosVenta.find(p => p.nombre === productoNombre);
    const totalCantidad = (existente ? existente.cantidad : 0) + cantidad;

    if (producto.stock < totalCantidad) {
        mostrarToast(`Stock insuficiente. Disponible: ${producto.stock} ${producto.unidadMedida || 'unidad(es)'}, Solicitado: ${totalCantidad} ${producto.unidadMedida || 'unidad(es)'} 🚫`, "error");
        return;
    }

    if (existente) {
        // Si el producto ya estaba en la lista, sólo aumentamos cantidad y subtotal
        existente.cantidad += cantidad;
        existente.subtotal = existente.cantidad * producto.precio;
        // Si la unidad no estaba, la añadimos (aunque ya debería estar desde inventario)
        existente.unidadMedida = producto.unidadMedida || 'unidad(es)';
    } else {
        productosVenta.push({
            nombre: producto.nombre,
            precio: producto.precio,
            costo: producto.costo,
            cantidad,
            subtotal: cantidad * producto.precio,
            unidadMedida: producto.unidadMedida || 'unidad(es)' // ¡NUEVO! Guardar la unidad de medida del producto
        });
    }

    actualizarTablaProductos();

    document.getElementById("productoVenta").value = "";
    document.getElementById("cantidadVenta").value = "";
}

// Función para actualizar y renderizar la tabla de productos en la venta
function actualizarTablaProductos() {
    const tabla = document.getElementById("tablaProductosVenta");
    tabla.innerHTML = ""; // Limpia la tabla antes de volver a renderizar
    let total = 0; // Variable para calcular el total de la venta

    // Recorre cada producto en el array temporal 'productosVenta'
    productosVenta.forEach((p, index) => {
        const fila = document.createElement("tr"); // Crea una nueva fila para cada producto
        
        // Asigna el contenido HTML a la fila
        // Cada celda (<td>) incluye el atributo 'data-label' que es crucial para
        // el diseño responsivo en móvil. El CSS lo usará para mostrar el "encabezado"
        // de la columna al lado del valor en pantallas pequeñas.
        // También incluye la 'unidadMedida' para mayor claridad.
        fila.innerHTML = `
            <td data-label="Producto">${p.nombre}</td>
            <td data-label="Cantidad">${p.cantidad} ${p.unidadMedida || ''}</td>
            <td data-label="Precio Unitario">$${p.precio.toFixed(2)}</td>
            <td data-label="Subtotal">$${p.subtotal.toFixed(2)}</td>
            <td data-label="Acción">
                <button onclick="eliminarProductoVenta(${index})" class="text-red-500 hover:text-red-700">
                    ❌<span> Eliminar</span>
                </button>
            </td>
        `;
        tabla.appendChild(fila); // Añade la fila a la tabla
        total += p.subtotal; // Suma el subtotal del producto al total general
    });

    // Actualiza el elemento HTML que muestra el total de la venta
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
        // ¡MODIFICADO! Incluir unidad de medida en la exportación de productos
        Productos: venta.productos.map(p => `${p.nombre} x${p.cantidad} ${p.unidadMedida || ''}`).join(", "),
        Ingreso: venta.ingreso.toFixed(2),
        Ganancia: venta.ganancia.toFixed(2),
        Fecha: venta.fecha,
        Pago: venta.tipoPago,
        Detalle: venta.tipoPago === "contado" ? venta.detallePago.metodo : `Vence: ${venta.detallePago.fechaVencimiento || "N/A"}`,
        Monto_Pendiente: venta.tipoPago === "credito" ? venta.montoPendiente.toFixed(2) : "N/A",
        Estado_Pago: venta.tipoPago === "credito" ? venta.estadoPago : "N/A"
    }));

    let csv = "Cliente,Productos,Ingreso,Ganancia,Fecha,Pago,Detalle,Monto_Pendiente,Estado_Pago\n";
    data.forEach(row => {
        // Asegúrate de que los campos con comas (como productos) estén entre comillas para CSV
        const escapeCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;
        csv += `${escapeCsv(row.Cliente)},${escapeCsv(row.Productos)},${row.Ingreso},${row.Ganancia},${row.Fecha},${escapeCsv(row.Pago)},${escapeCsv(row.Detalle)},${row.Monto_Pendiente},${escapeCsv(row.Estado_Pago)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ventas.csv";
    document.body.appendChild(link); // Añadir al DOM para Firefox
    link.click();
    document.body.removeChild(link); // Eliminar después de click
    URL.revokeObjectURL(url); // Liberar el objeto URL
    mostrarToast("📊 CSV/Excel exportado"); // Cambiado el toast
}

async function exportarPDF() {
    ventas = await obtenerTodasLasVentas(); // Carga las ventas más recientes
    const ventana = window.open('', '_blank');
    let contenido = `
        <html>
            <head>
                <title>Reporte de Ventas</title>
                <style>
                    body { font-family: sans-serif; margin: 20px; }
                    h2 { color:#5b2d90; text-align: center; margin-bottom: 20px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .header { display: flex; align-items: center; justify-content: center; margin-bottom: 30px; }
                    .logo { height: 50px; margin-right: 15px; }
                    .titulo-header { font-size: 2em; color: #5b2d90; }
                </style>
            </head>
            <body>
                <div class="header">
                    <img src="logo/LOS SS.png" alt="Logo" class="logo" />
                    <h1 class="titulo-header">Reporte de Ventas</h1>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Cliente</th>
                            <th>Productos</th>
                            <th>Ingreso</th>
                            <th>Ganancia</th>
                            <th>Fecha</th>
                            <th>Pago</th>
                            <th>Detalle</th>
                            <th>Monto Pendiente</th>
                            <th>Estado Pago</th>
                        </tr>
                    </thead>
                    <tbody>`;

    ventas.forEach(venta => {
        // ¡MODIFICADO! Incluir unidad de medida en la exportación de productos
        const productos = venta.productos.map(p => `${p.nombre} x${p.cantidad} ${p.unidadMedida || ''}`).join(", ");
        const detalle = venta.tipoPago === "contado"
            ? venta.detallePago.metodo
            : `Vence: ${venta.detallePago.fechaVencimiento || "N/A"}`;
        const montoPendiente = venta.tipoPago === "credito" ? `$${venta.montoPendiente.toFixed(2)}` : "N/A";
        const estadoPago = venta.tipoPago === "credito" ? venta.estadoPago : "N/A";

        contenido += `
                        <tr>
                            <td>${venta.cliente}</td>
                            <td>${productos}</td>
                            <td>$${venta.ingreso.toFixed(2)}</td>
                            <td>$${venta.ganancia.toFixed(2)}</td>
                            <td>${venta.fecha}</td>
                            <td>${venta.tipoPago}</td>
                            <td>${detalle}</td>
                            <td>${montoPendiente}</td>
                            <td>${estadoPago}</td>
                        </tr>`;
    });

    contenido += `
                    </tbody>
                </table>
            </body>
        </html>`;

    ventana.document.write(contenido);
    ventana.document.close();
    ventana.print();
    mostrarToast("📄 PDF preparado para impresión");
}

async function validarClienteIngresado() {
    clientes = await obtenerTodosLosClientes();

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

// === Funciones para Abonos / Modal de Cobro ===
let currentVentaIdAbono = null; // Para saber qué venta se está abonando

// Abre el modal para registrar un abono
async function abrirModalAbono(ventaId) {
    currentVentaIdAbono = ventaId;
    const venta = ventas.find(v => v.id === ventaId);

    if (!venta || venta.tipoPago !== 'credito') {
        mostrarToast("No se puede abonar a esta venta.");
        return;
    }

    // Aseguramos que el monto pendiente esté actualizado
    const abonosDeVenta = await obtenerAbonosPorPedidoId(ventaId);
    const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
    const montoPendienteActualizado = venta.ingreso - totalAbonado;
    venta.montoPendiente = Math.max(0, montoPendienteActualizado); // Para evitar negativos

    // Actualizar el estado de pago de la venta si es necesario
    if (venta.montoPendiente === 0) {
        venta.estadoPago = 'Pagado Total';
    } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
        venta.estadoPago = 'Pagado Parcial';
    } else {
        venta.estadoPago = 'Pendiente';
    }
    await actualizarVenta(venta.id, venta); // Persistir el estado actualizado

    document.getElementById("detalleVentaModal").innerHTML = `
        <p><strong>Cliente:</strong> ${venta.cliente}</p>
        <p><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
        <p><strong>Monto Pendiente:</strong> <span class="text-red-500 font-bold">$${venta.montoPendiente.toFixed(2)}</span></p>
        <p><strong>Estado:</strong> ${venta.estadoPago}</p>
        <p><strong>Vencimiento:</strong> ${venta.detallePago.fechaVencimiento || 'N/A'}</p>
    `;

    document.getElementById("montoAbono").value = venta.montoPendiente.toFixed(2); // Valor por defecto
    document.getElementById("modalAbono").style.display = "flex";

    document.getElementById("modalAbono").scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Cargar y mostrar abonos previos de esta venta
    await mostrarAbonosPrevios(ventaId);
}

// Cierra el modal de abono
function cerrarModalAbono() {
    document.getElementById("modalAbono").style.display = "none";
    document.getElementById("montoAbono").value = "";
    currentVentaIdAbono = null;
}

// Registra el abono
async function registrarAbono() {
    // Prevenir múltiples envíos
    if (abonoEnProceso) {
        console.log("Ya hay un abono en proceso, evitando duplicación");
        return;
    }
    
    // Activar el bloqueo
    abonoEnProceso = true;
    
    // Debug para ver si se está ejecutando la función
    console.log("Función registrarAbono() ejecutada");
    
    try {
        if (currentVentaIdAbono === null) {
            mostrarToast("No hay una venta seleccionada para abonar. 🚫");
            abonoEnProceso = false; // Liberar el bloqueo
            return;
        }

        // Obtenemos el valor y lo convertimos a número con 2 decimales de precisión
        let montoAbono = parseFloat(parseFloat(document.getElementById("montoAbono").value).toFixed(2));
        console.log("Monto de abono ingresado:", montoAbono);
        
        if (isNaN(montoAbono) || montoAbono <= 0) {
            mostrarToast("Ingresa un monto de abono válido. 🚫");
            abonoEnProceso = false; // Liberar el bloqueo
            return;
        }

        const venta = ventas.find(v => v.id === currentVentaIdAbono);
        if (!venta) {
            mostrarToast("Venta no encontrada. 🚫");
            abonoEnProceso = false; // Liberar el bloqueo
            return;
        }

        // Convertir el monto pendiente a 2 decimales de precisión para evitar problemas
        const montoPendiente = parseFloat(venta.montoPendiente.toFixed(2));
        console.log("Monto pendiente:", montoPendiente);

        // Usar una pequeña tolerancia (epsilon) para comparaciones de punto flotante
        const epsilon = 0.01; // Aumentamos la tolerancia a 0.01
        if (montoAbono > montoPendiente + epsilon) {
            mostrarToast(`El abono ($${montoAbono.toFixed(2)}) no puede ser mayor que el monto pendiente ($${montoPendiente.toFixed(2)}). 🚫`);
            abonoEnProceso = false; // Liberar el bloqueo
            return;
        }
        
        // Si los montos son casi iguales (dentro del margen de error), ajustar para que sean exactamente iguales
        if (Math.abs(montoAbono - montoPendiente) < epsilon) {
            console.log("Montos casi iguales, ajustando...");
            montoAbono = montoPendiente;
        }
        
        console.log("Monto de abono final:", montoAbono);
        
        // Obtener el valor de la forma de pago seleccionada
        const formaPago = document.getElementById("formaPagoAbono").value;

        const nuevoAbono = {
            pedidoId: currentVentaIdAbono, // Es el ID de la venta, para el objectStore abonos
            fechaAbono: new Date().toISOString().split("T")[0],
            montoAbonado: montoAbono,
            formaPago: formaPago // Añadir la forma de pago al objeto
        };

        // Deshabilitar el botón de confirmación para evitar doble clic
        const btnConfirmar = document.getElementById("btnRegistrarAbono");
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = "Procesando...";
        btnConfirmar.style.opacity = "0.7";
        
        await agregarAbonoDB(nuevoAbono);
        mostrarToast("Abono registrado con éxito ✅");

        // Actualizar el monto pendiente y estado de pago de la venta
        venta.montoPendiente -= montoAbono;
        console.log("Nuevo monto pendiente (antes de redondeo):", venta.montoPendiente);
        
        // Usar una tolerancia más amplia para evitar problemas con decimales
        // y redondear siempre a 2 decimales para evitar problemas de punto flotante
        venta.montoPendiente = parseFloat(venta.montoPendiente.toFixed(2));
        console.log("Nuevo monto pendiente (después de redondeo):", venta.montoPendiente);
        
        if (venta.montoPendiente <= 0.01) { 
            console.log("Venta pagada completamente");
            venta.montoPendiente = 0;
            venta.estadoPago = 'Pagado Total';
        } else {
            venta.estadoPago = 'Pagado Parcial';
        }
        
        console.log("Estado de pago final:", venta.estadoPago);
        await actualizarVenta(venta.id, venta); // Actualizar la venta en la DB

        // Registrar un movimiento de ingreso por el abono
        await agregarMovimientoDB({
            tipo: "ingreso",
            monto: montoAbono,
            fecha: nuevoAbono.fechaAbono,
            descripcion: `Abono a venta a crédito de ${venta.cliente}`
        });

        // Recargar datos y actualizar UI
        ventas = await obtenerTodasLasVentas();
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos(); // Recargar abonos para el modal
        mostrarVentas(); // Para que se actualicen las tarjetas en la lista

        // Actualizar el modal de abonos y la lista de abonos previos
        document.getElementById("montoAbono").value = venta.montoPendiente.toFixed(2);
        document.getElementById("detalleVentaModal").innerHTML = `
            <p><strong>Cliente:</strong> ${venta.cliente}</p>
            <p><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
            <p><strong>Monto Pendiente:</strong> <span class="text-red-500 font-bold">$${venta.montoPendiente.toFixed(2)}</span></p>
            <p><strong>Estado:</strong> ${venta.estadoPago}</p>
            <p><strong>Vencimiento:</strong> ${venta.detallePago.fechaVencimiento || 'N/A'}</p>
        `;
        await mostrarAbonosPrevios(currentVentaIdAbono); // Recargar la lista de abonos dentro del modal

        if (venta.montoPendiente === 0) {
            mostrarToast("Venta a crédito completamente pagada! 🎉");
            cerrarModalAbono(); // Cerrar modal si ya se pagó todo
        }
        
        // Restaurar el botón después de procesar todo
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = "Confirmar Abono";
        btnConfirmar.style.opacity = "1";
    } catch (error) {
        console.error("Error al registrar abono:", error);
        mostrarToast("Error al registrar abono. 😔");
        
        // Restaurar el botón en caso de error
        const btnConfirmar = document.getElementById("btnRegistrarAbono");
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = "Confirmar Abono";
        btnConfirmar.style.opacity = "1";
    } finally {
        // Liberar el bloqueo al finalizar, sin importar si hubo éxito o error
        abonoEnProceso = false;
    }
}

// Muestra los abonos previos en el modal
async function mostrarAbonosPrevios(ventaId) {
    const listaAbonos = document.getElementById("listaAbonosModal");
    listaAbonos.innerHTML = '';
    const abonosDeVenta = await obtenerAbonosPorPedidoId(ventaId);

    if (abonosDeVenta.length === 0) {
        listaAbonos.innerHTML = '<p class="text-center text-gray-500 text-sm mt-2">No hay abonos previos registrados para esta venta.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-disc pl-5 mt-2 text-sm text-gray-700';

    abonosDeVenta.sort((a, b) => new Date(a.fechaAbono) - new Date(b.fechaAbono)); // Ordenar por fecha

    abonosDeVenta.forEach(abono => {
        const li = document.createElement('li');
        // Convertir método de pago para mostrar en formato legible
        let metodoPago = abono.formaPago || "No especificado";
        if (metodoPago === "pago_movil") metodoPago = "Pago Móvil";
        else if (metodoPago) metodoPago = metodoPago.charAt(0).toUpperCase() + metodoPago.slice(1);
        
        li.innerHTML = `<strong>Fecha:</strong> ${abono.fechaAbono}, <strong>Monto:</strong> $${abono.montoAbonado.toFixed(2)}${metodoPago !== "No especificado" ? `, <strong>Método:</strong> ${metodoPago}` : ''}`;
        ul.appendChild(li);
    });
    listaAbonos.appendChild(ul);
}

// Función para limpiar el formulario y resetear el modo de edición
function cancelarEdicionVenta() {
    limpiarFormulario(); // Llama a la función que ya limpia los campos y la tabla
    editVentaId = null; // Resetea el ID de la venta en edición
    document.getElementById("btnRegistrarVenta").textContent = "Registrar Venta"; // Vuelve el texto del botón a su original
    mostrarToast("Edición de venta cancelada.", "info"); // Mensaje de confirmación
    document.getElementById("btnCancelarEdicion").style.display = "none"; // ¡OCULTAR EL BOTÓN CANCELAR!
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await abrirDB();
        initSortVentas();
        initArchivadoUI();

        ventas = await obtenerTodasLasVentas();
        clientes = await obtenerTodosLosClientes();
        productos = await obtenerTodosLosProductos(); // Asegúrate de cargar productos con unidad de medida
        movimientos = await obtenerTodosLosMovimientos();
        abonos = await obtenerTodosLosAbonos(); // Cargar abonos al inicio
        

        mostrarVentas();
        mostrarOpcionesPago();
        cargarClientes();
        cargarProductos(); // Recarga el select de productos con info de stock y unidad
        cargarClientesEnDatalist();

        const inputCliente = document.getElementById("clienteVenta");
        inputCliente.addEventListener("input", validarClienteIngresado);

        // Asociar eventos del modal de abono
        document.getElementById("btnRegistrarAbono").addEventListener("click", registrarAbono);
        // Eliminado el event listener para el botón que ya no existe
        
        // Cerrar modal al hacer clic fuera del contenido del modal
        document.getElementById("modalAbono").addEventListener("click", (e) => {
            if (e.target.id === "modalAbono") {
                cerrarModalAbono();
            }
        });

        // Asociar evento al botón de cancelar edición
        document.getElementById("btnCancelarEdicion").addEventListener("click", cancelarEdicionVenta);

    } catch (error) {
        console.error("Error al inicializar la aplicación:", error);
        mostrarToast("Error grave al cargar datos 😥");
    }
});

// ====== NUEVAS FUNCIONES PARA EXPORTAR, IMPORTAR Y PLANTILLA JSON ======

/**
 * Exporta todas las ventas a un archivo JSON.
 */
async function exportarJSON() {
    try {
        const todasLasVentas = await obtenerTodasLasVentas();
        const dataStr = JSON.stringify(todasLasVentas, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ventas-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        mostrarToast("Ventas exportadas a JSON con éxito ✅", "success");
    } catch (error) {
        console.error("Error al exportar ventas a JSON:", error);
        mostrarToast("Error al exportar ventas a JSON ❌", "error");
    }
}

/**
 * Maneja la selección del archivo para la importación.
 */
async function importarJSONConArchivo(event) {
    const confirmacion = await mostrarConfirmacion(
        "Al importar ventas, se añadirán nuevas ventas o se actualizarán existentes (si tienen el mismo ID). ¿Deseas continuar?",
        "Confirmar Importación"
    );
    if (!confirmacion) {
        mostrarToast("Importación de ventas cancelada.", "info");
        // Limpiar el input file para que se pueda seleccionar el mismo archivo de nuevo
        event.target.value = null; 
        return;
    }

    const file = event.target.files[0];
    if (!file) {
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedVentas = JSON.parse(e.target.result);

                if (!Array.isArray(importedVentas)) {
                    mostrarToast("El archivo JSON no contiene un array de ventas válido. 🚫", "error");
                    return;
                }

                let nuevasVentas = 0;
                let ventasActualizadas = 0;
                let errores = 0;

                for (const venta of importedVentas) {
                    try {
                        // Validar estructura básica de la venta
                        // Ajusta esta validación según los campos mínimos que esperas en una venta
                        if (!venta.cliente || !venta.productos || !Array.isArray(venta.productos) || !venta.tipoPago || typeof venta.ingreso === 'undefined') {
                            console.warn("Venta importada con formato inválido, omitiendo:", venta);
                            errores++;
                            continue;
                        }

                        // Comprobar si la venta ya existe por ID para actualizarla
                        // Si tu `db.js` maneja IDs autoincrementales, esta lógica de `venta.id` es clave.
                        // Si los IDs son generados por ti (UUID, etc.), asegúrate de que sean únicos.
                        if (venta.id) { // Solo si la venta importada tiene un ID
                            const ventaExistente = await obtenerVentaPorId(venta.id); 
                            if (ventaExistente) {
                                // Conservar la fecha de creación original si no se especifica una nueva
                                if (!venta.fecha && ventaExistente.fecha) {
                                    venta.fecha = ventaExistente.fecha;
                                }
                                await actualizarVenta(venta.id, venta); 
                                ventasActualizadas++;
                            } else {
                                // Si tiene ID pero no existe, agrégala (esto puede pasar si se exportó con ID pero se borró luego)
                                await agregarVenta(venta);
                                nuevasVentas++;
                            }
                        } else {
                            // Si no tiene ID, agrégala como nueva (IndexedDB le asignará uno)
                            await agregarVenta(venta);
                            nuevasVentas++;
                        }

                        // *** IMPORTANTE: Si la importación debe afectar el stock,
                        // necesitas una lógica aquí o asegurarte que 'agregarVenta' / 'actualizarVenta'
                        // manejen el ajuste de stock.
                        // Lo más seguro es que al agregar/actualizar la venta en DB, 
                        // se dispare una función que ajuste el stock.
                        // Por ahora, asumimos que tu lógica principal de venta ya lo hace.

                    } catch (itemError) {
                        console.error("Error al procesar una venta importada:", venta, itemError);
                        errores++;
                    }
                }

                // Recargar todos los datos y la UI después de la importación masiva
                ventas = await obtenerTodasLasVentas();
                productos = await obtenerTodosLosProductos(); // Si el stock se afecta
                movimientos = await obtenerTodosLosMovimientos(); // Si se generan movimientos de stock/finanzas
                abonos = await obtenerTodosLosAbonos(); // Si las ventas de crédito tienen abonos asociados

                mostrarVentas(); // Redibuja la lista de ventas
                guardarVentas(); // Para asegurar que cualquier función relacionada con gráficos/reportes se actualice

                mostrarToast(`Importación completada: ${nuevasVentas} nuevas, ${ventasActualizadas} actualizadas, ${errores} con errores. ✨`, "success");

            } catch (parseError) {
                mostrarToast("Error al parsear el archivo JSON. Asegúrate de que sea un JSON válido. 🚫", "error");
                console.error("Error al parsear JSON:", parseError);
            }
        };
        reader.readAsText(file);
    } catch (error) {
        console.error("Error al leer el archivo:", error);
        mostrarToast("Error al leer el archivo. 🚫", "error");
    } finally {
        // Limpiar el input file después de procesar
        event.target.value = null; 
    }
}

/**
 * Descarga una plantilla JSON de ventas para guiar la importación.
 */
function descargarPlantillaJSON() {
    const plantilla = [
        {
            // 'id' es opcional, si la importación es de ventas completamente nuevas, IndexedDB lo generará.
            // Si importas ventas previamente exportadas con ID, se usarán para actualizar.
            "id": "VENTA_ABCD-1234", // Ejemplo de ID si lo manejas manualmente
            "cliente": "Nombre del Cliente",
            "productos": [
                {
                    "nombre": "Nombre del Producto",
                    "cantidad": 1,
                    "precio": 10.00, // Precio unitario de venta
                    "costo": 5.00, // Costo unitario del producto (para cálculo de ganancia)
                    "subtotal": 10.00, // Cantidad * Precio
                    "unidadMedida": "unidad" // u "kg", "litro", etc.
                }
                // Puedes agregar más productos aquí si la venta es multiproducto
            ],
            "tipoPago": "contado", // Valores posibles: "contado", "credito"
            "detallePago": {
                // Si tipoPago es "contado":
                "metodo": "efectivo" // Valores posibles: "efectivo", "transferencia", "pago_movil"
                // Si tipoPago es "credito":
                // "fechaVencimiento": "YYYY-MM-DD" // Ejemplo: "2024-12-31"
            },
            "ingreso": 10.00, // Suma de todos los subtotales de productos
            "ganancia": 5.00, // Suma de (precio - costo) * cantidad de todos los productos
            "fecha": new Date().toISOString(), // Fecha y hora de la venta en formato ISO 8601 (ej: "2024-06-27T12:30:00.000Z")
            "montoPendiente": 0, // Si tipoPago es "contado", siempre 0. Si "credito", igual a "ingreso" inicialmente.
            "estadoPago": "Pagado Total", // Valores posibles: "Pagado Total" (para contado), "Pendiente", "Pagado Parcial"
            "abonos": [] // Array de objetos de abonos si es crédito y ya tiene abonos. Ej: [{"monto": 5.00, "fecha": "2024-07-01T10:00:00.000Z"}]
        }
        // Puedes añadir más objetos de venta para ejemplos si lo consideras útil.
    ];

    const dataStr = JSON.stringify(plantilla, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "plantilla_ventas.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast("Plantilla de ventas JSON descargada ✅", "success");
}

// Función para formatear fechas en formato legible
function formatearFecha(fechaStr) {
    if (!fechaStr) return 'No establecida';
    
    try {
        // Dividir la cadena de fecha en componentes (YYYY-MM-DD)
        const [year, month, day] = fechaStr.split('-').map(num => parseInt(num, 10));
        
        // Crear la fecha correctamente (sin ajuste de zona horaria)
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            // El mes en JavaScript es base 0 (0-11), por lo que restamos 1 al mes
            const fecha = new Date(year, month - 1, day);
            
            // Formatear la fecha en el formato deseado (DD/MM/YYYY)
            return fecha.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }
        
        // Si el formato no es YYYY-MM-DD, intentar parsear normalmente
        const fecha = new Date(fechaStr);
        if (!isNaN(fecha.getTime())) {
            return fecha.toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }
        
        return fechaStr; // Si no es una fecha válida, devolver el string original
    } catch (e) {
        console.error("Error al formatear fecha:", e);
        return fechaStr; // En caso de error, devolver el string original
    }
}

// Nuevas funciones para el recibo de venta
async function mostrarRecibo(id) {
    try {
        // Obtener la venta por su ID
        const venta = await obtenerVentaPorId(id);
        
        if (!venta) {
            mostrarToast("❌ No se encontró la venta", "error");
            return;
        }
        
        // Formatear fecha actual para el recibo
        const fechaActual = new Date().toLocaleDateString('es-ES', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        });
        document.getElementById('recibo-fecha-actual').textContent = fechaActual;
        
        // Formatear fecha de venta
        let fechaVenta;
        try {
            const fechaObj = new Date(venta.fecha);
            fechaVenta = fechaObj.toLocaleDateString('es-ES', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) {
            fechaVenta = venta.fecha || "Fecha no disponible";
        }
        
        // Datos básicos de la venta
        document.getElementById('recibo-cliente').textContent = venta.cliente;
        document.getElementById('recibo-fecha-venta').textContent = fechaVenta;
        document.getElementById('recibo-num-venta').textContent = id;
        document.getElementById('recibo-tipo-pago').textContent = venta.tipoPago === 'contado' ? 'Contado' : 'Crédito';
        // Método de pago destacado y lógica de visibilidad
        const metodoPago = venta.detallePago?.metodo || 'No especificado';
        document.getElementById('recibo-metodo-pago').textContent = metodoPago;
        const metodoDetallado = venta.detallePago?.metodo || '';
        const metodoDetalladoRow = document.getElementById('recibo-metodo-detallado-row');
        const metodoDetalladoSpan = document.getElementById('recibo-metodo-pago-detalle');
        if (venta.tipoPago === 'contado') {
            // Solo mostrar método de pago, ocultar el detallado
            metodoDetalladoRow.style.display = 'none';
        } else if (venta.tipoPago === 'credito') {
            // Mostrar ambos solo si son diferentes y ambos tienen valor
            if (metodoDetallado && metodoDetallado !== metodoPago) {
                metodoDetalladoSpan.textContent = metodoDetallado;
                metodoDetalladoRow.style.display = 'block';
            } else {
                metodoDetalladoRow.style.display = 'none';
            }
        } else {
            metodoDetalladoRow.style.display = 'none';
        }
        
        // Fecha de vencimiento (solo para crédito)
        const vencimientoContainer = document.getElementById('recibo-vencimiento-container');
        if (venta.tipoPago === 'credito' && venta.detallePago?.fechaVencimiento) {
            document.getElementById('recibo-fecha-vencimiento').textContent = venta.detallePago.fechaVencimiento;
            vencimientoContainer.style.display = 'flex';
        } else {
            vencimientoContainer.style.display = 'none';
        }
        
        // Procesar productos
        const tablaProductos = document.getElementById('recibo-productos-lista');
        tablaProductos.innerHTML = '';
        
        let productosArray;
        try {
            if (Array.isArray(venta.productos)) {
                productosArray = venta.productos;
            } else if (typeof venta.productos === 'string') {
                productosArray = JSON.parse(venta.productos || '[]');
            } else {
                productosArray = [];
            }
            
            productosArray.forEach(producto => {
                const fila = document.createElement('tr');
                const precio = parseFloat(producto.precio) || 0;
                const cantidad = parseInt(producto.cantidad) || 0;
                const subtotal = precio * cantidad;
                
                fila.innerHTML = `
                    <td>${producto.nombre}</td>
                    <td>${cantidad} ${producto.unidadMedida || 'unid.'}</td>
                    <td>$${precio.toFixed(2)}</td>
                    <td>$${subtotal.toFixed(2)}</td>
                `;
                
                tablaProductos.appendChild(fila);
            });
        } catch (e) {
            console.error("Error al procesar productos para recibo:", e);
            
            // Si hay error, mostrar mensaje en tabla
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td colspan="4" style="text-align: center;">Error al cargar los productos</td>
            `;
            tablaProductos.appendChild(fila);
        }
        
        // Mostrar totales
        const total = typeof venta.ingreso === 'number' ? venta.ingreso : parseFloat(venta.ingreso) || 0;
        document.getElementById('recibo-total').textContent = `$${total.toFixed(2)}`;
        
        const montoPendienteContainer = document.getElementById('recibo-monto-pendiente-container');
        if (venta.tipoPago === 'credito' && venta.montoPendiente > 0) {
            const montoPendiente = typeof venta.montoPendiente === 'number' ? venta.montoPendiente : parseFloat(venta.montoPendiente) || 0;
            document.getElementById('recibo-monto-pendiente').textContent = `$${montoPendiente.toFixed(2)}`;
            montoPendienteContainer.style.display = 'flex';
            
            // Total a pagar (depende del estado)
            const totalFinal = venta.estadoPago === 'Pagado Total' ? 0 : montoPendiente;
            document.getElementById('recibo-total-final').textContent = `$${totalFinal.toFixed(2)}`;
        } else {
            montoPendienteContainer.style.display = 'none';
            // Si es contado o ya está pagado, el total final es el mismo total
            document.getElementById('recibo-total-final').textContent = `$${total.toFixed(2)}`;
        }
        
        // Generar código de barras
        try {
            // Crear un identificador único para el código de barras usando ID de venta y fecha
            const codigoVenta = "SS" + id + new Date().getTime().toString().slice(-6);
            
            // Guardar el valor del código de barras como atributo data
            document.getElementById("codigo-barras").setAttribute("data-value", codigoVenta);
            
            // Generar el código de barras
            JsBarcode("#codigo-barras", codigoVenta, {
                format: "CODE128",
                lineColor: "#000",
                width: 2,
                height: 50,
                displayValue: true,
                fontSize: 16,
                margin: 5
            });
        } catch (barcodeError) {
            console.error("Error al generar código de barras:", barcodeError);
        }
        
        // Mostrar espacio de firma solo si es venta a crédito
        const firmaDiv = document.getElementById('recibo-firma');
        if (venta.tipoPago === 'credito') {
            firmaDiv.style.display = 'block';
        } else {
            firmaDiv.style.display = 'none';
        }
        
        // Mostrar el modal
        document.getElementById('modalRecibo').style.display = 'flex';
        
        // Mostrar observaciones en el recibo
        const obsDiv = document.getElementById('recibo-observaciones');
        if (obsDiv) {
            if (venta.observaciones && venta.observaciones.trim() !== "") {
                obsDiv.textContent = venta.observaciones;
                obsDiv.style.display = 'block';
            } else {
                obsDiv.style.display = 'none';
            }
        }

        // Teléfono de contacto del negocio (ejemplo)
        document.getElementById('recibo-telefono').textContent = '+58 416-6963821 / 414-0872621';

        // Estado de la venta
        document.getElementById('recibo-estado').textContent = venta.estadoPago;

        // Método de pago destacado
        document.getElementById('recibo-metodo-pago-detalle').textContent = venta.detallePago?.metodo || 'No especificado';

        // Mensaje personalizado
        document.getElementById('recibo-mensaje').textContent = '¡Gracias por tu compra y preferencia!';

        // Código de venta/folio destacado
        document.getElementById('recibo-folio').textContent = id;

        // Mini resumen de abonos (solo para crédito)
        const resumenAbonosDiv = document.getElementById('recibo-resumen-abonos');
        if (venta.tipoPago === 'credito') {
            try {
                const abonos = await obtenerAbonosPorPedidoId(id);
                if (abonos && abonos.length > 0) {
                    let html = '<strong>Abonos realizados:</strong><ul style="margin:0; padding-left:18px;">';
                    abonos.forEach(a => {
                        html += `<li>${a.fechaAbono || ''}: $${a.montoAbonado.toFixed(2)} (${a.formaPago || ''})</li>`;
                    });
                    html += '</ul>';
                    resumenAbonosDiv.innerHTML = html;
                    resumenAbonosDiv.style.display = 'block';
                } else {
                    resumenAbonosDiv.style.display = 'none';
                }
            } catch (e) {
                resumenAbonosDiv.style.display = 'none';
            }
        } else {
            resumenAbonosDiv.style.display = 'none';
        }
        
    } catch (error) {
        console.error("Error al mostrar recibo:", error);
        mostrarToast("❌ Error al generar el recibo", "error");
    }
}

function cerrarModalRecibo() {
    document.getElementById('modalRecibo').style.display = 'none';
}

function imprimirRecibo() {
    const recibo = document.querySelector('.recibo-contenido').innerHTML;
    const ventanaImpresion = window.open('', '_blank');
    
    ventanaImpresion.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Recibo de Venta - Salazar</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    color: #333;
                }
                .recibo-empresa {
                    text-align: center;
                    margin-bottom: 15px;
                    border-bottom: 1px dashed #ccc;
                    padding-bottom: 10px;
                }
                .recibo-logo {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 10px;
                }
                .logo-recibo {
                    max-width: 180px;
                    height: auto;
                    margin: 0 auto 8px;
                }
                .recibo-empresa h3 {
                    font-size: 1.4em;
                    color: #d4af37;
                    margin: 0 0 5px;
                    font-weight: bold;
                }
                .recibo-productos {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                .recibo-productos th {
                    background-color: #f0e68c;
                    padding: 10px 5px;
                    text-align: left;
                    border-bottom: 1px solid #ccc;
                }
                .recibo-productos td {
                    padding: 8px 5px;
                    border-bottom: 1px solid #eee;
                }
                .recibo-cliente-info p, .recibo-detalles p {
                    margin: 5px 0;
                    display: flex;
                    justify-content: space-between;
                }
                .recibo-totales {
                    margin-top: 15px;
                    border-top: 1px dashed #ccc;
                    padding-top: 10px;
                }
                .recibo-totales p {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                    font-weight: bold;
                }
                .recibo-totales .total-final {
                    font-size: 1.2em;
                    border-top: 1px double #ccc;
                    margin-top: 10px;
                    padding-top: 10px;
                }
                .recibo-footer {
                    text-align: center;
                    font-size: 0.9em;
                    color: #666;
                    margin-top: 15px;
                    border-top: 1px dashed #ccc;
                    padding-top: 15px;
                }
                @media print {
                    body { margin: 0; }
                    button { display: none; }
                }
                .recibo-codigo-barras {
                    text-align: center;
                    margin-top: 15px;
                    padding: 10px 0;
                    border-top: 1px dashed #ccc;
                }
                .recibo-codigo-barras svg {
                    width: 100%;
                    max-height: 60px;
                }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
            ${recibo}
            <script>
                window.onload = function() {
                    // Recrear el código de barras en la ventana de impresión
                    try {
                        const codigoBarras = document.querySelector("#codigo-barras");
                        if (codigoBarras) {
                            const codigoValor = codigoBarras.getAttribute("data-value") || 
                                              "SS" + new Date().getTime().toString().slice(-8);
                            JsBarcode(codigoBarras, codigoValor, {
                                format: "CODE128",
                                lineColor: "#000",
                                width: 2,
                                height: 50,
                                displayValue: true,
                                fontSize: 16,
                                margin: 5
                            });
                        }
                    } catch (e) {
                        console.error("Error al recrear código de barras:", e);
                    }
                    
                    // Imprimir el recibo
                    window.print();
                }
            </script>
        </body>
        </html>
    `);
    
    ventanaImpresion.document.close();
}

async function guardarReciboPDF() {
    try {
        // Utilizamos las librerías jsPDF y html2canvas ya cargadas
        if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined') {
            mostrarToast("❌ Se requieren las librerías jsPDF y html2canvas", "error");
            
            // Cargar las librerías si no están disponibles
            const scriptJsPDF = document.createElement('script');
            scriptJsPDF.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            document.body.appendChild(scriptJsPDF);
            
            const scriptHtml2Canvas = document.createElement('script');
            scriptHtml2Canvas.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            document.body.appendChild(scriptHtml2Canvas);
            
            // Volver a intentar después de cargar las librerías
            setTimeout(() => {
                guardarReciboPDF();
            }, 2000);
            
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const recibo = document.querySelector('.recibo-contenido');
        const clienteNombre = document.getElementById('recibo-cliente').textContent;
        const ventaID = document.getElementById('recibo-num-venta').textContent;
        const fechaActual = new Date().toISOString().slice(0, 10);
        
        const nombreArchivo = `Recibo_${clienteNombre}_${ventaID}_${fechaActual}.pdf`;
        
        // Mostrar mensaje de carga
        mostrarToast("⏳ Generando PDF...", "info");
        
        // Asegurarse de que el código de barras está visible para la captura
        try {
            const codigoBarras = document.getElementById("codigo-barras");
            if (codigoBarras && !codigoBarras.innerHTML.trim()) {
                const codigoValor = codigoBarras.getAttribute("data-value") || 
                                  "SS" + new Date().getTime().toString().slice(-8);
                JsBarcode("#codigo-barras", codigoValor, {
                    format: "CODE128",
                    lineColor: "#000",
                    width: 2,
                    height: 50,
                    displayValue: true,
                    fontSize: 16,
                    margin: 5
                });
            }
        } catch (e) {
            console.error("Error al regenerar código de barras para PDF:", e);
        }
        
        html2canvas(recibo).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 30;
            
            // Agregar logo o título
            pdf.setFontSize(20);
            pdf.setTextColor(212, 175, 55); // Color dorado para combinar con el logo
            pdf.text('Salazar - Recibo de Venta', pdfWidth / 2, 20, { align: 'center' });
            
            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save(nombreArchivo);
            
            mostrarToast("✅ PDF generado correctamente", "success");
        }).catch(error => {
            console.error("Error al generar PDF:", error);
            mostrarToast("❌ Error al generar el PDF", "error");
        });
        
    } catch (error) {
        console.error("Error al guardar recibo como PDF:", error);
        mostrarToast("❌ Error al guardar el recibo", "error");
    }
}

// ---- Control de ordenación ----
function initSortVentas() {
  const contenedor = document.getElementById('sortVentasContainer');
  const lista = document.getElementById('listaVentas');
  if (!lista) return; // página no tiene ventas
  let wrapper = contenedor;
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'sortVentasContainer';
    wrapper.style.textAlign = 'right';
    lista.parentNode.insertBefore(wrapper, lista);
  }

  let select = document.getElementById('sortVentas');
  if (!select) {
    select = document.createElement('select');
    select.id = 'sortVentas';
    select.style.margin = '10px 0';
    sortOptionsVentas.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.key;
      option.textContent = `Ordenar por ${opt.label}`;
      select.appendChild(option);
    });
    wrapper.appendChild(select);
    // Botón asc/desc
    const btnDir = document.createElement('button');
    btnDir.id = 'btnSortDirVentas';
    btnDir.textContent = '🔽';
    btnDir.style.marginLeft = '6px';
    wrapper.appendChild(btnDir);

    select.addEventListener('change', () => {
      sortKeyVentas = select.value;
      mostrarVentas();
    });

    btnDir.addEventListener('click', () => {
      sortAscVentas = !sortAscVentas;
      btnDir.textContent = sortAscVentas ? '🔼' : '🔽';
      mostrarVentas();
    });
  }
}

// ===== Archivado =====
async function archivarVenta(id){
    try{
        const venta= ventas.find(v=>v.id===id);
        if(!venta){mostrarToast('Venta no encontrada','error');return;}
        venta.archivado=true;
        await actualizarVenta(id,venta);
        mostrarToast('Venta archivada 🗄️','success');
        mostrarVentas();
    }catch(e){console.error(e);mostrarToast('Error al archivar','error');}
}

async function restaurarVenta(id){
    try{
        const venta= ventas.find(v=>v.id===id);
        if(!venta){mostrarToast('Venta no encontrada','error');return;}
        venta.archivado=false;
        await actualizarVenta(id,venta);
        mostrarToast('Venta restaurada','success');
        mostrarVentas();
    }catch(e){console.error(e);mostrarToast('Error al restaurar','error');}
}

function toggleMostrarArchivadas(){
    mostrarArchivadas = !mostrarArchivadas;
    mostrarVentas();
}

function initArchivadoUI(){
    const lista = document.getElementById('listaVentas');
    if(!lista) return;
    let btn = document.getElementById('btnToggleArchivadas');
    if(!btn){
        btn = document.createElement('button');
        btn.id='btnToggleArchivadas';
        btn.className='btn-archivar-toggle';
        btn.style.margin='10px 6px 10px 0';
        btn.onclick=toggleMostrarArchivadas;
        lista.parentNode.insertBefore(btn, lista);
    }
    btn.textContent = mostrarArchivadas ? '📂 Ocultar archivadas' : '📂 Mostrar archivadas';

    let btnDel = document.getElementById('btnEliminarArchivadas');
    if(!btnDel){
        btnDel = document.createElement('button');
        btnDel.id='btnEliminarArchivadas';
        btnDel.className='btn-eliminar-archivadas';
        btnDel.style.margin='10px 0';
        btnDel.textContent='🗑 Eliminar archivadas';
        btnDel.onclick=eliminarVentasArchivadas;
        btn.parentNode.insertBefore(btnDel, btn.nextSibling);
    }
    btnDel.style.display = mostrarArchivadas ? '' : 'none';
}

async function eliminarVentasArchivadas(){
  const ventasArchivadas = ventas.filter(v=>v.archivado);
  if(ventasArchivadas.length===0){mostrarToast('No hay ventas archivadas','info');return;}
  const confirmar = await mostrarConfirmacion(`Se eliminarán ${ventasArchivadas.length} venta(s) archivadas. ¿Deseas continuar?`,'Eliminar archivadas');
  if(!confirmar) return;
  try{
     for(const v of ventasArchivadas){
        await eliminarVentaPermanente(v.id);
     }
     ventas = await obtenerTodasLasVentas();
     mostrarToast('Ventas archivadas eliminadas','success');
     mostrarVentas();
  }catch(e){console.error(e);mostrarToast('Error al eliminar archivadas','error');}
}
