// js/dashboard.js - Lógica para el Panel de Control de la página de inicio

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar consejos del día
    initDailyTips();
    
    // Cargar actividades recientes
    loadRecentActivity();
    
    // Inicializar sistema de notas
    initNotesSystem();
    
    // Comprobar si hay una sesión activa
    checkActiveSession();
    
    // Actualizar badges en accesos rápidos
    updateQuickAccessBadges();
});

/**
 * Inicializa la funcionalidad de consejos del día
 */
function initDailyTips() {
    const dailyTipElement = document.getElementById("dailyTip");
    const newTipBtn = document.getElementById("newTipBtn");
    
    if (dailyTipElement && newTipBtn) {
        // Lista de consejos para el negocio
        const tips = [
            "Verifica regularmente los productos con bajo stock para evitar quedarte sin inventario.",
            "Mantén un registro de tus clientes más frecuentes para ofrecerles promociones personalizadas.",
            "Revisa semanalmente tus reportes de ventas para identificar tendencias y productos populares.",
            "Considera ofrecer descuentos en productos con poco movimiento para mejorar el flujo de inventario.",
            "Actualiza los precios periódicamente para mantener tus márgenes de ganancia.",
            "Contacta a tus proveedores con anticipación antes de que se agoten los productos esenciales.",
            "Monitorea las cuentas por cobrar para evitar acumulación de deudas vencidas.",
            "Toma fotos de calidad de tus productos para mejorar tu catálogo digital.",
            "Analiza qué días de la semana tienes mejores ventas para optimizar tu horario de atención.",
            "Mantén un registro detallado de las devoluciones y sus motivos para mejorar la calidad del servicio.",
            "Compara regularmente los precios de tus proveedores para obtener las mejores ofertas.",
            "Considera crear combos con productos complementarios para aumentar el valor de venta.",
            "Registra las opiniones de tus clientes para mejorar constantemente tu servicio.",
            "Realiza inventarios físicos periódicos para mantener tu información actualizada.",
            "Identifica los productos que generan mayores ganancias y destáquelos en tu tienda."
        ];
        
        // Mostrar un consejo aleatorio al cargar
        showRandomTip(dailyTipElement, tips);
        
        // Configurar el botón para mostrar un nuevo consejo
        newTipBtn.addEventListener("click", () => {
            showRandomTip(dailyTipElement, tips);
        });
    }
}

/**
 * Muestra un consejo aleatorio en el elemento especificado
 */
function showRandomTip(element, tips) {
    const randomIndex = Math.floor(Math.random() * tips.length);
    element.innerHTML = `<p>${tips[randomIndex]}</p>`;
    
    // Añadir una animación sencilla
    element.style.opacity = "0";
    element.style.transform = "translateY(-10px)";
    
    setTimeout(() => {
        element.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        element.style.opacity = "1";
        element.style.transform = "translateY(0)";
    }, 50);
}

/**
 * Carga las actividades recientes del usuario
 */
async function loadRecentActivity() {
    const timelineElement = document.getElementById("activityTimeline");
    
    if (!timelineElement) return;
    
    try {
        // Intentar cargar datos recientes de la base de datos
        await abrirDB();
        
        // Obtener ventas recientes (últimos 5 días)
        const ventas = await obtenerTodasLasVentas() || [];
        const movimientos = await obtenerTodosLosMovimientos() || [];
        
        // Filtrar por fecha reciente (últimos 5 días)
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        
        const ventasRecientes = ventas
            .filter(v => new Date(v.fecha) >= fiveDaysAgo)
            .slice(0, 10);
            
        const movimientosRecientes = movimientos
            .filter(m => new Date(m.fecha) >= fiveDaysAgo)
            .slice(0, 10);
        
        // Combinar actividades y ordenar por fecha (más reciente primero)
        const activities = [
            ...ventasRecientes.map(venta => ({
                type: "sale",
                icon: "🛒",
                title: `Venta por $${typeof venta.ingreso === 'number' ? venta.ingreso.toFixed(2) : '0.00'}`,
                description: venta.tipoPago === 'contado' ? 'Pago al contado' : 'Crédito',
                date: new Date(venta.fecha)
            })),
            ...movimientosRecientes.map(mov => ({
                type: "movement",
                icon: mov.tipo === 'ingreso' ? "💰" : "📤",
                title: `${mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}: ${mov.descripcion || 'Sin descripción'}`,
                description: `$${typeof mov.monto === 'number' ? mov.monto.toFixed(2) : '0.00'}`,
                date: new Date(mov.fecha)
            }))
        ].sort((a, b) => b.date - a.date).slice(0, 7); // Ordenar por fecha descendente y tomar máximo 7
        
        // Renderizar las actividades
        if (activities.length > 0) {
            timelineElement.innerHTML = activities.map(activity => `
                <div class="timeline-item">
                    <div class="timeline-icon">${activity.icon}</div>
                    <div class="timeline-content">
                        <div class="timeline-title">${activity.title}</div>
                        <div class="timeline-description">${activity.description}</div>
                        <div class="timeline-time">${formatDate(activity.date)}</div>
                    </div>
                </div>
            `).join('');
        } else {
            timelineElement.innerHTML = '<div class="timeline-loader">No hay actividad reciente</div>';
        }
        
    } catch (error) {
        console.error("Error al cargar actividades recientes:", error);
        timelineElement.innerHTML = '<div class="timeline-loader">Error al cargar actividades recientes</div>';
    }
}

/**
 * Formatea una fecha para mostrar
 */
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return "Fecha desconocida";
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    
    if (diffMins < 60) {
        return `Hace ${diffMins} minutos`;
    } else if (diffHours < 24) {
        return `Hace ${diffHours} horas`;
    } else if (diffDays < 5) {
        return `Hace ${diffDays} días`;
    } else {
        return date.toLocaleDateString('es-ES', { 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit' 
        });
    }
}

/**
 * Verifica si hay una sesión activa y actualiza la UI según corresponda
 */
function checkActiveSession() {
    const isLoggedIn = sessionStorage.getItem("sesionIniciada") === "true";
    
    // Si hay elementos específicos que necesitan ajustes cuando no hay sesión,
    // se pueden manipular aquí
    if (!isLoggedIn) {
        const activityTimeline = document.getElementById("activityTimeline");
        const dailyTip = document.getElementById("dailyTip");
        const notesContainer = document.getElementById("notesContainer");
        
        if (activityTimeline) {
            activityTimeline.innerHTML = '<div class="timeline-loader">Inicia sesión para ver la actividad reciente</div>';
        }
        
        if (dailyTip) {
            dailyTip.innerHTML = '<p>Inicia sesión para ver consejos personalizados</p>';
        }
        
        if (notesContainer) {
            notesContainer.innerHTML = '<div class="empty-notes-message">Inicia sesión para gestionar tus recordatorios</div>';
            
            // Deshabilitar input de notas
            const noteInput = document.getElementById("newNoteInput");
            const addNoteBtn = document.getElementById("addNoteBtn");
            if (noteInput) noteInput.disabled = true;
            if (addNoteBtn) addNoteBtn.disabled = true;
        }
    }
}

/**
 * Inicializa el sistema de notas/recordatorios
 */
function initNotesSystem() {
    const notesContainer = document.getElementById("notesContainer");
    const newNoteInput = document.getElementById("newNoteInput");
    const addNoteBtn = document.getElementById("addNoteBtn");
    
    if (!notesContainer || !newNoteInput || !addNoteBtn) return;
    
    // Cargar notas existentes al iniciar
    loadNotes();
    
    // Manejar eventos para agregar notas
    addNoteBtn.addEventListener("click", addNewNote);
    newNoteInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            addNewNote();
        }
    });
    
    // Delegar eventos para manejar notas (completar/eliminar)
    notesContainer.addEventListener("click", (e) => {
        // Si se hizo click en un checkbox
        if (e.target.classList.contains("note-checkbox")) {
            toggleNoteStatus(e.target.dataset.id);
        }
        
        // Si se hizo click en el botón eliminar
        if (e.target.classList.contains("note-delete")) {
            deleteNote(e.target.dataset.id);
        }
    });
}

/**
 * Carga las notas desde localStorage y las muestra
 */
function loadNotes() {
    const notesContainer = document.getElementById("notesContainer");
    if (!notesContainer) return;
    
    // Obtener notas de localStorage
    const notes = getNotes();
    
    // Mostrar las notas o un mensaje vacío
    if (notes.length > 0) {
        notesContainer.innerHTML = notes.map(note => `
            <div class="note-item ${note.completed ? 'completed' : ''}">
                <input type="checkbox" class="note-checkbox" data-id="${note.id}" ${note.completed ? 'checked' : ''}>
                <span class="note-text">${escapeHtml(note.text)}</span>
                <button class="note-delete" data-id="${note.id}">×</button>
            </div>
        `).join('');
    } else {
        notesContainer.innerHTML = '<div class="empty-notes-message">No hay recordatorios. ¡Agrega uno nuevo!</div>';
    }
}

/**
 * Obtiene las notas guardadas en localStorage
 */
function getNotes() {
    try {
        const notesJSON = localStorage.getItem('losSS_notes');
        return notesJSON ? JSON.parse(notesJSON) : [];
    } catch (error) {
        console.error("Error al obtener notas:", error);
        return [];
    }
}

/**
 * Guarda las notas en localStorage
 */
function saveNotes(notes) {
    try {
        localStorage.setItem('losSS_notes', JSON.stringify(notes));
    } catch (error) {
        console.error("Error al guardar notas:", error);
        if (typeof mostrarToast === 'function') {
            mostrarToast("Error al guardar tus recordatorios", "error");
        }
    }
}

/**
 * Agrega una nueva nota
 */
function addNewNote() {
    const newNoteInput = document.getElementById("newNoteInput");
    const text = newNoteInput.value.trim();
    
    if (text.length === 0) return;
    
    // Crear nueva nota
    const notes = getNotes();
    const newNote = {
        id: Date.now().toString(),
        text: text,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    // Añadir al principio del array para que aparezca primero
    notes.unshift(newNote);
    
    // Guardar y recargar
    saveNotes(notes);
    loadNotes();
    
    // Limpiar input
    newNoteInput.value = '';
    newNoteInput.focus();
}

/**
 * Cambia el estado de una nota (completada/pendiente)
 */
function toggleNoteStatus(noteId) {
    const notes = getNotes();
    const noteIndex = notes.findIndex(note => note.id === noteId);
    
    if (noteIndex >= 0) {
        notes[noteIndex].completed = !notes[noteIndex].completed;
        saveNotes(notes);
        loadNotes();
    }
}

/**
 * Elimina una nota
 */
function deleteNote(noteId) {
    const notes = getNotes();
    const filteredNotes = notes.filter(note => note.id !== noteId);
    
    saveNotes(filteredNotes);
    loadNotes();
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function updateQuickAccessBadges(){
   try{
       await abrirDB();
       const ventas = await obtenerTodasLasVentas() || [];
       const pendientes = ventas.filter(v=> v.tipoPago === 'credito' && v.estadoPago !== 'Pagado Total').length;
       const cxcBtn = document.querySelector('.quick-button[data-badge="cxc"] .badge-count');
       if(cxcBtn){
           if(pendientes>0){
               cxcBtn.style.display='block';
               cxcBtn.textContent = pendientes>99 ? '99+' : pendientes;
           }else{
               cxcBtn.style.display='none';
           }
       }
   }catch(e){console.error('Error badge',e);}
}
