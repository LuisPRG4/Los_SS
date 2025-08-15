let ventasCredito = []; // Solo las ventas a crédito
let clientes = [];
let abonos = []; // Para los abonos
let ventas = []; // <--- ASEGÚRATE DE QUE ESTA LÍNEA EXISTA

let currentAbonoIdEditar = null; // Para guardar el ID del abono que estamos editando en el modal
let ventaIdParaAbonoAccion = null; // Para guardar el ID de la venta a la que pertenece el abono que se está editando/revirtiendo

const btnCancelarEdicionAbono = document.getElementById("btnCancelarEdicionAbono");

// Función para actualizar las métricas del nuevo dashboard de Cuentas por Cobrar
// ✅ FUNCIÓN CORREGIDA: actualizarDashboardCxC
async function actualizarDashboardCxC() {
    let totalCuentasPorCobrar = 0;
    let ventasVencidasMonto = 0;
    let ventasPorVencerMonto = 0;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const unaSemanaDespues = new Date(hoy);
    unaSemanaDespues.setDate(hoy.getDate() + 7);
    unaSemanaDespues.setHours(23, 59, 59, 999);

    for (const venta of ventasCredito) {
        if (venta.montoPendiente > 0 && venta.detallePago && venta.detallePago.fechaVencimiento) {
            const fechaVencimiento = new Date(venta.detallePago.fechaVencimiento);
            fechaVencimiento.setHours(0, 0, 0, 0);

            totalCuentasPorCobrar += venta.montoPendiente;

            if (fechaVencimiento < hoy) {
                ventasVencidasMonto += venta.montoPendiente;
            } else if (fechaVencimiento >= hoy && fechaVencimiento <= unaSemanaDespues) {
                ventasPorVencerMonto += venta.montoPendiente;
            }
        }
    }

    // Actualizar dashboard
    const totalPendienteEl = document.getElementById("totalPendienteDashboard");
    const ventasPendientesEl = document.getElementById("ventasPendientesDashboard");
    const ventasVencidasEl = document.getElementById("ventasVencidasDashboard");
    const porVencerEl = document.getElementById("porVencerDashboard");

    totalPendienteEl.textContent = `$${totalCuentasPorCobrar.toFixed(2)}`;
    ventasPendientesEl.textContent = ventasCredito.filter(v => v.montoPendiente > 0).length.toString();
    ventasVencidasEl.textContent = `$${ventasVencidasMonto.toFixed(2)}`;
    porVencerEl.textContent = `$${ventasPorVencerMonto.toFixed(2)}`;

    // Función auxiliar para manejar el scroll y resaltado
    const scrollToAndHighlight = (ventasFiltradas) => {
        if (ventasFiltradas.length > 0) {
            const primeraVenta = ventasFiltradas[0];
            const cardId = `venta-${primeraVenta.id}`;
            const cardElement = document.getElementById(cardId);
            if (cardElement) {
                cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                cardElement.classList.add('highlight');
                setTimeout(() => {
                    cardElement.classList.remove('highlight');
                }, 2000);
            }
        }
    };



    // Event Listener para 'Cuentas Pendientes'
    ventasPendientesEl.onclick = () => {
        const ventasFiltradas = ventasCredito.filter(v => v.montoPendiente > 0);
        scrollToAndHighlight(ventasFiltradas);
    };

    // Event Listener para 'Vencidas'
    ventasVencidasEl.onclick = () => {
        const ventasFiltradas = ventasCredito.filter(venta => {
            if (venta.montoPendiente > 0 && venta.detallePago && venta.detallePago.fechaVencimiento) {
                const fechaVencimiento = new Date(venta.detallePago.fechaVencimiento);
                fechaVencimiento.setHours(0, 0, 0, 0);
                return fechaVencimiento < hoy;
            }
            return false;
        });
        scrollToAndHighlight(ventasFiltradas);
    };

    // Event Listener para 'Por Vencer'
    porVencerEl.onclick = () => {
        const ventasFiltradas = ventasCredito.filter(venta => {
            if (venta.montoPendiente > 0 && venta.detallePago && venta.detallePago.fechaVencimiento) {
                const fechaVencimiento = new Date(venta.detallePago.fechaVencimiento);
                fechaVencimiento.setHours(0, 0, 0, 0);
                return fechaVencimiento >= hoy && fechaVencimiento <= unaSemanaDespues;
            }
            return false;
        });
        scrollToAndHighlight(ventasFiltradas);
    };

}

// Números de pago
const NUMERO_VENDEDOR_PRINCIPAL = '0414-0872621'; // Cambia por el tuyo
const NUMERO_VENDEDOR_ALTERNATIVO = '0416-6963821'; // Cambia por el tuyo

// Datos fijos que aparecerán en los mensajes
const CEDULA_VENDEDOR = 'V-19.317.877'; // OTRO
const CEDULA_VENDEDOR_ALTERNATIVO = 'V-9.424.663'; //JOSE
const BANCO_VENDEDOR  = 'Banco de Venezuela';
const BANCO_VENDEDOR_ALTERNATIVO  = 'Banco de Venezuela';

let currentVentaIdAbono = null; // Para el modal de abonos
let abonoEnProceso = false;

let currentPageCuentas = 1;
const rowsPerPageCuentas = 10;

const sortOptionsCxC = [
  { key: 'fechaVencimiento', label: 'Vencimiento' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'montoPendiente', label: 'Monto pendiente' }
];
let sortKeyCxC = 'fechaVencimiento';
let sortAscCxC = true;

// Variables globales
let filtroClienteBusquedaDinamica;
let sugerenciasClientes;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await abrirDB(); // Abre la base de datos

        // Cargar todos los datos necesarios al inicio
        ventas = await obtenerTodasLasVentas();
        clientes = await obtenerTodosLosClientes();
        llenarDatalistClientes();

        // --- Lógica para el buscador dinámico y autocompletado ---
        filtroClienteBusquedaDinamica = document.getElementById('filtroClienteBusquedaDinamica');
        sugerenciasClientes = document.getElementById('sugerenciasClientes');
        const modalDetalleVenta = document.getElementById('modalDetalleVenta');
        const cerrarModalDetalleVenta = document.getElementById('cerrarModalDetalleVenta');

        let ventasCreditoOriginal = []; // Para mantener una copia de las ventas originales

        filtroClienteBusquedaDinamica.addEventListener('input', () => {
            const textoBusqueda = filtroClienteBusquedaDinamica.value.toLowerCase();
            sugerenciasClientes.innerHTML = '';

            if (textoBusqueda.length > 0) {
                const clientesFiltrados = clientes.filter(cliente =>
                    cliente.nombre.toLowerCase().includes(textoBusqueda)
                );

                clientesFiltrados.forEach(cliente => {
                    const li = document.createElement('li');
                    li.textContent = cliente.nombre;
                    li.addEventListener('click', async () => {

                        filtroClienteBusquedaDinamica.value = cliente.nombre;
                        sugerenciasClientes.innerHTML = '';
                        // Scroll automático a la tarjeta del cliente
                        // Consolidar ventas para el cliente seleccionado
                        const ventasDelCliente = ventasCredito.filter(v => v.cliente === cliente.nombre && v.montoPendiente > 0);

                        if (ventasDelCliente.length > 0) {
                            const totalPendienteCliente = ventasDelCliente.reduce((sum, v) => sum + v.montoPendiente, 0);
                            // Limpiar todas las tarjetas existentes
                            limpiarContenedorTarjetas();

                            // Crear y mostrar la tarjeta consolidada
                            const tarjetaConsolidada = crearTarjetaConsolidada(cliente.nombre, totalPendienteCliente, ventasDelCliente.length, ventasDelCliente);
                            document.getElementById('listaCuentasPorCobrar').appendChild(tarjetaConsolidada);

                            // Añadir scroll automático a la tarjeta consolidada
                            tarjetaConsolidada.scrollIntoView({ behavior: 'smooth', block: 'center' });

                            // Opcional: Deshabilitar el filtro de búsqueda hasta que se limpie
                            // filtroClienteBusquedaDinamica.disabled = true; 

                        } else {
                            mostrarToast(`No hay ventas pendientes para ${cliente.nombre}.`, 'info');
                            limpiarContenedorTarjetas(); // Limpiar si no hay ventas pendientes
                            cargarYMostrarCuentasPorCobrar(); // Volver a cargar todas las tarjetas
                        }
                    });
                    sugerenciasClientes.appendChild(li);
                });
            }
        });

        // Cerrar sugerencias al hacer clic fuera
        document.addEventListener('click', (event) => {
            if (!filtroClienteBusquedaDinamica.contains(event.target) && !sugerenciasClientes.contains(event.target)) {
                sugerenciasClientes.innerHTML = '';
            }
        });

        // Lógica para cerrar el modal de detalle de venta
        if (cerrarModalDetalleVenta) {
            cerrarModalDetalleVenta.addEventListener('click', () => {
                modalDetalleVenta.style.display = 'none';
            });
        }

        if (modalDetalleVenta) {
            modalDetalleVenta.addEventListener('click', (event) => {
                if (event.target === modalDetalleVenta) {
                    modalDetalleVenta.style.display = 'none';
                }
            });
        }
        // --- Fin de la lógica para el buscador dinámico y autocompletado ---
        abonos = await obtenerTodosLosAbonos();

        // NUEVO: Verificar y normalizar las fechas de vencimiento
        await verificarFormatosFechasVencimiento();

        // Inicializar la sección de ventas pagadas
        const seccionVentasPagadas = document.getElementById("seccionVentasPagadas");
        if (seccionVentasPagadas) {
            seccionVentasPagadas.style.display = "none";
        }

        // --- *** NUEVA LÍNEA CLAVE *** ---
        const btnEliminarHistorialPagadas = document.getElementById("btnEliminarHistorialPagadas");
        if (btnEliminarHistorialPagadas) {
            btnEliminarHistorialPagadas.style.display = "none"; // Esta línea lo oculta al inicio
        }
        // --- FIN: NUEVA LÍNEA CLAVE ---

        // --- AQUÍ ESTÁ LA LÍNEA PARA OCULTAR EL BOTÓN DE EXPORTAR AL INICIO ---
        const btnExportarHistorialPagadasPDF = document.getElementById("btnExportarHistorialPagadasPDF");
        if (btnExportarHistorialPagadasPDF) {
            btnExportarHistorialPagadasPDF.style.display = "none"; // <--- Esta es la línea
        }
        // --- FIN DE LA LÍNEA ---

        initSortCxC();

        await cargarYMostrarCuentasPorCobrar();

        // Forzar una carga inmediata
        await cargarYMostrarCuentasPorCobrar();

        if (typeof renderCalendar === 'function') {
            renderCalendar();
            // Forzar una segunda renderización después de un pequeño retraso
            // para asegurar que todos los datos estén disponibles
            setTimeout(() => {
                console.log("🔄 Forzando actualización del calendario...");
                renderCalendar();
            }, 1000);
        } else {
            console.error("Error: renderCalendar() no está definido.");
        }

        const addSafeEventListener = (elementId, event, handler) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.error(`Elemento con ID '${elementId}' no encontrado`);
            }
        };

        addSafeEventListener("btnFiltrarCuentas", "click", aplicarFiltros);
        addSafeEventListener("btnLimpiarFiltros", "click", limpiarFiltros);
        addSafeEventListener("btnToggleVentasPagadas", "click", toggleVentasPagadas); 

        addSafeEventListener("btnRegistrarAbono", "click", registrarAbono);
        addSafeEventListener("cerrarModalAbono", "click", cerrarModalAbono);

        const modalAbono = document.getElementById("modalAbono");
        if (modalAbono) {
            modalAbono.addEventListener("click", (e) => {
                if (e.target.id === "modalAbono") {
                    cerrarModalAbono();
                }
            });
        }

        const storedEditVentaId = localStorage.getItem('editVentaId');
        if (storedEditVentaId) {
            localStorage.removeItem('editVentaId');
        }
        
        // Este event listener para eliminar historial ya lo tienes, y está bien ubicado
        const btnEliminarHistorialPagadas_listener = document.getElementById("btnEliminarHistorialPagadas");
        if (btnEliminarHistorialPagadas_listener) {
            btnEliminarHistorialPagadas_listener.addEventListener("click", eliminarHistorialVentasPagadas);
        }

        // Añadir el event listener para el botón de exportar a PDF
        const btnExportarPDF = document.getElementById("btnExportarHistorialPagadasPDF");
        if (btnExportarPDF) {
            btnExportarPDF.addEventListener("click", exportarVentasPagadasPDF);
        }

    } catch (error) {
        console.error("Error en la inicialización:", error);
        mostrarToast("Error al inicializar la aplicación ❌", "error");
    }

    const selector = document.getElementById('selectorDiasUrgentes');
    if (selector) {
        // ✅ Restaurar valor guardado al cargar
        const guardado = localStorage.getItem('diasUrgentes');
        if (guardado) selector.value = guardado;

        // ✅ Guardar cambio y actualizar lista
        selector.addEventListener('change', () => {
            localStorage.setItem('diasUrgentes', selector.value);
            actualizarRankingClientesUrgentes();
        });
    }
});

function llenarDatalistClientes() {
    const datalist = document.getElementById("clientesLista");
    datalist.innerHTML = ""; // Limpiar por si ya había algo

    // Crear una lista de nombres únicos, limpios
    const nombresUnicos = [...new Set(clientes.map(c => c.nombre.trim()).filter(n => n))];

    // Insertar cada nombre como una opción en el datalist
    nombresUnicos.forEach(nombre => {
        const option = document.createElement("option");
        option.value = nombre;
        datalist.appendChild(option);
    });
}

// Función para limpiar el contenedor de tarjetas
function limpiarContenedorTarjetas() {
    const contenedor = document.getElementById('listaCuentasPorCobrar');
    if (contenedor) {
        contenedor.innerHTML = '';
    }
}

// Función para crear una tarjeta consolidada para un cliente
function crearTarjetaConsolidada(nombreCliente, totalPendiente, numVentas, ventasDelCliente) {
    // Ordenar las ventas por fecha para encontrar la primera y última
    const ventasOrdenadasPorFecha = [...ventasDelCliente].sort((a, b) => {
        const fechaA = new Date(a.fechaVenta); // Asumiendo que existe 'fechaVenta'
        const fechaB = new Date(b.fechaVenta);
        return fechaA - fechaB;
    });

    const primeraVentaFecha = ventasOrdenadasPorFecha.length > 0 ? new Date(ventasOrdenadasPorFecha[0].fechaVenta).toLocaleDateString() : 'N/A';
    const ultimaVentaFecha = ventasOrdenadasPorFecha.length > 0 ? new Date(ventasOrdenadasPorFecha[ventasOrdenadasPorFecha.length - 1].fechaVenta).toLocaleDateString() : 'N/A';


    const card = document.createElement('div');
    card.classList.add('card', 'mb-3', 'shadow-sm', 'border-primary'); // Clases de Bootstrap y personalizadas
    card.innerHTML = `
        <div class="card-body">
            <h5 class="card-title text-primary">${nombreCliente}</h5>
            <p class="card-text">Total Pendiente: <strong>$${totalPendiente.toFixed(2)} USD</strong></p>
            <p class="card-text text-muted">(${numVentas} ventas asociadas)</p>
            <p class="card-text"><small class="text-muted">Primera venta pendiente: ${primeraVentaFecha}</small></p>
            <p class="card-text"><small class="text-muted">Última venta pendiente: ${ultimaVentaFecha}</small></p>
            <div class="card-actions mt-3">
                <button class="btn btn-outline-secondary btn-sm" id="btnLimpiarFiltro">Limpiar Filtro</button>
                <button class="btn btn-primary btn-sm ms-2" id="btnVerDetalles">Ver Detalles</button>
            </div>
        </div>
    `;

    // Añadir event listener al botón de limpiar filtro
    const btnLimpiarFiltro = card.querySelector('#btnLimpiarFiltro');
    if (btnLimpiarFiltro) {
        btnLimpiarFiltro.addEventListener('click', () => {
            console.log('Intentando limpiar filtro. Valor de filtroClienteBusquedaDinamica:', filtroClienteBusquedaDinamica);
            filtroClienteBusquedaDinamica.value = ''; // Limpiar el input de búsqueda
            sugerenciasClientes.innerHTML = ''; // Limpiar las sugerencias
            cargarYMostrarCuentasPorCobrar(); // Recargar todas las cuentas
        });
    }

    const btnVerDetalles = card.querySelector('#btnVerDetalles');
    if (btnVerDetalles) {
        btnVerDetalles.addEventListener('click', () => {
            limpiarContenedorTarjetas();
            mostrarCuentasEnUI(ventasDelCliente, nombreCliente);

        });
    }

    return card;
}

async function cargarYMostrarCuentasPorCobrar() {
    try {
        // Limpiar el contenedor de cuentas
        const listaCuentas = document.getElementById("listaCuentasPorCobrar");
        if (listaCuentas) {
            listaCuentas.innerHTML = "";
        }

        // Obtener todas las ventas y filtrar solo las de crédito
        const allVentas = await obtenerTodasLasVentas();
        ventasCredito = ventas.filter(venta => venta.tipoPago === 'credito' && venta.estadoPago !== 'Pagado Total');
        abonos = await obtenerTodosLosAbonos(); // Asegurar que los abonos estén actualizados

        // Recalcular montos pendientes y estados para cada venta a crédito
        for (const venta of ventasCredito) {
            const abonosDeVenta = abonos.filter(abono => abono.pedidoId === venta.id);
            const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
            venta.montoPendiente = Math.max(0, venta.ingreso - totalAbonado); // Evitar negativos

            // Asignar estado de pago basado en el monto pendiente
            if (venta.montoPendiente === 0) {
                venta.estadoPago = 'Pagado Total';
            } else if (totalAbonado > 0 && totalAbonado < venta.ingreso) {
                venta.estadoPago = 'Pagado Parcial';
            } else {
                venta.estadoPago = 'Pendiente';
            }
            // Persistir el estado actualizado en la DB
            await actualizarVenta(venta.id, venta);
        }

        // Filtrar solo las ventas que aún tienen un monto pendiente por defecto
        const pendientesFiltradas = ventasCredito.filter(v => v.montoPendiente > 0);

        // Forzar una actualización completa de la UI
        mostrarCuentasEnUI(pendientesFiltradas);
        await actualizarEstadisticas(pendientesFiltradas);

        verificarRecordatorios(pendientesFiltradas);
        mostrarRankingMorosos(pendientesFiltradas);

        // Forzar un refresco de los eventos después de actualizar la UI
        agregarEventosHistorial();

        // Aplicar paginación después de renderizar las tarjetas
        setTimeout(() => {
            if (window.PaginacionUtils?.paginarDOM) {
                PaginacionUtils.paginarDOM('#listaCuentasPorCobrar', '.venta-credito-card', currentPageCuentas, rowsPerPageCuentas, 'paginacionCuentas', (nuevaPag) => {
                    currentPageCuentas = nuevaPag;
                });
            }
        }, 0);

    } catch (error) {
        console.error("Error al cargar y mostrar cuentas por cobrar:", error);
        mostrarToast("Error al cargar cuentas por cobrar ❌", 'error');
    }

    // >>>>> AÑADE ESTA LÍNEA AQUÍ AL FINAL DE LA FUNCIÓN <<<<<
    await actualizarDashboardCxC(); // Actualiza el nuevo dashboard después de cargar los datos
    document.getElementById("kpiBoxAntiguo").style.display = "none";
    //ACTUALIZAR LISTA DE CLIENTES MOROSOS
    await actualizarRankingClientesUrgentes(); // ¡AÑADE ESTA LÍNEA AQUÍ!
}

function mostrarCuentasEnUI(cuentasParaMostrar, clienteNombreParaVolver = null) {

    // Ordenar segun sortKeyCxC antes de filtros adicionales
    cuentasParaMostrar.sort((a,b)=>{
      let valA,valB;
      switch(sortKeyCxC){
        case 'cliente': valA=(a.cliente||'').toLowerCase(); valB=(b.cliente||'').toLowerCase(); break;
        case 'montoPendiente': valA=a.montoPendiente||0; valB=b.montoPendiente||0; break;
        case 'fechaVencimiento': default:
          valA=new Date(a.detallePago?.fechaVencimiento||'9999-12-31');
          valB=new Date(b.detallePago?.fechaVencimiento||'9999-12-31');
      }
      if (valA < valB) return sortAscCxC? -1: 1;
      if (valA > valB) return sortAscCxC? 1: -1;
      return 0;
    });

    const listaCuentas = document.getElementById("listaCuentasPorCobrar");
    listaCuentas.innerHTML = "";

    if (cuentasParaMostrar.length === 0) {
        listaCuentas.innerHTML = `<p class="mensaje-lista">No hay cuentas por cobrar pendientes que coincidan con los filtros.</p>`;
        return;
    }

    cuentasParaMostrar.forEach(venta => {
        const card = crearCardVentaCredito(venta);
        listaCuentas.appendChild(card);
    });

    agregarEventosHistorial(); // ¡Agrega los eventos a los botones!



}

//FUNCIÓN RECORDARTORIOS 25 DE JUNIO 2025
function verificarRecordatorios(pedidos) {
    // Verificar si ya se mostró el recordatorio en esta sesión
    if (sessionStorage.getItem("recordatorioMostrado") === "true") {
        return; // Si ya se mostró, no hacer nada
    }
    
    const hoy = new Date();
    const proximosAVencer = pedidos.filter(pedido => {
        const fechaVencimiento = new Date(pedido.detallePago?.fechaVencimiento);
        if (pedido.estadoPago !== "Pagado Total" && !isNaN(fechaVencimiento)) {
            const diffDias = (fechaVencimiento - hoy) / (1000 * 60 * 60 * 24);
            return diffDias >= 0 && diffDias <= 3;
        }
        return false;
    });

    if (proximosAVencer.length > 0) {
        mostrarToast(`⚠️ Tienes ${proximosAVencer.length} cliente(s) por vencer en menos de 3 días.`, "warning", 5000);
        // Marcar que ya se mostró el recordatorio en esta sesión
        sessionStorage.setItem("recordatorioMostrado", "true");
    }
}

//NUEVA A LA 1 AM (actualizada para ventas pagadas)
function agregarEventosHistorial() {
    // Para los botones de "Ventas a Crédito Pendientes"
    document.querySelectorAll('.btn-ver-historial').forEach(btn => {
        btn.removeEventListener('click', toggleHistorialPagos); // Eliminar por si ya existía
        btn.addEventListener('click', toggleHistorialPagos);
    });

    // --- NUEVA SECCIÓN: Para los botones de "Historial de Ventas Pagadas" ---
    document.querySelectorAll('.btn-ver-historial-pagada').forEach(btn => {
        btn.removeEventListener('click', toggleHistorialPagos); // Eliminar por si ya existía
        btn.addEventListener('click', toggleHistorialPagos);
    });
    // --- FIN NUEVA SECCIÓN ---
}

function crearCardVentaCredito(venta, forModal = false) {
    const card = document.createElement('div');
    card.className = 'card-venta';
    if (!forModal) {
        card.id = `venta-${venta.id}`;
    }
    const nombreCliente = venta.cliente || "Cliente desconocido";
    
    // Validación defensiva para productos
    let productosTexto = "Sin productos";
    if (venta.productos && Array.isArray(venta.productos) && venta.productos.length > 0) {
        productosTexto = venta.productos.map(p => `${p.nombre || 'Producto'} x${p.cantidad || 1}`).join(", ");
    } else if (venta.productos && typeof venta.productos === 'string') {
        // Si productos es un string, usarlo directamente
        productosTexto = venta.productos;
    }
    const fechaVencimiento = venta.detallePago?.fechaVencimiento || "Sin fecha";

    console.log('Datos de venta:', {
        id: venta.id,
        fechaVencimientoOriginal: fechaVencimiento,
        detallePago: venta.detallePago
    });

    // Formatear fecha y hora de registro
    let fechaRegistro;
    try {
        const fechaObj = new Date(venta.fecha);
        fechaRegistro = fechaObj.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).replace(',', '');
    } catch (e) {
        fechaRegistro = venta.fecha || "Fecha no disponible";
    }

    let estadoPagoHTML = '';
    let cardStatusClass = 'card-status-info';
    let textColorClass = 'text-info';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const vencimientoDate = new Date(fechaVencimiento);
    const vencimientoOnlyDate = new Date(vencimientoDate.getFullYear(), vencimientoDate.getMonth(), vencimientoDate.getDate());

    // Texto de días de mora o por vencer y nivel de riesgo
    let textoDias = '';
    let nivelRiesgo = 'Bajo';
    
    if (fechaVencimiento !== "Sin fecha") {
        // Crear fecha de vencimiento correctamente

        // ✅ Crear fechas normalizadas correctamente
        // Parsear la fecha de vencimiento como fecha local
        const fechaVencimientoParts = fechaVencimiento.split('-');
        const fechaVencimientoSinHora = new Date(parseInt(fechaVencimientoParts[0]), parseInt(fechaVencimientoParts[1]) - 1, parseInt(fechaVencimientoParts[2]));

        // Crear fecha de hoy normalizada
        const fechaHoySinHora = new Date();
        fechaHoySinHora.setHours(0, 0, 0, 0);
        
        console.log('Fechas para cálculo:', {
            fechaVencimiento: fechaVencimientoSinHora.toISOString(),
            fechaHoy: fechaHoySinHora.toISOString(),
            fechaVencimientoOriginal: fechaVencimiento
        });
        
        // Calcular la diferencia en días usando UTC para evitar problemas de zona horaria
        const diffTime = fechaVencimientoSinHora.getTime() - fechaHoySinHora.getTime();
        const diasTotales = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

                // const diasTotales = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        console.log('Cálculo de días:', {
            diferenciaMilisegundos: diffTime,
            diasTotales: diasTotales
        });
        
        // ✅ Calcular nivel de riesgo dinámico basado en días
        if (diasTotales < 0) {
            // Ya está vencida
            nivelRiesgo = 'Alto';
        } else if (diasTotales <= 2) {
            // 2 días o menos para vencer
            nivelRiesgo = 'Alto';
        } else if (diasTotales < 5) {
            // Menos de 5 días para vencer
            nivelRiesgo = 'Medio';
        } else {
            // 5 o más días para vencer
            nivelRiesgo = 'Bajo';
        }
        
        if (diasTotales < 0) {
            const diasMora = Math.abs(diasTotales);
            textoDias = `<span class="mora-text text-danger">
                ${diasMora === 1 ? 'Hace 1 día de mora' : `Hace ${diasMora} días de mora`}
            </span>`;
        } else if (diasTotales === 0) {
            textoDias = `<span class="mora-text text-warning">Vence hoy</span>`;
        } else {
            textoDias = `<span class="mora-text text-muted">
                ${diasTotales === 1 ? 'Falta 1 día' : `Faltan ${diasTotales} días`}
            </span>`;
        }
    } else {
        textoDias = `<span class="mora-text text-muted">Sin fecha de vencimiento</span>`;
    }

    // Colores y etiquetas de estado
    if (venta.montoPendiente <= 0) {
        cardStatusClass = 'card-status-success';
        textColorClass = 'text-success';
        estadoPagoHTML = `<span class="tag-status tag-success">(Pagado)</span>`;
    } else if (vencimientoOnlyDate < today) {
        cardStatusClass = 'card-status-danger';
        textColorClass = 'text-danger';
        estadoPagoHTML = `<span class="tag-status tag-danger">(Vencida)</span>`;
    } else if (vencimientoOnlyDate.getTime() - today.getTime() < (7 * 24 * 60 * 60 * 1000)) {
        cardStatusClass = 'card-status-warning';
        textColorClass = 'text-warning';
        estadoPagoHTML = `<span class="tag-status tag-warning">(Próxima a Vencer)</span>`;
    } else if (venta.estadoPago === 'Pagado Parcial') {
        cardStatusClass = 'card-status-primary';
        textColorClass = 'text-primary';
        estadoPagoHTML = `<span class="tag-status tag-primary">(Pagado Parcial)</span>`;
    } else {
        cardStatusClass = 'card-status-info';
        textColorClass = 'text-info';
        estadoPagoHTML = `<span class="tag-status tag-info">(Pendiente)</span>`;
    }

    card.className = `venta-credito-card ${cardStatusClass}`;

    card.innerHTML = `
    <div class="card-header-flex">
        <h3 class="card-title ${textColorClass}">${nombreCliente}</h3>
        <p class="riesgo-nivel">🧠 Riesgo: <strong>${nivelRiesgo}</strong></p>
        <span class="card-date">Reg: ${fechaRegistro}</span>
    </div>
    <p class="card-text"><strong>Productos:</strong> ${productosTexto}</p>
    <p class="card-text"><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
    <p class="card-text"><strong>Monto Pendiente:</strong> <span class="text-amount-danger">$${venta.montoPendiente.toFixed(2)}</span></p>
    <p class="card-text">
        <strong>Vencimiento:</strong> ${fechaVencimiento} ${estadoPagoHTML}<br>
        ${textoDias}
    </p>
    <div class="card-actions">
        ${venta.montoPendiente > 0 ?
            `<button onclick="abrirModalAbono(${venta.id})" class="btn-success">💰 Abonar</button>` :
            `<button class="btn-disabled">✅ Pagado</button>`
        }
        <button onclick="cargarVentaParaEditar(${venta.id})" class="btn-warning">✏️ Editar Venta</button>
        <button class="btn-info btn-ver-historial" data-venta-id="${venta.id}">📜 Ver Historial de Pagos</button>
    </div>
    <div class="historial-pagos" id="historial-${venta.id}" style="display:none; margin-top:10px;"></div>
    `;

    // 📱 Botón WhatsApp si el cliente tiene teléfono
    const clienteDatos = clientes.find(c => c.nombre === nombreCliente);
    if (clienteDatos?.telefono) {
        const localNum = clienteDatos.telefono.replace(/\D/g, '');
        const numeroIntl = `58${localNum}`; // Asumimos Venezuela
        // Mensaje principal
        const mensajeWhatsApp = `Buen día, estimado/a ${clienteDatos.nombre}:\n\n`+
          `Esperamos que haya quedado conforme con los productos entregados recientemente. Por este medio, le recordamos de manera respetuosa el saldo pendiente correspondiente a su crédito:\n\n`+
          `💳 Monto adeudado: $${venta.montoPendiente.toFixed(2)} USD (≈ [Monto BS] BS) Tasa de cambio aplicada: [Tasa Actual]\n\n`+
          `📌 Formas de pago disponibles: 1️⃣ Pago móvil: [Teléfono] / C.I. [Cédula] / [Banco] 2️⃣ Divisas o bolívares: Aceptados al momento de la cancelación, según disponibilidad\n\n`+
          `Saludos cordiales.`;
          
        // Mensaje alternativo (idéntico por ahora)
        const mensajeWhatsAppAlt = `Buen día, estimado/a ${clienteDatos.nombre}:\n\n`+
        `Esperamos que haya quedado conforme con los productos entregados recientemente. Por este medio, le recordamos de manera respetuosa el saldo pendiente correspondiente a su crédito:\n\n`+
        `💳 Monto adeudado: $${venta.montoPendiente.toFixed(2)} USD (≈ [Monto BS] BS) Tasa de cambio aplicada: [Tasa Actual]\n\n`+
        `📌 Formas de pago disponibles: 1️⃣ Pago móvil: [Teléfono] / C.I. [Cédula] / [Banco] 2️⃣ Divisas o bolívares: Aceptados al momento de la cancelación, según disponibilidad\n\n`+
        `Saludos cordiales.`;

        // Contenedor para el botón y el menú
        const contenedorWhatsapp = document.createElement("div");
        contenedorWhatsapp.className = "whatsapp-dropdown-container";
        contenedorWhatsapp.style.position = "relative";

        // Botón principal
        const botonDropdown = document.createElement("button");
        botonDropdown.type = "button";
        botonDropdown.className = "btn-whatsapp-dropdown";
        botonDropdown.innerHTML = "Opciones de Contacto ▼";
        contenedorWhatsapp.appendChild(botonDropdown);

        // Menú desplegable
        const menu = document.createElement("div");
        menu.className = "whatsapp-dropdown-menu";
        menu.style.display = "none";
        menu.style.position = "absolute";
        menu.style.top = "110%";
        menu.style.left = "0";
        menu.style.background = "#fff";
        menu.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
        menu.style.borderRadius = "6px";
        menu.style.zIndex = "1000";
        menu.style.minWidth = "220px";
        menu.style.padding = "6px 0";

        // Opción 1
        const opcion1 = document.createElement("button");
        opcion1.type = "button";
        opcion1.className = "whatsapp-dropdown-option";
        opcion1.innerHTML = " Contactar por WhatsApp";
        opcion1.onclick = (e) => {
            e.stopPropagation();
            menu.style.display = "none";
            abrirModalWhatsApp(venta, clienteDatos, numeroIntl, mensajeWhatsApp);
        };
        menu.appendChild(opcion1);

        // Opción 2
        const opcion2 = document.createElement("button");
        opcion2.type = "button";
        opcion2.className = "whatsapp-dropdown-option";
        opcion2.innerHTML = "Btn. José Luis";
        opcion2.onclick = (e) => {
            e.stopPropagation();
            menu.style.display = "none";
            abrirModalWhatsApp(venta, clienteDatos, numeroIntl, mensajeWhatsAppAlt, true);
        };
        menu.appendChild(opcion2);

        contenedorWhatsapp.appendChild(menu);
        card.querySelector(".card-actions").appendChild(contenedorWhatsapp);

        // Mostrar/ocultar menú
        botonDropdown.onclick = (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === "none" ? "block" : "none";
        };
        // Cerrar menú al hacer clic fuera
        document.addEventListener("click", function cerrarMenuWhatsapp(e) {
            if (!contenedorWhatsapp.contains(e.target)) {
                menu.style.display = "none";
            }
        });
    }

    return card;
}

//NUEVA A LA 1 AM
// Función para cargar y mostrar el historial de pagos de una venta
async function toggleHistorialPagos(event) {
    const btn = event.currentTarget;
    const ventaId = Number(btn.dataset.ventaId);
    const historialDiv = document.getElementById(`historial-${ventaId}`);

    if (!historialDiv) return;

    if (historialDiv.style.display === 'block') {
        // Ocultar historial
        historialDiv.style.display = 'none';
        btn.textContent = '📜 Ver Historial de Pagos';
        historialDiv.innerHTML = '';
        return;
    }

    // Mostrar historial
    btn.textContent = '❌ Ocultar Historial';

    try {
        // Obtener abonos desde IndexedDB (usamos la función que tienes)
        const abonos = await obtenerAbonosPorPedidoId(ventaId);

        if (abonos.length === 0) {
            historialDiv.innerHTML = '<p>No hay abonos registrados para esta venta.</p>';
        } else {
            // Crear listado bonito de abonos
            historialDiv.innerHTML = abonos.map(abono => {
                // Formatear método de pago legible
                let metodo = abono.formaPago || abono.metodoPago || '';
                if (metodo === 'pago_movil') metodo = 'Pago Móvil';
                else if (metodo) metodo = metodo.charAt(0).toUpperCase() + metodo.slice(1);

                return `
                    <div class="abono-item">
                        <p><strong>Fecha y Hora:</strong> ${abono.fechaAbono}</p>
                        <p><strong>Monto Abonado:</strong> $${abono.montoAbonado.toFixed(2)}</p>
                        ${metodo ? `<p><strong>Método de Pago:</strong> ${metodo}</p>` : ''}
                    </div>
                    <hr>
                `;
            }).join('');
        }
        historialDiv.style.display = 'block';
    } catch (error) {
        historialDiv.innerHTML = `<p class="text-danger">Error al cargar el historial: ${error}</p>`;
        historialDiv.style.display = 'block';
    }
}

// Abre la venta en el módulo de ventas.html para edición
function cargarVentaParaEditar(ventaId) {
    localStorage.setItem('editVentaId', ventaId);
    window.location.href = 'ventas.html';
}

async function aplicarFiltros() {
    const clienteFiltro = document.getElementById("filtroCliente").value.toLowerCase().trim();
    // Si hay coincidencia exacta en cliente, mostrar solo el resumen
    const coincidenciaExacta = clientes.some(c => c.nombre.toLowerCase() === clienteFiltro);
    if (coincidenciaExacta) {
        mostrarResumenCliente(clienteFiltro); // <-- Volvemos a llamar a esta
        return; // Ya no seguimos con el filtro normal
    }

    // ... (el resto de tu lógica de filtros si no hay coincidencia exacta) ...
    // ... Asegúrate de que cargarYMostrarCuentasPorCobrar() se llama aquí o al inicio de la función
    await cargarYMostrarCuentasPorCobrar(); // <-- Es bueno asegurarlo aquí también para los otros filtros

    let filteredCuentas = ventasCredito.filter(venta => {
        // ... (el resto de tu lógica de filtrado) ...
    });

    mostrarCuentasEnUI(filteredCuentas);
    await actualizarEstadisticas(filteredCuentas);
}

function limpiarFiltros() {
    filtroClienteBusquedaDinamica.value = "";
    sugerenciasClientes.innerHTML = "";
    document.getElementById("filtroEstado").value = ""; // Restablece al valor inicial "Todas las Pendientes"
    document.getElementById("filtroFechaVencimiento").value = "";
    cargarYMostrarCuentasPorCobrar(); // Recargar sin filtros
}

async function actualizarEstadisticas(currentFilteredVentas = null) {
    let ventasParaEstadisticas = currentFilteredVentas || ventasCredito.filter(v => v.montoPendiente > 0);

    const totalCredito = ventasParaEstadisticas.reduce((sum, v) => sum + v.ingreso, 0);
    const montoPendienteGlobal = ventasParaEstadisticas.reduce((sum, v) => sum + v.montoPendiente, 0);

    let vencidasCount = 0;
    let proximasVencerCount = 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDays = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos

    ventasParaEstadisticas.forEach(venta => {
        if (venta.montoPendiente > 0 && venta.detallePago && venta.detallePago.fechaVencimiento) {
            const vencimientoDate = new Date(venta.detallePago.fechaVencimiento);
            const vencimientoOnlyDate = new Date(vencimientoDate.getFullYear(), vencimientoDate.getMonth(), vencimientoDate.getDate());

            if (vencimientoOnlyDate < today) {
                vencidasCount++;
            } else if (vencimientoOnlyDate.getTime() - today.getTime() < sevenDays) {
                proximasVencerCount++;
            }
        }
    });

    document.getElementById("totalCredito").textContent = `$${totalCredito.toFixed(2)}`;
    document.getElementById("montoPendienteGlobal").textContent = `$${montoPendienteGlobal.toFixed(2)}`;
    document.getElementById("ventasVencidasProximas").textContent = `${vencidasCount} / ${proximasVencerCount}`;
}

// --- Funciones del Modal de Abonos ---
// (Estas asumen que tienes obtenerVentaPorId y obtenerAbonosPorPedidoId en db.js)
// Función global para poder ser llamada desde cualquier contexto (incluyendo modales y calendario)
window.abrirModalAbono = async function(ventaId) {
    console.log(`🔄 Abriendo modal de abono para venta #${ventaId}`);
    
    // Cerrar cualquier modal que esté abierto antes de mostrar este
    cerrarTodosLosModales();
    
    currentVentaIdAbono = ventaId;
    const venta = await obtenerVentaPorId(ventaId);
    
    if (!venta || venta.tipoPago !== 'credito') {
        mostrarToast("No se puede abonar a esta venta.", 'error');
        return;
    }

    // Aseguramos que el monto pendiente esté actualizado al momento de abrir el modal
    const abonosDeVenta = await obtenerAbonosPorPedidoId(ventaId);
    const totalAbonado = abonosDeVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
    const montoPendienteActualizado = venta.ingreso - totalAbonado;
    venta.montoPendiente = Math.max(0, montoPendienteActualizado);

    // Actualizar el estado de pago de la venta si es necesario y persistir
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
        <p><strong>Monto Pendiente:</strong> <span class="text-amount-danger">$${venta.montoPendiente.toFixed(2)}</span></p>
        <p><strong>Estado:</strong> ${venta.estadoPago}</p>
        <p><strong>Vencimiento:</strong> ${venta.detallePago.fechaVencimiento || 'N/A'}</p>
    `;

    document.getElementById("montoAbono").value = venta.montoPendiente.toFixed(2);
    document.getElementById("modalAbono").style.display = "flex"; // Mostrar el modal

    await mostrarAbonosPrevios(ventaId);
}

function cerrarModalAbono() {
    document.getElementById("modalAbono").style.display = "none";
    document.getElementById("montoAbono").value = ''; // Limpiar el campo de monto
    document.getElementById("formaPagoAbono").value = ''; // Limpiar el campo de forma de pago
    document.getElementById("detalleVentaModal").innerHTML = ''; // Limpiar el detalle de la venta/abono

    // ESTAS SON LAS LÍNEAS CLAVE QUE FALTABAN PARA RESTABLECER EL MODAL:
    const btnRegistrarAbono = document.getElementById("btnRegistrarAbono");
    btnRegistrarAbono.textContent = "Confirmar Abono"; // Vuelve el texto del botón a "Confirmar Abono"
    btnRegistrarAbono.onclick = registrarAbono; // Asigna de nuevo la función original para registrar abonos

    document.getElementById("listaAbonosModal").style.display = "block"; // Vuelve a mostrar la lista de abonos previos
    // Si tienes un título específico para el formulario del abono (como un <h2> con id="abonoFormTitle"), descomenta y restablece también:
    // document.getElementById("abonoFormTitle").textContent = "Registrar Abono";

    currentVentaIdAbono = null; // Limpiar el ID de la venta actual
    currentAbonoIdEditar = null; // Asegurarse de que no quede ningún abono en modo edición
    ventaIdParaAbonoAccion = null; // Limpiar el ID de la venta para la acción de abono/reversión
    
    cargarYMostrarCuentasPorCobrar(); // Recargar la lista de cuentas para que refleje los cambios
}

async function registrarAbono() {
    // Prevenir múltiples envíos
    if (abonoEnProceso) {
        console.log("Ya hay un abono en proceso, evitando duplicación");
        return;
    }
    
    // Activar el bloqueo
    abonoEnProceso = true;
    
    try {
        if (currentVentaIdAbono === null) {
            mostrarToast("No hay una venta seleccionada para abonar. 🚫", 'error');
            abonoEnProceso = false; // Liberar el bloqueo
            return;
        }

        const montoAbonoInput = document.getElementById("montoAbono").value;
        const montoAbono = parseFloat(montoAbonoInput);

        if (isNaN(montoAbono) || montoAbono <= 0) {
            mostrarToast("Ingresa un monto de abono válido. 🚫", 'warning');
            abonoEnProceso = false; // Liberar el bloqueo
            return;
        }

        const venta = await obtenerVentaPorId(currentVentaIdAbono);
        if (!venta) {
            mostrarToast("Venta no encontrada. 🚫", 'error');
            abonoEnProceso = false; // Liberar el bloqueo
            return;
        }

        // Recalcular el monto pendiente justo antes de abonar para evitar condiciones de carrera
        const abonosDeVentaActuales = await obtenerAbonosPorPedidoId(currentVentaIdAbono);
        const totalAbonadoActual = abonosDeVentaActuales.reduce((sum, abono) => sum + abono.montoAbonado, 0);
        venta.montoPendiente = Math.max(0, venta.ingreso - totalAbonadoActual);

        // --- CORRECCIÓN CLAVE: Redondear para evitar problemas de precisión con flotantes ---
        const montoAbonoRedondeado = parseFloat(montoAbono.toFixed(2));
        const montoPendienteRedondeado = parseFloat(venta.montoPendiente.toFixed(2));

        if (montoAbonoRedondeado > montoPendienteRedondeado) {
            mostrarToast(`El abono ($${montoAbonoRedondeado.toFixed(2)}) no puede ser mayor que el monto pendiente ($${montoPendienteRedondeado.toFixed(2)}). 🚫`, 'warning');
            abonoEnProceso = false; // Liberar el bloqueo
            return;
        }
        // --- FIN DE CORRECCIÓN ---

        // Obtener la forma de pago seleccionada
        const formaPago = document.getElementById("formaPagoAbono").value;

        const nuevoAbono = {
            pedidoId: currentVentaIdAbono,
            fechaAbono: getNowDateTimeFormattedLocal(),
            montoAbonado: montoAbono,
            formaPago: formaPago // Añadir la forma de pago al objeto
        };

        // Deshabilitar el botón de confirmación para evitar doble clic
        const btnConfirmar = document.getElementById("btnRegistrarAbono");
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = "Procesando...";
        btnConfirmar.style.opacity = "0.7";
        
        await agregarAbonoDB(nuevoAbono);
        mostrarToast("Abono registrado con éxito ✅", 'success');

        await actualizarDashboardCxC();

        //ACTUALIZAR LISTA DE CLIENTES MOROSOS
        await actualizarRankingClientesUrgentes();

        // Actualizar el monto pendiente y estado de pago de la venta en el modelo
        venta.montoPendiente -= montoAbono;
        if (venta.montoPendiente <= 0.01) { // Pequeña tolerancia para flotantes
            venta.montoPendiente = 0;
            venta.estadoPago = 'Pagado Total';
        } else {
            venta.estadoPago = 'Pagado Parcial';
        }
        await actualizarVenta(venta.id, venta); // Persistir el estado actualizado en la DB

        // Registrar el movimiento de ingreso por el abono
        await agregarMovimientoDB({
            tipo: "ingreso",
            monto: montoAbono,
            fecha: nuevoAbono.fechaAbono,
            descripcion: `Abono a venta a crédito de ${venta.cliente} (ID Venta: ${venta.id})`
        });

        // --- INICIO DE CAMBIOS CLAVE PARA ACTUALIZACIÓN DINÁMICA ---

        // 1. Actualizar el detalle de la venta dentro del modal con los nuevos montos
        document.getElementById("detalleVentaModal").innerHTML = `
            <p><strong>Cliente:</strong> ${venta.cliente}</p>
            <p><strong>Total Venta:</strong> $${venta.ingreso.toFixed(2)}</p>
            <p><strong>Monto Pendiente:</strong> <span class="text-amount-danger">$${venta.montoPendiente.toFixed(2)}</span></p>
            <p><strong>Estado:</strong> ${venta.estadoPago}</p>
            <p><strong>Vencimiento:</strong> ${venta.detallePago.fechaVencimiento || 'N/A'}</p>
        `;

        // 2. Recargar la lista de abonos previos en el modal
        await mostrarAbonosPrevios(currentVentaIdAbono);

        // Opcional: Reiniciar el campo de monto de abono para la siguiente entrada
        document.getElementById("montoAbono").value = venta.montoPendiente > 0 ? venta.montoPendiente.toFixed(2) : "0.00";

        // --- FIN DE CAMBIOS CLAVE ---

        if (venta.montoPendiente === 0) {
            mostrarToast("Venta a crédito completamente pagada! 🎉", 'success');
            cerrarModalAbono(); // Cerrar el modal automáticamente si ya se pagó todo
        }

        // Finalmente, recargar la vista principal de cuentas por cobrar para reflejar los cambios
        // (Esto también se encarga de recargar las variables globales ventasCredito y abonos)
        cargarYMostrarCuentasPorCobrar();
        
        // Actualizar el calendario si existe la función
        if (typeof renderCalendar === 'function') {
            renderCalendar();
        }
        
        // Restaurar el botón después de procesar todo
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = "Confirmar Abono";
        btnConfirmar.style.opacity = "1";

    } catch (error) {
        console.error("Error al registrar abono:", error);
        mostrarToast("Error al registrar abono. 😔", 'error');
        
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

async function mostrarAbonosPrevios(ventaId) {
    const listaAbonos = document.getElementById("listaAbonosModal");
    listaAbonos.innerHTML = '';
    const abonosDeVenta = await obtenerAbonosPorPedidoId(ventaId);

    if (abonosDeVenta.length === 0) {
        listaAbonos.innerHTML = '<p class="text-center text-gray-500 text-sm mt-2">No hay abonos previos registrados para esta venta.</p>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'list-style-none abonos-list'; // Nueva clase para la lista de abonos

    abonosDeVenta.sort((a, b) => new Date(a.fechaAbono) - new Date(b.fechaAbono));

    abonosDeVenta.forEach(abono => {
        const li = document.createElement('li');
        
        // Convertir método de pago para mostrar en formato legible
        let metodoPago = abono.formaPago || "No especificado";
        if (metodoPago === "pago_movil") metodoPago = "Pago Móvil";
        else if (metodoPago) metodoPago = metodoPago.charAt(0).toUpperCase() + metodoPago.slice(1);
        
        li.innerHTML = `
        <div class="abono-info">
            <p><strong>Fecha:</strong> ${abono.fechaAbono}</p>
            <p><strong>Monto:</strong> $${abono.montoAbonado.toFixed(2)}</p>
            ${metodoPago !== "No especificado" ? `<p><strong>Método:</strong> ${metodoPago}</p>` : ''}
        </div>
        <div class="abono-actions">
            <button onclick="abrirModalEditarAbono(${abono.id})" class="btn-sm btn-warning">Editar</button>
            <button onclick="confirmarRevertirAbono(${abono.id})" class="btn-sm btn-danger">Revertir</button>
        </div>
    `;
    li.className = 'abono-item'; // Asegúrate de que esta línea exista para el estilo
    ul.appendChild(li);
    });
    listaAbonos.appendChild(ul);
}

// Nota: La función mostrarToast se asume que está definida en db.js o script.js
// y que db.js se carga antes de este script.
// Función para mostrar el resumen del cliente y sus ventas detalladas
async function mostrarResumenCliente(clienteNombre) { // <--- AÑADE 'async' AQUÍ
    // Asegurarse de tener los datos más recientes antes de filtrar
    await cargarYMostrarCuentasPorCobrar(); // <--- AÑADE ESTA LÍNEA AQUÍ. Esto recarga y recalcula ventasCredito

    const ventasDelCliente = ventasCredito.filter(v => v.cliente.toLowerCase() === clienteNombre.toLowerCase());
    
    if (ventasDelCliente.length === 0) {
        mostrarToast("Este cliente no tiene cuentas por cobrar pendientes. ✅", "info");
        document.getElementById("listaCuentasPorCobrar").innerHTML = ""; // Limpia la vista completamente si no hay nada
        actualizarEstadisticas([]); // Limpia las estadísticas también
        return;
    }

    const totalPendiente = ventasDelCliente.reduce((sum, v) => sum + v.montoPendiente, 0);


    card.className = "venta-credito-card card-status-primary"; // Tarjeta azul/morado

    card.innerHTML = `
        <div class="card-header-flex">
            <h3 class="card-title text-primary">${clienteNombre}</h3>
            <span class="card-date">Ventas: ${ventasDelCliente.length}</span>
        </div>
        <p class="card-text"><strong>Total Pendiente:</strong> <span class="text-amount-danger">$${totalPendiente.toFixed(2)}</span></p>
        <p class="card-text"><strong>Última Venta:</strong> ${ventasDelCliente[ventasDelCliente.length - 1].fecha}</p>
        <div class="card-actions">
            <button class="btn-secondary btn-toggle-detalles-ventas">📄 Ver Ventas Detalladas</button>
            <button class="btn-imprimir-resumen">🧾 Exportar resumen</button>
        </div>

        <div class="ventas-individuales-container" style="display:none; margin-top:15px; padding-top:15px; border-top: 1px solid #eee;">
            <h4>Ventas Pendientes de ${clienteNombre}:</h4>
            <div id="listaVentasIndividualesCliente" class="lista-ventas-individuales">
                </div>
        </div>
    `;
    const listaCuentas = document.getElementById("listaCuentasPorCobrar");
    listaCuentas.innerHTML = ""; // Limpiar lista antes de añadir la nueva tarjeta
    listaCuentas.appendChild(card);

    actualizarEstadisticas(ventasDelCliente); // Mostrar estadísticas solo de este cliente

    // --- Lógica para el nuevo botón de "Ver Ventas Detalladas" ---
    const btnToggleVentas = card.querySelector(".btn-toggle-detalles-ventas"); // Asegúrate que el nombre de la clase es este
    const ventasIndividualesContainer = card.querySelector(".ventas-individuales-container");
    const listaVentasIndividualesDiv = card.querySelector("#listaVentasIndividualesCliente");

    btnToggleVentas.addEventListener("click", () => {
        if (ventasIndividualesContainer.style.display === "none") {
            // Mostrar las ventas individuales
            ventasIndividualesContainer.style.display = "block";
            btnToggleVentas.textContent = "👆 Ocultar Ventas Detalladas";
            
            // Limpiar y rellenar las ventas individuales usando crearCardVentaCredito
            listaVentasIndividualesDiv.innerHTML = "";
            ventasDelCliente.forEach(venta => {
                const cardVentaIndividual = crearCardVentaCredito(venta); // <--- ¡USA ESTA FUNCIÓN!
                listaVentasIndividualesDiv.appendChild(cardVentaIndividual);
            });
            agregarEventosHistorial(); // <--- AÑADE ESTA LÍNEA AQUÍ para reactivar eventos
        } else {
            // Ocultar las ventas individuales
            ventasIndividualesContainer.style.display = "none";
            btnToggleVentas.textContent = "📄 Ver Ventas Detalladas";
            listaVentasIndividualesDiv.innerHTML = ""; // Opcional: limpiar al ocultar
        }
    });

    // --- Lógica para el botón de "Exportar resumen" (ya existía) ---
    const btnImprimir = card.querySelector(".btn-imprimir-resumen");
    btnImprimir.addEventListener("click", () => {
        const contenido = `
            <html>
            <head>
                <title>Resumen de ${clienteNombre}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    h1 { color: #5b2d90; }
                    .venta-item { margin-bottom: 10px; }
                    .venta-item span { display: inline-block; min-width: 120px; }
                    .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
                    .footer { margin-top: 40px; font-size: 12px; color: #555; }
                </style>
            </head>
            <body>
                <h1>Resumen de cuenta: ${clienteNombre}</h1>
                <div class="total">Total pendiente: $${totalPendiente.toFixed(2)}</div>
                <h3>Ventas pendientes:</h3>
                <div>
                    ${ventasDelCliente.map(v => `
                    <div class="venta-item">
                            <span><strong>ID:</strong> ${v.id}</span>
                            <span><strong>Fecha:</strong> ${v.fecha}</span>
                            <span><strong>Monto:</strong> $${v.montoPendiente.toFixed(2)}</span>
                    </div>
                    `).join('')}
                </div>
                <div class="footer">
                    Generado el ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(contenido);
        doc.close();

        iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        
        // Opcional: eliminar el iframe después de imprimir
        setTimeout(() => document.body.removeChild(iframe), 1000);
        };

    });
}

function mostrarVentasDetalladas(clienteNombre) {
    const ventasDelCliente = ventasCredito.filter(v => v.cliente.toLowerCase() === clienteNombre.toLowerCase());
    mostrarCuentasEnUI(ventasDelCliente);
    actualizarEstadisticas(ventasDelCliente);
}

//RANKING DE MOROSOS
function calcularRankingMorosos(ventas) {
  const resumenClientes = {};

  ventas.forEach(venta => {
    if (!resumenClientes[venta.cliente]) {
      resumenClientes[venta.cliente] = 0;
    }
    resumenClientes[venta.cliente] += venta.montoPendiente;
  });

  const ranking = Object.entries(resumenClientes)
    .sort((a, b) => b[1] - a[1]) // Orden descendente
    .slice(0, 5); // Top 5

  return ranking; // [['Juan', 500], ['Ana', 300], ...]
}

//MOSTRAR MOROSOS
function mostrarRankingMorosos(ventas) {
  const lista = document.getElementById("listaRankingMorosos");
  if (!lista) return;

  const ranking = calcularRankingMorosos(ventas);

  if (ranking.length === 0) {
    lista.innerHTML = "<li>No hay clientes con deuda significativa.</li>";
    return;
  }

  lista.innerHTML = ranking.map(([nombre, total]) =>
    `<li><strong>${nombre}</strong>: $${total.toFixed(2)}</li>`
  ).join('');
}

// --- NUEVAS FUNCIONES PARA VENTAS PAGADAS ---

// Función para alternar la visibilidad de las ventas pagadas
// Función para alternar la visibilidad de las ventas pagadas
async function toggleVentasPagadas() {
    const seccionVentasPagadas = document.getElementById("seccionVentasPagadas");
    const btnToggle = document.getElementById("btnToggleVentasPagadas");
    const listaVentasPagadasDiv = document.getElementById("listaVentasPagadas");
    const noVentasPagadasMsg = document.getElementById("noVentasPagadasMsg");
    const btnEliminarHistorialPagadas = document.getElementById("btnEliminarHistorialPagadas");
    // --- NUEVA LÍNEA CLAVE: OBTENER EL BOTÓN DE EXPORTAR ---
    const btnExportarHistorialPagadasPDF = document.getElementById("btnExportarHistorialPagadasPDF"); 

    // Verificar que todos los elementos necesarios existen (incluyendo el nuevo botón de exportar)
    if (!seccionVentasPagadas || !btnToggle || !listaVentasPagadasDiv || !noVentasPagadasMsg || !btnEliminarHistorialPagadas || !btnExportarHistorialPagadasPDF) { 
        console.error("No se encontraron todos los elementos necesarios para mostrar/ocultar ventas pagadas o los botones de acción.");
        return;
    }

    if (seccionVentasPagadas.style.display === "none") {
        // Si está oculta, mostrarla
        seccionVentasPagadas.style.display = "block";
        btnToggle.innerHTML = '<i class="fas fa-file-invoice-slash"></i> Ocultar Facturas Pagadas';
        
        // Limpiar y cargar las ventas pagadas
        listaVentasPagadasDiv.innerHTML = '<p style="text-align: center;">Cargando facturas pagadas...</p>';
        noVentasPagadasMsg.style.display = 'none';

        // --- INICIO: Control de visibilidad de los botones (mostrar) ---
        btnEliminarHistorialPagadas.style.display = "inline-block"; 
        // --- NUEVA LÍNEA CLAVE: MOSTRAR EL BOTÓN DE EXPORTAR ---
        btnExportarHistorialPagadasPDF.style.display = "inline-block"; 
        // --- FIN: Control de visibilidad ---

        try {
            await cargarYMostrarVentasPagadas();
            seccionVentasPagadas.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            console.error("Error al cargar las ventas pagadas:", error);
            listaVentasPagadasDiv.innerHTML = '<p style="color: red;">Error al cargar las facturas pagadas. Por favor, intente de nuevo.</p>';
        }
    } else {
        // Si está visible, ocultarla
        seccionVentasPagadas.style.display = "none";
        btnToggle.innerHTML = '<i class="fas fa-file-invoice"></i> Ver Facturas Pagadas';
        listaVentasPagadasDiv.innerHTML = '';
        noVentasPagadasMsg.style.display = 'none';

        // --- INICIO: Control de visibilidad de los botones (ocultar) ---
        btnEliminarHistorialPagadas.style.display = "none";
        // --- NUEVA LÍNEA CLAVE: OCULTAR EL BOTÓN DE EXPORTAR ---
        btnExportarHistorialPagadasPDF.style.display = "none"; 
        // --- FIN: Control de visibilidad ---
    }
}

// Función para cargar y mostrar las ventas que están totalmente pagadas
async function cargarYMostrarVentasPagadas() {
    const listaVentasPagadasDiv = document.getElementById("listaVentasPagadas");
    const noVentasPagadasMsg = document.getElementById("noVentasPagadasMsg");

    listaVentasPagadasDiv.innerHTML = ''; // Limpiar antes de cargar
    noVentasPagadasMsg.style.display = 'none'; // Asegurar que esté oculto

    try {
        // Asegúrate de que 'ventas' global está actualizada (ya lo hacemos en DOMContentLoaded)
        // Si por alguna razón necesitas recargar específicamente, puedes poner:
        // ventas = await obtenerTodasLasVentas(); 

        // Filtrar solo las ventas que están 'Pagado Total'
        const ventasPagadas = ventas.filter(venta => venta.estadoPago === 'Pagado Total');

        if (ventasPagadas.length === 0) {
            noVentasPagadasMsg.style.display = 'block'; // Mostrar mensaje si no hay
            return;
        }

        // Ordenar por fecha, las más recientes primero (puedes ajustar el orden)
        ventasPagadas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        ventasPagadas.forEach(venta => {
            const card = document.createElement('div');
            card.className = "venta-pagada-card"; // Clase CSS nueva para estas tarjetas
            
            // Determinar el método de pago y su etiqueta
            let metodoPagoHTML = '';
            if (venta.tipoPago === 'contado') {
                metodoPagoHTML = `<p class="card-text">Método de pago: <strong>${venta.detallePago?.metodo || 'No especificado'}</strong></p>`;
            } else {
                metodoPagoHTML = `
                    <p class="card-text">Método de pago: 
                        <select class="metodo-pago-select" data-venta-id="${venta.id}">
                            <option value="" ${!venta.detallePago?.metodo ? 'selected' : ''}>Seleccionar método</option>
                            <option value="Efectivo" ${venta.detallePago?.metodo === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
                            <option value="Pago Móvil" ${venta.detallePago?.metodo === 'Pago Móvil' ? 'selected' : ''}>Pago Móvil</option>
                            <option value="Transferencia" ${venta.detallePago?.metodo === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
                            <option value="Mixto" ${venta.detallePago?.metodo === 'Mixto' ? 'selected' : ''}>Mixto</option>
                        </select>
                    </p>`;
            }

            card.innerHTML = `
                <div class="card-header-flex">
                    <h4 class="card-title">Factura ${venta.id} - ${venta.cliente}</h4>
                    <span class="card-date">${venta.fecha}</span>
                </div>
                <p class="card-text">Total Venta: <strong>$${venta.ingreso.toFixed(2)}</strong></p>
                <p class="card-text">Tipo de Venta: <strong>${venta.tipoPago.charAt(0).toUpperCase() + venta.tipoPago.slice(1)}</strong></p>
                ${metodoPagoHTML}
                <p class="card-text status-pagado">Estado: ${venta.estadoPago}</p>
                <div class="card-actions">
                    <button class="btn-detail btn-ver-historial-pagada" data-venta-id="${venta.id}">Ver Historial</button>
                </div>
                <div class="historial-pagos" id="historial-${venta.id}" style="display:none; margin-top:10px;"></div>
            `;
            listaVentasPagadasDiv.appendChild(card);

            // Si es venta a crédito, agregar el event listener para el select
            if (venta.tipoPago === 'credito') {
                const select = card.querySelector('.metodo-pago-select');
                select.addEventListener('change', async (e) => {
                    const nuevoMetodo = e.target.value;
                    const ventaId = parseInt(e.target.dataset.ventaId);
                    try {
                        const ventaActualizada = {...venta};
                        if (!ventaActualizada.detallePago) ventaActualizada.detallePago = {};
                        ventaActualizada.detallePago.metodo = nuevoMetodo;
                        await actualizarVenta(ventaId, ventaActualizada);
                        mostrarToast('Método de pago actualizado correctamente', 'success');
                    } catch (error) {
                        console.error('Error al actualizar el método de pago:', error);
                        mostrarToast('Error al actualizar el método de pago', 'error');
                        // Revertir la selección en caso de error
                        e.target.value = venta.detallePago?.metodo || '';
                    }
                });
            }
        });

        // Esta línea ya estaba bien ubicada y se mantiene.
        agregarEventosHistorial(); // ¡Ahora también agregamos eventos para las tarjetas pagadas!

    } catch (error) {
        console.error("Error al cargar ventas pagadas:", error);
        listaVentasPagadasDiv.innerHTML = '<p style="color: red;">Error al cargar las facturas pagadas.</p>';
    }
}

// Función de utilidad para obtener la fecha actual en formato YYYY-MM-DD (hora local)
function getTodayDateFormattedLocal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0'); // getMonth() es de 0-11
    const day = today.getDate().toString().padStart(2, '0'); // getDate() es el día del mes
    return `${year}-${month}-${day}`;
}

// === Nueva utilidad: fecha y hora local (YYYY-MM-DD HH:MM) ===
function getNowDateTimeFormattedLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 -> 12
  const hh12 = String(hours).padStart(2, '0');
  return `${y}-${m}-${d} ${hh12}:${minutes} ${ampm}`;
}

// --- INICIO: FUNCIÓN PARA ELIMINAR HISTORIAL DE VENTAS PAGADAS ---
// --- FUNCIÓN PARA ELIMINAR HISTORIAL DE VENTAS PAGADAS (¡CORREGIDA!) ---
// --- FUNCIÓN PARA "ELIMINAR" HISTORIAL DE VENTAS PAGADAS (¡CORREGIDA PARA ARCHIVAR!) ---
async function eliminarHistorialVentasPagadas() {
    // Confirmar eliminación
    const confirmar = confirm("¿Estás seguro de que deseas archivar todo el historial de ventas pagadas? Esta acción no se puede deshacer.");
    
    if (confirmar) {
        try {
            const ventasPagadas = ventas.filter(venta => 
                venta.tipoPago === 'credito' && venta.estadoPago === 'Pagado Total');
            
            for (const venta of ventasPagadas) {
                venta.archivado = true; // Marcar como archivada
                await actualizarVenta(venta.id, venta);
            }
            
            // Actualizar la vista
            mostrarToast("Historial de ventas pagadas archivado correctamente ✅", "success");
            await cargarYMostrarCuentasPorCobrar(); // Recargar todo
            
            // Ocultar sección ya que no hay nada que mostrar ahora
            const seccionVentasPagadas = document.getElementById("seccionVentasPagadas");
            if (seccionVentasPagadas) {
                seccionVentasPagadas.style.display = "none";
            }
            
            // Cambiar texto del botón toggle
            const btnToggle = document.getElementById("btnToggleVentasPagadas");
            if (btnToggle) {
                btnToggle.textContent = "Ver Facturas Pagadas";
            }
            
            // Ocultar botón de exportar
            const btnExportarHistorialPagadasPDF = document.getElementById("btnExportarHistorialPagadasPDF");
            if (btnExportarHistorialPagadasPDF) {
                btnExportarHistorialPagadasPDF.style.display = "none";
            }
            
            // Ocultar botón de archivar
            const btnEliminarHistorialPagadas = document.getElementById("btnEliminarHistorialPagadas");
            if (btnEliminarHistorialPagadas) {
                btnEliminarHistorialPagadas.style.display = "none";
            }
            
        } catch (error) {
            console.error("Error al archivar ventas pagadas:", error);
            mostrarToast("Error al archivar ventas pagadas ❌", "error");
        }
    }
}

// Función para exportar ventas pagadas a PDF
async function exportarVentasPagadasPDF() {
    try {
        const ventasPagadas = ventas.filter(venta => 
            venta.tipoPago === 'credito' && 
            venta.estadoPago === 'Pagado Total' && 
            !venta.archivado
        );

        if (ventasPagadas.length === 0) {
            mostrarToast("No hay ventas pagadas para exportar", "warning");
            return;
        }

        // Crear el PDF utilizando jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración inicial del documento
        doc.setFont("helvetica");
        doc.setFontSize(18);
        doc.text("Historial de Ventas a Crédito Pagadas", 105, 15, { align: "center" });
        
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 105, 22, { align: "center" });
        doc.setFontSize(12);
        
        // Variables para la posición
        let y = 35;
        const lineHeight = 7;
        let totalGeneral = 0;
        
        // Encabezado de la tabla
        doc.setFont("helvetica", "bold");
        doc.text("Factura", 10, y);
        doc.text("Fecha", 40, y);
        doc.text("Cliente", 70, y);
        doc.text("Monto", 150, y);
        doc.text("Fecha Pago", 180, y);
        y += lineHeight;
        
        doc.setLineWidth(0.1);
        doc.line(10, y - 2, 200, y - 2); // Línea horizontal después del encabezado
        
        doc.setFont("helvetica", "normal");
        
        // Ordenar ventas por fecha (más reciente primero)
        ventasPagadas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Agregar cada venta al PDF
        for (const venta of ventasPagadas) {
            // Verificar si necesitamos una nueva página
            if (y > 270) {
                doc.addPage();
                y = 20;
                
                // Repetir encabezados en nueva página
                doc.setFont("helvetica", "bold");
                doc.text("Factura", 10, y);
                doc.text("Fecha", 40, y);
                doc.text("Cliente", 70, y);
                doc.text("Monto", 150, y);
                doc.text("Fecha Pago", 180, y);
                y += lineHeight;
                
                doc.line(10, y - 2, 200, y - 2);
                doc.setFont("helvetica", "normal");
            }
            
            // Obtener la fecha del último abono (fecha de pago)
            const ventaAbonos = abonos.filter(abono => abono.pedidoId === venta.id);
            let fechaPago = "No disponible";
            if (ventaAbonos.length > 0) {
                // Ordenar abonos por fecha (descendente) y tomar el más reciente
                ventaAbonos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
                const ultimoAbono = ventaAbonos[0];
                const fechaObj = new Date(ultimoAbono.fecha);
                fechaPago = fechaObj.toLocaleDateString('es-ES');
            }
            
            // Formatear la fecha de la venta
            const fechaVenta = new Date(venta.fecha).toLocaleDateString('es-ES');
            
            // Formatear factura
            const factura = `Factura ${venta.id}`;
            
            // Limitar longitud del nombre del cliente
            let cliente = venta.cliente || "Cliente desconocido";
            if (cliente.length > 25) cliente = cliente.substring(0, 22) + "...";
            
            // Agregar datos a la fila
            doc.text(factura, 10, y);
            doc.text(fechaVenta, 40, y);
            doc.text(cliente, 70, y);
            doc.text(`$${venta.ingreso.toFixed(2)}`, 150, y);
            doc.text(fechaPago, 180, y);
            
            totalGeneral += venta.ingreso;
            y += lineHeight;
            
            // Línea separadora entre filas
            if (ventasPagadas.indexOf(venta) < ventasPagadas.length - 1) {
                doc.setDrawColor(200, 200, 200); // Gris claro para separadores
                doc.line(10, y - 3, 200, y - 3);
                doc.setDrawColor(0, 0, 0); // Restaurar color negro
            }
        }
        
        // Línea antes del total
        doc.setLineWidth(0.2);
        doc.line(10, y, 200, y);
        y += lineHeight;
        
        // Total general
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL:", 120, y);
        doc.text(`$${totalGeneral.toFixed(2)}`, 150, y);
        
        // Pie de página
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("Documento generado por Los SS - Sistema de Gestión", 105, 280, { align: "center" });
        
        // Guardar el PDF
        doc.save(`Historial_Ventas_Pagadas_${getTodayDateFormattedLocal()}.pdf`);
        
        mostrarToast("PDF exportado correctamente ✅", "success");
    } catch (error) {
        console.error("Error al exportar PDF:", error);
        mostrarToast("Error al exportar PDF ❌", "error");
    }
}
// --- FIN: FUNCIÓN PARA "ELIMINAR" HISTORIAL DE VENTAS PAGADAS ---

// --- NUEVA FUNCIÓN PARA MODAL DE DETALLE COMPLETO DE UNA VENTA ---
// Esta función es global para poder ser llamada desde el calendario
window.mostrarDetalleVentaModal = async function(ventaId) {
    try {
        const venta = await obtenerVentaPorId(Number(ventaId));
        if (!venta) {
            mostrarToast("No se pudo encontrar la venta solicitada.", "error");
            return;
        }

        // Verificar si ya existe un modal para detalles, si no, crearlo
        let modalDetalle = document.getElementById('modalDetalleVenta');
        if (!modalDetalle) {
            modalDetalle = document.createElement('div');
            modalDetalle.id = 'modalDetalleVenta';
            modalDetalle.className = 'modal-overlay';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content modal-detalle-venta';
            
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2>📋 Detalle de Venta</h2>
                    <span class="close-button" id="cerrarModalDetalle">&times;</span>
                </div>
                <div class="modal-body" id="detalleVentaCompleto">
                </div>
                <div class="modal-footer">
                    <button id="btnAbonarDesdeDetalle" class="btn-primary">💰 Abonar</button>
                    <button id="btnCerrarDetalle" class="btn-secondary">Cerrar</button>
                </div>
            `;
            
            modalDetalle.appendChild(modalContent);
            document.body.appendChild(modalDetalle);
            
            // Event listeners para cerrar el modal
            document.getElementById('cerrarModalDetalle').addEventListener('click', () => {
                modalDetalle.style.display = 'none';
            });
            
            document.getElementById('btnCerrarDetalle').addEventListener('click', () => {
                modalDetalle.style.display = 'none';
            });
            
            // Cerrar el modal al hacer clic fuera del contenido
            modalDetalle.addEventListener('click', (e) => {
                if (e.target === modalDetalle) {
                    modalDetalle.style.display = 'none';
                }
            });
        }
        
        // Configurar el botón de abonar para que abra el modal de abonos
        const btnAbonarDesdeDetalle = document.getElementById('btnAbonarDesdeDetalle');
        btnAbonarDesdeDetalle.onclick = () => {
            // Ocultar este modal antes de abrir el de abonos
            modalDetalle.style.display = 'none';
            
            // Cerrar también el modal de ventas del calendario si está abierto
            const modalVentasCalendario = document.getElementById('modalVentasCalendario');
            if (modalVentasCalendario) {
                modalVentasCalendario.style.display = 'none';
            }
            
            // Ahora sí, abrir el modal de abonos
            setTimeout(() => {
                // Usar la función global abrirModalAbono para asegurar que funcione
                window.abrirModalAbono(ventaId);
            }, 100); // Pequeño retraso para evitar problemas de UI
        };
        
        // Llenar el modal con los detalles de la venta
        const detalleDiv = document.getElementById('detalleVentaCompleto');
        
        // Calcular días de mora si aplica
        let estadoMora = '';
        if (venta.detallePago && venta.detallePago.fechaVencimiento) {
            const fechaVenc = new Date(venta.detallePago.fechaVencimiento);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            fechaVenc.setHours(0, 0, 0, 0);
            
            const diasDiferencia = Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24));
            
            if (diasDiferencia > 0 && venta.montoPendiente > 0) {
                estadoMora = `<span class="badge badge-danger">En mora: ${diasDiferencia} día(s)</span>`;
            } else if (diasDiferencia === 0 && venta.montoPendiente > 0) {
                estadoMora = '<span class="badge badge-warning">Vence hoy</span>';
            } else if (venta.montoPendiente > 0) {
                estadoMora = `<span class="badge badge-info">Quedan ${Math.abs(diasDiferencia)} día(s)</span>`;
            } else {
                estadoMora = '<span class="badge badge-success">Pagado</span>';
            }
        }
        
        // Obtener el historial de abonos
        const abonosVenta = await obtenerAbonosPorPedidoId(ventaId);
        const totalAbonado = abonosVenta.reduce((sum, abono) => sum + abono.montoAbonado, 0);
        
        // Encontrar datos del cliente
        const clienteData = clientes.find(c => c.nombre === venta.cliente) || {};
        
        // Crear tabla HTML con productos de la venta
        let productosHTML = '<table class="tabla-productos-detalle"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>';
        
        venta.productos.forEach(producto => {
            const subtotal = producto.precio * producto.cantidad;
            productosHTML += `
                <tr>
                    <td>${producto.nombre}</td>
                    <td>${producto.cantidad}</td>
                    <td>$${producto.precio.toFixed(2)}</td>
                    <td>$${subtotal.toFixed(2)}</td>
                </tr>
            `;
        });
        
        productosHTML += '</tbody></table>';
        
        // Crear tabla HTML con abonos
        let abonosHTML = '<table class="tabla-abonos-detalle"><thead><tr><th>Fecha</th><th>Monto</th><th>Método</th></tr></thead><tbody>';
        
        if (abonosVenta.length === 0) {
            abonosHTML += '<tr><td colspan="3" class="text-center">No hay abonos registrados</td></tr>';
        } else {
            abonosVenta.forEach(abono => {
                let metodoPago = abono.formaPago || "No especificado";
                if (metodoPago === "pago_movil") metodoPago = "Pago Móvil";
                else if (metodoPago) metodoPago = metodoPago.charAt(0).toUpperCase() + metodoPago.slice(1);
                
                abonosHTML += `
                    <tr>
                        <td>${abono.fechaAbono}</td>
                        <td>$${abono.montoAbonado.toFixed(2)}</td>
                        <td>${metodoPago}</td>
                    </tr>
                `;
            });
        }
        
        abonosHTML += '</tbody></table>';
        
        // Insertar todo el contenido en el modal
        detalleDiv.innerHTML = `
            <div class="detalle-venta-grid">
                <div class="detalle-venta-seccion">
                    <h3>Información General</h3>
                    <div class="detalle-item">
                        <strong>Factura #:</strong> ${venta.id}
                    </div>
                    <div class="detalle-item">
                        <strong>Fecha:</strong> ${venta.fecha}
                    </div>
                    <div class="detalle-item">
                        <strong>Cliente:</strong> ${venta.cliente}
                        ${clienteData.telefono ? (() => {
                            const localNum = clienteData.telefono.replace(/\D/g, '');
                            const numeroIntl = `58${localNum}`; // Asumimos Venezuela
                            
                            // Crear contenedor para el dropdown de WhatsApp
                            return `
                                <div class="whatsapp-dropdown-container-detalle" style="position: relative; display: inline-block; margin-left: 10px;">
                                    <button type="button" class="btn-whatsapp-dropdown-detalle" style="
                                        background: #25D366;
                                        color: white;
                                        border: none;
                                        padding: 8px 12px;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-size: 14px;
                                        display: inline-flex;
                                        align-items: center;
                                        gap: 6px;
                                    ">
                                        <i class="fab fa-whatsapp"></i> Contactar ▼
                                    </button>
                                    <div class="whatsapp-dropdown-menu-detalle" style="
                                        display: none;
                                        position: absolute;
                                        top: 110%;
                                        left: 0;
                                        background: #fff;
                                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                                        border-radius: 6px;
                                        z-index: 1000;
                                        min-width: 220px;
                                        padding: 6px 0;
                                        border: 1px solid #ddd;
                                    ">
                                        <button type="button" class="whatsapp-dropdown-option-detalle" data-tipo="principal" style="
                                            width: 100%;
                                            padding: 10px 15px;
                                            border: none;
                                            background: none;
                                            text-align: left;
                                            cursor: pointer;
                                            font-size: 14px;
                                            color: #333;
                                            display: flex;
                                            align-items: center;
                                            gap: 8px;
                                        ">
                                            <i class="fab fa-whatsapp" style="color: #25D366;"></i> Contactar por WhatsApp
                                        </button>
                                        <button type="button" class="whatsapp-dropdown-option-detalle" data-tipo="alternativo" style="
                                            width: 100%;
                                            padding: 10px 15px;
                                            border: none;
                                            background: none;
                                            text-align: left;
                                            cursor: pointer;
                                            font-size: 14px;
                                            color: #333;
                                            display: flex;
                                            align-items: center;
                                            gap: 8px;
                                        ">
                                            <i class="fab fa-whatsapp" style="color: #25D366;"></i> Btn. José Luis
                                        </button>
                                    </div>
                                </div>
                            `;
                        })() : ''}
                    </div>
                    <div class="detalle-item">
                        <strong>Tipo de Pago:</strong> ${venta.tipoPago.charAt(0).toUpperCase() + venta.tipoPago.slice(1)}
                    </div>
                    <div class="detalle-item estado-pago">
                        <strong>Estado:</strong> ${venta.estadoPago} ${estadoMora}
                    </div>
                    <div class="detalle-item">
                        <strong>Vencimiento:</strong> ${venta.detallePago?.fechaVencimiento || 'No aplica'}
                    </div>
                </div>

                <div class="detalle-venta-seccion">
                    <h3>Resumen Financiero</h3>
                    <div class="detalle-item">
                        <strong>Total Venta:</strong> <span class="monto-total">$${venta.ingreso.toFixed(2)}</span>
                    </div>
                    <div class="detalle-item">
                        <strong>Total Abonado:</strong> <span class="monto-abonado">$${totalAbonado.toFixed(2)}</span>
                    </div>
                    <div class="detalle-item">
                        <strong>Pendiente:</strong> <span class="monto-pendiente">$${venta.montoPendiente.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="detalle-venta-seccion">
                <h3>Productos</h3>
                ${productosHTML}
            </div>

            <div class="detalle-venta-seccion">
                <h3>Historial de Abonos</h3>
                ${abonosHTML}
            </div>
        `;
        
        // Si la venta está pagada totalmente, ocultar el botón de abonar
        if (venta.montoPendiente <= 0) {
            btnAbonarDesdeDetalle.style.display = 'none';
        } else {
            btnAbonarDesdeDetalle.style.display = 'inline-block';
        }
        
        // Agregar event listeners para el dropdown de WhatsApp en el modal de detalle
        const btnDropdownDetalle = modalDetalle.querySelector('.btn-whatsapp-dropdown-detalle');
        const menuDropdownDetalle = modalDetalle.querySelector('.whatsapp-dropdown-menu-detalle');
        const opcionesDropdownDetalle = modalDetalle.querySelectorAll('.whatsapp-dropdown-option-detalle');
        
        if (btnDropdownDetalle && menuDropdownDetalle) {
            // Agregar estilos de hover a las opciones
            opcionesDropdownDetalle.forEach(opcion => {
                opcion.addEventListener('mouseenter', () => {
                    opcion.style.backgroundColor = '#f5f5f5';
                });
                opcion.addEventListener('mouseleave', () => {
                    opcion.style.backgroundColor = 'transparent';
                });
                
                // Agregar funcionalidad de clic
                opcion.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menuDropdownDetalle.style.display = 'none';
                    
                    const tipo = opcion.getAttribute('data-tipo');
                    const localNum = clienteData.telefono.replace(/\D/g, '');
                    const numeroIntl = `58${localNum}`;
                    
                    // Crear mensajes usando las funciones existentes
                    const mensajePrincipal = construirMensajePrincipal(venta, clienteData, 0);
                    const mensajeAlternativo = construirMensajeAlternativo(venta, clienteData, 0);
                    
                    if (tipo === 'principal') {
                        abrirModalWhatsApp(venta, clienteData, numeroIntl, mensajePrincipal, false);
                    } else if (tipo === 'alternativo') {
                        abrirModalWhatsApp(venta, clienteData, numeroIntl, mensajeAlternativo, true);
                    }
                });
            });
            
            // Mostrar/ocultar menú al hacer clic en el botón
            btnDropdownDetalle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = menuDropdownDetalle.style.display === 'block';
                menuDropdownDetalle.style.display = isVisible ? 'none' : 'block';
            });
            
            // Cerrar menú al hacer clic fuera
            document.addEventListener('click', function cerrarMenuWhatsappDetalle(e) {
                if (!modalDetalle.querySelector('.whatsapp-dropdown-container-detalle').contains(e.target)) {
                    menuDropdownDetalle.style.display = 'none';
                }
            });
        }
        
        // Mostrar el modal
        modalDetalle.style.display = 'flex';
        
    } catch (error) {
        console.error("Error al mostrar detalle de venta:", error);
        mostrarToast("Error al cargar los detalles de la venta.", "error");
    }
}

// Función para verificar y normalizar las fechas de vencimiento de todas las ventas
async function verificarFormatosFechasVencimiento() {
    try {
        console.log("🔍 Verificando formatos de fechas de vencimiento...");
        let contadorCorregidas = 0;
        
        // Iterar por todas las ventas a crédito
        for (const venta of ventas) {
            if (venta.tipoPago === 'credito' && venta.detallePago && venta.detallePago.fechaVencimiento) {
                let fechaOriginal = venta.detallePago.fechaVencimiento;
                let necesitaCorreccion = false;
                
                // Si la fecha tiene barras en lugar de guiones
                if (fechaOriginal.includes('/')) {
                    venta.detallePago.fechaVencimiento = fechaOriginal.replace(/\//g, '-');
                    necesitaCorreccion = true;
                }
                
                // Si la fecha no está en formato ISO (YYYY-MM-DD)
                if (!/^\d{4}-\d{2}-\d{2}/.test(venta.detallePago.fechaVencimiento)) {
                    try {
                        // Intentar convertir cualquier formato de fecha válido a ISO
                        const fecha = new Date(venta.detallePago.fechaVencimiento);
                        if (!isNaN(fecha)) {
                            venta.detallePago.fechaVencimiento = fecha.toISOString().split('T')[0];
                            necesitaCorreccion = true;
                        }
                    } catch (e) {
                        console.error(`Error al convertir fecha para venta #${venta.id}:`, e);
                    }
                }
                
                // Si se realizó alguna corrección, actualizar la venta en la base de datos
                if (necesitaCorreccion) {
                    console.log(`✅ Corrigiendo formato de fecha para venta #${venta.id}: ${fechaOriginal} → ${venta.detallePago.fechaVencimiento}`);
                    await actualizarVenta(venta.id, venta);
                    contadorCorregidas++;
                }
            }
        }
        
        console.log(`🔄 Proceso de verificación completado. ${contadorCorregidas} fechas corregidas.`);
        
        // Si se corrigieron fechas, recargar las ventas
        if (contadorCorregidas > 0) {
            ventas = await obtenerTodasLasVentas();
            console.log("🔄 Datos de ventas actualizados con fechas normalizadas");
        }
    } catch (error) {
        console.error("❌ Error al verificar formatos de fechas:", error);
    }
}

// Función para diagnosticar y solucionar problemas con el calendario
// Se puede ejecutar desde la consola del navegador con diagnosticarCalendario()
window.diagnosticarCalendario = async function() {
    console.log("🔍 INICIANDO DIAGNÓSTICO DEL CALENDARIO");
    
    // 1. Verificar si hay ventas a crédito con fecha de vencimiento
    const todasLasVentas = await obtenerTodasLasVentas();
    console.log(`📊 Total de ventas: ${todasLasVentas.length}`);
    
    const ventasCredito = todasLasVentas.filter(v => v.tipoPago === 'credito');
    console.log(`💳 Ventas a crédito: ${ventasCredito.length}`);
    
    const ventasPendientes = ventasCredito.filter(v => v.montoPendiente > 0);
    console.log(`⏳ Ventas a crédito pendientes: ${ventasPendientes.length}`);
    
    const ventasConFechaVencimiento = ventasPendientes.filter(v => v.detallePago && v.detallePago.fechaVencimiento);
    console.log(`📅 Ventas con fecha de vencimiento: ${ventasConFechaVencimiento.length}`);
    
    if (ventasConFechaVencimiento.length === 0) {
        console.error("❌ No hay ventas con fecha de vencimiento. Añade una fecha de vencimiento a tus ventas a crédito.");
    } else {
        console.log("✅ Hay ventas con fecha de vencimiento.");
        
        // 2. Verificar el formato de las fechas de vencimiento
        let formatosIncorrectos = 0;
        
        ventasConFechaVencimiento.forEach(venta => {
            const fechaVenc = venta.detallePago.fechaVencimiento;
            console.log(`Venta #${venta.id} - Fecha: ${fechaVenc}`);
            
            if (fechaVenc.includes('/')) {
                console.warn(`⚠️ La venta #${venta.id} tiene barras en la fecha: ${fechaVenc}`);
                formatosIncorrectos++;
            }
            
            if (!/^\d{4}[-/]\d{2}[-/]\d{2}/.test(fechaVenc)) {
                console.warn(`⚠️ La venta #${venta.id} tiene un formato de fecha no estándar: ${fechaVenc}`);
                formatosIncorrectos++;
            }
        });
        
        if (formatosIncorrectos > 0) {
            console.warn(`⚠️ Se encontraron ${formatosIncorrectos} fechas con posibles problemas de formato.`);
            console.log("🔧 Ejecutando corrección de formatos de fecha...");
            await verificarFormatosFechasVencimiento();
        } else {
            console.log("✅ Todas las fechas tienen un formato correcto.");
        }
    }
    
    // 3. Verificar si el calendario está cargando las ventas correctamente
    console.log("🔄 Forzando recarga del calendario...");
    if (typeof cargarVentasPendientesPorFecha === 'function') {
        await cargarVentasPendientesPorFecha();
        console.log("✅ Función de carga de ventas ejecutada.");
    } else {
        console.error("❌ La función cargarVentasPendientesPorFecha no está disponible.");
    }
    
    // 4. Forzar renderización del calendario
    if (typeof renderCalendar === 'function') {
        renderCalendar();
        console.log("✅ Calendario renderizado. Verifica si aparecen los marcadores en las fechas correctas.");
    } else {
        console.error("❌ La función renderCalendar no está disponible.");
    }
    
    console.log("🏁 DIAGNÓSTICO COMPLETADO");
    
    // Instrucciones para el usuario
    console.log("\n📌 INSTRUCCIONES:");
    console.log("1. Si no ves marcadores en el calendario, verifica que tus ventas a crédito tengan:");
    console.log("   - Monto pendiente mayor a 0");
    console.log("   - Campo detallePago.fechaVencimiento con formato YYYY-MM-DD");
    console.log("2. Si el problema persiste, prueba recargar la página.");
    console.log("3. Para editar una venta y corregir manualmente su fecha, usa el botón 'Editar Venta' en la tarjeta de la venta.");
}

// Función auxiliar para cerrar todos los modales abiertos
function cerrarTodosLosModales() {
    // Lista de IDs de todos los modales que usamos
    const idsModales = ['modalAbono', 'modalDetalleVenta', 'modalVentasCalendario'];
    
    idsModales.forEach(idModal => {
        const modal = document.getElementById(idModal);
        if (modal) {
            modal.style.display = 'none';
        }
    });
}

function initSortCxC(){
  const lista = document.getElementById('listaCuentasPorCobrar');
  if(!lista) return;
  let wrapper=document.getElementById('sortCxCContainer');
  if(!wrapper){
    wrapper=document.createElement('div');
    wrapper.id='sortCxCContainer';
    wrapper.style.textAlign='right';
    lista.parentNode.insertBefore(wrapper, lista);
  }
  let select=document.getElementById('sortCxC');
  if(!select){
    select=document.createElement('select');
    select.id='sortCxC';
    select.style.margin='10px 0';
    sortOptionsCxC.forEach(opt=>{
      const option=document.createElement('option');
      option.value=opt.key;
      option.textContent=`Ordenar por ${opt.label}`;
      select.appendChild(option);
    });
    wrapper.appendChild(select);
    const btnDir=document.createElement('button');
    btnDir.id='btnSortDirCxC';
    btnDir.textContent='🔽';
    btnDir.style.marginLeft='6px';
    wrapper.appendChild(btnDir);
    select.addEventListener('change',()=>{sortKeyCxC=select.value;cargarYMostrarCuentasPorCobrar();});
    btnDir.addEventListener('click',()=>{sortAscCxC=!sortAscCxC;btnDir.textContent=sortAscCxC?'🔼':'🔽';cargarYMostrarCuentasPorCobrar();});
  }
}

// === Utilidad para generar enlaces de WhatsApp ===
function generarEnlaceWhatsApp(numeroRaw, mensajeRaw = '') {
  const numero = String(numeroRaw).replace(/\\D/g, ''); // Solo dígitos con código país incluido
  const mensaje = mensajeRaw ? encodeURIComponent(mensajeRaw) : '';
  const isMobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  if (isMobile) {
    return `https://wa.me/${numero}${mensaje ? `?text=${mensaje}` : ''}`;
  }
  return `https://web.whatsapp.com/send?phone=${numero}${mensaje ? `&text=${mensaje}` : ''}`;
}

// === MODAL PARA WHATSAPP ===
// Función global para abrir el modal de edición y envío de WhatsApp
window.abrirModalWhatsApp = function(venta, clienteDatos, numeroIntl, mensajePrincipal, esAlternativo = false){
  // Crear modal si aún no existe
  let modal = document.getElementById('modalWhatsApp');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'modalWhatsApp';
    modal.className = 'modal-overlay';
    // === Inyectar CSS responsivo (solo una vez) ===
    if(!document.getElementById('whModalStyles')){
      const styleTag = document.createElement('style');
      styleTag.id = 'whModalStyles';
      styleTag.textContent = `
        #modalWhatsApp .modal-content{max-width:95%;width:95%;}
      `;
      document.head.appendChild(styleTag);
    }
    modal.innerHTML = `
      <div class="modal-content whatsapp-modal">
        <div class="modal-header">
          <h2>Edición de WhatsApp</h2>
          <span id="cerrarModalWhatsApp" class="close-button">&times;</span>
        </div>

        <div class="modal-body">
          <label style="display:block; margin-bottom:8px;">Tasa BCV (Bs/USD):
            <input type="number" id="whTasaInput" step="0.0001" style="width:120px; margin-left:6px;" />
          </label>
          <textarea id="whMessageText" rows="10" style="width:100%; resize:vertical;"></textarea>
        </div>

        <div class="modal-footer">
          <button id="btnEnviarWhatsApp" class="btn-success">Enviar por WhatsApp</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    // Cerrar modal al hacer clic en X o fuera del contenido
    modal.addEventListener('click', (e)=>{
      if(e.target.id==='cerrarModalWhatsApp'|| e.target===modal){
        modal.style.display='none';
      }
    });
  }

  // Preparar mensaje
  const tasaInput = modal.querySelector('#whTasaInput');
  const txtArea   = modal.querySelector('#whMessageText');
  const btnEnviar = modal.querySelector('#btnEnviarWhatsApp');

  // Obtener tasa guardada o valor por defecto
  const storedTasa = parseFloat(localStorage.getItem('tasaBCV')) || 0;
  const tasaInicial = storedTasa>0? storedTasa : 0;
  tasaInput.value = tasaInicial;

  const mensajeFunc = esAlternativo ? construirMensajeAlternativo : construirMensajePrincipal;

  // Rellenar mensaje inicial
  txtArea.value = mensajeFunc(venta, clienteDatos, tasaInicial);

  // Actualizar mensaje al cambiar la tasa
  const updateMessage = () => {
    const nuevaTasa = parseFloat(tasaInput.value) || 0;
    txtArea.value = mensajeFunc(venta, clienteDatos, nuevaTasa);
  };
  
  tasaInput.oninput = updateMessage;

  // Acción enviar
  btnEnviar.onclick = ()=>{
    const tasaUsada = parseFloat(tasaInput.value)||0;
    // guardar tasa en localStorage para próximos usos
    if(tasaUsada>0){
      localStorage.setItem('tasaBCV', tasaUsada.toString());
    }
    const mensajeFinal = txtArea.value;
    const enlaceEnvio = generarEnlaceWhatsApp(numeroIntl, mensajeFinal);
    window.open(enlaceEnvio, '_blank');
    modal.style.display = 'none';
  };

  // Mostrar modal
  modal.style.display='flex';
};

// Delegación global para enlaces de WhatsApp dentro de modales/detalles
document.body.addEventListener('click', (e)=>{
  const link = e.target.closest('.btn-link-whatsapp');
  if(link){
    e.preventDefault();
    const ventaId = Number(link.dataset.ventaId);
    const numeroIntl = link.dataset.numeroIntl;
    const venta = ventas.find(v=>v.id===ventaId);
    if(!venta) return;
    const clienteDatos = clientes.find(c=>c.nombre===venta.cliente) || {nombre: venta.cliente};
    abrirModalWhatsApp(venta, clienteDatos, numeroIntl);
  }
}, false);


//FUNCIONES PARA EDITAR Y REVERTIR ABONOS
// Función para abrir el modal en modo edición
window.abrirModalEditarAbono = async function(abonoId) {
    console.log(`🔄 Abriendo modal para editar abono #${abonoId}`);
    currentAbonoIdEditar = abonoId; // Guardamos el ID del abono que vamos a editar

    // Obtenemos los datos del abono desde la base de datos
    const abono = await obtenerAbonoPorId(abonoId); 
    if (!abono) {
        mostrarToast("Abono no encontrado para editar. 🚫", 'error');
        return;
    }

    // Guardamos el ID de la venta a la que pertenece este abono
    ventaIdParaAbonoAccion = abono.pedidoId; 

    // Rellenamos la información de detalle de la venta en el modal para que el usuario sepa qué está editando
    document.getElementById("detalleVentaModal").innerHTML = `
        <p><strong>Editando Abono ID:</strong> ${abono.id}</p>
        <p><strong>Fecha de Abono Original:</strong> ${abono.fechaAbono}</p>
        <p><strong>Venta Asociada ID:</strong> ${abono.pedidoId}</p>
    `;

    // Rellenamos los campos de monto y forma de pago con los datos del abono
    document.getElementById("montoAbono").value = abono.montoAbonado.toFixed(2);
    document.getElementById("formaPagoAbono").value = abono.formaPago || ''; 

    // Cambiamos el texto del botón principal del modal para que diga "Guardar Edición"
    const btnRegistrarAbono = document.getElementById("btnRegistrarAbono");
    btnRegistrarAbono.textContent = "Guardar Edición de Abono";
    btnRegistrarAbono.onclick = guardarEdicionAbono; // Y le asignamos la función para guardar la edición

    // >>>>> AQUÍ ESTÁN LAS NUEVAS LÍNEAS QUE DEBES AÑADIR/MODIFICAR <<<<<

    // Mostrar el nuevo botón de "Cancelar Edición" y asignarle su función
    const btnCancelarEdicionAbono = document.getElementById("btnCancelarEdicionAbono"); // Asegúrate de haber añadido este id al botón en el HTML
    if (btnCancelarEdicionAbono) { // Asegurarse de que el botón existe en el HTML
        btnCancelarEdicionAbono.style.display = "inline-block"; // Lo hacemos visible
        btnCancelarEdicionAbono.onclick = cancelarEdicionAbono; // Le asignamos la nueva función de cancelar
    }

    // >>>>> FIN DE LAS NUEVAS LÍNEAS <<<<<

    // Mostramos el modal y ocultamos la lista de abonos previos (porque estamos editando uno)
    document.getElementById("modalAbono").style.display = "flex"; 
    document.getElementById("listaAbonosModal").style.display = "none"; 
    // Si tienes un título específico para el formulario del abono (por ejemplo, <h2 id="abonoFormTitle">), cámbialo aquí también:
    // document.getElementById("abonoFormTitle").textContent = "Editar Abono"; 
};

//FUNCIÓN CANCELAR EDICIÓN ABONO
async function cancelarEdicionAbono() {
    console.log("🚫 Cancelando edición de abono. Volviendo a modo de registro.");

    // 1. Restaurar el botón principal a su estado original
    const btnRegistrarAbono = document.getElementById("btnRegistrarAbono");
    btnRegistrarAbono.textContent = "Confirmar Abono";
    btnRegistrarAbono.onclick = registrarAbono; 

    // 2. Ocultar el botón "Cancelar Edición"
    if (btnCancelarEdicionAbono) {
        btnCancelarEdicionAbono.style.display = "none";
        btnCancelarEdicionAbono.onclick = null; // Limpiar el event listener
    }

    // 3. Limpiar los campos del formulario de abono
    document.getElementById("montoAbono").value = '';
    document.getElementById("formaPagoAbono").value = '';
    document.getElementById("detalleVentaModal").innerHTML = ''; // Limpiar el detalle

    // 4. Resetear las variables de estado de edición
    currentAbonoIdEditar = null; 
    // ventaIdParaAbonoAccion NO se resetea aquí, porque la necesitamos para reabrir el modal correctamente

    // 5. Volver a mostrar la lista de abonos previos
    document.getElementById("listaAbonosModal").style.display = "block"; 

    // 6. ¡Lo más importante! Reabrir el modal con la función original de abono
    // Esto recargará los abonos previos y restaurará la estructura normal
    if (ventaIdParaAbonoAccion) {
        await abrirModalAbono(ventaIdParaAbonoAccion); 
    } else {
        // Si por alguna razón no tenemos ventaIdParaAbonoAccion, cerramos el modal
        // Esto es un caso de seguridad, no debería ocurrir si el flujo es correcto.
        cerrarModalAbono();
    }
}

// Función para guardar la edición de un abono
async function guardarEdicionAbono() {
    if (abonoEnProceso) {
        console.log("Ya hay una edición en proceso, evitando duplicación");
        return;
    }
    abonoEnProceso = true; // Evita que se haga doble clic o se ejecute dos veces

    try {
        if (currentAbonoIdEditar === null) {
            mostrarToast("No hay un abono seleccionado para editar. 🚫", 'error');
            abonoEnProceso = false;
            return;
        }

        const nuevoMontoAbono = parseFloat(document.getElementById("montoAbono").value);
        const nuevaFormaPago = document.getElementById("formaPagoAbono").value;

        if (isNaN(nuevoMontoAbono) || nuevoMontoAbono <= 0) {
            mostrarToast("Ingresa un monto de abono válido. 🚫", 'warning');
            abonoEnProceso = false;
            return;
        }

        const abonoOriginal = await obtenerAbonoPorId(currentAbonoIdEditar);
        if (!abonoOriginal) {
            mostrarToast("Abono original no encontrado. 🚫", 'error');
            abonoEnProceso = false;
            return;
        }

        const venta = await obtenerVentaPorId(abonoOriginal.pedidoId);
        if (!venta) {
            mostrarToast("Venta asociada no encontrada. 🚫", 'error');
            abonoEnProceso = false;
            return;
        }

        // Calculamos la diferencia entre el nuevo monto y el monto original del abono
        const diferenciaMonto = nuevoMontoAbono - abonoOriginal.montoAbonado;

        // Validar que el nuevo monto total abonado no exceda el ingreso total de la venta
        if ((venta.ingreso - venta.montoPendiente + diferenciaMonto) > venta.ingreso) {
            mostrarToast("El monto total abonado no puede exceder el total de la venta. 🚫", 'warning');
            abonoEnProceso = false;
            return;
        }

        // Actualizamos los datos del abono original
        abonoOriginal.montoAbonado = nuevoMontoAbono;
        abonoOriginal.formaPago = nuevaFormaPago;
        // Opcional: podrías actualizar la fecha del abono a la fecha actual de edición si quieres
        // abonoOriginal.fechaAbono = getNowDateTimeFormattedLocal(); 
        await actualizarAbonoDB(abonoOriginal); // Guardamos el abono actualizado en la DB

        // Actualizamos el monto pendiente de la venta (sumamos/restamos la diferencia)
        venta.montoPendiente -= diferenciaMonto;
        venta.montoPendiente = Math.max(0, venta.montoPendiente); // Aseguramos que no sea negativo

        // Actualizamos el estado de pago de la venta
        if (venta.montoPendiente <= 0.01) { // Usamos 0.01 para evitar problemas con números flotantes
            venta.montoPendiente = 0;
            venta.estadoPago = 'Pagado Total';
        } else if (venta.montoPendiente > 0 && venta.montoPendiente < venta.ingreso) {
            venta.estadoPago = 'Pagado Parcial';
        } else {
            venta.estadoPago = 'Pendiente';
        }
        await actualizarVenta(venta.id, venta); // Guardamos la venta actualizada en la DB

        // Opcional: Registramos un movimiento financiero para reflejar el cambio en el abono
        const descripcionMovimiento = `Edición de abono a venta a crédito de ${venta.cliente} (ID Venta: ${venta.id}, Abono ID: ${abonoOriginal.id})`;
        await agregarMovimientoDB({ tipo: "ingreso", monto: diferenciaMonto, fecha: getNowDateTimeFormattedLocal(), descripcion: descripcionMovimiento });


        mostrarToast("Abono editado con éxito ✅", 'success');

        await actualizarDashboardCxC();

        //ACTUALIZAR LISTA DE CLIENTES MOROSOS
        await actualizarRankingClientesUrgentes();

        // >>>>> AÑADE ESTAS DOS LÍNEAS AQUÍ <<<<<
        if (btnCancelarEdicionAbono) { // Asegúrate de que el botón existe
            btnCancelarEdicionAbono.style.display = "none"; // Ocultar el botón "Cancelar Edición"
            btnCancelarEdicionAbono.onclick = null; // Limpiar el event listener
        }
        // >>>>> FIN DE LAS LÍNEAS A AÑADIR <<<<<

        // Restauramos el modal a su estado original para registrar nuevos abonos
        const btnRegistrarAbono = document.getElementById("btnRegistrarAbono");
        btnRegistrarAbono.textContent = "Confirmar Abono"; // Vuelve a su texto original
        btnRegistrarAbono.onclick = registrarAbono; // Vuelve a la función original de registrar


        document.getElementById("listaAbonosModal").style.display = "block"; // Mostramos de nuevo la lista de abonos previos
        // Si tienes un título de formulario, restablece también:
        // document.getElementById("abonoFormTitle").textContent = "Registrar Abono"; 

        // Recargamos la lista de abonos en el modal y la vista principal de cuentas por cobrar
        if (ventaIdParaAbonoAccion) {
            await mostrarAbonosPrevios(ventaIdParaAbonoAccion);
            // Reabrimos el modal de abono para la misma venta para que se vea el historial actualizado
            await abrirModalAbono(ventaIdParaAbonoAccion); 
        } else {
            cerrarModalAbono(); 
        }
        cargarYMostrarCuentasPorCobrar(); // Recargamos la tabla principal
    } catch (error) {
        console.error("Error al guardar edición de abono:", error);
        mostrarToast("Error al editar abono. 😔", 'error');
    } finally {
        abonoEnProceso = false; // Liberamos el proceso
        currentAbonoIdEditar = null; // Limpiamos el ID del abono en edición
        ventaIdParaAbonoAccion = null;
    }
}

//REVERTIR ABONOS
// Función de confirmación para revertir abono (usa SweetAlert2)
window.confirmarRevertirAbono = async function(abonoId) {
    // Verificamos si SweetAlert2 está cargado
    if (typeof Swal === 'undefined') {
        console.error("SweetAlert2 no está cargado. No se puede mostrar la confirmación.");
        mostrarToast("Error: No se puede confirmar. Faltan librerías (SweetAlert2).", 'error');
        return;
    }

    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¡Esta acción eliminará el abono y ajustará el monto pendiente de la venta!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6', // Azul
        cancelButtonColor: '#d33',    // Rojo
        confirmButtonText: 'Sí, revertir abono',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) { // Si el usuario confirma
        await revertirAbono(abonoId);
    }
};

// Función principal para revertir el abono
async function revertirAbono(abonoId) {
    if (abonoEnProceso) {
        console.log("Ya hay un proceso en marcha, evitando duplicación");
        return;
    }
    abonoEnProceso = true;

    try {
        const abono = await obtenerAbonoPorId(abonoId); // Obtenemos el abono a revertir
        if (!abono) {
            mostrarToast("Abono no encontrado para revertir. 🚫", 'error');
            abonoEnProceso = false;
            return;
        }

        const venta = await obtenerVentaPorId(abono.pedidoId); // Obtenemos la venta asociada
        if (!venta) {
            mostrarToast("Venta asociada no encontrada. 🚫", 'error');
            abonoEnProceso = false;
            return;
        }

        ventaIdParaAbonoAccion = venta.id; // Guardamos el ID de la venta

        // Revertimos el monto abonado: lo sumamos de nuevo al monto pendiente de la venta
        venta.montoPendiente += abono.montoAbonado;

        // Ajustamos el estado de pago de la venta
        if (venta.montoPendiente >= venta.ingreso) {
            venta.montoPendiente = venta.ingreso; // Aseguramos que no exceda el total de la venta
            venta.estadoPago = 'Pendiente'; // Si el monto pendiente vuelve a ser el total, es "Pendiente"
        } else if (venta.montoPendiente > 0 && venta.montoPendiente < venta.ingreso) {
            venta.estadoPago = 'Pagado Parcial'; // Si sigue habiendo un saldo, es "Pagado Parcial"
        } else if (venta.montoPendiente <= 0) { 
            venta.montoPendiente = 0;
            venta.estadoPago = 'Pagado Total'; // Si por alguna razón el monto llega a 0, es "Pagado Total"
        }

        await actualizarVenta(venta.id, venta); // Guardamos los cambios en la venta
        await eliminarAbonoDB(abonoId); // Eliminamos el abono de la base de datos

        // Opcional: Registramos un movimiento financiero como "egreso" por la reversión del abono
        const descripcionMovimiento = `Reversión de abono a venta a crédito de ${venta.cliente} (ID Venta: ${venta.id}, Abono ID: ${abono.id})`;
        await agregarMovimientoDB({ tipo: "egreso", monto: abono.montoAbonado, fecha: getNowDateTimeFormattedLocal(), descripcion: descripcionMovimiento });


        mostrarToast("Abono revertido con éxito y monto ajustado. ✅", 'success');

        // Recargamos la lista de abonos en el modal y la vista principal
        if (ventaIdParaAbonoAccion) {
             await mostrarAbonosPrevios(ventaIdParaAbonoAccion);
            await abrirModalAbono(ventaIdParaAbonoAccion); // Reabrimos el modal para ver historial actualizado
        } else {
            cerrarModalAbono();
        }
        cargarYMostrarCuentasPorCobrar(); // Recargamos la tabla principal
    } catch (error) {
        console.error("Error al revertir abono:", error);
        mostrarToast("Error al revertir abono. 😔", 'error');
    } finally {
        abonoEnProceso = false;
        ventaIdParaAbonoAccion = null;
    }
}


// Función para actualizar el listado de clientes con Vencimientos Urgentes
// ✅ FUNCIÓN COMPLETA Y CORREGIDA
async function actualizarRankingClientesUrgentes() {
    const clientesConVencimientosUrgentes = new Map();

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // ✅ Usar localStorage para recordar la selección
    const diasGuardados = localStorage.getItem("diasUrgentes");
    const diasAlerta = parseInt(document.getElementById("selectorDiasUrgentes")?.value || diasGuardados || 3);

    // ✅ Actualizar selector si existe
    const selector = document.getElementById("selectorDiasUrgentes");
    if (selector) {
        selector.value = diasAlerta;
    }

    const diasDespues = new Date(hoy);
    diasDespues.setDate(hoy.getDate() + diasAlerta);
    diasDespues.setHours(23, 59, 59, 999);

    for (const venta of ventasCredito) {
        if (venta.montoPendiente > 0 && venta.detallePago?.fechaVencimiento) {
            // ✅ Usar el mismo método de parseo de fechas que corregimos antes
            const fechaVencimientoParts = venta.detallePago.fechaVencimiento.split('-');
            const fechaVencimiento = new Date(parseInt(fechaVencimientoParts[0]), parseInt(fechaVencimientoParts[1]) - 1, parseInt(fechaVencimientoParts[2]));

            // ✅ Incluir hoy y los próximos días seleccionados
            if (fechaVencimiento <= diasDespues) {
                const nombreCliente = venta.cliente || "Cliente desconocido";
                const clienteDatos = clientes.find(c => c.nombre === nombreCliente);

                if (clienteDatos) {
                    let monto = clientesConVencimientosUrgentes.get(nombreCliente)?.monto || 0;
                    monto += venta.montoPendiente;

                    clientesConVencimientosUrgentes.set(nombreCliente, {
                        nombre: clienteDatos.nombre,
                        monto,
                        esVencido: fechaVencimiento < hoy
                    });
                }
            }
        }
    }

    const ranking = Array.from(clientesConVencimientosUrgentes.values()).sort((a, b) => {
        if (a.esVencido && !b.esVencido) return -1;
        if (!a.esVencido && b.esVencido) return 1;
        return b.monto - a.monto;
    });

    const lista = document.getElementById("listaRankingMorosos");
    lista.innerHTML = '';

    if (ranking.length === 0) {
        lista.innerHTML = '<li class="no-urgentes-msg">¡Excelente! No hay clientes con vencimientos urgentes o vencidos.</li>';
        return;
    }

    ranking.forEach(item => {
        const li = document.createElement('li');
        li.className = item.esVencido ? 'cliente-urgente vencido' : 'cliente-urgente por-vencer';
        li.innerHTML = `
            <span>${item.nombre}</span>
            <span class="monto-urgente">$${item.monto.toFixed(2)}</span>
            ${item.esVencido ? '<span class="estado-urgente vencido-tag">VENCIDO</span>' : ''}
        `;
        li.addEventListener('click', async () => {
            const clienteNombre = item.nombre;
            const ventasDelCliente = ventasCredito.filter(v => v.cliente === clienteNombre && v.montoPendiente > 0);

            if (ventasDelCliente.length > 0) {
                // Hacer scroll a la primera tarjeta encontrada
                const primeraVenta = ventasDelCliente[0];
                const cardId = `venta-${primeraVenta.id}`;
                const cardElement = document.getElementById(cardId);

                if (cardElement) {
                    cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    cardElement.classList.add('highlight');
                    setTimeout(() => {
                        cardElement.classList.remove('highlight');
                    }, 2000);
                } else {
                    // Si la tarjeta no está visible (ej. por filtros), recargar y luego hacer scroll
                    await cargarYMostrarCuentasPorCobrar();
                    const updatedCardElement = document.getElementById(cardId);
                    if (updatedCardElement) {
                        updatedCardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        updatedCardElement.classList.add('highlight');
                        setTimeout(() => {
                            updatedCardElement.classList.remove('highlight');
                        }, 2000);
                    }
                }
            } else {
                mostrarToast(`No hay ventas pendientes para ${clienteNombre}.`, 'info');
            }
        });

        lista.appendChild(li);
    });
}

function construirMensajePrincipal(venta, clienteDatos, tasaValor) {
        const montoBs = (venta.montoPendiente * tasaValor).toFixed(2);
        return `Buen día, estimado/a ${clienteDatos.nombre}:

Esperamos que haya quedado conforme con los productos entregados recientemente. Por este medio, le recordamos de manera respetuosa el saldo pendiente correspondiente a su crédito:

💳 Monto adeudado: $${venta.montoPendiente.toFixed(2)} USD (≈ ${montoBs} BS) Tasa de cambio aplicada: ${tasaValor}

📌 Formas de pago disponibles: 
1️⃣ Pago móvil: ${NUMERO_VENDEDOR_PRINCIPAL} / C.I. ${CEDULA_VENDEDOR} / ${BANCO_VENDEDOR} 
2️⃣ Divisas o bolívares: Aceptados al momento de la cancelación, según disponibilidad

Saludos cordiales.`;
}


// Función para abrir el modal de detalle de venta
async function abrirModalDetalleVenta(ventaId) {
    console.log(`Abriendo modal para venta ID: ${ventaId}`);
    const venta = await obtenerVentaPorId(ventaId);
    if (!venta) {
        mostrarToast('Venta no encontrada.', 'error');
        return;
    }

    const modalDetalleVenta = document.getElementById('modalDetalleVenta');
    const detalleVentaModalContent = document.getElementById('detalleVentaModalContent');

    // Limpiar contenido previo
    detalleVentaModalContent.innerHTML = '';

    // Crear la tarjeta de venta para el modal
    const cardVenta = crearCardVentaCredito(venta, true); // true para indicar que es para modal
    detalleVentaModalContent.appendChild(cardVenta);

    // Asegurar que los botones de acción dentro del modal funcionen
    // (Abonar, Editar, Ver Historial, WhatsApp)
    // Re-asignar event listeners ya que el contenido se recrea
    const btnAbonarModal = cardVenta.querySelector('.btn-success');
    if (btnAbonarModal) {
        btnAbonarModal.onclick = () => {
            abrirModalAbono(venta.id);
            modalDetalleVenta.style.display = 'none'; // Cerrar modal de detalle al abrir el de abono
        };
    }

    const btnEditarModal = cardVenta.querySelector('.btn-warning');
    if (btnEditarModal) {
        btnEditarModal.onclick = () => {
            cargarVentaParaEditar(venta.id);
        };
    }

    const btnVerHistorialModal = cardVenta.querySelector('.btn-info.btn-ver-historial');
    if (btnVerHistorialModal) {
        btnVerHistorialModal.onclick = (e) => {
            toggleHistorialPagos(e);
        };
    }

    // Lógica para el dropdown de WhatsApp dentro del modal
    const whatsappDropdownContainer = cardVenta.querySelector('.whatsapp-dropdown-container');
    if (whatsappDropdownContainer) {
        const botonDropdown = whatsappDropdownContainer.querySelector('.btn-whatsapp-dropdown');
        const menu = whatsappDropdownContainer.querySelector('.whatsapp-dropdown-menu');

        if (botonDropdown && menu) {
            botonDropdown.onclick = (e) => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            };

            document.addEventListener('click', function cerrarMenuWhatsapp(e) {
                if (!whatsappDropdownContainer.contains(e.target)) {
                    menu.style.display = 'none';
                }
            });
        }

        // Re-asignar eventos a las opciones del dropdown de WhatsApp
        const opcion1 = whatsappDropdownContainer.querySelector('.whatsapp-dropdown-option:nth-child(1)');
        const opcion2 = whatsappDropdownContainer.querySelector('.whatsapp-dropdown-option:nth-child(2)');

        const clienteDatos = clientes.find(c => c.nombre === venta.cliente);
        const localNum = clienteDatos?.telefono.replace(/\D/g, '');
        const numeroIntl = `58${localNum}`; // Asumimos Venezuela

        if (opcion1) {
            opcion1.onclick = (e) => {
                e.stopPropagation();
                menu.style.display = 'none';
                abrirModalWhatsApp(venta, clienteDatos, numeroIntl, construirMensajePrincipal(venta, clienteDatos, parseFloat(document.getElementById('tasaBCV').value)));
            };
        }
        if (opcion2) {
            opcion2.onclick = (e) => {
                e.stopPropagation();
                menu.style.display = 'none';
                abrirModalWhatsApp(venta, clienteDatos, numeroIntl, construirMensajeAlternativo(venta, clienteDatos, parseFloat(document.getElementById('tasaBCV').value)), true);
            };
        }
    }

    modalDetalleVenta.style.display = 'flex'; // Mostrar el modal
}

//MENSAJE SEGUNDO BOTÓN (JOSÉ LUIS)
function construirMensajeAlternativo(venta, clienteDatos, tasaValor) {
    const montoBs = (venta.montoPendiente * tasaValor).toFixed(2);
    return `Buen día, estimado/a ${clienteDatos.nombre}:

Confío en que el producto entregado haya sido de su agrado. Le escribo para recordarle el saldo pendiente correspondiente al acuerdo de crédito.

💳 Monto adeudado: $${venta.montoPendiente.toFixed(2)} USD (≈ ${montoBs} BS) Tasa referencial aplicada: ${tasaValor}

📌 Medios de pago disponibles: 
1️⃣ Pago móvil: ${NUMERO_VENDEDOR_ALTERNATIVO} / C.I. ${CEDULA_VENDEDOR_ALTERNATIVO} / ${BANCO_VENDEDOR_ALTERNATIVO}
2️⃣ Divisas o bolívares: Aceptados según disponibilidad, al momento de la cancelación

Agradezco su atención a este mensaje y quedo atento/a para asistirle en lo que necesite.

Saludos cordiales.`;
}
