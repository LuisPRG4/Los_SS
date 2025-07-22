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


document.addEventListener("DOMContentLoaded", filtrarKPIsVisuales);
