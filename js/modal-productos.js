function inicializarModalProductos() {
    const modalReporteProductos = document.getElementById('modalReporteProductos');
    const cerrarModalBtn = modalReporteProductos ? modalReporteProductos.querySelector('.cerrar-modal') : null;
    const btnCambiarVista = document.getElementById('btnCambiarVista'); // Referencia al nuevo botón de cambio de vista

    if (!modalReporteProductos) {
        console.warn('inicializarModalProductos: Modal de productos no encontrado en el DOM.');
        return;
    }

    // Asegura que el modal esté oculto al inicio, por si acaso el CSS no se ha aplicado aún
    modalReporteProductos.classList.remove('mostrar'); // Elimina la clase 'mostrar' si estuviera presente
    modalReporteProductos.style.display = 'none'; // Asegura que no se muestre

    // Listener para cerrar el modal haciendo clic en la 'x'
    if (cerrarModalBtn) {
        cerrarModalBtn.addEventListener('click', () => {
            modalReporteProductos.classList.remove('mostrar');
            modalReporteProductos.style.display = 'none';
        });
    } else {
        console.warn('Botón de cerrar modal (.cerrar-modal) no encontrado.');
    }

    // Listener para cerrar el modal haciendo clic fuera de él
    window.addEventListener('click', (event) => {
        if (event.target === modalReporteProductos) {
            modalReporteProductos.classList.remove('mostrar');
            modalReporteProductos.style.display = 'none';
        }
    });

    // *** Lógica para el botón de Cambiar Vista ***
    if (btnCambiarVista) {
        // Usamos una variable para mantener el estado actual de la vista
        // false = tarjetas (por defecto), true = tabla
        let esVistaTabla = false;

        btnCambiarVista.addEventListener('click', () => {
            esVistaTabla = !esVistaTabla; // Alternar el estado
            alternarVistaProductos(esVistaTabla); // Llamar a la función para cambiar la vista
            // Actualizar el texto del botón según la vista actual
            btnCambiarVista.textContent = esVistaTabla ? "Cambiar a Vista de Tarjeta" : "Cambiar a Vista de Tabla";
        });
    } else {
        console.warn('Botón "btnCambiarVista" no encontrado en el DOM.');
    }

    console.log('inicializarModalProductos: Configuración inicial del modal completa.');
}


// Esta función carga los datos de productos y los muestra en el modal,
// tanto en formato de tarjeta como de tabla. Luego hace el modal visible.
async function mostrarReporteProductos() {
    const modalReporteProductos = document.getElementById('modalReporteProductos');
    const listaReporteProductos = document.getElementById('listaReporteProductos');
    const tablaReporteProductosDiv = document.getElementById('tablaReporteProductos');
    const tablaBody = tablaReporteProductosDiv ? tablaReporteProductosDiv.querySelector('tbody') : null;

    if (!modalReporteProductos || !listaReporteProductos || !tablaReporteProductosDiv || !tablaBody) {
        console.error('Elementos esenciales del modal no encontrados al mostrar el reporte.');
        return;
    }

    listaReporteProductos.innerHTML = '<p>Cargando productos...</p>';
    tablaBody.innerHTML = '<tr><td colspan="5">Cargando productos...</td></tr>';

    listaReporteProductos.style.display = 'grid';
    tablaReporteProductosDiv.style.display = 'none';
    const btnCambiarVista = document.getElementById('btnCambiarVista');
    if(btnCambiarVista) {
        btnCambiarVista.textContent = "Cambiar a Vista de Tabla";
    }

    try {
        const todosLosProductos = await obtenerTodosLosProductos();

        // ****** INICIO DE LA MODIFICACIÓN CLAVE ******
        // Filtrar productos: solo mostrar aquellos con stock mayor a 0
        const productosConExistencia = todosLosProductos.filter(producto => {
            // Asegurarse de que 'stock' es un número y es mayor que 0
            // Si 'stock' es undefined o null, se considera 0 para el filtro
            return (producto.stock !== undefined && producto.stock !== null && producto.stock > 0);
        });
        // ****** FIN DE LA MODIFICACIÓN CLAVE ******


        if (productosConExistencia && productosConExistencia.length > 0) { // Usamos los productos filtrados aquí
            listaReporteProductos.innerHTML = '';
            tablaBody.innerHTML = '';

            // 1. Poblar la vista de tarjetas (tarjeta-card-reporte)
            productosConExistencia.forEach(producto => { // Usamos productos filtrados
                const productoCard = document.createElement('div');
                productoCard.classList.add('producto-card-reporte');

                const nombre = producto.nombre || 'Nombre Desconocido';
                const categoria = producto.categoria || 'N/A';
                const stock = producto.stock !== undefined ? producto.stock : 'N/A';
                const unidadMedida = producto.unidadMedida || '';
                const stockMin = producto.stockMin !== undefined ? producto.stockMin : 'N/A';
                const stockMax = producto.stockMax !== undefined ? producto.stockMax : 'N/A';
                const vendidos = producto.vendidos !== undefined ? producto.vendidos : '0';
                const costo = (producto.costo || 0).toFixed(2);
                const precio = (producto.precio || 0).toFixed(2);
                const proveedor = producto.proveedor || 'N/A';
                const imagenHTML = producto.imagen ? `<img src="${producto.imagen}" alt="Imagen de ${nombre}">` : '';

                productoCard.innerHTML = `
                    <h3>${nombre}</h3>
                    ${imagenHTML}
                    <p><strong>Categoría:</strong> ${categoria}</p>
                    <p><strong>Stock:</strong> ${stock} ${unidadMedida}</p>
                    <p><strong>Stock Mínimo:</strong> ${stockMin}</p>
                    <p><strong>Stock Máximo:</strong> ${stockMax}</p>
                    <p><strong>Vendidos:</strong> ${vendidos}</p>
                    <p><strong>Costo:</strong> $${costo}</p>
                    <p><strong>Precio de Venta:</strong> $${precio}</p>
                    <p><strong>Proveedor:</strong> ${proveedor}</p>
                `;
                listaReporteProductos.appendChild(productoCard);
            });

            // 2. Poblar la vista de tabla
            productosConExistencia.forEach(producto => { // Usamos productos filtrados
                const row = tablaBody.insertRow();
                row.innerHTML = `
                    <td>${producto.nombre || 'N/A'}</td>
                    <td>${producto.categoria || 'N/A'}</td>
                    <td>${producto.stock !== undefined ? producto.stock : 'N/A'} ${producto.unidadMedida || ''}</td>
                    <td>$${(producto.precio || 0).toFixed(2)}</td>
                    <td>${producto.proveedor || 'N/A'}</td>
                    `;
            });

        } else {
            listaReporteProductos.innerHTML = '<p>No hay productos con existencias en el inventario.</p>';
            tablaBody.innerHTML = '<tr><td colspan="5">No hay productos con existencias en el inventario.</td></tr>';
        }

        modalReporteProductos.style.display = 'flex';
        modalReporteProductos.classList.add('mostrar');
        console.log('Modal de productos mostrado con éxito.');

    } catch (error) {
        console.error('Error al cargar los productos para el reporte:', error);
        listaReporteProductos.innerHTML = '<p>Error al cargar los productos. Por favor, intente de nuevo.</p>';
        tablaBody.innerHTML = '<tr><td colspan="5">Error al cargar los productos.</td></tr>';
    }
}

// Nueva función para alternar entre la vista de tarjetas y la vista de tabla
function alternarVistaProductos(esTabla) {
    const listaReporteProductos = document.getElementById('listaReporteProductos');
    const tablaReporteProductosDiv = document.getElementById('tablaReporteProductos');

    if (!listaReporteProductos || !tablaReporteProductosDiv) {
        console.error('Elementos de vista (listaReporteProductos o tablaReporteProductos) no encontrados para alternar.');
        return;
    }

    if (esTabla) {
        listaReporteProductos.style.display = 'none'; // Oculta la vista de tarjetas
        tablaReporteProductosDiv.style.display = 'block'; // Muestra la vista de tabla (o 'table' si prefieres semánticamente, pero 'block' suele funcionar bien)
    } else {
        listaReporteProductos.style.display = 'grid'; // Muestra la vista de tarjetas (asumiendo que usas grid para ellas)
        tablaReporteProductosDiv.style.display = 'none'; // Oculta la vista de tabla
    }
    console.log(`Cambiando a vista: ${esTabla ? 'Tabla' : 'Tarjetas'}`);
}


// Este listener espera a que todo el DOM esté cargado antes de ejecutar el script.
document.addEventListener('DOMContentLoaded', () => {
    // Busca el botón principal para abrir el modal (en el miniMenuLateral)
    const btnReporteProductos = document.getElementById('btnReporteProductos');
    // Busca el nuevo botón de acceso rápido en index.html (NUEVO ID)
    const btnReporteProductosIndex = document.getElementById('btnReporteProductosIndex'); // <--- Esta línea es la que faltaba!

    if (btnReporteProductos) {
        // Adjunta el event listener al botón para llamar a mostrarReporteProductos
        btnReporteProductos.addEventListener('click', mostrarReporteProductos);
        console.log('Botón btnReporteProductos (para abrir el modal) encontrado y listener adjuntado.');
    } else {
        console.warn('Botón "btnReporteProductos" no encontrado en el DOM.');
    }

    // Si el botón del index existe, también le añadimos el listener
    if (btnReporteProductosIndex) { // <--- Y este if es el que lo usa
        btnReporteProductosIndex.addEventListener('click', mostrarReporteProductos);
        console.log('Botón btnReporteProductosIndex (en index.html) encontrado y listener adjuntado.');
    } else {
        console.warn('Botón "btnReporteProductosIndex" no encontrado en el DOM actual.');
    }


    // Inicializa los listeners de cierre y el botón de cambio de vista del modal.
    // Esto se hace siempre al cargar la página, sin hacer el modal visible.
    inicializarModalProductos();
});
