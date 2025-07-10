(function(){
  function updateIcons(){
    const online = navigator.onLine;
    document.querySelectorAll('.connection-icon').forEach(icon=>{
      if(!icon.dataset.wifi){
        icon.innerHTML = '<i class="fas fa-wifi"></i>';
        icon.dataset.wifi = 'true';
      }
      icon.classList.toggle('offline', !online);
      icon.classList.toggle('online', online);
      icon.title = online ? 'En línea' : 'Sin conexión';
    });
  }
  window.addEventListener('online', updateIcons);
  window.addEventListener('offline', updateIcons);
  updateIcons();
})(); 