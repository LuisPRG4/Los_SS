document.addEventListener("DOMContentLoaded", () => {
  const miniMenu = document.getElementById("miniMenuLateral");
  const btnAyuda = document.getElementById("btnAyudaFlotante");
  const btnChatbot = document.getElementById("btnChatbot");
  const panelChatbot = document.getElementById("panelChatbot");
  const ayudaSection = document.getElementById("ayuda");
  const cerrarChatbot = document.getElementById("cerrarChatbot");
  const cerrarAyuda = document.getElementById("cerrarAyuda");
  const toggleMiniMenu = document.getElementById("toggleMiniMenu");

  let respuestasChatbot = {
  inventario: {
    errorStock: `
      <strong>Errores comunes con el stock:</strong>
      <ul>
        <li>No ingresar números negativos o textos en los campos de stock.</li>
        <li>Asegúrate de que el stock máximo sea mayor o igual al stock mínimo.</li>
        <li>Verifica que el stock actual no sea menor que el stock mínimo para evitar alertas constantes.</li>
      </ul>
    `,
    imagenProducto: `
      <strong>Problemas con la imagen del producto:</strong>
      <p>Si la imagen no se muestra después de seleccionarla, verifica que el archivo sea una imagen válida (jpg, png, gif).</p>
      <p>Además, algunas imágenes muy pesadas o formatos no soportados pueden no cargarse correctamente.</p>
    `,
    recomendacionPrecios: `
      <strong>Recomendaciones para precios:</strong>
      <ul>
        <li>Define precios basados en el costo más un margen razonable para cubrir gastos y ganancias.</li>
        <li>Revisa periódicamente los precios para ajustarlos según mercado y competencia.</li>
        <li>Evita poner precios negativos o cero, a menos que sea una promoción especial.</li>
      </ul>
    `,
    cancelarEdicion: `
      <strong>¿Cómo cancelar una edición?</strong>
      <p>Si iniciaste a editar un producto pero quieres cancelar, simplemente pulsa el botón "Cancelar" que aparecerá durante la edición para limpiar el formulario y volver al modo de agregar.</p>
    `,
    proveedorOpcional: `
      <strong>¿Por qué el proveedor es opcional?</strong>
      <p>El proveedor es opcional para que puedas registrar productos propios o sin un proveedor definido sin problemas.</p>
      <p>Sin embargo, si quieres llevar un control más detallado, te recomiendo siempre asignar un proveedor cuando sea posible.</p>
    `
  },

  clientes: {
    variosTelefonos: `
      <strong>¿Puedo registrar varios números?</strong>
      <p>Actualmente solo puedes registrar un número de contacto. Si necesitas varios, puedes escribirlos separados en el campo dirección como medida temporal.</p>
    `,
    agregarRapido: `
      <strong>¿Cómo agregar un cliente desde el buscador?</strong>
      <p>Si escribes el nombre en el buscador y no existe, se mostrará un botón para agregarlo rápidamente con un clic sin llenar todo el formulario.</p>
    `,
    editarEliminar: `
      <strong>Editar o eliminar clientes</strong>
      <p>Para editar usa el botón ✏️ y para eliminar el botón 🗑️ junto a cada cliente. Ten cuidado al eliminar, no se puede deshacer.</p>
    `,
    busquedaCorreo: `
      <strong>¿Puedo buscar por correo?</strong>
      <p>Por ahora, solo se puede buscar por nombre, dirección o teléfono, no por correo electrónico.</p>
    `,
    formatoTelefono: `
      <strong>Formato recomendado para el teléfono:</strong>
      <p>Ingresa solo números sin espacios ni símbolos: por ejemplo <code>5512345678</code>.</p>
    `,
    correoObligatorio: `
      <strong>¿Es obligatorio el correo?</strong>
      <p>No, pero es recomendable para tener contacto con tus clientes, enviar promociones o avisos de pago.</p>
    `,
    clientesDuplicados: `
      <strong>Evitar clientes duplicados</strong>
      <p>Siempre busca primero por nombre antes de agregar. Si ves que no existe, entonces agrégalo. Así evitarás tener datos repetidos.</p>
    `,
    corregirNombre: `
      <strong>¿Cómo corrijo errores en nombre u otros datos?</strong>
      <p>Usa el botón ✏️ y vuelve a escribir el nombre, dirección o cualquier dato mal ingresado.</p>
    `,
    exportarClientes: `
      <strong>¿Puedo exportar la lista de clientes?</strong>
      <p>De momento no hay opción de exportar, pero en el futuro podría añadirse. Puedes copiar la lista manualmente si lo necesitas.</p>
    `,
    eliminarError: `
      <strong>¿Qué pasa si elimino un cliente por error?</strong>
      <p>No se puede recuperar. Tendrás que ingresarlo nuevamente si fue un error. Más adelante podríamos permitir deshacer.</p>
    `
  },

  mermas: {
  motivosMerma: `
    <strong>¿Qué motivo debo elegir?</strong>
    <p>Selecciona el que más se ajuste a la causa de la pérdida: vencido, dañado, roto, o "Otro" si no está en la lista.</p>
    <p>Esto te ayudará a llevar mejores reportes en el futuro.</p>
  `,
  productoNoAparece: `
    <strong>¿Qué hacer si el producto no aparece?</strong>
    <p>Asegúrate de haberlo registrado primero en el inventario. Solo los productos existentes se pueden reportar como merma.</p>
  `,
  editarMerma: `
    <strong>¿Puedo editar una merma?</strong>
    <p>Por ahora, solo puedes eliminarla y registrar nuevamente si cometiste un error.</p>
  `,
  afectaInventario: `
    <strong>¿Esto afecta al inventario?</strong>
    <p>Sí, al registrar una merma, se descuenta la cantidad del stock automáticamente.</p>
  `,
  motivoOtro: `
    <strong>¿Qué pasa si selecciono "Otro"?</strong>
    <p>Podrás escribir el motivo específico en el campo que aparece. Así puedes personalizar el motivo según el caso.</p>
  `,
  exportarMerma: `
    <strong>¿Cómo exportar el historial?</strong>
    <p>Usa el botón "⬇️ Exportar" y elige entre PDF o Excel para guardar un reporte de tus mermas.</p>
  `,
  errorCantidad: `
    <strong>¿Qué hago si me equivoqué en la cantidad?</strong>
    <p>Debes eliminar el registro incorrecto y volver a ingresarlo con la cantidad correcta.</p>
  `
  },

  ventas: {
  registrarMultiproducto: `
    <strong>¿Cómo registrar una venta con varios productos?</strong>
    <p>Selecciona un producto, indica la cantidad y pulsa en "Agregar Producto". Repite este proceso para todos los productos que desees incluir.</p>
  `,
  tiposPago: `
    <strong>¿Qué opciones de pago hay?</strong>
    <p>Puedes elegir entre <strong>Contado</strong> (efectivo, transferencia, pago móvil) o <strong>Crédito</strong> (con fecha de vencimiento).</p>
  `,
  registrarAbono: `
    <strong>¿Cómo registrar un abono a una venta a crédito?</strong>
    <p>Ve al historial, busca la venta correspondiente, y haz clic en "Abonar". Podrás ver los detalles y registrar un nuevo pago.</p>
  `,
  clienteNuevo: `
    <strong>¿Qué hago si no encuentro al cliente?</strong>
    <p>Puedes ir al módulo de clientes y registrar uno nuevo. El buscador se actualizará automáticamente si recargas la página.</p>
  `,
  exportarVentas: `
    <strong>¿Puedo exportar mis ventas?</strong>
    <p>Sí, puedes exportarlas tanto a <strong>Excel</strong> como a <strong>PDF</strong> desde el historial de ventas.</p>
  `
  },

  proveedores: {
  agregarProveedor: `
    <strong>¿Cómo agregar un proveedor?</strong>
    <p>Completa el formulario con nombre, empresa, teléfono y productos que suministra y pulsa "Guardar Proveedor".</p>
  `,
  editarEliminarProveedor: `
    <strong>¿Cómo editar o eliminar un proveedor?</strong>
    <p>Usa los botones ✏️ para editar y 🗑️ para eliminar en la lista de proveedores.</p>
  `,
  buscarProveedor: `
    <strong>¿Cómo buscar un proveedor?</strong>
    <p>Escribe el nombre, empresa, teléfono o producto en el buscador para filtrar rápidamente.</p>
  `,
  productosProveedor: `
    <strong>¿Cómo registrar productos que suministra?</strong>
    <p>En el campo "Producto que suministra" puedes listar los productos separados por comas o espacios.</p>
  `,
  telefonoFormato: `
    <strong>¿Cuál es el formato correcto para el teléfono?</strong>
    <p>Solo números sin espacios ni símbolos, por ejemplo: <code>5512345678</code>.</p>
  `
},

cuentasPorCobrar: {
  queEsCuentaPorCobrar: `
    <strong>¿Qué es una cuenta por cobrar?</strong>
    <p>Es una venta realizada a crédito que aún no ha sido pagada completamente por el cliente.</p>
  `,
  registrarAbono: `
    <strong>¿Cómo registrar un abono a una cuenta?</strong>
    <p>Selecciona la venta pendiente, ingresa el monto del abono y confirma para actualizar el saldo pendiente.</p>
  `,
  filtrarCuentas: `
    <strong>¿Cómo uso los filtros para buscar cuentas?</strong>
    <p>Usa los campos de cliente, estado de pago y fecha de vencimiento para encontrar cuentas específicas.</p>
  `,
  estadoPago: `
    <strong>¿Qué significan los estados de pago?</strong>
    <ul>
      <li><em>Pendiente:</em> No se ha realizado ningún abono.</li>
      <li><em>Pagado Parcial:</em> Se han hecho abonos pero queda saldo pendiente.</li>
      <li><em>Pagado:</em> La cuenta está saldada completamente.</li>
    </ul>
  `,
  fechaVencimiento: `
    <strong>¿Para qué sirve la fecha de vencimiento?</strong>
    <p>Es la fecha límite para que el cliente realice el pago completo o los abonos de la venta a crédito.</p>
  `,
  abonoParcial: `
    <strong>¿Puedo hacer abonos parciales?</strong>
    <p>Sí, puedes registrar pagos parciales hasta completar el monto total de la venta.</p>
  `,
  ventasVencidas: `
    <strong>¿Cómo identificar ventas vencidas o próximas?</strong>
    <p>El sistema muestra las ventas vencidas en rojo y las próximas en alerta para que puedas actuar a tiempo.</p>
  `,
  editarCuentas: `
    <strong>¿Puedo editar o eliminar una cuenta por cobrar?</strong>
    <p>Sí, puedes modificar los datos o eliminar cuentas, pero hazlo con precaución para no perder información importante.</p>
  `,
  notificaciones: `
    <strong>¿Cómo recibir notificaciones de cuentas vencidas?</strong>
    <p>Actualmente el sistema muestra alertas visuales, y en futuras actualizaciones podrás activar notificaciones personalizadas.</p>
  `,
  exportarCuentas: `
    <strong>¿Puedo exportar el historial de cuentas por cobrar?</strong>
    <p>Sí, puedes exportar a Excel o PDF para generar reportes y análisis.</p>
  `
},

reportes: {
  tipoGrafico: `
    <strong>¿Qué tipos de gráficos puedo usar?</strong>
    <p>Puedes elegir entre gráficos de pastel, barras y líneas para visualizar tus datos de forma clara y atractiva.</p>
  `,
  filtrarFechas: `
    <strong>¿Cómo filtrar reportes por fecha?</strong>
    <p>Usa los campos de "Desde" y "Hasta" para seleccionar un rango de fechas y luego presiona el botón "Filtrar" para actualizar los gráficos.</p>
  `,
  exportarExcel: `
    <strong>¿Cómo exportar los datos a Excel?</strong>
    <p>Presiona el botón "Exportar ventas a Excel" para descargar un archivo con los datos actuales filtrados para un análisis más detallado.</p>
  `,
  agruparDatos: `
    <strong>¿Qué significa agrupar por semana o mes?</strong>
    <p>Al agrupar por semana o mes, los datos se suman y muestran en períodos específicos, facilitando la visualización de tendencias a mediano plazo.</p>
  `,
  reportesEspeciales: `
    <strong>¿Qué son los reportes especiales?</strong>
    <p>Son reportes que muestran datos específicos como ventas a crédito, cobranzas, ventas por producto o fecha, y ventas recurrentes para un análisis detallado.</p>
  `,
  buscarEnReportes: `
    <strong>¿Cómo usar el buscador en reportes especiales?</strong>
    <p>Cuando accedes a un reporte especial con lista, usa el buscador para filtrar la información por cliente o producto según corresponda.</p>
  `,
  productosMasVendidos: `
    <strong>¿Cómo ver los productos más vendidos?</strong>
    <p>En el módulo de reportes, el gráfico "Productos Más Vendidos" muestra cuáles son los artículos con mayor cantidad de ventas.</p>
  `,
  ventasPorCliente: `
    <strong>¿Cómo visualizar ventas por cliente?</strong>
    <p>El gráfico "Ventas por Cliente" permite analizar cuánto compra cada cliente, ayudándote a identificar tus mejores compradores.</p>
  `,
  tipoPago: `
    <strong>¿Qué muestra el gráfico de tipo de pago?</strong>
    <p>Este gráfico indica la proporción de ventas hechas a crédito o al contado, para entender mejor las formas de pago preferidas.</p>
  `,
  erroresComunes: `
    <strong>¿Qué hago si un reporte no carga?</strong>
    <p>Intenta refrescar la página, verifica tu conexión a internet y revisa que los filtros estén bien configurados. Si el problema persiste, contacta soporte.</p>
  `
},

finanzas: {
  nuevoMovimiento: `
    <strong>¿Cómo registro un nuevo movimiento?</strong>
    <p>Selecciona el tipo de movimiento (Ingreso o Gasto), escribe el monto y una descripción, luego haz clic en "Guardar Movimiento".</p>
  `,
  ingresoVsGasto: `
    <strong>¿Cuál es la diferencia entre ingreso y gasto?</strong>
    <p>Un <strong>Ingreso</strong> representa dinero que entra (como ventas o abonos) y un <strong>Gasto</strong> es dinero que sale (como compras o pagos).</p>
  `,
  reiniciarTodo: `
    <strong>¿Qué hace el botón "Reiniciar todo"?</strong>
    <p>Este botón borra todos los movimientos registrados. Solo debe usarse si estás seguro, ya que esta acción es irreversible.</p>
  `,
  filtrarFecha: `
    <strong>¿Cómo filtrar movimientos por fecha?</strong>
    <p>Selecciona las fechas en los campos "Desde" y "Hasta" y luego presiona "Aplicar Filtro" para ver solo los movimientos dentro de ese rango.</p>
  `,
  buscarMovimiento: `
    <strong>¿Cómo buscar un movimiento específico?</strong>
    <p>Escribe palabras clave en el buscador (por ejemplo "compra", "ingreso", "efectivo") y se filtrarán los movimientos que coincidan.</p>
  `,
  graficoFinanzas: `
    <strong>¿Qué muestra el gráfico financiero?</strong>
    <p>El gráfico visualiza la proporción entre tus ingresos y gastos, permitiéndote ver de forma clara tu situación financiera.</p>
  `,
  gananciaInventario: `
    <strong>¿Qué es la ganancia potencial del inventario?</strong>
    <p>Es el beneficio estimado que obtendrías si vendes todo tu inventario al precio de venta, restando el costo de adquisición.</p>
  `,
  editarEliminarMovimiento: `
    <strong>¿Puedo editar o eliminar movimientos?</strong>
    <p>Sí, desde el historial de movimientos puedes modificar o borrar registros individuales si necesitas corregir algo.</p>
  `,
  exportarFinanzas: `
    <strong>¿Puedo exportar mis finanzas a Excel?</strong>
    <p>Sí, pulsa el botón "📤 Exportar a Excel" para guardar tus movimientos en un archivo que puedes abrir con Excel o Google Sheets.</p>
  `,
  problemasFinanzas: `
    <strong>¿Qué hago si no se actualiza el balance?</strong>
    <p>Verifica que no tengas filtros activos y asegúrate de que los movimientos están correctamente registrados. Si el problema persiste, recarga la página.</p>
  `
},

pedidos: {
  agregarPedido: `
    <strong>¿Cómo agregar un pedido?</strong>
    <p>Selecciona el cliente, elige el producto, ingresa la cantidad y haz clic en "Agregar Pedido". El sistema hará los cálculos automáticamente.</p>
  `,
  precioAutomatico: `
    <strong>¿El precio se calcula solo?</strong>
    <p>Sí. Al elegir un producto, se muestra automáticamente su precio unitario. Este no se puede modificar manualmente.</p>
  `,
  editarPedido: `
    <strong>¿Puedo editar un pedido ya creado?</strong>
    <p>Sí. Presiona el botón ✏️ del pedido que desees modificar, y sus datos subirán al formulario para que puedas actualizarlos.</p>
  `,
  eliminarPedido: `
    <strong>¿Qué pasa si elimino un pedido?</strong>
    <p>Si el pedido no ha sido entregado, el sistema devolverá automáticamente el stock al inventario. Si ya fue entregado, no se hará ajuste.</p>
  `,
  stockDescontado: `
    <strong>¿El stock se descuenta automáticamente?</strong>
    <p>Sí. Cuando agregas un pedido, la cantidad del producto se descuenta del inventario de forma automática.</p>
  `,
  clienteNoAparece: `
    <strong>¿Qué hago si no aparece el cliente?</strong>
    <p>Primero asegúrate de haberlo registrado en el módulo Clientes. Solo los clientes registrados aparecerán en la lista.</p>
  `,
  limpiarTodos: `
    <strong>¿Qué hace el botón "Limpiar todos los pedidos"?</strong>
    <p>Elimina todos los pedidos registrados. Asegúrate de usarlo solo si estás seguro, ya que también ajusta el stock si corresponde.</p>
  `,
  cambiarEstado: `
    <strong>¿Cómo cambiar el estado de un pedido?</strong>
    <p>Desde la lista de pedidos, puedes hacer clic en el estado para alternarlo entre "Pendiente", "Preparado" y "Entregado".</p>
  `,
  pedidoCancelado: `
    <strong>¿Se recupera el stock si cancelo un pedido?</strong>
    <p>Sí. Si cancelas un pedido que aún no fue entregado, el sistema sumará de nuevo la cantidad al inventario automáticamente.</p>
  `,
  multiplesPedidos: `
    <strong>¿Puedo registrar múltiples pedidos seguidos?</strong>
    <p>¡Claro! Después de agregar un pedido, el formulario quedará listo para ingresar uno nuevo sin tener que recargar la página.</p>
  `
},

novedades: {
  queEsNovedades: `
    <strong>¿Qué es el módulo Novedades?</strong>
    <p>Es un espacio donde puedes conocer los cambios, mejoras, correcciones y nuevas funciones que se han implementado en el sistema.</p>
  `,
  comoSeOrganiza: `
    <strong>¿Cómo se organiza la información?</strong>
    <p>Las novedades están agrupadas por versión. Cada versión tiene su número, fecha y una lista detallada de lo que se cambió o agregó.</p>
  `,
  historialActualizaciones: `
    <strong>¿Dónde veo el historial de versiones?</strong>
    <p>En la parte inferior del módulo Novedades verás tarjetas que representan las versiones anteriores, en orden cronológico.</p>
  `,
  cambiosImportantes: `
    <strong>¿Cómo saber si hubo cambios importantes?</strong>
    <p>Las novedades clave o más destacadas se marcan con íconos como ✨ o 🎨 y se colocan al principio para que sean fácilmente visibles.</p>
  `,
  ultimaVersion: `
    <strong>¿Cómo saber cuál es la última versión?</strong>
    <p>La versión más reciente siempre estará en la parte superior de la lista, junto con la fecha en que fue lanzada.</p>
  `,
  versionesAnteriores: `
    <strong>¿Puedo ver qué había en versiones anteriores?</strong>
    <p>Sí. Todas las versiones anteriores están listadas en orden descendente, con su contenido intacto para referencia histórica.</p>
  `
}

};

  btnAyuda?.addEventListener("click", () => {
    ayudaSection?.classList.add("visible");
    panelChatbot?.classList.remove("panelVisible");
    miniMenu?.classList.add("oculto");
    ayudaSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  cerrarAyuda?.addEventListener("click", () => {
    ayudaSection?.classList.remove("visible");
    miniMenu?.classList.remove("oculto");
  });

  btnChatbot?.addEventListener("click", () => {
    panelChatbot?.classList.add("panelVisible");
    ayudaSection?.classList.remove("visible");
    miniMenu?.classList.add("oculto");
  });

  cerrarChatbot?.addEventListener("click", () => {
    panelChatbot?.classList.remove("panelVisible");
    miniMenu?.classList.remove("oculto");
  });

  toggleMiniMenu?.addEventListener("click", () => {
    miniMenu.classList.toggle("retraido");
  });

  window.mostrarRespuesta = function (pregunta) {
  const respuesta = document.getElementById("respuestaChatbot");
  let texto = "";

  // Buscar en todos los módulos
  for (const modulo in respuestasChatbot) {
    if (pregunta in respuestasChatbot[modulo]) {
      texto = respuestasChatbot[modulo][pregunta];
      break;
    }
  }

  if (!texto) {
    texto = `<p>Lo siento, no tengo información sobre eso aún.</p>`;
  }

  respuesta.innerHTML = texto;
};

  // ──────────────────────────────────────────────
  // Carga dinámica de respuestas desde archivo JSON externo
  // y generación automática de botones + buscador
  // ──────────────────────────────────────────────

  const JSON_PATH = "resources/chatbot-respuestas.json";

  // IIFE asíncrona para cargar base de conocimiento una vez iniciado el DOM
  (async function cargarBaseConocimiento() {
    try {
      const resp = await fetch(JSON_PATH);
      if (resp.ok) {
        const data = await resp.json();
        // Combina lo que ya existe con lo que viene del archivo (el JSON sobrescribe si hay claves iguales)
        respuestasChatbot = { ...respuestasChatbot, ...data };
      } else {
        console.warn("No se encontró "+JSON_PATH+"; se usará la base embebida.");
      }
    } catch (err) {
      console.error("Error cargando la base externa del chatbot:", err);
    }

    // Cuando termina la carga (o falla) generamos los botones dinámicos
    generarPreguntasDinamicas();
  })();

  // Devuelve el identificador de módulo a partir del <h3> del panel
  function detectarModuloChatbot() {
    const h3 = document.querySelector("#panelChatbot h3");
    if (!h3) return null;
    const texto = h3.textContent.toLowerCase();
    const mapa = {
      inventario: "inventario",
      clientes: "clientes",
      mermas: "mermas",
      ventas: "ventas",
      proveedores: "proveedores",
      "cuentas por cobrar": "cuentasPorCobrar",
      reportes: "reportes",
      finanzas: "finanzas",
      pedidos: "pedidos",
      novedades: "novedades",
    };
    for (const clave in mapa) {
      if (texto.includes(clave)) return mapa[clave];
    }
    return null;
  }

  // Construye los botones de preguntas y el buscador dentro del contenedor
  function generarPreguntasDinamicas() {
    const modulo = detectarModuloChatbot();
    const contenedor = document.getElementById("chatbotContenido");
    if (!contenedor || !modulo || !respuestasChatbot?.[modulo]) return;

    // Crea / reutiliza buscador
    let buscador = document.getElementById("chatbotSearch");
    if (!buscador) {
      buscador = document.createElement("input");
      buscador.id = "chatbotSearch";
      buscador.placeholder = "Escribe tu duda…";
      buscador.classList.add("buscadorChatbot");
      contenedor.prepend(buscador);
    }

    const preguntas = Object.entries(respuestasChatbot[modulo]);

    const render = (lista) => {
      // Elimina botones creados previamente para evitar duplicados
      contenedor.querySelectorAll("button.preguntaDinamica").forEach(b => b.remove());
      lista.forEach(([clave]) => {
        const btn = document.createElement("button");
        btn.className = "preguntaDinamica";
        btn.textContent = formatearClavePreg(clave);
        btn.onclick = () => window.mostrarRespuesta(clave);
        contenedor.appendChild(btn);
      });
    };

    buscador.onkeyup = (e) => {
      const filtro = e.target.value.toLowerCase();
      const filtradas = preguntas.filter(([k]) => k.toLowerCase().includes(filtro));
      render(filtradas);
    };

    // Render inicial sin filtro
    render(preguntas);
  }

  // Convierte camelCase o notación similar en texto legible
  function formatearClavePreg(clave) {
    return clave.replace(/([A-Z])/g, " $1").replace(/^./, m => m.toUpperCase()).trim() + "?";
  }

});
