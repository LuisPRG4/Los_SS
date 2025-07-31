// chatbot-voz.js - Funcionalidad de reconocimiento de voz para el chatbot
// Utiliza la Web Speech API disponible en navegadores modernos

document.addEventListener("DOMContentLoaded", () => {
  console.log("Cargando funcionalidad de voz para chatbot");
  
  // Verificar si la API de reconocimiento de voz está disponible
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn("La API de reconocimiento de voz no está disponible en este navegador");
    return;
  }
  
  console.log("API de reconocimiento de voz disponible");
  
  // Crear instancia de reconocimiento de voz
  const recognition = new SpeechRecognition();
  recognition.continuous = false; // Solo escuchar una vez
  recognition.interimResults = false; // No mostrar resultados intermedios
  recognition.lang = 'es-ES'; // Idioma español
  
  // Elementos del DOM
  const btnChatbot = document.getElementById("btnChatbot");
  const panelChatbot = document.getElementById("panelChatbot");
  const chatbotSearch = document.getElementById("chatbotSearch");
  
  console.log("Elementos del DOM encontrados:", { btnChatbot, panelChatbot, chatbotSearch });
  
  // Verificar si estamos en una página con chatbot
  if (!btnChatbot || !panelChatbot) {
    console.warn("No se encontraron los elementos necesarios para el chatbot");
    return;
  }
  
  console.log("Elementos del chatbot encontrados, inicializando funcionalidad de voz");
  
  // Crear botón de micrófono
  const crearBotonVoz = () => {
    console.log("Creando botón de voz");
    const botonVoz = document.createElement("button");
    botonVoz.id = "btnVozChatbot";
    botonVoz.className = "miniBoton dorado";
    botonVoz.title = "Habla con el chatbot";
    botonVoz.innerHTML = "🎤";
    botonVoz.style.marginTop = "10px";
    botonVoz.style.display = "none"; // Oculto por defecto
    
    console.log("Intentando insertar botón de voz en el menú lateral");
    // Insertar el botón en el menú lateral, después del botón de chatbot
    const miniMenu = document.getElementById("miniMenuLateral");
    console.log("Elemento miniMenuLateral encontrado:", miniMenu);
    if (miniMenu) {
      // Buscar la posición del botón de chatbot dentro del menú
      const btnChatbotInMenu = miniMenu.querySelector("#btnChatbot");
      console.log("Botón de chatbot encontrado en menú:", btnChatbotInMenu);
      if (btnChatbotInMenu && btnChatbotInMenu.nextSibling) {
        console.log("Insertando botón de voz después del botón de chatbot");
        miniMenu.insertBefore(botonVoz, btnChatbotInMenu.nextSibling);
      } else {
        console.log("Agregando botón de voz al final del menú");
        miniMenu.appendChild(botonVoz);
      }
    } else {
      console.log("No se encontró miniMenuLateral, usando método fallback");
      // Fallback: insertar después del botón de chatbot como antes
      btnChatbot.parentNode.insertBefore(botonVoz, btnChatbot.nextSibling);
    }
    
    console.log("Botón de voz creado e insertado");
    return botonVoz;
  };
  
  const btnVoz = crearBotonVoz();
  console.log("Botón de voz creado:", btnVoz);
  
  // Mostrar/ocultar botón de voz según el estado del panel
  const toggleBotonVoz = () => {
    console.log("Ejecutando toggleBotonVoz, estado del panel:", panelChatbot.style.display);
    if (panelChatbot.style.display === "block") {
      btnVoz.style.display = "block";
      console.log("Botón de voz mostrado");
    } else {
      btnVoz.style.display = "none";
      console.log("Botón de voz ocultado");
    }
  };
  
  // Event listeners para mostrar/ocultar el botón de voz
  btnChatbot.addEventListener("click", () => {
    console.log("Botón de chatbot clickeado");
    setTimeout(toggleBotonVoz, 100); // Pequeño retraso para asegurar que el panel se haya mostrado
  });
  
  const cerrarChatbot = document.getElementById("cerrarChatbot");
  if (cerrarChatbot) {
    console.log("Botón de cierre de chatbot encontrado");
    cerrarChatbot.addEventListener("click", () => {
      btnVoz.style.display = "none";
      console.log("Botón de voz ocultado al cerrar chatbot");
    });
  } else {
    console.log("Botón de cierre de chatbot no encontrado");
  }
  
  // Función para iniciar el reconocimiento de voz
  const iniciarReconocimiento = () => {
    try {
      recognition.start();
      btnVoz.innerHTML = "🎙️"; // Cambiar icono mientras escucha
      btnVoz.title = "Escuchando...";
    } catch (error) {
      console.error("Error al iniciar el reconocimiento de voz:", error);
      btnVoz.innerHTML = "❌";
      setTimeout(() => {
        btnVoz.innerHTML = "🎤";
        btnVoz.title = "Habla con el chatbot";
      }, 2000);
    }
  };
  
  // Evento para el botón de voz
  btnVoz.addEventListener("click", iniciarReconocimiento);
  
  // Evento cuando se reconoce el habla
  recognition.onresult = (event) => {
    const resultado = event.results[0][0].transcript;
    console.log("Texto reconocido:", resultado);
    
    // Restaurar icono del botón
    btnVoz.innerHTML = "🎤";
    btnVoz.title = "Habla con el chatbot";
    
    // Si hay un buscador de chatbot, poner el texto reconocido en él
    if (chatbotSearch) {
      chatbotSearch.value = resultado;
      // Disparar el evento de búsqueda
      const inputEvent = new Event('keyup');
      chatbotSearch.dispatchEvent(inputEvent);
    }
    
    // También intentar encontrar una pregunta que coincida
    buscarYMostrarRespuesta(resultado);
  };
  
  // Función para buscar y mostrar respuesta
  const buscarYMostrarRespuesta = (texto) => {
    // Esta función intentará encontrar una pregunta similar al texto reconocido
    const preguntas = document.querySelectorAll(".preguntaDinamica");
    
    for (let pregunta of preguntas) {
      const textoPregunta = pregunta.textContent.toLowerCase();
      const textoBuscado = texto.toLowerCase();
      
      // Buscar coincidencias parciales
      if (textoPregunta.includes(textoBuscado) || textoBuscado.includes(textoPregunta)) {
        pregunta.click(); // Hacer clic en la pregunta para mostrar la respuesta
        break;
      }
    }
  };
  
  // Evento cuando el reconocimiento termina
  recognition.onend = () => {
    // Restaurar icono del botón
    btnVoz.innerHTML = "🎤";
    btnVoz.title = "Habla con el chatbot";
  };
  
  // Evento para errores
  recognition.onerror = (event) => {
    console.error("Error en el reconocimiento de voz:", event.error);
    btnVoz.innerHTML = "❌";
    btnVoz.title = "Error de reconocimiento";
    
    setTimeout(() => {
      btnVoz.innerHTML = "🎤";
      btnVoz.title = "Habla con el chatbot";
    }, 2000);
  };
  
  // Mensaje de consola para indicar que la funcionalidad está lista
  console.log("Funcionalidad de voz para chatbot cargada");
});
