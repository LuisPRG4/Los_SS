// js/proveedores.js

let proveedores = [];
let editProveedorId = null; // Ahora usamos ID real (IndexedDB)

// Función para inicializar el toggle del formulario de proveedores
function inicializarToggleFormularioProveedores() {
  const toggleBtn = document.getElementById('toggleFormProveedoresBtn');
  const formulario = document.getElementById('formularioProveedor');
  
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
        toggleBtn.textContent = '➕ Agregar Proveedor';
        
        // Después de la animación, ocultar el formulario
        setTimeout(() => {
          formulario.style.display = 'none';
          formulario.classList.remove('slide-up');
        }, 500);
      }
    });
  }
}

// Modificar la función editarProveedor para mostrar el formulario con animación al editar
function editarProveedor(id) {
  const proveedor = proveedores.find(p => p.id === id);
  if (proveedor) {
    // Mostrar el formulario con animación si está oculto
    const formulario = document.getElementById('formularioProveedor');
    const toggleBtn = document.getElementById('toggleFormProveedoresBtn');
    
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
    
    // Llenar los campos del formulario con los datos del proveedor
    document.getElementById("nombreProveedor").value = proveedor.nombre;
    document.getElementById("empresa").value = proveedor.empresa || '';
    document.getElementById("telefono").value = proveedor.telefono || '';
    document.getElementById("productos").value = proveedor.productos || '';
    
    // Configurar el modo de edición
    editProveedorId = id;
    document.getElementById("btnGuardarProveedor").textContent = "Actualizar Proveedor";
    document.getElementById("btnCancelarProveedor").style.display = "block";
    
    // Desplazar hacia el formulario
    formulario.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
    await abrirDB();
    proveedores = await obtenerTodosLosProveedoresDB() || [];
    mostrarProveedores();

    // Asocia los event listeners para los botones del formulario
    document.getElementById("btnGuardarProveedor").addEventListener("click", agregarProveedor);
    document.getElementById("btnCancelarProveedor").addEventListener("click", cancelarEdicionProveedor);
    document.getElementById("buscadorProveedores").addEventListener("input", filtrarProveedores);

    // *** NUEVO: Event Listeners para los botones de Exportar/Importar/Plantilla (JSON) ***
    document.getElementById('exportarProveedoresBtn').addEventListener('click', exportarProveedoresJSON);
    document.getElementById('importarProveedoresInput').addEventListener('change', importarProveedoresJSON);
    document.getElementById('descargarPlantillaProveedoresBtn').addEventListener('click', descargarPlantillaProveedoresJSON);
    
    // Inicializar el toggle del formulario de proveedores
    inicializarToggleFormularioProveedores();
});

// Guardar o actualizar proveedor
async function agregarProveedor() {
    const nombre = document.getElementById("nombreProveedor").value.trim();
    const empresa = document.getElementById("empresa").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    const productosSuministra = document.getElementById("productos").value.trim();

    if (!nombre) {
        mostrarToast("El nombre del proveedor es obligatorio ⚠️", "error");
        return;
    }

    const nuevoProveedor = {
        nombre: nombre,
        empresa: empresa,
        telefono: telefono,
        productos: productosSuministra
    };

    if (editProveedorId === null) {
        // Verificar si el proveedor ya existe por nombre antes de agregar
        const proveedorExistente = proveedores.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
        if (proveedorExistente) {
            mostrarToast("Ya existe un proveedor con ese nombre. Por favor, usa uno diferente o edita el existente.", "error");
            return;
        }

        try {
            const id = await agregarProveedorDB(nuevoProveedor); // Función de db.js
            nuevoProveedor.id = id; // Asignar el ID de la DB al objeto local
            proveedores.push(nuevoProveedor);
            mostrarToast("Proveedor agregado con éxito 🚚", "success");
        } catch (e) {
            console.error("Error al agregar proveedor:", e);
            mostrarToast("Error al guardar proveedor 😔", "error");
        }
    } else {
        // Cuando es una actualización, buscar por ID para asegurar que no se duplica el nombre
        const proveedorExistente = proveedores.find(p => p.nombre.toLowerCase() === nombre.toLowerCase() && p.id !== editProveedorId);
        if (proveedorExistente) {
            mostrarToast("Ya existe otro proveedor con ese nombre. Por favor, usa uno diferente o edita el existente.", "error");
            return;
        }

        try {
            nuevoProveedor.id = editProveedorId; // Aseguramos que el ID se mantiene para la actualización
            await actualizarProveedorDB(editProveedorId, nuevoProveedor); // Función de db.js
            // Actualizar el array local 'proveedores' después de la actualización en la DB
            const index = proveedores.findIndex(p => p.id === editProveedorId);
            if (index !== -1) proveedores[index] = nuevoProveedor;

            mostrarToast("Proveedor actualizado ✏️", "success");
            editProveedorId = null; // Resetear ID de edición
            document.getElementById("btnGuardarProveedor").textContent = "Guardar Proveedor";
            document.getElementById("btnCancelarProveedor").style.display = "none";
        } catch (e) {
            console.error("Error al actualizar proveedor:", e);
            mostrarToast("Error al actualizar proveedor 😔", "error");
        }
    }

    // Volver a cargar los proveedores de la DB para asegurar que la lista local esté sincronizada
    proveedores = await obtenerTodosLosProveedoresDB() || [];
    mostrarProveedores(); // Volver a renderizar la lista
    limpiarFormulario(); // Limpiar el formulario
}

// Función para crear la tarjeta HTML de un proveedor con el estilo "modern-card"
function crearCardProveedor(proveedor) {
    const card = document.createElement("div");
    card.className = "modern-card"; // Aplica la clase general de tarjeta

    card.innerHTML = `
        <div class="card-header">
            <h3 title="${proveedor.nombre}">${proveedor.nombre}</h3>
            <span class="card-meta">Empresa: ${proveedor.empresa || 'N/D'}</span>
        </div>
        <div class="card-content">
            <p><strong>Teléfono:</strong> ${proveedor.telefono || 'No especificado'}</p>
            <p><strong>Productos:</strong> ${proveedor.productos || 'No especificados'}</p>
        </div>
        <div class="card-actions">
            <button onclick="editarProveedor(${proveedor.id})" class="btn-edit">✏️ Editar</button>
            <button onclick="eliminarProveedor(${proveedor.id})" class="btn-delete">🗑️ Eliminar</button>
        </div>
    `;
    return card;
}

// Mostrar lista de proveedores (ahora usa crearCardProveedor)
function mostrarProveedores(filtrados = proveedores) {
    if (!Array.isArray(filtrados)) filtrados = [];
    const lista = document.getElementById("listaProveedores"); // Este es ahora un <div> con clase 'proveedores-grid'
    lista.innerHTML = "";

    if (filtrados.length === 0) {
        lista.innerHTML = `<p class="mensaje-lista">No hay proveedores registrados.</p>`;
        return;
    }

    filtrados.forEach((proveedor) => {
        const card = crearCardProveedor(proveedor); // Crea la tarjeta usando la nueva función
        lista.appendChild(card);
    });
}

// Editar
async function editarProveedor(id) {
    const proveedor = proveedores.find(p => p.id === id); // Busca el proveedor por su ID
    if (!proveedor) {
        mostrarToast("Proveedor no encontrado para edición.", "error");
        return;
    }

    document.getElementById("nombreProveedor").value = proveedor.nombre;
    document.getElementById("empresa").value = proveedor.empresa;
    document.getElementById("telefono").value = proveedor.telefono;
    document.getElementById("productos").value = proveedor.productos;

    editProveedorId = proveedor.id; // Guarda el ID para la edición
    document.getElementById("btnGuardarProveedor").textContent = "Actualizar Proveedor";
    document.getElementById("btnCancelarProveedor").style.display = "inline-block";

    document.getElementById("nombreProveedor").scrollIntoView({ behavior: "smooth", block: "start" });
}

// Eliminar (ahora usa mostrarConfirmacion)
async function eliminarProveedor(id) {
    const confirmacion = await mostrarConfirmacion( // Función de db.js
        "¿Estás seguro de eliminar este proveedor? Esta acción no se puede deshacer.",
        "Eliminar Proveedor"
    );

    if (confirmacion) {
        try {
            await eliminarProveedorDB(id); // Función de db.js
            // Después de eliminar de la DB, actualizamos el array local y la UI
            proveedores = proveedores.filter(p => p.id !== id);
            mostrarProveedores();
            mostrarToast("Proveedor eliminado 🗑️", "success");
        } catch (e) {
            console.error("Error al eliminar proveedor:", e);
            mostrarToast("Error al eliminar proveedor 😔", "error");
        }
    } else {
        mostrarToast("Eliminación de proveedor cancelada.", "info");
    }
}

// Cancelar edición
function cancelarEdicionProveedor() {
    editProveedorId = null;
    limpiarFormulario();
    document.getElementById("btnGuardarProveedor").textContent = "Guardar Proveedor";
    document.getElementById("btnCancelarProveedor").style.display = "none";
    mostrarToast("Edición cancelada ❌", "info");
}

// Filtro
async function filtrarProveedores() { // Ahora asíncrona para asegurar que `proveedores` esté actualizado
    const filtro = document.getElementById("buscadorProveedores").value.toLowerCase();
    
    // Obtener la lista más reciente de proveedores antes de filtrar
    proveedores = await obtenerTodosLosProveedoresDB() || [];

    const resultados = proveedores.filter(p =>
        p.nombre.toLowerCase().includes(filtro) ||
        p.empresa.toLowerCase().includes(filtro) ||
        p.telefono.toLowerCase().includes(filtro) ||
        p.productos.toLowerCase().includes(filtro)
    );
    mostrarProveedores(resultados);
}

// Limpiar form
function limpiarFormulario() {
    document.getElementById("nombreProveedor").value = "";
    document.getElementById("empresa").value = "";
    document.getElementById("telefono").value = "";
    document.getElementById("productos").value = "";
}

// --- FUNCIONES DE EXPORTACIÓN / IMPORTACIÓN (SÓLO JSON) para Proveedores ---

async function exportarProveedoresJSON() {
    const proveedoresAExportar = await obtenerTodosLosProveedoresDB(); // Obtiene proveedores directamente de IndexedDB
    if (proveedoresAExportar.length === 0) {
        mostrarToast('No hay proveedores en el registro para exportar.', "info");
        return;
    }

    const jsonContent = JSON.stringify(proveedoresAExportar, null, 2); // Formatea el JSON con indentación para legibilidad

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'proveedores_registro.json'); // Nombre del archivo para proveedores
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast('Registro de proveedores exportado a proveedores_registro.json ✅', "success");
}

async function importarProveedoresJSON(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (file.type !== 'application/json') {
        mostrarToast('Por favor, selecciona un archivo JSON válido.', "error");
        event.target.value = '';
        return;
    }

    const confirmacion = await mostrarConfirmacion( // Función de db.js
        "¿Estás seguro de importar estos datos de proveedores? Esto puede agregar o actualizar proveedores existentes.",
        "Confirmar Importación de Proveedores"
    );
    if (!confirmacion) {
        mostrarToast("Importación de proveedores cancelada ❌", "info");
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const jsonContent = e.target.result;
        let proveedoresImportados = [];
        try {
            proveedoresImportados = JSON.parse(jsonContent);
            if (!Array.isArray(proveedoresImportados)) {
                throw new Error("El archivo JSON no contiene un array de proveedores válido.");
            }
        } catch (error) {
            console.error('Error al parsear el archivo JSON de proveedores:', error);
            mostrarToast('Error al procesar el archivo JSON de proveedores. Asegúrate de que el formato sea correcto. ' + error.message, "error");
            event.target.value = '';
            return;
        }

        if (proveedoresImportados.length === 0) {
            mostrarToast('El archivo JSON no contiene datos de proveedores.', "info");
            event.target.value = '';
            return;
        }

        const proveedoresActuales = await obtenerTodosLosProveedoresDB();
        let proveedoresAgregados = 0;
        let proveedoresActualizados = 0;
        const erroresImportacion = [];

        for (const nuevoProveedor of proveedoresImportados) {
            if (!nuevoProveedor || typeof nuevoProveedor !== 'object' || !nuevoProveedor.nombre) {
                erroresImportacion.push(`Objeto de proveedor inválido o sin nombre. Saltando.`);
                continue;
            }

            // Normalizar tipos de datos si es necesario (ej. telefono como string)
            nuevoProveedor.telefono = String(nuevoProveedor.telefono || '');
            nuevoProveedor.empresa = String(nuevoProveedor.empresa || '');
            nuevoProveedor.productos = String(nuevoProveedor.productos || '');

            let proveedorExistenteDB = null;
            if (nuevoProveedor.id) {
                proveedorExistenteDB = proveedoresActuales.find(p => p.id === parseInt(nuevoProveedor.id));
            }
            if (!proveedorExistenteDB) {
                proveedorExistenteDB = proveedoresActuales.find(p => p.nombre.toLowerCase() === nuevoProveedor.nombre.toLowerCase());
            }

            if (proveedorExistenteDB) {
                const proveedorActualizado = { ...proveedorExistenteDB, ...nuevoProveedor };
                proveedorActualizado.id = proveedorExistenteDB.id; // Mantener el ID original de IndexedDB
                await actualizarProveedorDB(proveedorActualizado.id, proveedorActualizado);
                proveedoresActualizados++;
            } else {
                const proveedorParaAgregar = { ...nuevoProveedor };
                delete proveedorParaAgregar.id; // Permitir que IndexedDB asigne un nuevo ID
                await agregarProveedorDB(proveedorParaAgregar);
                proveedoresAgregados++;
            }
        }

        // Después de la importación, recargar y mostrar la lista
        proveedores = await obtenerTodosLosProveedoresDB();
        mostrarProveedores();

        let mensajeFinal = `Importación de proveedores completada:\n${proveedoresAgregados} proveedores agregados.\n${proveedoresActualizados} proveedores actualizados.`;
        if (erroresImportacion.length > 0) {
            mensajeFinal += `\n\nErrores (${erroresImportacion.length}):\n${erroresImportacion.join('\n')}`;
            mostrarToast(mensajeFinal, "error", 5000);
        } else {
            mostrarToast(mensajeFinal, "success");
        }
    };
    reader.readAsText(file);
    // Limpiar el input de archivo después de la importación
    event.target.value = ''; 
}

async function descargarPlantillaProveedoresJSON() {
    const plantillaProveedores = [
        {
            "id": null, // Dejar en null para que IndexedDB asigne un nuevo ID
            "nombre": "Proveedor Ejemplo S.A.",
            "empresa": "Suministros Globales",
            "telefono": "1122334455",
            "productos": "Alimentos no perecederos, Bebidas"
        },
        {
            "id": null,
            "nombre": "Distribuidora Fresca",
            "empresa": "Frutas y Verduras Frescas",
            "telefono": "6677889900",
            "productos": "Frutas, Verduras, Lácteos"
        }
    ];

    const jsonContent = JSON.stringify(plantillaProveedores, null, 2);

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'plantilla_proveedores.json'); // Nombre del archivo para plantilla
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    mostrarToast('Plantilla de proveedores JSON descargada ✅', "success");
}

// Las funciones toggleMenu, mostrarAyuda, cerrarAyuda y la redirección de sesión
// se mantienen en sus respectivos lugares o en el HTML como en tu estructura.
// Si están en el HTML, no es necesario que estén aquí también.
// Si son parte de un archivo 'chatbot-ayuda.js' o 'nav-highlighter.js',
// asegúrate de que se carguen después de db.js.

/*
// Removí el código de mostrarToast comentado, ya que asumimos que db.js lo proporciona.
function mostrarToast(mensaje, tipo = "info") {
    // ... tu implementación de mostrarToast global desde db.js
}
*/
