// ... [El resto del código de script.js permanece igual] ...

function borrarDatos() {
    if (confirm("¿Estás seguro de que quieres borrar TODOS los datos del torneo (jugadores, resultados y configuración)? Esta acción es irreversible.")) {
        localStorage.clear();
        
        // Reiniciar variables a su estado inicial
        participantes = [];
        partidos = [];
        grupos = { A: [], B: [] };
        MAX_JUGADORES = 10; // Restablecer al valor inicial

        alert("Todos los datos han sido borrados. La aplicación se ha reiniciado.");
        // Recargar la UI
        location.reload(); 
    }
}

// ... [El resto del código de script.js permanece igual] ...
