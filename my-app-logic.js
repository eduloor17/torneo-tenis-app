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
// VARIABLES Y LÓGICA DEL TORNEO DE TENIS (GLOBAL STATE)
// ==========================================================

let participantes = [];
let partidos = []; // Partidos de Fase de Grupos
let grupos = {}; // Objeto para almacenar Grupo A, B, etc.
let playoffs = { semifinales: [], tercerPuesto: null, final: null }; 
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
    grupos = g ? JSON.parse(g) : {}; 
    
    // Se asegura de que 'playoffs' esté definido para evitar ReferenceError
    playoffs = pl ? JSON.parse(pl) : { semifinales: [], tercerPuesto: null, final: null }; 

    document.getElementById('max-jugadores-input').value = MAX_JUGADORES;
    const numGruposInput = document.getElementById('num-grupos-input');
    if (numGruposInput) numGruposInput.value = NUM_GRUPOS;

    actualizarIU();
    
    const isTournamentStarted = participantes.length === MAX_JUGADORES && Object.keys(grupos).length > 0;

    if (isTournamentStarted) {
        // Ocultar configuración si el torneo ya está iniciado
        const configSection = document.getElementById('configuracion');
        const regSection = document.getElementById('registro');
        const gruposFixtureSection = document.getElementById('grupos-fixture');
        const rankingFinalesSection = document.getElementById('ranking-finales');
        
        if (configSection) configSection.style.display = 'none';
        if (regSection) regSection.style.display = 'none';
        if (gruposFixtureSection) gruposFixtureSection.style.display = 'block';
        if (rankingFinalesSection) rankingFinalesSection.style.display = 'block';
        
        const analysisButton = document.getElementById('btn-generate-analysis');
        if (analysisButton) analysisButton.style.display = 'block'; 

        generarGruposHTML();
        generarPartidosGruposHTML();
        actualizarRankingYFinales();
    } else {
        // Mostrar configuración
        const configSection = document.getElementById('configuracion');
        const regSection = document.getElementById('registro');
        const gruposFixtureSection = document.getElementById('grupos-fixture');
        const rankingFinalesSection = document.getElementById('ranking-finales');

        if (configSection) configSection.style.display = 'block';
        if (regSection) regSection.style.display = 'block';
        if (gruposFixtureSection) gruposFixtureSection.style.display = 'none';
        if (rankingFinalesSection) rankingFinalesSection.style.display = 'none';

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
    // Se evita confirm() y se usa un mensaje de error en consola.
    console.error("⚠️ Aviso: Se han borrado todos los datos locales del torneo. Recargando...");
    localStorage.clear();
    
    participantes = [];
    partidos = [];
    grupos = {};
    playoffs = { semifinales: [], tercerPuesto: null, final: null };
    MAX_JUGADORES = 10; 
    NUM_GRUPOS = 2; // Resetear grupos
    
    currentTournamentId = null; 
    localStorage.removeItem('currentTournamentId');

    location.reload(); 
}

// --- LÓGICA DE FIREBASE ---

/**
 * Carga el estado completo del torneo desde Firebase usando el currentTournamentId.
 * Si tiene éxito, guarda el estado en Local Storage para persistencia local.
 * @returns {Promise<boolean>} True si la carga fue exitosa.
 */
async function loadTournamentFromFirebase() {
    // Verificación robusta de inicialización de Firebase
    if (!currentTournamentId || typeof window.db === 'undefined' || !window.db.collection) {
        console.log("No hay ID de torneo de Firebase o db no está inicializado.");
        return false;
    }

    try {
        const docRef = window.db.collection("torneos").doc(currentTournamentId);
        // Usando getDoc que asumo existe en window.db
        const docSnap = await getDoc(docRef); 

        if (docSnap.exists) {
            const data = docSnap.data();
            
            MAX_JUGADORES = data.max_jugadores || 10;
            NUM_GRUPOS = data.num_grupos || 2; 
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
    if (typeof window.db === 'undefined') {
        console.error("Firebase Firestore 'db' no está inicializado.");
        return;
    }

    try {
        const docRef = window.db.collection("torneos").doc(externalId);
        // Usando getDoc que asumo existe en window.db
        const docSnap = await getDoc(docRef); 

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
    if (typeof window.db === 'undefined' || typeof window.firebase === 'undefined' || !window.db.collection) {
        console.error("Firebase Firestore 'db' o 'firebase' no están inicializados. No se puede guardar.");
        return;
    }

    const tournamentData = {
        max_jugadores: MAX_JUGADORES,
        num_grupos: NUM_GRUPOS, 
        participantes: participantes,
        partidos: partidos, 
        grupos: grupos,     
        playoffs: playoffs, 
        fecha_ultima_actualizacion: window.firebase.firestore.FieldValue.serverTimestamp(),
        estado: (Object.keys(grupos).length > 0 ? 'Iniciado' : 'Pre-registro')
    };

    const operation = async () => {
        if (currentTournamentId) {
            // Utilizar updateDoc para el documento existente
            const docRef = window.db.collection("torneos").doc(currentTournamentId);
            // Asumiendo que updateDoc y setDoc son globales o accesibles desde window.db
            await updateDoc(docRef, tournamentData); 
            return { type: 'UPDATE', id: currentTournamentId };
        } else {
            // Utilizar addDoc para un documento nuevo
            const docRef = await addDoc(window.db.collection("torneos"), tournamentData);
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
        displayTournamentInfo(); 
    } catch (error) {
        console.error("❌ ERROR CRÍTICO: Falló la operación de guardado/actualización en /torneos después de múltiples reintentos.", error);
    }
}


// --- CONFIGURACIÓN Y GESTIÓN DE PARTICIPANTES ---

async function configurarMaxJugadores() {
    console.log("➡️ Se hizo click en 'Ajustar Máximo'. Iniciando configuración..."); // LOG DE DEBUG
    const input = document.getElementById('max-jugadores-input');
    const nuevoMax = parseInt(input.value);

    if (isNaN(nuevoMax) || nuevoMax < 4 || nuevoMax % 2 !== 0) { 
        console.error(`❌ ERROR: El número de jugadores (${nuevoMax}) debe ser al menos 4 y debe ser par.`);
        input.value = MAX_JUGADORES; // Restaura el valor anterior
        return;
    }
    
    if (participantes.length > nuevoMax) {
        console.error(`❌ ERROR: Ya hay ${participantes.length} jugadores registrados. El nuevo máximo (${nuevoMax}) debe ser mayor o igual.`);
        input.value = MAX_JUGADORES;
        return;
    }
    
    if (nuevoMax === MAX_JUGADORES) {
        console.log("ℹ️ El máximo de jugadores no ha cambiado.");
        return;
    }

    MAX_JUGADORES = nuevoMax;
    partidos = [];
    grupos = {};
    playoffs = { semifinales: [], tercerPuesto: null, final: null };
    
    guardarDatos();
    actualizarIU();
    console.log(`✅ Torneo configurado para ${MAX_JUGADORES} jugadores.`);
    
    await saveTournamentConfig(); 
}

async function configurarNumGrupos() {
    console.log("➡️ Se hizo click en 'Ajustar Grupos'. Iniciando configuración..."); // LOG DE DEBUG
    const input = document.getElementById('num-grupos-input');
    const nuevoNum = parseInt(input.value);

    // Validación del número de grupos:
    const jugadoresPorGrupo = MAX_JUGADORES / nuevoNum;
    if (isNaN(nuevoNum) || nuevoNum < 1 || nuevoNum > 6 || MAX_JUGADORES % nuevoNum !== 0 || jugadoresPorGrupo < 2) {
        console.error(`❌ ERROR: Configuración de grupos inválida. Máx jugadores: ${MAX_JUGADORES}. Grupos solicitados: ${nuevoNum}.`);
        input.value = NUM_GRUPOS; // Restaura el valor anterior
        return;
    }
    
    if (nuevoNum === NUM_GRUPOS) {
        console.log("ℹ️ El número de grupos no ha cambiado.");
        return;
    }

    NUM_GRUPOS = nuevoNum;
    grupos = {};
    partidos = [];
    playoffs = { semifinales: [], tercerPuesto: null, final: null };

    guardarDatos();
    actualizarIU();
    console.log(`✅ Torneo configurado con ${NUM_GRUPOS} grupos.`);
    await saveTournamentConfig();
}

function actualizarIU() {
    const lista = document.getElementById('lista-participantes');
    if (lista) {
        lista.innerHTML = '';
        participantes.forEach(nombre => {
            const li = document.createElement('li');
            li.textContent = nombre;
            lista.appendChild(li);
        });
    }

    const maxJugadoresActual = document.getElementById('max-jugadores-actual');
    if (maxJugadoresActual) maxJugadoresActual.textContent = MAX_JUGADORES;
    
    const maxParticipantesDisplay = document.getElementById('max-participantes-display');
    if (maxParticipantesDisplay) maxParticipantesDisplay.textContent = MAX_JUGADORES;
    
    const contadorParticipantes = document.getElementById('contador-participantes');
    if (contadorParticipantes) contadorParticipantes.textContent = participantes.length;
    
    const btnIniciar = document.getElementById('btn-iniciar');
    if (btnIniciar) {
        const jugadoresPorGrupo = MAX_JUGADORES / NUM_GRUPOS;
        const isValidConfig = participantes.length === MAX_JUGADORES && MAX_JUGADORES > 0 && MAX_JUGADORES % NUM_GRUPOS === 0 && jugadoresPorGrupo >= 2;

        if (isValidConfig) {
            btnIniciar.disabled = false;
            btnIniciar.textContent = '¡Iniciar Torneo!';
            btnIniciar.classList.remove('opacity-50', 'cursor-not-allowed');
            btnIniciar.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
        } else {
            btnIniciar.disabled = true;
            btnIniciar.classList.remove('hover:bg-indigo-700');
            btnIniciar.classList.add('opacity-50', 'cursor-not-allowed', 'bg-indigo-600');
            if (participantes.length !== MAX_JUGADORES) {
                btnIniciar.textContent = `Iniciar Torneo (Necesita ${MAX_JUGADORES - participantes.length} más)`;
            } else if (jugadoresPorGrupo < 2) {
                 btnIniciar.textContent = `Iniciar Torneo (Mínimo 2 jugadores por grupo)`;
            } else {
                 btnIniciar.textContent = `Iniciar Torneo (Configuración de grupo inválida)`;
            }
        }
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
    const jugadoresPorGrupo = MAX_JUGADORES / NUM_GRUPOS;
    if (participantes.length !== MAX_JUGADORES || jugadoresPorGrupo < 2 || MAX_JUGADORES % NUM_GRUPOS !== 0) {
        console.error(`El torneo requiere exactamente ${MAX_JUGADORES} jugadores y la configuración de grupos debe ser válida.`);
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
    cargarDatos(); // Recargar la UI para mostrar las nuevas secciones
    
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
    if (!container) return;
    container.innerHTML = '';
    
    for (const nombreGrupo in grupos) {
        container.innerHTML += `
            <div class="w-full md:w-1/2 p-2 group-section">
                <h3 class="text-xl font-bold text-gray-700 mb-2">Grupo ${nombreGrupo} (${grupos[nombreGrupo].length} jugadores)</h3>
                <div id="ranking-grupo-${nombreGrupo.toLowerCase()}" class="mt-2">
                    <p class="text-sm text-gray-500">Calculando ranking...</p>
                </div>
            </div>
        `;
    }
}

async function registrarResultado(index, isPlayoff = false) {
    const targetArray = isPlayoff ? playoffs.semifinales : partidos;
    const match = targetArray[index];
    
    const scoreJ1Input = document.getElementById(`score-j1-${index}`);
    const scoreJ2Input = document.getElementById(`score-j2-${index}`);
    
    const gamesJ1 = parseInt(scoreJ1Input.value);
    const gamesJ2 = parseInt(scoreJ2Input.value);

    if (isNaN(gamesJ1) || isNaN(gamesJ2) || gamesJ1 === gamesJ2) {
        console.error("Por favor, introduce puntuaciones de sets válidas. Los marcadores no pueden ser iguales (debe haber un ganador).");
        // Se resetea el input para mostrar que hubo un error de validación
        scoreJ1Input.value = match.gamesJ1 || 0;
        scoreJ2Input.value = match.gamesJ2 || 0;
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
    }
    
    await saveTournamentConfig();
}


function generarPartidosGruposHTML() {
    const container = document.getElementById('partidos-registro-grupos');
    if (!container) return;
    
    container.innerHTML = partidos.map((p, index) => {
        const isCompleted = p.ganador !== null;
        return `
            <div class="match-card ${isCompleted ? 'completed' : 'pending'} bg-white p-4 rounded-xl shadow-md transition duration-300 hover:shadow-lg">
                <h4 class="text-md font-semibold text-indigo-700 mb-2">Partido #${index + 1} - Grupo ${p.grupo}</h4>
                <div class="score-inputs flex items-center justify-between space-x-2">
                    <span class="font-medium w-1/3 text-right truncate">${p.jugador1}</span>
                    <input type="number" id="score-j1-${index}" min="0" value="${p.gamesJ1 !== null ? p.gamesJ1 : 0}" ${isCompleted ? 'disabled' : ''} class="w-12 text-center border rounded-md p-1">
                    <span class="font-bold">Sets</span> 
                    <input type="number" id="score-j2-${index}" min="0" value="${p.gamesJ2 !== null ? p.gamesJ2 : 0}" ${isCompleted ? 'disabled' : ''} class="w-12 text-center border rounded-md p-1">
                    <span class="font-medium w-1/3 text-left truncate">${p.jugador2}</span>
                </div>
                <!-- Uso de data-index y manejo de eventos limpio -->
                <button data-index="${index}" class="btn-registrar-resultado mt-3 w-full py-2 rounded-lg text-white font-semibold transition duration-150 ${isCompleted ? 'bg-green-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}" ${isCompleted ? 'disabled' : ''}>
                    ${isCompleted ? `Ganador: ${p.ganador} 🏆` : 'Registrar Marcador (Sets)'}
                </button>
            </div>
        `;
    }).join('');

    // Añadir event listeners a los nuevos botones
    document.querySelectorAll('.btn-registrar-resultado').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            registrarResultado(index);
        });
    });
}


// --- LÓGICA DE RANKING (ADAPTADA A TENIS) ---

/**
 * Calcula el ranking de un grupo específico basado en los resultados de 'partidos'.
 */
function calcularRanking(jugadores, nombreGrupo) { 
    const stats = jugadores.map(nombre => ({ 
        nombre, 
        puntos: 0, 
        ganados: 0, 
        perdidos: 0, 
        sets_a_favor: 0, 
        sets_en_contra: 0, 
        dif: 0 
    }));
    
    const jugadorMap = new Map(stats.map(s => [s.nombre, s]));

    partidos.filter(p => p.grupo === nombreGrupo && p.ganador).forEach(p => {
        const s1 = jugadorMap.get(p.jugador1);
        const s2 = jugadorMap.get(p.jugador2);

        if (!s1 || !s2) return; 

        s1.sets_a_favor += p.gamesJ1;
        s1.sets_en_contra += p.gamesJ2;
        s2.sets_a_favor += p.gamesJ2;
        s2.sets_en_contra += p.gamesJ1;

        if (p.ganador === p.jugador1) {
            s1.puntos += 3;
            s1.ganados += 1;
            s2.perdidos += 1;
        } else if (p.ganador === p.jugador2) {
            s2.puntos += 3;
            s2.ganados += 1;
            s1.perdidos += 1;
        }
    });

    stats.forEach(s => {
        s.dif = s.sets_a_favor - s.sets_en_contra;
    });

    // Ordenar: Puntos (desc) -> Diferencia de Sets (desc) -> Sets a Favor (desc)
    stats.sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        if (b.dif !== a.dif) return b.dif - a.dif;
        return b.sets_a_favor - a.sets_a_favor;
    });

    return stats;
}


/**
 * Genera el HTML de la tabla de ranking y la inserta en el contenedor correcto.
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
                    <th scope="col" class="py-2 px-3 rounded-tr-xl">Dif Sets</th>
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

    const partidosPendientes = partidos.filter(p => !p.ganador).length;
    if (partidosPendientes === 0 && Object.keys(grupos).length > 1) {
        // TODO: Lógica para generar y mostrar playoffs
        console.log("🏆 Fase de grupos completa. Listo para generar Playoffs.");
    }
}


// --- OTRAS FUNCIONES (Manteniendo la estructura) ---
function saveParticipant(name, score) { console.log(`Guardando participante: ${name} con score: ${score}`); }
function getScores() { console.log("Obteniendo scores..."); }
function generarPlayoffs(rA, rB) { console.log("Generando playoffs..."); }
function mostrarRankingFinal() { console.log("Mostrando ranking final..."); }


// ==========================================================
// FUNCIÓN DE ANÁLISIS DE GEMINI (IA)
// ==========================================================

async function generateTournamentAnalysis() {
    const resultsContainer = document.getElementById('analysis-results');
    if (!resultsContainer) return;
    
    // Muestra el spinner de carga
    resultsContainer.innerHTML = `
        <div class="flex items-center space-x-2">
            <svg class="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-gray-600">Generando análisis estratégico de Tenis...</span>
        </div>
    `;

    const modelName = "gemini-2.5-flash-preview-05-20";
    const apiKey = ""; 
    const queryParam = apiKey ? `?key=${apiKey}` : ''; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent${queryParam}`;

    const playerList = participantes.join(', ');
    const tournamentState = Object.keys(grupos).length > 0 ? 'iniciado con partidos de sets en juego' : 'en pre-registro';
    
    const rankingData = Object.keys(grupos).map(nombre => {
        const ranking = calcularRanking(grupos[nombre], nombre);
        return `Grupo ${nombre}: ${ranking.map(r => `${r.nombre} (Ptos: ${r.puntos}, Dif Sets: ${r.dif})`).join('; ')}`;
    }).join('\n');


    const userQuery = `Eres un analista deportivo experto en el torneo de Tenis. Genera un análisis estratégico de este torneo.
    - Estado del Torneo: ${tournamentState}.
    - Número de grupos: ${NUM_GRUPOS}.
    - Jugadores inscritos: ${playerList}.
    - Ranking actual (si aplica):\n${rankingData}
    
    Proporciona un párrafo corto con: el mayor desafío táctico para el torneo, un pronóstico sobre el favorito y una sugerencia de regla de casa (house rule) divertida para añadir un giro.`;

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

        if (!response.ok) {
            // Manejo de errores HTTP más detallado
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorText.substring(0, 100)}...`);
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
            
        } else {
            resultsContainer.innerHTML = '<p class="text-red-500">Error: No se pudo obtener la respuesta del modelo o la respuesta estaba vacía.</p>';
        }

    } catch (error) {
        console.error("Fallo definitivo al generar análisis:", error);
        resultsContainer.innerHTML = `
            <div class="bg-red-100 p-3 rounded-xl border border-red-400">
                <p class="text-red-700 font-semibold">Error al generar el análisis 🚨</p>
                <p class="text-red-600 text-sm mt-1">${error.message}</p>
                <p class="text-xs mt-1">Inténtalo de nuevo.</p>
            </div>
        `;
    }
}

// ==========================================================
// MANEJADOR INICIAL Y EVENT LISTENERS (Conecta el JS al HTML)
// ==========================================================

document.addEventListener('DOMContentLoaded', async (event) => {
    
    // 1. Manejo del formulario de carga externa
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

    // 2. Carga Inicial de Datos (Firebase y Local Storage)
    // Se asume que getDoc, updateDoc y addDoc están disponibles globalmente si Firebase está inicializado
    if (currentTournamentId) {
        await loadTournamentFromFirebase();
    }
    cargarDatos(); // Carga datos finales y actualiza la UI
    
    // 3. Conexión de Botones a Event Listeners (Usando los IDs del HTML)
    
    // Configuración
    document.getElementById('btn-configurar-max')?.addEventListener('click', configurarMaxJugadores);
    document.getElementById('btn-configurar-grupos')?.addEventListener('click', configurarNumGrupos);

    // Registro
    document.getElementById('btn-agregar-participante')?.addEventListener('click', agregarParticipante);
    document.getElementById('btn-iniciar')?.addEventListener('click', iniciarTorneo);
    document.getElementById('btn-borrar-datos')?.addEventListener('click', borrarDatos);

    // Análisis
    document.getElementById('btn-generate-analysis')?.addEventListener('click', generateTournamentAnalysis);

    getScores(); 
});
