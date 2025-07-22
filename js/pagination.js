// js/pagination.js
// Utilidades genéricas para paginar y ordenar listas o tablas sin depender de librerías externas.
// Autor: AI Assistant – 2025-07-07

(function () {
  /**
   * Crea controles de paginación dentro de un contenedor.
   * @param {HTMLElement} container  Contenedor donde insertar los botones
   * @param {number} totalPages      Cantidad total de páginas
   * @param {number} currentPage     Página actual (1-based)
   * @param {Function} onPageChange  Callback cuando se hace clic en un número
   */
  function crearControles(container, totalPages, currentPage, onPageChange) {
    container.innerHTML = "";
    if (totalPages <= 1) return; // Sin controles si solo hay una página

    const crearBtn = (text, page, disabled = false) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.disabled = disabled;
      btn.className = "btn-pagination";
      btn.onclick = () => onPageChange(page);
      return btn;
    };

    // Botón anterior
    container.appendChild(crearBtn("«", Math.max(1, currentPage - 1), currentPage === 1));

    // Números (máximo 5 visibles: actual ±2)
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
      const btnPage = crearBtn(i, i, false);
      if (i === currentPage) btnPage.classList.add("active");
      container.appendChild(btnPage);
    }

    // Botón siguiente
    container.appendChild(crearBtn("»", Math.min(totalPages, currentPage + 1), currentPage === totalPages));
  }

  /**
   * Paginación genérica de elementos del DOM.
   * Oculta/enseña elementos según la página.
   * @param {string} listSelector Selector del contenedor de elementos (ej. '#listaVentas').
   * @param {string} itemSelector Selector de elementos a paginar (ej. '.venta-card').
   * @param {number} currentPage  Página actual (1-based).
   * @param {number} rowsPerPage  Elementos por página.
   * @param {string} paginationContainerId Id del contenedor donde generar los controles.
   * @param {Function=} onPageChangeExtra  Llamado tras cambiar página.
   */
  function paginarDOM(listSelector, itemSelector, currentPage, rowsPerPage, paginationContainerId, onPageChangeExtra) {
    const lista = document.querySelector(listSelector);
    if (!lista) return;

    const items = Array.from(lista.querySelectorAll(itemSelector));
    const totalPages = Math.ceil(items.length / rowsPerPage) || 1;
    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;

    items.forEach((item, idx) => {
      item.style.display = idx >= startIdx && idx < endIdx ? "" : "none";
    });

    const pagContainer = document.getElementById(paginationContainerId) || crearContenedorPaginacion(lista, paginationContainerId);

    crearControles(pagContainer, totalPages, currentPage, (nuevaPag) => {
      paginarDOM(listSelector, itemSelector, nuevaPag, rowsPerPage, paginationContainerId, onPageChangeExtra);
      if (typeof onPageChangeExtra === "function") onPageChangeExtra(nuevaPag);
    });
  }

  /** Crea un contenedor de paginación al final de la lista si no existe */
  function crearContenedorPaginacion(lista, id) {
    const div = document.createElement("div");
    div.id = id;
    div.className = "pagination-container";
    lista.parentNode.insertBefore(div, lista.nextSibling);
    return div;
  }

  // Exponer funciones globalmente
  window.PaginacionUtils = {
    paginarDOM,
  };
})(); 
