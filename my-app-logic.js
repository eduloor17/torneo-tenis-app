// Este archivo se carga DESPUÉS de la inicialización de Firebase
// y tiene acceso a las variables globales 'db' y 'firebase'.

// ==========================================================
// VARIABLES Y LÓGICA ORIGINAL DEL TORNEO
// ==========================================================

let participantes = [];
let partidos = []; // Partidos de Fase de Grupos
let grupos = { A: [], B: [] };
let playoffs = {
    semifinales: [],
    tercerPuesto: null,
    final: null
};
let MAX_JUGADORES = 10; // VALOR INICIAL

// Variable global para el ID del torneo actual en Firebase.
let currentTournamentId = localStorage.getItem('currentTournamentId') || null;

// --- UTILIDAD DE RETRY CON EXPONENCIAL BACKOFF ---

/**
 * Intenta ejecutar una función (operación de Firebase) con reintentos
 * utilizando un retardo exponencial.
 * @param {function} operation - Función asíncrona a ejecutar (ej: db.collection().add()).
 * @param {number} retries - Número máximo de reintentos.
 * @param {number} delay - Retraso inicial en milisegundos.
 */
async function retryWithBackoff(operation, retries = 5, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            // Reintentar solo si no es el último intento
            if (i === retries - 1) {
                throw error; // Lanza el error si falló el último intento
            }
            // Espera con backoff exponencial (1s, 2s, 4s, 8s...)
            await new Promise(resolve => setTimeout(resolve, delay * (2 ** i)));
        }
    }
}


// --- GESTIÓN DE DATOS Y ESTADO ---

function cargarDatos() {
    const max = localStorage.getItem('maxJugadores');
    if (max) MAX_JUGADORES = parseInt(max);
    
    const p = localStorage.getItem('participantes');
    const pa = localStorage.getItem('partidos');
    const g = localStorage.getItem('grupos');
    const pl = localStorage.getItem('playoffs'); 
    
    participantes = p ? JSON.parse(p) : [];
    partidos = pa ? JSON.parse(pa) : [];
    grupos = g ? JSON.parse(g) : { A: [], B: [] };
    playoffs = pl ? JSON.parse(pl) : { semifinales: [], tercerPuesto: null, final: null }; 

    document.getElementById('max-jugadores-input').value = MAX_JUGADORES;
    actualizarIU();
    
    if (participantes.length === MAX_JUGADORES && grupos.A.length > 0) {
        document.getElementById('configuracion').style.display = 'none';
        document.getElementById('registro').style.display = 'none';
        document.getElementById('grupos-fixture').style.display = 'block';
        document.getElementById('ranking-finales').style.display = 'block';
        generarGruposHTML();
        generarPartidosGruposHTML();
        actualizarRankingYFinales();
    } else {
        document.getElementById('configuracion').style.display = 'block';
        document.getElementById('registro').style.display = 'block';
        document.getElementById('grupos-fixture').style.display = 'none';
        document.getElementById('ranking-finales').style.display = 'none';
    }
}

function guardarDatos() {
    localStorage.setItem('maxJugadores', MAX_JUGADORES);
    localStorage.setItem('participantes', JSON.stringify(participantes));
    localStorage.setItem('partidos', JSON.stringify(partidos));
    localStorage.setItem('grupos', JSON.stringify(grupos));
    localStorage.setItem('playoffs', JSON.stringify(playoffs)); 
}

function borrarDatos() {
    if (confirm("⚠️ ¿Estás seguro de que quieres borrar TODOS los datos del torneo (jugadores, resultados y configuración)? Esta acción es irreversible.")) {
        localStorage.clear();
        
        participantes = [];
        partidos = [];
        grupos = { A: [], B: [] };
        playoffs = { semifinales: [], tercerPuesto: null, final: null }; 
        MAX_JUGADORES = 10; 
        
        currentTournamentId = null; 
        localStorage.removeItem('currentTournamentId');

        alert("✅ Todos los datos han sido borrados. La aplicación se ha reiniciado.");
        location.reload(); 
    }
}

// --- CONFIGURACIÓN Y GESTIÓN DE PARTICIPANTES ---

function configurarMaxJugadores() {
    const input = document.getElementById('max-jugadores-input');
    const nuevoMax = parseInt(input.value);

    if (nuevoMax < 4 || nuevoMax % 2 !== 0) { 
        alert("El número de jugadores debe ser **al menos 4** y debe ser par (4, 6, 8...).");
        input.value = MAX_JUGADORES;
        return;
    }
    
    if (participantes.length > nuevoMax) {
        alert(`Ya hay ${participantes.length} jugadores registrados. El nuevo máximo debe ser mayor o igual.`);
        input.value = MAX_JUGADORES; 
        return;
    }

    MAX_JUGADORES = nuevoMax;
    partidos = [];
    grupos = { A: [], B: [] };
    playoffs = { semifinales: [], tercerPuesto: null, final: null };
    
    guardarDatos();
    actualizarIU();
    alert(`Torneo configurado para ${MAX_JUGADORES} jugadores.`);
    
    // Llama a la función de guardado en Firebase
    saveTournamentConfig(); 
}

function actualizarIU() {
    const lista = document.getElementById('lista-participantes');
    lista.innerHTML = '';
    participantes.forEach(nombre => {
        const li = document.createElement('li');
        li.textContent = nombre;
        lista.appendChild(li);
    });

    document.getElementById('max-jugadores-actual').textContent = MAX_JUGADORES;
    document.getElementById('max-participantes-display').textContent = MAX_JUGADORES;
    document.getElementById('contador-participantes').textContent = participantes.length;
    
    const btnIniciar = document.getElementById('btn-iniciar');
    if (participantes.length === MAX_JUGADORES && MAX_JUGADORES > 0) {
        btnIniciar.disabled = false;
        btnIniciar.textContent = '¡Iniciar Torneo!';
    } else {
        btnIniciar.disabled = true;
        btnIniciar.textContent = `Iniciar Torneo (Necesita ${MAX_JUGADORES - participantes.length} más)`;
    }
}

function agregarParticipante() {
    const input = document.getElementById('nombre-input');
    const nombre = input.value.trim();

    if (nombre && participantes.length < MAX_JUGADORES && !participantes.includes(nombre)) {
        participantes.push(nombre);
        input.value = '';
        guardarDatos();
        actualizarIU();
        
        // Llama a la función de guardado en Firebase
        saveTournamentConfig(); 
    } else if (participantes.length >= MAX_JUGADORES) {
        alert(`Ya se han añadido el máximo de ${MAX_JUGADORES} participantes.`);
    }
}

function iniciarTorneo() {
    if (participantes.length !== MAX_JUGADORES) {
        alert(`El torneo requiere exactamente ${MAX_JUGADORES} jugadores.`);
        return;
    }

    const mezclados = participantes.sort(() => Math.random() - 0.5);
    const mitad = MAX_JUGADORES / 2;
    grupos.A = mezclados.slice(0, mitad);
    grupos.B = mezclados.slice(mitad, MAX_JUGADORES);

    partidos = generarFixture(grupos.A).concat(generarFixture(grupos.B));
    partidos.forEach(p => {
        p.gamesJ1 = null;
        p.gamesJ2 = null;
        p.ganador = null;
        p.perdedor = null;
        p.tipo = 'Grupo'; 
    });
    
    playoffs = { semifinales: [], tercerPuesto: null, final: null };

    guardarDatos();
    document.getElementById('registro').style.display = 'none';
    document.getElementById('configuracion').style.display = 'none';
    document.getElementById('grupos-fixture').style.display = 'block';
    document.getElementById('ranking-finales').style.display = 'block';
    
    generarGruposHTML();
    generarPartidosGruposHTML(); 
    actualizarRankingYFinales();
    
    // Llama a la función de guardado en Firebase para marcar como 'Iniciado'
    saveTournamentConfig(); 
}

// --- Lógica del Fixture, Resultados, Rankings, etc. (Tu código) ---

function generarFixture(grupo) { 
    const fixture = [];
    for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
            fixture.push({ jugador1: grupo[i], jugador2: grupo[j], grupo: grupo === grupos.A ? 'A' : 'B' });
        }
    }
    return fixture;
}
// ... (El resto de tus funciones de UI y lógica del torneo deben estar aquí) ...
// ... (Omito para mantener el foco en la solución de Firebase) ...
// Nota: Asegúrate de que todas tus funciones (como generarGruposHTML, registrarResultado, etc.) estén incluidas aquí.

// ==========================================================
// LÓGICA DE FIREBASE (ACTUALIZADA Y ROBUSTA)
// ==========================================================

/**
 * Guarda o actualiza la configuración base del torneo en Firebase, con reintentos.
 */
function saveTournamentConfig() {
    // Si no hay participantes registrados y no hay un ID de torneo, no hacemos nada.
    if (participantes.length === 0 && !currentTournamentId) return;
    
    const tournamentData = {
        max_jugadores: MAX_JUGADORES,
        participantes: participantes,
        fecha_ultima_actualizacion: firebase.firestore.FieldValue.serverTimestamp(),
        estado: (grupos.A.length > 0 ? 'Iniciado' : 'Pre-registro')
    };

    // Usamos retryWithBackoff para manejar la operación de Firebase
    const firebaseOperation = async () => {
        if (currentTournamentId) {
            // 1. Torneo existente: Actualizamos el documento por ID
            await db.collection("torneos").doc(currentTournamentId).update(tournamentData);
            console.log("✅ Configuración del torneo actualizada en Firebase:", currentTournamentId);
        } else {
            // 2. Nuevo torneo: Creamos un nuevo documento
            const docRef = await db.collection("torneos").add(tournamentData);
            currentTournamentId = docRef.id;
            localStorage.setItem('currentTournamentId', currentTournamentId);
            console.log("✅ Nuevo torneo guardado en Firebase con ID:", docRef.id);
        }
    };

    // Ejecutamos la operación con el mecanismo de reintento y un catch robusto
    retryWithBackoff(firebaseOperation)
        .catch((error) => {
            // ESTE MENSAJE DEBE APARECER SI FALLA
            console.error("❌ ERROR CRÍTICO DE FIREBASE:", error);
            alert("⚠️ Error al guardar los datos del torneo en la nube. Revisa las Reglas de Seguridad de Firestore.");
        });
}


// --- LÓGICA DE SCORES DE PLAYOFF (Mantenida de tu código anterior) ---

function saveParticipant(name, score) {
    // Implementa retryWithBackoff también para esta función
    const operation = () => db.collection("scores").add({
        name: name,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    retryWithBackoff(operation)
    .then(() => {
        console.log("Score saved successfully!");
    })
    .catch((error) => {
        console.error("Error writing score document: ", error);
        alert("⚠️ Error al guardar el score individual en la nube.");
    });
}

function getScores() {
    const scoreDisplayContainer = document.getElementById('playoffs');
    if (!scoreDisplayContainer) return;

    // Solo mostramos los scores individuales si no se ha iniciado la fase de Playoff local.
    if (scoreDisplayContainer.innerHTML.includes("Paso 5")) return; 
    
    scoreDisplayContainer.innerHTML = "<h3>Cargando resultados de Playoff...</h3>"; 

    db.collection("scores").orderBy("timestamp", "desc")
        .onSnapshot((snapshot) => {
             // ... (Tu lógica para mostrar scores de Firebase) ...
             scoreDisplayContainer.innerHTML = '<h3>Últimos Resultados de Playoff Guardados</h3>';
             const ul = document.createElement('ul');
             snapshot.forEach(doc => {
                 const data = doc.data();
                 const li = document.createElement('li');
                 const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString() : 'N/A';
                 li.textContent = `${data.name}: ${data.score} puntos (${date})`;
                 ul.appendChild(li);
             });
             scoreDisplayContainer.appendChild(ul);
        }, (error) => {
            console.error("Error al escuchar scores:", error);
            scoreDisplayContainer.innerHTML = '<p style="color:red;">Error cargando scores: Revisa tu conexión o reglas de seguridad.</p>';
        });
}


// ==========================================================
// MANEJADOR INICIAL
// ==========================================================

document.addEventListener('DOMContentLoaded', (event) => {
    cargarDatos();
    getScores(); 
    
    document.getElementById('score-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('player-name').value.trim();
        const score = parseInt(document.getElementById('player-score').value);
        if (name && !isNaN(score)) {
            saveParticipant(name, score);
            document.getElementById('message-area').textContent = `Resultado de ${name} guardado localmente.`;
            document.getElementById('player-name').value = '';
            document.getElementById('player-score').value = 0;
        }
    });
});
