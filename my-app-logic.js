// Este archivo se carga DESPUÉS de la inicialización de Firebase
// y tiene acceso a las variables globales 'db' y 'firebase'.

// ==========================================================
// UTILITY: EXPONENTIAL BACKOFF FOR FIREBASE WRITES AND API CALLS
// ==========================================================

/**
 * Intenta ejecutar una función asíncrona (como una operación de Firestore o una llamada a una API) con reintentos
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
let MAX_JUGADORES = 10; // VALOR INICIAL
let NUM_GRUPOS = 2; // NUEVA VARIABLE PARA CONTROLAR EL NÚMERO DE GRUPOS

// Variable global para el ID del torneo actual en Firebase.
let currentTournamentId = localStorage.getItem('currentTournamentId') || null;

// --- Funciones de Display ---
/**
 * Muestra el ID del torneo actual en la interfaz de usuario.
 */
function displayTournamentInfo() {
    const displayElement = document.getElementById('tournament-id-display');
    if (displayElement && currentTournamentId) {
        displayElement.innerHTML = `
            <p class="text-xs text-gray-600 mt-2">
                ID del Torneo (Firebase): <span class="font-bold text-indigo-600">${currentTournamentId}</span>
            </p>
            <p class="text-sm font-semibold text-green-700">¡Este torneo está guardado y listo para compartirse!</p>
        `;
    } else if (displayElement) {
        displayElement.innerHTML = `<p class="text-sm text-gray-500 mt-2">Torneo no iniciado o ID no disponible.</p>`;
    }
}


// --- GESTIÓN DE DATOS LOCALES ---

/**
 * Carga el estado del torneo desde Local Storage y actualiza la UI.
 */
function cargarDatos() {
    const max = localStorage.getItem('maxJugadores');
    if (max) MAX_JUGADORES = parseInt(max);

    const numG = localStorage.getItem('numGrupos');
    if (numG) NUM_GRUPOS = parseInt(numG);
    
    const p = localStorage.getItem('participantes');
    const pa = localStorage.getItem('partidos');
    const g = localStorage.getItem('grupos');
    const pl = localStorage.getItem('playoffs'); 
    
    participantes = p ? JSON.parse(p) : [];
    partidos = pa ? JSON.parse(pa) : [];
    grupos = g ? JSON.parse(g) : {}; // Ahora es un objeto vacío por defecto
    playoffs = pl ? JSON.parse(pl) : { semifinales: [], tercerPuesto: null, final: null }; 

    document.getElementById('max-jugadores-input').value = MAX_JUGADORES;
    // CRÍTICO: Asegurarse de que el input de grupos se actualice
    const numGruposInput = document.getElementById('num-grupos-input');
    if (numGruposInput) numGruposInput.value = NUM_GRUPOS;

    actualizarIU();
    
    const isTournamentStarted = participantes.length === MAX_JUGADORES && Object.keys(grupos).length > 0;

    if (isTournamentStarted) {
        document.getElementById('configuracion').style.display = 'none';
        document.getElementById('registro').style.display = 'none';
        document.getElementById('grupos-fixture').style.display = 'block';
        document.getElementById('ranking-finales').style.display = 'block';
        
        const analysisButton = document.getElementById('btn-generate-analysis');
        if (analysisButton) analysisButton.style.display = 'block'; 

        generarGruposHTML();
        generarPartidosGruposHTML();
        actualizarRankingYFinales();
    } else {
        document.getElementById('configuracion').style.display = 'block';
        document.getElementById('registro').style.display = 'block';
        document.getElementById('grupos-fixture').style.display = 'none';
        document.getElementById('ranking-finales').style.display = 'none';

        const analysisButton = document.getElementById('btn-generate-analysis');
        if (analysisButton) analysisButton.style.display = 'none'; 
    }
    
    displayTournamentInfo(); // Muestra el ID al cargar
}

/**
 * Guarda el estado actual de las variables globales en Local Storage.
 */
function guardarDatos() {
    localStorage.setItem('maxJugadores', MAX_JUGADORES);
    localStorage.setItem('numGrupos', NUM_GRUPOS); // Guardamos el número de grupos
    localStorage.setItem('participantes', JSON.stringify(participantes));
    localStorage.setItem('partidos', JSON.stringify(partidos));
    localStorage.setItem('grupos', JSON.stringify(grupos));
    localStorage.setItem('playoffs', JSON.stringify(playoffs)); 
}

function borrarDatos() {
    if (confirm("⚠️ ¿Estás seguro de que quieres borrar TODOS los datos del torneo? Esta acción es irreversible.")) {
        localStorage.clear();
        
        participantes = [];
        partidos = [];
        grupos = {};
        playoffs = { semifinales: [], tercerPuesto: null, final: null }; 
        MAX_JUGADORES = 10; 
        NUM_GRUPOS = 2; // Resetear grupos
        
        currentTournamentId = null; 
        localStorage.removeItem('currentTournamentId');

        console.log("✅ Todos los datos han sido borrados. La aplicación se ha reiniciado.");
        location.reload(); 
    }
}

// --- LÓGICA DE FIREBASE ---

/**
 * Carga el estado completo del torneo desde Firebase usando el currentTournamentId.
 * Si tiene éxito, guarda el estado en Local Storage para persistencia local.
 * @returns {Promise<boolean>} True si la carga fue exitosa.
 */
async function loadTournamentFromFirebase() {
    if (!currentTournamentId || typeof db === 'undefined') {
        console.log("No hay ID de torneo de Firebase o db no está inicializado. Se cargará solo de Local Storage.");
        return false;
    }

    console.log(`Intentando cargar torneo con ID: ${currentTournamentId} desde Firebase.`);
    try {
        const docSnap = await db.collection("torneos").doc(currentTournamentId).get();

        if (docSnap.exists) {
            const data = docSnap.data();
            
            // Actualizar variables globales con los datos de Firebase
            MAX_JUGADORES = data.max_jugadores || 10;
            NUM_GRUPOS = data.num_grupos || 2; // Cargar el número de grupos
            participantes = data.participantes || [];
            partidos = data.partidos || []; 
            grupos = data.grupos || {};
            playoffs = data.playoffs || { semifinales: [], tercerPuesto: null, final: null };

            guardarDatos(); 

            console.log("✅ Datos del torneo cargados exitosamente desde Firebase.");
            return true;

        } else {
            console.warn("Documento de Firebase no encontrado para el ID:", currentTournamentId);
            currentTournamentId = null;
            localStorage.removeItem('currentTournamentId');
            return false;
        }
    } catch (error) {
        console.error("Error al cargar el torneo desde Firebase. Se usará Local Storage:", error);
        return false;
    }
}

/**
 * Carga el estado completo del torneo desde Firebase usando un ID externo.
 * @param {string} externalId - ID del torneo proporcionado por el usuario.
 */
async function loadExternalTournamentById(externalId) {
    if (typeof db === 'undefined') {
        console.error("Firebase Firestore 'db' no está inicializado.");
        return;
    }

    try {
        const docSnap = await db.collection("torneos").doc(externalId).get();

        if (docSnap.exists) {
            localStorage.setItem('currentTournamentId', externalId);
            currentTournamentId = externalId;
            
            console.log(`✅ Torneo ID ${externalId} encontrado y sincronizado. Recargando...`);
            location.reload(); 
        } else {
            console.error("❌ Error: No se encontró un torneo con ese ID.");
            const loadMessage = document.getElementById('load-message');
            if (loadMessage) loadMessage.textContent = "Error: No se encontró un torneo con ese ID. Verifica que sea correcto.";
            document.getElementById('external-id-input').value = '';
        }
    } catch (error) {
        console.error("Error al cargar el ID externo:", error);
        const loadMessage = document.getElementById('load-message');
        if (loadMessage) loadMessage.textContent = "Error de conexión. Revisa la consola.";
    }
}


/**
 * Guarda o actualiza la configuración base del torneo en Firebase.
 */
async function saveTournamentConfig() {
    if (typeof db === 'undefined') {
        console.error("Firebase Firestore 'db' no está inicializado. No se puede guardar.");
        return;
    }

    const tournamentData = {
        max_jugadores: MAX_JUGADORES,
        num_grupos: NUM_GRUPOS, // Guardar el número de grupos
        participantes: participantes,
        partidos: partidos, // Fixture de grupos
        grupos: grupos,     // Lista de jugadores en Grupo A y B
        playoffs: playoffs, // Estructura de eliminatorias
        fecha_ultima_actualizacion: firebase.firestore.FieldValue.serverTimestamp(),
        estado: (Object.keys(grupos).length > 0 ? 'Iniciado' : 'Pre-registro')
    };

    const operation = async () => {
        if (currentTournamentId) {
            await db.collection("torneos").doc(currentTournamentId).update(tournamentData);
            return { type: 'UPDATE', id: currentTournamentId };
        } else {
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
        displayTournamentInfo(); // Muestra el ID después de guardar
    } catch (error) {
        console.error("❌ ERROR CRÍTICO: Falló la operación de guardado/actualización en /torneos después de múltiples reintentos.", error);
        console.error(`❌ ERROR CRÍTICO DE FIREBASE. No se pudo guardar el torneo. Mensaje: ${error.message}`);
    }
}


// --- CONFIGURACIÓN Y GESTIÓN DE PARTICIPANTES ---

async function configurarMaxJugadores() {
    const input = document.getElementById('max-jugadores-input');
    const nuevoMax = parseInt(input.value);

    if (nuevoMax < 4 || nuevoMax % 2 !== 0) { 
        console.error("El número de jugadores debe ser **al menos 4** y debe ser par (4, 6, 8...).");
        input.value = MAX_JUGADORES;
        return;
    }
    
    if (participantes.length > nuevoMax) {
        console.error(`Ya hay ${participantes.length} jugadores registrados. El nuevo máximo debe ser mayor o igual.`);
        input.value = MAX_JUGADORES; 
        return;
    }

    MAX_JUGADORES = nuevoMax;
    partidos = [];
    grupos = {};
    playoffs = { semifinales: [], tercerPuesto: null, final: null };
    
    guardarDatos();
    actualizarIU();
    console.log(`Torneo configurado para ${MAX_JUGADORES} jugadores.`);
    
    await saveTournamentConfig(); 
}

async function configurarNumGrupos() {
    const input = document.getElementById('num-grupos-input');
    const nuevoNum = parseInt(input.value);

    // Lógica de validación: debe ser par, al menos 2, y no más que la mitad de jugadores
    if (nuevoNum < 1 || nuevoNum > 6 || nuevoNum > MAX_JUGADORES / 2 || MAX_JUGADORES % nuevoNum !== 0) {
        console.error(`El número de grupos debe ser entre 1 y 6, y debe dividir a los ${MAX_JUGADORES} jugadores de manera equitativa. Intenta 2, o 4.`);
        input.value = NUM_GRUPOS;
        return;
    }

    NUM_GRUPOS = nuevoNum;
    // Si cambiamos los grupos, reiniciamos la estructura
    grupos = {};
    partidos = [];
    playoffs = { semifinales: [], tercerPuesto: null, final: null };

    guardarDatos();
    actualizarIU();
    console.log(`Torneo configurado con ${NUM_GRUPOS} grupos.`);
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
        // Validación adicional para iniciar el torneo con la nueva configuración
        const jugadoresPorGrupo = MAX_JUGADORES / NUM_GRUPOS;
        if (jugadoresPorGrupo < 2) {
             btnIniciar.disabled = true;
             btnIniciar.textContent = `Iniciar Torneo (Mínimo 2 jugadores por grupo)`;
        } else {
             btnIniciar.disabled = false;
             btnIniciar.textContent = '¡Iniciar Torneo!';
        }
    } else {
        btnIniciar.disabled = true;
        btnIniciar.textContent = `Iniciar Torneo (Necesita ${MAX_JUGADORES - participantes.length} más)`;
    }
}

async function agregarParticipante() {
    const input = document.getElementById('nombre-input');
    const nombre = input.value.trim();

    if (nombre && participantes.length < MAX_JUGADORES && !participantes.includes(nombre)) {
        participantes.push(nombre);
        input.value = '';
        guardarDatos();
        actualizarIU();
        
        await saveTournamentConfig(); 
    } else if (participantes.length >= MAX_JUGADORES) {
        console.error(`Ya se han añadido el máximo de ${MAX_JUGADORES} participantes.`);
    }
}

async function iniciarTorneo() {
    if (participantes.length !== MAX_JUGADORES) {
        console.error(`El torneo requiere exactamente ${MAX_JUGADORES} jugadores.`);
        return;
    }

    const jugadoresPorGrupo = MAX_JUGADORES / NUM_GRUPOS;
    if (jugadoresPorGrupo < 2 || MAX_JUGADORES % NUM_GRUPOS !== 0) {
        console.error("Configuración de grupos inválida. Asegúrate de que los jugadores se puedan dividir equitativamente en grupos de al menos 2.");
        return;
    }

    const mezclados = participantes.sort(() => Math.random() - 0.5);
    partidos = [];
    grupos = {};

    // 1. ASIGNACIÓN DE GRUPOS (A, B, C, D...)
    for (let i = 0; i < NUM_GRUPOS; i++) {
        const nombreGrupo = String.fromCharCode(65 + i); // A, B, C, ...
        grupos[nombreGrupo] = mezclados.slice(i * jugadoresPorGrupo, (i + 1) * jugadoresPorGrupo);
    }
    
    // 2. GENERACIÓN DEL FIXTURE
    for (const nombreGrupo in grupos) {
        const fixtureGrupo = generarFixture(grupos[nombreGrupo], nombreGrupo);
        partidos = partidos.concat(fixtureGrupo);
    }
    
    playoffs = { semifinales: [], tercerPuesto: null, final: null };

    guardarDatos();
    
    // Recargar la UI para mostrar las nuevas secciones
    cargarDatos();
    
    await saveTournamentConfig(); 
}

// --- Lógica de Torneo ---

function generarFixture(grupo, nombreGrupo) { 
    const fixture = [];
    // Liga (todos contra todos)
    for (let i = 0; i < grupo.length; i++) {
        for (let j = i + 1; j < grupo.length; j++) {
            fixture.push({
                jugador1: grupo[i],
                jugador2: grupo[j],
                grupo: nombreGrupo, // Asigna el nombre del grupo
                gamesJ1: null,
                gamesJ2: null,
                ganador: null,
                perdedor: null,
                tipo: 'Grupo',
            });
        }
    }
    return fixture;
}

function generarGruposHTML() {
    const container = document.getElementById('grupos-container');
    container.innerHTML = '';
    
    for (const nombreGrupo in grupos) {
        // Agregamos la tabla de ranking al lado del listado de jugadores
        container.innerHTML += `
            <div class="md:w-1/2 p-2 group-section">
                <h3 class="text-xl font-bold text-gray-700 mb-2">Grupo ${nombreGrupo} (${grupos[nombreGrupo].length} jugadores)</h3>
                <div id="ranking-grupo-${nombreGrupo.toLowerCase()}" class="mt-2">
                    <!-- Aquí se cargará la tabla de posiciones -->
                    <p class="text-sm text-gray-500">Calculando ranking...</p>
                </div>
            </div>
        `;
    }
}

async function registrarResultado(index, isPlayoff = false) {
    const targetArray = isPlayoff ? playoffs.semifinales : partidos;
    const match = targetArray[index];
    
    const gamesJ1 = parseInt(document.getElementById(`score-j1-${index}`).value);
    const gamesJ2 = parseInt(document.getElementById(`score-j2-${index}`).value);

    if (isNaN(gamesJ1) || isNaN(gamesJ2) || gamesJ1 === gamesJ2) {
        console.error("Por favor, introduce puntuaciones válidas. Los marcadores no pueden ser iguales.");
        return;
    }

    match.gamesJ1 = gamesJ1;
    match.gamesJ2 = gamesJ2;
    match.ganador = gamesJ1 > gamesJ2 ? match.jugador1 : match.jugador2;
    match.perdedor = gamesJ1 < gamesJ2 ? match.jugador1 : match.jugador2;
    
    guardarDatos();

    if (!isPlayoff) {
        actualizarRankingYFinales();
        generarPartidosGruposHTML(); 
    } else {
        // Lógica de avance de playoffs aquí...
    }
    
    await saveTournamentConfig();
}


function generarPartidosGruposHTML() {
    const container = document.getElementById('partidos-registro-grupos');
    container.innerHTML = partidos.map((p, index) => `
        <div class="match-card ${p.ganador ? 'completed' : 'pending'} bg-white p-4 rounded-xl shadow-md transition duration-300 hover:shadow-lg">
            <h4 class="text-md font-semibold text-indigo-700 mb-2">Partido #${index + 1} - Grupo ${p.grupo}</h4>
            <div class="score-inputs flex items-center justify-between space-x-2">
                <span class="font-medium w-1/3 text-right truncate">${p.jugador1}</span>
                <input type="number" id="score-j1-${index}" min="0" value="${p.gamesJ1 !== null ? p.gamesJ1 : 0}" ${p.ganador ? 'disabled' : ''} class="w-12 text-center border rounded-md p-1">
                <span class="font-bold">-</span>
                <input type="number" id="score-j2-${index}" min="0" value="${p.gamesJ2 !== null ? p.gamesJ2 : 0}" ${p.ganador ? 'disabled' : ''} class="w-12 text-center border rounded-md p-1">
                <span class="font-medium w-1/3 text-left truncate">${p.jugador2}</span>
            </div>
            <button onclick="registrarResultado(${index})" ${p.ganador ? 'disabled' : ''}
                    class="mt-3 w-full py-2 rounded-lg text-white font-semibold transition duration-150 ${p.ganador ? 'bg-green-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}">
                ${p.ganador ? `Ganador: ${p.ganador} 🏆` : 'Registrar Resultado'}
            </button>
        </div>
    `).join('');
}


// --- LÓGICA DE RANKING (NUEVA Y CRÍTICA) ---

/**
 * Calcula el ranking de un grupo específico basado en los resultados de 'partidos'.
 * Criterios: Puntos > Diferencia de Games > Games a favor.
 * @param {string[]} jugadores - Array de nombres de jugadores en el grupo.
 * @param {string} nombreGrupo - Nombre del grupo (ej: 'A').
 * @returns {object[]} - Ranking ordenado.
 */
function calcularRanking(jugadores, nombreGrupo) { 
    // Inicializa las estadísticas para cada jugador
    const stats = jugadores.map(nombre => ({ 
        nombre, 
        puntos: 0, 
        ganados: 0, 
        perdidos: 0, 
        games_a_favor: 0, 
        games_en_contra: 0, 
        dif: 0 
    }));
    
    // Mapea los jugadores por nombre para fácil acceso
    const jugadorMap = new Map(stats.map(s => [s.nombre, s]));

    // Procesa todos los partidos del grupo
    partidos.filter(p => p.grupo === nombreGrupo && p.ganador).forEach(p => {
        const s1 = jugadorMap.get(p.jugador1);
        const s2 = jugadorMap.get(p.jugador2);

        if (!s1 || !s2) return; // Jugador no encontrado (error de datos)

        // Actualizar Games
        s1.games_a_favor += p.gamesJ1;
        s1.games_en_contra += p.gamesJ2;
        s2.games_a_favor += p.gamesJ2;
        s2.games_en_contra += p.gamesJ1;

        // Actualizar Puntos y Ganados/Perdidos
        if (p.ganador === p.jugador1) {
            s1.puntos += 3;
            s1.ganados += 1;
            s2.perdidos += 1;
        } else if (p.ganador === p.jugador2) {
            s2.puntos += 3;
            s2.ganados += 1;
            s1.perdidos += 1;
        }
        // Nota: No hay empates en foosball/pinball, por eso solo hay +3 puntos.
    });

    // Calcula la diferencia de Games (necesario para el desempate)
    stats.forEach(s => {
        s.dif = s.games_a_favor - s.games_en_contra;
    });

    // Ordenar: Puntos (desc) -> Diferencia de Games (desc) -> Games a Favor (desc)
    stats.sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.dif !== a.dif) return b.dif - a.dif;
        return b.games_a_favor - a.games_a_favor;
    });

    return stats;
}


/**
 * Genera el HTML de la tabla de ranking y la inserta en el contenedor correcto.
 * @param {object[]} ranking - El ranking calculado.
 * @param {string} tablaId - El ID del elemento donde se insertará la tabla.
 */
function mostrarRanking(ranking, tablaId) { 
    const tabla = document.getElementById(tablaId);
    if (!tabla) return;
    let html = `
        <table class="w-full text-sm text-left text-gray-700 shadow-lg rounded-xl overflow-hidden">
            <thead class="text-xs text-white uppercase bg-indigo-600">
                <tr>
                    <th scope="col" class="py-2 px-3 rounded-tl-xl">#</th>
                    <th scope="col" class="py-2 px-3">Jugador</th>
                    <th scope="col" class="py-2 px-3">Ptos</th>
                    <th scope="col" class="py-2 px-3">G</th>
                    <th scope="col" class="py-2 px-3">P</th>
                    <th scope="col" class="py-2 px-3 rounded-tr-xl">Dif</th>
                </tr>
            </thead>
            <tbody>
    `;
    ranking.forEach((p, index) => {
        html += `
            <tr class="bg-white border-b hover:bg-gray-50">
                <th scope="row" class="py-3 px-3 font-medium text-gray-900 whitespace-nowrap">${index + 1}</th>
                <td class="py-3 px-3 font-medium">${p.nombre}</td>
                <td class="py-3 px-3 font-bold text-indigo-700">${p.puntos}</td>
                <td class="py-3 px-3 text-green-600">${p.ganados}</td>
                <td class="py-3 px-3 text-red-600">${p.perdidos}</td>
                <td class="py-3 px-3">${p.dif}</td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    tabla.innerHTML = html;
}

// Función principal para actualizar rankings y verificar pase a finales
function actualizarRankingYFinales() { 
    
    for (const nombreGrupo in grupos) {
        const jugadoresGrupo = grupos[nombreGrupo];
        const ranking = calcularRanking(jugadoresGrupo, nombreGrupo);
        mostrarRanking(ranking, `ranking-grupo-${nombreGrupo.toLowerCase()}`);
    }

    // Lógica para pasar a playoffs
    // Ejemplo: Si todos los partidos terminaron y se requiere más de un grupo
    const partidosPendientes = partidos.filter(p => !p.ganador).length;
    if (partidosPendientes === 0 && Object.keys(grupos).length > 1) {
        // generarPlayoffs(rankingA, rankingB); // (Lógica futura)
    }
}


// --- OTRAS FUNCIONES (Manteniendo la estructura) ---
function saveParticipant(name, score) { /* ... lógica de ejemplo ... */ }
function getScores() { /* ... lógica de ejemplo ... */ }
function generarPlayoffs(rA, rB) { /* ... lógica de playoffs ... */ }
function mostrarRankingFinal() { /* ... lógica de ranking final ... */ }


// ==========================================================
// FUNCIÓN DE ANÁLISIS DE GEMINI (IA)
// ==========================================================

async function generateTournamentAnalysis() {
    const resultsContainer = document.getElementById('analysis-results');
    resultsContainer.innerHTML = `
        <div class="flex items-center space-x-2">
            <svg class="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-gray-600">Generando análisis estratégico...</span>
        </div>
    `;

    const modelName = "gemini-2.5-flash-preview-05-20";
    const apiKey = ""; 
    const queryParam = apiKey ? `?key=${apiKey}` : ''; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent${queryParam}`;

    const playerList = participantes.join(', ');
    const tournamentState = Object.keys(grupos).length > 0 ? 'iniciado con partidos en juego' : 'en pre-registro';
    
    // Incluir el estado actual del ranking para un análisis más profundo
    const rankingData = Object.keys(grupos).map(nombre => {
        const ranking = calcularRanking(grupos[nombre], nombre);
        return `Grupo ${nombre}: ${ranking.map(r => `${r.nombre} (Ptos: ${r.puntos}, Dif: ${r.dif})`).join('; ')}`;
    }).join('\n');


    const userQuery = `Eres un analista deportivo experto en el torneo de futbolín/foosball. Genera un análisis estratégico de este torneo.
    - Estado del Torneo: ${tournamentState}.
    - Número de grupos: ${NUM_GRUPOS}.
    - Jugadores inscritos: ${playerList}.
    - Ranking actual (si aplica):\n${rankingData}
    
    Proporciona un párrafo corto con: el mayor desafío para el torneo, un pronóstico sobre el favorito y una sugerencia de regla de casa (house rule) divertida para añadir un giro.`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }], 
    };

    const operation = async () => {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.status === 400) {
            const errorData = await response.json();
            if (errorData.error && errorData.error.message.includes("API key not valid")) {
                throw new Error("❌ ERROR 400: Clave API no válida. El entorno de ejecución está fallando en la autenticación.");
            }
            throw new Error(`Error 400 Bad Request: ${JSON.stringify(errorData)}`);
        } else if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return response.json();
    };

    try {
        const result = await retryWithBackoff(operation, 3, 1500);
        
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const analysisText = candidate.content.parts[0].text;
            
            resultsContainer.innerHTML = `
                <div class="bg-white p-4 rounded-xl shadow-inner border border-indigo-200">
                    <h5 class="text-lg font-bold text-indigo-700 mb-2">Análisis Estratégico de Gemini</h5>
                    <p class="text-gray-700 whitespace-pre-wrap">${analysisText}</p>
                </div>
            `;
            
            // ... (Lógica para mostrar fuentes)
        } else {
            resultsContainer.innerHTML = '<p class="text-red-500">Error: No se pudo obtener la respuesta del modelo.</p>';
        }

    } catch (error) {
        console.error("Fallo definitivo al generar análisis:", error);
        resultsContainer.innerHTML = `
            <div class="bg-red-100 p-3 rounded-xl border border-red-400">
                <p class="text-red-700 font-semibold">Error al generar el análisis 🚨</p>
                <p class="text-red-600 text-sm mt-1">${error.message}</p>
                <p class="text-xs mt-1">Inténtalo de nuevo. Si el error persiste, verifica la clave de la API en la consola.</p>
            </div>
        `;
    }
}


// ==========================================================
// MANEJADOR INICIAL Y DE FORMULARIO DE FIREBASE
// ==========================================================

document.addEventListener('DOMContentLoaded', async (event) => {
    
    if (currentTournamentId) {
        await loadTournamentFromFirebase();
    }
    
    cargarDatos();
    
    getScores(); 
    
    // --- LISTENER para la Sincronización (Carga por ID) ---
    const loadForm = document.getElementById('load-tournament-form');
    if (loadForm) {
        loadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const loadMessage = document.getElementById('load-message');
            if(loadMessage) loadMessage.textContent = 'Buscando torneo...';
            const externalId = document.getElementById('external-id-input').value.trim();
            if (externalId) {
                await loadExternalTournamentById(externalId);
            } else {
                if(loadMessage) loadMessage.textContent = "Por favor, introduce un ID de torneo válido.";
            }
        });
    }

    // --- LISTENER para el Formulario de Score Individual (ejemplo) ---
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
