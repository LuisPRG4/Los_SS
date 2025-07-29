// --- Configuración de KPIs Personalizados ---
const KPIS_DISPONIBLES = {
  ventasHoy: "Ventas del día",
  ventasSemana: "Ventas de la semana",
  productoTop: "Producto más vendido",
  totalProductos: "Productos registrados",
  totalStock: "Stock total",
  totalVendidos: "Total vendidos",
  totalGananciaBruta: "Ganancia bruta"
};

// Muestra el formulario de configuración
function mostrarConfiguracionKPI() {
  const contenedor = document.getElementById("configKpi");
  if (!contenedor) return;
  contenedor.style.display = "block";

  const seleccionados = JSON.parse(localStorage.getItem("kpiSeleccionados")) || Object.keys(KPIS_DISPONIBLES);

  document.querySelectorAll("#formKpi input").forEach(input => {
    input.checked = seleccionados.includes(input.value);
  });

  document.getElementById("formKpi").onsubmit = function (e) {
    e.preventDefault();
    const nuevos = Array.from(document.querySelectorAll("#formKpi input:checked"))
      .map(el => el.value);
    localStorage.setItem("kpiSeleccionados", JSON.stringify(nuevos));
    alert("Configuración guardada correctamente");
    location.reload();
  };
}

// Elimina los KPIs no seleccionados al cargar la página
function filtrarKPIsVisuales() {
  const seleccionados = JSON.parse(localStorage.getItem("kpiSeleccionados")) || Object.keys(KPIS_DISPONIBLES);
  document.querySelectorAll(".kpis .kpi").forEach(div => {
    const span = div.querySelector("span[id]");
    if (span) {
      const id = span.id;
      if (!seleccionados.includes(id)) {
        div.remove(); // Oculta el KPI no seleccionado
      }
    }
  });
}

//CERRAR AJUSTES DE KPI:
function cerrarConfiguracionKPI() {
  const contenedor = document.getElementById("configKpi");
  if (contenedor) contenedor.style.display = "none";
}

// Función para inicializar el toggle del formulario de mermas
function inicializarToggleFormularioMermas() {
  const toggleBtn = document.getElementById('toggleFormMermasBtn');
  const formulario = document.getElementById('formularioMerma');
  
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
        toggleBtn.textContent = '➕ Agregar Merma';
        
        // Después de la animación, ocultar el formulario
        setTimeout(() => {
          formulario.style.display = 'none';
          formulario.classList.remove('slide-up');
        }, 500);
      }
    });
  }
}

// Inicializar el toggle cuando el DOM esté cargado
document.addEventListener("DOMContentLoaded", function() {
  filtrarKPIsVisuales();
  inicializarToggleFormularioMermas();
});
