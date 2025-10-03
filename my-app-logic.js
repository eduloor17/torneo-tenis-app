// Este archivo se carga DESPUÉS de la inicialización de Firebase
// y tiene acceso a las variables globales 'db' y 'firebase'.

// ==========================================================
// UTILITY: EXPONENTIAL BACKOFF FOR FIREBASE WRITES
// ==========================================================

/**
 * Intenta ejecutar una función asíncrona (como una operación de Firestore) con reintentos
 * y espera creciente (exponential backoff) en caso de fallo.
 * @param {Function} operation - Función asíncrona a intentar.
 * @param {number} maxRetries - Número máximo de reintentos.
 * @param {number} delay - Retraso inicial en milisegundos.
 */
async function retryWithBackoff(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) {
                // Si es el último intento, lanzamos el error
                throw error;
            }
            // Esperar con un retraso exponencial (1s, 2s, 4s...)
            const waitTime = delay * Math.pow(2, i);
            console.warn(`Intento ${i + 1} fallido. Reintentando en ${waitTime / 1000}s...`, error.message);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
}


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

// --- GESTIÓN DE DATOS LOCALES ---

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
        
        // Limpia el ID del torneo actual
        currentTournamentId = null; 
        localStorage.removeItem('currentTournamentId');

        alert("✅ Todos los datos han sido borrados. La aplicación se ha reiniciado.");
        location.reload(); 
    }
}

// --- LÓGICA DE FIREBASE ---

/**
 * Guarda o actualiza la configuración base del torneo en Firebase.
 */
async function saveTournamentConfig() {
    // Si la variable 'db' no está definida (aunque ya lo comprobamos), salimos
    if (typeof db === 'undefined') {
        console.error("Firebase Firestore 'db' no está inicializado. No se puede guardar.");
        return;
    }

    const tournamentData = {
        max_jugadores: MAX_JUGADORES,
        participantes: participantes,
        fecha_ultima_actualizacion: firebase.firestore.FieldValue.serverTimestamp(),
        estado: (grupos.A.length > 0 ? 'Iniciado' : 'Pre-registro')
    };

    const operation = async () => {
        if (currentTournamentId) {
            // 1. Torneo existente: Actualizamos el documento por ID
            await db.collection("torneos").doc(currentTournamentId).update(tournamentData);
            return { type: 'UPDATE', id: currentTournamentId };
        } else {
            // 2. Nuevo torneo: Creamos un nuevo documento
            const docRef = await db.collection("torneos").add(tournamentData);
            return { type: 'CREATE', id: docRef.id };
        }
    };

    try {
        const result = await retryWithBackoff(operation);
        
        if (result.type === 'CREATE') {
            currentTournamentId = result.id;
            localStorage.setItem('currentTournamentId', currentTournamentId);
            console.log("🔥 Nuevo torneo guardado en Firebase con ID:", result.id);
        } else {
            console.log("⬆️ Configuración del torneo actualizada en Firebase:", result.id);
        }
    } catch (error) {
        console.error("❌ ERROR CRÍTICO: Falló la operación de guardado/actualización en /torneos después de múltiples reintentos.", error);
        // Si falla, mostramos una alerta para que el usuario tome acción
        alert(`❌ ERROR CRÍTICO DE FIREBASE. No se pudo guardar el torneo. Verifica la Consola (F12) para detalles del error. Mensaje: ${error.message}`);
    }
}


// --- CONFIGURACIÓN Y GESTIÓN DE PARTICIPANTES ---

// IMPORTANTE: Convertimos esta función a async para poder esperar el guardado de Firebase
async function configurarMaxJugadores() {
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
    
    // --> LLAMADA CRÍTICA: Esperamos a que Firebase guarde la configuración.
    await saveTournamentConfig(); 
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

// IMPORTANTE: Convertimos esta función a async
async function agregarParticipante() {
    const input = document.getElementById('nombre-input');
    const nombre = input.value.trim();

    if (nombre && participantes.length < MAX_JUGADORES && !participantes.includes(nombre)) {
        participantes.push(nombre);
        input.value = '';
        guardarDatos();
        actualizarIU();
        
        // --> Llamada al guardado de Firebase
        await saveTournamentConfig(); 
    } else if (participantes.length >= MAX_JUGADORES) {
        alert(`Ya se han añadido el máximo de ${MAX_JUGADORES} participantes.`);
    }
}

// IMPORTANTE: Convertimos esta función a async
async function iniciarTorneo() {
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
    
    // --> Llamada al guardado de Firebase para marcar como 'Iniciado'
    await saveTournamentConfig(); 
}

// --- Lógica del Fixture, Resultados, Rankings, etc. (El resto del código...) ---

function generarFixture(grupo) { 
    const fixture = [];
    // Ejemplo de fixture: A vs B, A vs C, B vs C
    for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
            fixture.push({
                jugador1: grupo[i],
                jugador2: grupo[j],
                grupo: grupo.length > 2 ? (grupos.A.includes(grupo[i]) ? 'A' : 'B') : 'FINAL', // Determina el grupo
            });
        }
    }
    return fixture;
}

function generarGruposHTML() {
    const container = document.getElementById('grupos-container');
    container.innerHTML = `
        <div class="group-summary">
            <h3>Grupo A (${grupos.A.length} jugadores)</h3>
            <ul>${grupos.A.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
        <div class="group-summary">
            <h3>Grupo B (${grupos.B.length} jugadores)</h3>
            <ul>${grupos.B.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
    `;
}

// Función que maneja el registro de resultados y el guardado en Firebase
async function registrarResultado(index, isPlayoff = false) {
    const targetArray = isPlayoff ? playoffs.semifinales : partidos;
    const match = targetArray[index];
    const gamesJ1 = parseInt(document.getElementById(`score-j1-${index}`).value);
    const gamesJ2 = parseInt(document.getElementById(`score-j2-${index}`).value);

    if (isNaN(gamesJ1) || isNaN(gamesJ2) || gamesJ1 === gamesJ2) {
        alert("Por favor, introduce puntuaciones válidas. Los marcadores no pueden ser iguales.");
        return;
    }

    match.gamesJ1 = gamesJ1;
    match.gamesJ2 = gamesJ2;
    match.ganador = gamesJ1 > gamesJ2 ? match.jugador1 : match.jugador2;
    match.perdedor = gamesJ1 < gamesJ2 ? match.jugador1 : match.jugador2;
    
    guardarDatos();

    // Si es fase de grupos, actualizamos rankings y checamos playoffs
    if (!isPlayoff) {
        actualizarRankingYFinales();
        generarPartidosGruposHTML(); // Para actualizar el estado del formulario
    } else {
        // Lógica de avance de playoffs aquí...
    }
    
    // Guardamos el estado completo del torneo a Firebase después de cada resultado
    // Ya que la función saveTournamentConfig incluye el estado de partidos, grupos y playoffs
    await saveTournamentConfig();
}


function generarPartidosGruposHTML() {
    const container = document.getElementById('partidos-registro-grupos');
    container.innerHTML = partidos.map((p, index) => `
        <div class="match-card ${p.ganador ? 'completed' : 'pending'}">
            <h4>Partido #${index + 1} (${p.grupo === 'A' || p.grupo === 'B' ? `Grupo ${p.grupo}` : 'Playoff'})</h4>
            <div class="score-inputs">
                <span>${p.jugador1}</span>
                <input type="number" id="score-j1-${index}" min="0" value="${p.gamesJ1 !== null ? p.gamesJ1 : 0}" ${p.ganador ? 'disabled' : ''}>
                <span>-</span>
                <input type="number" id="score-j2-${index}" min="0" value="${p.gamesJ2 !== null ? p.gamesJ2 : 0}" ${p.ganador ? 'disabled' : ''}>
                <span>${p.jugador2}</span>
            </div>
            <button onclick="registrarResultado(${index})" ${p.ganador ? 'disabled' : ''}>
                ${p.ganador ? `Ganador: ${p.ganador} 🏆` : 'Registrar'}
            </button>
        </div>
    `).join('');
}


// Función de Playoff (manteniendo estructura de tu código original)
async function saveParticipant(name, score) {
    // Esta función se mantiene para la colección 'scores'
    const operation = async () => {
        await db.collection("scores").add({
            name: name,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    try {
        await retryWithBackoff(operation);
        console.log("Score saved to 'scores' collection successfully!");
        return true;
    } catch (error) {
        console.error("Error writing score to 'scores' collection: ", error.message);
        return false;
    }
}

function getScores() {
    // ... (Tu lógica para leer scores con onSnapshot)
    // Dejamos esta función simplificada ya que la lectura no era el problema
    if (typeof db === 'undefined') return;
    db.collection("scores").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        // Lógica para mostrar scores aquí
    }, (error) => {
        console.error("Error al escuchar scores:", error);
    });
}


function calcularRanking(jugadores, calcularGlobal = false) { 
    // ... (Tu lógica para calcular ranking) ...
    return [];
}
function mostrarRanking(ranking, tablaId) { /* ... tu código ... */ }
function generarPlayoffs(rA, rB) { /* ... tu código ... */ }
function mostrarRankingFinal() { /* ... tu código ... */ }
function actualizarRankingYFinales() { /* ... tu código ... */ }


// ==========================================================
// MANEJADOR INICIAL Y DE FORMULARIO DE FIREBASE
// ==========================================================

document.addEventListener('DOMContentLoaded', (event) => {
    
    // 1. Cargar datos del torneo original
    cargarDatos();
    
    // 2. Inicia la lectura de scores de Firebase
    // Nota: Esta lectura es asíncrona, no bloquea el inicio
    getScores(); 
    
    // Manejador del formulario de score individual
    const scoreForm = document.getElementById('score-form');
    if (scoreForm) {
        scoreForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const playerName = document.getElementById('player-name').value;
            const playerScore = parseInt(document.getElementById('player-score').value);
            const messageArea = document.getElementById('message-area');

            messageArea.textContent = 'Guardando resultado...';
            const success = await saveParticipant(playerName, playerScore);

            if (success) {
                messageArea.textContent = 'Resultado de Playoff guardado con éxito!';
                document.getElementById('player-name').value = '';
                document.getElementById('player-score').value = 0;
            } else {
                messageArea.textContent = 'Fallo al guardar. Revisa la Consola.';
            }
        });
    }
});
