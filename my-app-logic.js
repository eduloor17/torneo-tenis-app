// Este archivo ahora se inicializa a través de window.loadAndInitializeLogic() 
// en index.html, asegurando que 'db', 'auth', y 'userId' ya sean globales y estén listos.

import { doc, getDoc, addDoc, setDoc, onSnapshot, collection, query, limit, orderBy, deleteDoc, FieldValue } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================================
// UTILITY: EXPONENTIAL BACKOFF FOR FIREBASE WRITES AND API CALLS
// ==========================================================

/**
 * Intenta ejecutar una función asíncrona (como una operación de Firestore o una llamada a una API) con reintentos
 * y espera creciente (exponential backoff) en caso de fallo.
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
let playoffs = { 
    semifinales: [], 
    tercerPuesto: null, 
    final: null,
    campeon: null,
    segundo: null,
    tercero: null,
    cuarto: null
}; 
let MAX_JUGADORES = 10; 
let NUM_GRUPOS = 2; 

// currentTournamentId puede ser cargado de localStorage, pero se sobrescribe con onSnapshot
let currentTournamentId = localStorage.getItem('currentTournamentId') || null;

// --- Funciones de Display ---
function displayTournamentInfo() {
    const displayElement = document.getElementById('tournament-id-display');
    const userId = typeof window.userId !== 'undefined' ? window.userId : 'No Autenticado';

    if (displayElement && currentTournamentId) {
        // Enlace para compartir el ID
        const shareText = `ID del Torneo (Compartir): ${currentTournamentId}`;
        const shareLink = `https://mi-app.com/torneo?id=${currentTournamentId}`; // URL de ejemplo

        displayElement.innerHTML = `
            <p class="text-xs text-gray-600 mt-2">
                ${shareText} 
                <button onclick="copyToClipboard('${currentTournamentId}')" class="text-indigo-500 hover:text-indigo-700 ml-1 font-semibold">📋 Copiar</button>
            </p>
            <p class="text-xs text-gray-500">ID de Usuario: <span class="font-mono text-xs">${userId}</span></p>
            ${window.db ? '<p class="text-sm font-semibold text-green-700">¡Guardado en la nube! (Real-time)</p>' : '<p class="text-sm font-semibold text-red-500">❌ Solo Local Storage</p>'}
        `;
    } else if (displayElement) {
        displayElement.innerHTML = `<p class="text-sm text-gray-500 mt-2">Torneo no iniciado o ID no disponible.</p><p class="text-xs text-gray-500">ID de Usuario: <span class="font-mono text-xs">${userId}</span></p>`;
    }
}

// Helper para copiar al portapapeles
window.copyToClipboard = function(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        // Usar un modal en una app real, pero para el ejercicio usamos un alert simple.
        // En una app final, esto debería ser reemplazado por un modal o toast
        // alert("ID de Torneo copiado al portapapeles."); 
    } catch (err) {
        console.error('No se pudo copiar: ', err);
    }
    document.body.removeChild(textArea);
};

/**
 * Genera el HTML para los partidos de la Fase de Grupos.
 */
function generarPartidosGruposHTML() {
    const container = document.getElementById('partidos-registro-grupos');
    if (!container) return;

    let html = '';
    let allMatchesCompleted = true; 

    partidos.forEach((match, index) => {
        const isCompleted = match.ganador !== null;
        if (!isCompleted) {
            allMatchesCompleted = false;
        }
        
        // La función registrarResultado ahora se llama con el índice y un flag
        const clickHandler = `registrarResultado(${index}, false)`; 

        html += `
            <div class="match-card ${isCompleted ? 'completed' : 'pending'} bg-white p-4 rounded-xl shadow-md transition duration-300 hover:shadow-lg">
                <h4 class="text-md font-bold text-gray-800 mb-2">Grupo ${match.grupo} - Partido ${index + 1}</h4>
                <p class="text-xs text-gray-500 mb-2">${match.jugador1} vs ${match.jugador2}</p>
                <div class="score-inputs flex items-center justify-between space-x-2">
                    <span class="font-medium w-1/3 text-right truncate">${match.jugador1}</span>
                    <input type="number" id="score-j1-${match.matchId}" min="0" value="${match.gamesJ1 !== null ? match.gamesJ1 : 0}" ${isCompleted ? 'disabled' : ''} class="w-12 text-center border rounded-md p-1">
                    <span class="font-bold">Sets</span> 
                    <input type="number" id="score-j2-${match.matchId}" min="0" value="${match.gamesJ2 !== null ? match.gamesJ2 : 0}" ${isCompleted ? 'disabled' : ''} class="w-12 text-center border rounded-md p-1">
                    <span class="font-medium w-1/3 text-left truncate">${match.jugador2}</span>
                </div>
                <button onclick="${clickHandler}" class="mt-3 w-full py-2 rounded-lg text-white font-semibold transition duration-150 ${isCompleted ? 'bg-green-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}" ${isCompleted ? 'disabled' : ''}>
                    ${isCompleted ? `Ganador: ${match.ganador}` : 'Registrar Marcador'}
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
    
    // Controla la visibilidad del botón de análisis
    const analysisButton = document.getElementById('btn-generate-analysis');
    if (analysisButton) {
        if (allMatchesCompleted) {
            analysisButton.style.display = 'block';
            console.log("🏆 Fase de grupos completa. Listo para generar Playoffs.");
        } else {
            analysisButton.style.display = 'none';
        }
    }
}

function generarGruposHTML() {
    const container = document.getElementById('grupos-container');
    if (!container) return;

    let html = '';
    for (const nombreGrupo in grupos) {
        html += `
            <div class="w-full md:w-1/2 px-2 mb-4">
                <h3 class="text-xl font-bold text-gray-700 mb-2">Grupo ${nombreGrupo} (${grupos[nombreGrupo].length} jugadores)</h3>
                <div id="ranking-grupo-${nombreGrupo.toLowerCase()}" class="bg-white p-4 rounded-xl shadow-md">
                    <!-- El ranking se insertará aquí con JS -->
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

// --- GESTIÓN DE DATOS LOCALES Y FIREBASE ---

function loadLocalStorageData() {
    // Carga de configuración
    const max = localStorage.getItem('maxJugadores');
    if (max) MAX_JUGADORES = parseInt(max);

    const numG = localStorage.getItem('numGrupos');
    if (numG) NUM_GRUPOS = parseInt(numG);
    
    // Carga de estado
    participantes = JSON.parse(localStorage.getItem('participantes') || '[]');
    partidos = JSON.parse(localStorage.getItem('partidos') || '[]');
    grupos = JSON.parse(localStorage.getItem('grupos') || '{}'); 
    playoffs = JSON.parse(localStorage.getItem('playoffs') || '{"semifinales": [], "tercerPuesto": null, "final": null, "campeon": null, "segundo": null, "tercero": null, "cuarto": null}'); 
    currentTournamentId = localStorage.getItem('currentTournamentId') || null;

    // Sincroniza la UI con los datos cargados
    sincronizarUIConEstado();
}

function guardarDatosLocal() {
    localStorage.setItem('maxJugadores', MAX_JUGADORES);
    localStorage.setItem('numGrupos', NUM_GRUPOS); 
    localStorage.setItem('participantes', JSON.stringify(participantes));
    localStorage.setItem('partidos', JSON.stringify(partidos));
    localStorage.setItem('grupos', JSON.stringify(grupos));
    localStorage.setItem('playoffs', JSON.stringify(playoffs));
    localStorage.setItem('currentTournamentId', currentTournamentId || '');
}

function borrarDatos() {
    console.warn("⚠️ Aviso: Se han borrado todos los datos locales del torneo. Recargando...");
    localStorage.clear();
    // Intenta borrar el documento de Firebase si existe
    if (window.db && currentTournamentId) {
        try {
             const torneosCollection = collection(window.db, "artifacts", window.appId, "public", "data", "torneos");
             deleteDoc(doc(torneosCollection, currentTournamentId));
             console.log(`Documento de Firebase con ID ${currentTournamentId} marcado para eliminación.`);
        } catch (e) {
            console.error("No se pudo eliminar el documento de Firebase:", e);
        }
    }
    location.reload(); 
}


// --- LÓGICA DE FIREBASE ---

/**
 * Escucha los cambios en un torneo de Firebase o lo crea si no existe.
 */
function listenForTournamentChanges() {
    if (!window.db || !window.appId) {
        console.warn("❌ Firebase no está inicializado. Ejecutando solo con Local Storage.");
        return;
    }
    
    const torneosRef = collection(window.db, "artifacts", window.appId, "public", "data", "torneos");
    
    if (currentTournamentId) {
        // Modo Edición: Escucha un documento específico
        const docRef = doc(torneosRef, currentTournamentId);
        onSnapshot(docRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                console.log("⬇️ Datos del Torneo actualizados desde Firebase.");
                actualizarEstadoDesdeDB(data);
            } else {
                console.warn("El torneo guardado en Firebase ya no existe. Creando uno nuevo si es necesario.");
                currentTournamentId = null;
                guardarDatosLocal(); // Limpiar ID de local storage
                // Forzamos un guardado para crear un nuevo documento con los datos locales
                saveTournamentConfig(); 
            }
        }, (error) => {
            console.error("Error al escuchar el documento:", error);
        });
    } else {
        // Modo Creación: Si no hay ID, no escuchamos, solo permitimos guardar.
        console.log("Modo Creación de Torneo. El guardado creará un nuevo ID.");
    }
}

/**
 * Actualiza las variables de estado con los datos de Firebase (o local).
 */
function actualizarEstadoDesdeDB(data) {
    MAX_JUGADORES = data.max_jugadores || MAX_JUGADORES;
    NUM_GRUPOS = data.num_grupos || NUM_GRUPOS;
    participantes = data.participantes || participantes;
    partidos = data.partidos || partidos;
    grupos = data.grupos || grupos;
    playoffs = data.playoffs || playoffs;
    
    // Guardar en local storage para persistencia de la última versión
    guardarDatosLocal();
    sincronizarUIConEstado();
}

/**
 * Guarda o actualiza la configuración base del torneo en Firebase.
 */
async function saveTournamentConfig() {
    // ⚠️ REFUERZO DE CHEQUEO DE FIREBASE (Usa window.db)
    if (!window.db) {
        console.error("❌ Firebase Firestore 'db' no está inicializado. No se puede guardar en la nube.");
        return; // Devolvemos exitosamente para que el flujo de la app continúe con Local Storage.
    }

    const torneosCollection = collection(window.db, "artifacts", window.appId || 'default-app-id', "public", "data", "torneos");

    const tournamentData = {
        max_jugadores: MAX_JUGADORES,
        num_grupos: NUM_GRUPOS, 
        participantes: participantes,
        partidos: partidos, 
        grupos: grupos,     
        playoffs: playoffs, 
        userId: window.userId || 'anonymous',
        fecha_ultima_actualizacion: FieldValue.serverTimestamp(), // Usa FieldValue desde la importación
        estado: (playoffs.campeon ? 'Finalizado' : Object.keys(grupos).length > 0 ? 'En curso' : 'Pre-registro')
    };

    const operation = async () => {
        if (currentTournamentId) {
            // Utilizar setDoc (con merge:true) para el documento existente
            const docRef = doc(torneosCollection, currentTournamentId);
            await setDoc(docRef, tournamentData, { merge: true }); 
            return { type: 'UPDATE', id: currentTournamentId };
        } else {
            // Utilizar addDoc para un documento nuevo
            const docRef = await addDoc(torneosCollection, tournamentData);
            return { type: 'CREATE', id: docRef.id };
        }
    };

    try {
        const result = await retryWithBackoff(operation);
        
        if (result.type === 'CREATE') {
            currentTournamentId = result.id;
            localStorage.setItem('currentTournamentId', currentTournamentId);
            console.log("🔥 Nuevo torneo guardado en Firebase con ID:", result.id);
            // Iniciamos la escucha en tiempo real para el nuevo ID
            listenForTournamentChanges(); 
        } else {
            console.log("⬆️ Configuración del torneo actualizada en Firebase:", result.id);
        }
        displayTournamentInfo(); 
    } catch (error) {
        console.error("❌ ERROR CRÍTICO: Falló la operación de guardado/actualización en Firebase después de múltiples reintentos.", error);
    }
}

// --- SINCRONIZACIÓN DE LA UI (El antiguo actualizarIU) ---

function sincronizarUIConEstado() {
    // Actualizar inputs de configuración
    document.getElementById('max-jugadores-input').value = MAX_JUGADORES;
    const numGruposInput = document.getElementById('num-grupos-input');
    if (numGruposInput) numGruposInput.value = NUM_GRUPOS;

    // Actualizar lista de participantes
    const lista = document.getElementById('lista-participantes');
    if (lista) {
        lista.innerHTML = '';
        participantes.forEach(nombre => {
            const li = document.createElement('li');
            li.textContent = nombre;
            lista.appendChild(li);
        });
        document.getElementById('contador-participantes-list').textContent = participantes.length;
    }
    
    // Actualizar contadores
    document.getElementById('max-jugadores-actual').textContent = MAX_JUGADORES;
    document.getElementById('max-participantes-display').textContent = MAX_JUGADORES;
    document.getElementById('contador-participantes').textContent = participantes.length;
    
    // Control de visibilidad de secciones
    const isTournamentStarted = participantes.length === MAX_JUGADORES && Object.keys(grupos).length > 0;
    const configSection = document.getElementById('configuracion');
    const regSection = document.getElementById('registro');
    const gruposFixtureSection = document.getElementById('grupos-fixture');
    const rankingFinalesSection = document.getElementById('ranking-finales');
    const analysisButton = document.getElementById('btn-generate-analysis');
    
    if (isTournamentStarted) {
        if (configSection) configSection.style.display = 'none';
        if (regSection) regSection.style.display = 'none';
        if (gruposFixtureSection) gruposFixtureSection.style.display = 'block';
        if (rankingFinalesSection) rankingFinalesSection.style.display = 'block';
        
        generarGruposHTML();
        generarPartidosGruposHTML();
        actualizarRankingYFinales(); 
    } else {
        if (configSection) configSection.style.display = 'block';
        if (regSection) regSection.style.display = 'block';
        if (gruposFixtureSection) gruposFixtureSection.style.display = 'none';
        if (rankingFinalesSection) rankingFinalesSection.style.display = 'none';
    }
    
    // Lógica del botón de inicio
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
    
    displayTournamentInfo();
}

// --- CONFIGURACIÓN Y GESTIÓN DE PARTICIPANTES (Actualizadas para usar saveTournamentConfig) ---

async function configurarMaxJugadores() {
    const input = document.getElementById('max-jugadores-input');
    const nuevoMax = parseInt(input.value);

    if (isNaN(nuevoMax) || nuevoMax < 4 || nuevoMax % 2 !== 0) { 
        console.error(`❌ ERROR: El número de jugadores (${nuevoMax}) debe ser al menos 4 y debe ser par.`);
        input.value = MAX_JUGADORES; 
        return;
    }
    
    if (participantes.length > nuevoMax) {
        console.error(`❌ ERROR: Ya hay ${participantes.length} jugadores registrados. El nuevo máximo (${nuevoMax}) debe ser mayor o igual.`);
        input.value = MAX_JUGADORES;
        return;
    }
    
    if (nuevoMax === MAX_JUGADORES) {
        console.info("ℹ️ El número de jugadores no ha cambiado.");
        return;
    }

    MAX_JUGADORES = nuevoMax;
    partidos = [];
    grupos = {};
    playoffs = { semifinales: [], tercerPuesto: null, final: null, campeon: null, segundo: null, tercero: null, cuarto: null };
    
    guardarDatosLocal();
    sincronizarUIConEstado();
    await saveTournamentConfig(); 
}

async function configurarNumGrupos() {
    const input = document.getElementById('num-grupos-input');
    const nuevoNum = parseInt(input.value);

    const jugadoresPorGrupo = MAX_JUGADORES / nuevoNum;
    if (isNaN(nuevoNum) || nuevoNum < 1 || nuevoNum > 6 || MAX_JUGADORES % nuevoNum !== 0 || jugadoresPorGrupo < 2) {
        console.error(`❌ ERROR: Configuración de grupos inválida. Máx jugadores: ${MAX_JUGADORES}. Grupos solicitados: ${nuevoNum}.`);
        input.value = NUM_GRUPOS; 
        return;
    }
    
    if (nuevoNum === NUM_GRUPOS) {
        console.info("ℹ️ El número de grupos no ha cambiado.");
        return;
    }

    NUM_GRUPOS = nuevoNum;
    grupos = {};
    partidos = [];
    playoffs = { semifinales: [], tercerPuesto: null, final: null, campeon: null, segundo: null, tercero: null, cuarto: null };

    guardarDatosLocal();
    sincronizarUIConEstado();
    await saveTournamentConfig();
}


async function agregarParticipante() {
    const input = document.getElementById('nombre-input');
    const nombre = input.value.trim();

    if (nombre && participantes.length < MAX_JUGADORES && !participantes.includes(nombre)) {
        participantes.push(nombre);
        input.value = '';
        
        guardarDatosLocal();
        sincronizarUIConEstado();
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

    // 1. ASIGNACIÓN DE GRUPOS
    for (let i = 0; i < NUM_GRUPOS; i++) {
        const nombreGrupo = String.fromCharCode(65 + i); // A, B, C, ...
        grupos[nombreGrupo] = mezclados.slice(i * jugadoresPorGrupo, (i + 1) * jugadoresPorGrupo);
    }
    
    // 2. GENERACIÓN DEL FIXTURE
    for (const nombreGrupo in grupos) {
        const fixtureGrupo = generarFixture(grupos[nombreGrupo], nombreGrupo);
        partidos = partidos.concat(fixtureGrupo);
    }
    
    playoffs = { semifinales: [], tercerPuesto: null, final: null, campeon: null, segundo: null, tercero: null, cuarto: null };

    guardarDatosLocal();
    sincronizarUIConEstado(); 
    
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
                matchId: `${nombreGrupo}-${i}-${j}`
            });
        }
    }
    return fixture;
}

// Función para registrar resultados, soporta grupos y playoffs
async function registrarResultado(index, isPlayoff = false) {
    let matchId;
    let match;
    
    // Determinar el partido y su ID para la UI
    if (isPlayoff === 'final') {
        matchId = 'final';
        match = playoffs.final;
    } else if (isPlayoff === 'tercer') {
        matchId = 'tercerPuesto';
        match = playoffs.tercerPuesto;
    } else if (isPlayoff) {
        matchId = `semi-${index}`;
        match = playoffs.semifinales[index];
    } else {
        matchId = partidos[index].matchId;
        match = partidos[index];
    }
    
    // Obtener los valores de los inputs usando el matchId
    const scoreJ1Input = document.getElementById(`score-j1-${matchId}`);
    const scoreJ2Input = document.getElementById(`score-j2-${matchId}`);
    
    // Chequear si el input existe (puede que se actualice la UI mientras se hace click)
    if (!scoreJ1Input || !scoreJ2Input) {
        console.warn(`Inputs para el partido ${matchId} no encontrados. UI desactualizada. Cancelando.`);
        return;
    }
    
    const gamesJ1 = parseInt(scoreJ1Input.value);
    const gamesJ2 = parseInt(scoreJ2Input.value);

    if (isNaN(gamesJ1) || isNaN(gamesJ2) || gamesJ1 === gamesJ2) {
        console.error("Por favor, introduce puntuaciones de sets válidas. Los marcadores no pueden ser iguales (debe haber un ganador).");
        scoreJ1Input.value = match.gamesJ1 !== null ? match.gamesJ1 : 0;
        scoreJ2Input.value = match.gamesJ2 !== null ? match.gamesJ2 : 0;
        return;
    }

    match.gamesJ1 = gamesJ1;
    match.gamesJ2 = gamesJ2;
    match.ganador = gamesJ1 > gamesJ2 ? match.jugador1 : match.jugador2;
    match.perdedor = gamesJ1 < gamesJ2 ? match.jugador1 : match.jugador2;
    
    // Actualizar el estado global
    if (isPlayoff === 'final') {
        playoffs.final = match;
        playoffs.campeon = match.ganador;
        playoffs.segundo = match.perdedor;
    } else if (isPlayoff === 'tercer') {
        playoffs.tercerPuesto = match;
        playoffs.tercero = match.ganador;
        playoffs.cuarto = match.perdedor;
    } else if (isPlayoff) {
        playoffs.semifinales[index] = match;
        // Si ambas semis están listas, generar 3er puesto y final
        if (playoffs.semifinales.every(m => m.ganador)) {
            generarPlayoffs();
        }
    } else {
        // Es partido de grupo, actualizamos el array partidos
        partidos[index] = match;
    }

    guardarDatosLocal();
    // La UI se actualizará automáticamente si estamos en modo Real-time, 
    // pero la forzamos localmente por si acaso no hay conexión.
    sincronizarUIConEstado(); 
    
    await saveTournamentConfig();
}


// --- LÓGICA DE RANKING Y PLAYOFFS ---

/**
 * Calcula el ranking de un grupo específico.
 */
function calcularRanking(jugadores, nombreGrupo) { 
    const stats = jugadores.map(nombre => ({ 
        nombre, puntos: 0, ganados: 0, perdidos: 0, sets_a_favor: 0, 
        sets_en_contra: 0, dif: 0, jugados: 0 
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
        
        s1.jugados++;
        s2.jugados++;

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
 * Identifica a los clasificados y genera los partidos de Semifinales (Solo si NUM_GRUPOS=2).
 */
function generarPlayoffs() {
    if (Object.keys(grupos).length !== 2) {
        return; 
    }

    const rankingA = calcularRanking(grupos.A, 'A');
    const rankingB = calcularRanking(grupos.B, 'B');

    // Tomamos los dos primeros de cada grupo para los playoffs.
    const topA = rankingA.slice(0, 2).map(r => r.nombre);
    const topB = rankingB.slice(0, 2).map(r => r.nombre);
    
    if (topA.length < 2 || topB.length < 2) return;
    
    // SEMIFINALES: Solo se generan si están vacías.
    if (playoffs.semifinales.length === 0 || !playoffs.semifinales[0].jugador1) {
        playoffs.semifinales = [
            // SF1: Ganador A vs. Segundo B
            { jugador1: topA[0], jugador2: topB[1], gamesJ1: null, gamesJ2: null, ganador: null, perdedor: null, tipo: 'Semi', matchId: 'semi-0' },
            // SF2: Ganador B vs. Segundo A
            { jugador1: topB[0], jugador2: topA[1], gamesJ1: null, gamesJ2: null, ganador: null, perdedor: null, tipo: 'Semi', matchId: 'semi-1' }
        ];
        playoffs.tercerPuesto = null;
        playoffs.final = null;
    }
    
    // TERCER PUESTO Y FINAL: Se generan solo si las Semifinales están completas y estas no han sido generadas.
    const semiCompletas = playoffs.semifinales.every(m => m.ganador);
    if (semiCompletas) {
        const perdedorSF1 = playoffs.semifinales[0].perdedor;
        const perdedorSF2 = playoffs.semifinales[1].perdedor;
        const ganadorSF1 = playoffs.semifinales[0].ganador;
        const ganadorSF2 = playoffs.semifinales[1].ganador;

        // 3ER PUESTO
        if (!playoffs.tercerPuesto || !playoffs.tercerPuesto.jugador1) {
            playoffs.tercerPuesto = { jugador1: perdedorSF1, jugador2: perdedorSF2, gamesJ1: null, gamesJ2: null, ganador: null, perdedor: null, tipo: 'Tercer Puesto', matchId: 'tercerPuesto' };
        } 

        // FINAL
        if (!playoffs.final || !playoffs.final.jugador1) {
            playoffs.final = { jugador1: ganadorSF1, jugador2: ganadorSF2, gamesJ1: null, gamesJ2: null, ganador: null, perdedor: null, tipo: 'Final', matchId: 'final' };
        } 
        
        // Asignar 1er y 2do lugar si la final ya se jugó
        if(playoffs.final && playoffs.final.ganador) {
            playoffs.campeon = playoffs.final.ganador;
            playoffs.segundo = playoffs.final.perdedor;
        }

        // Asignar 3er y 4to lugar si el partido por el 3er puesto ya se jugó
        if(playoffs.tercerPuesto && playoffs.tercerPuesto.ganador) {
            playoffs.tercero = playoffs.tercerPuesto.ganador;
            playoffs.cuarto = playoffs.tercerPuesto.perdedor;
        }
    }
    
    guardarDatosLocal();
}

/**
 * Genera el HTML de los partidos de Playoffs (SF, 3er, Final).
 */
function generarPlayoffsHTML() {
    const container = document.getElementById('playoffs-container');
    if (!container) return;
    
    // Una vez que los grupos están completos, mostramos la sección de playoffs
    const isGroupsComplete = partidos.length > 0 && partidos.every(p => p.ganador);
    
    if (!isGroupsComplete || Object.keys(grupos).length !== 2) {
        container.innerHTML = `<p class="text-gray-600 mb-4">La Etapa Final (Playoffs) requiere que la Fase de Grupos esté <span class="font-bold text-indigo-700">100% completa</span> y que haya <span class="font-bold text-indigo-700">exactamente 2 grupos</span> para generar el Top 4.</p>`;
        return;
    }

    // Función auxiliar para renderizar un partido de playoff
    const renderMatch = (match, matchType, index, matchId) => {
        if (!match || !match.jugador1) return '';
        const isCompleted = match.ganador !== null;
        const typeLabel = matchType;
        const indexSuffix = index !== undefined ? ` #${index + 1}` : '';
        // La función registrarResultado se llama con el ID y un flag de playoff
        const clickHandler = `registrarResultadoPlayoff('${matchId}')`; 
        const scoreInputId = `score-j1-${matchId}`;
        const scoreInputId2 = `score-j2-${matchId}`;

        return `
            <div class="match-card ${isCompleted ? 'completed' : 'pending'} bg-white p-4 rounded-xl shadow-md transition duration-300 hover:shadow-lg">
                <h4 class="text-md font-bold text-indigo-700 mb-2">${typeLabel}${indexSuffix}</h4>
                <p class="text-xs text-gray-500 mb-2">${match.jugador1} vs ${match.jugador2}</p>
                <div class="score-inputs flex items-center justify-between space-x-2">
                    <span class="font-medium w-1/3 text-right truncate">${match.jugador1}</span>
                    <input type="number" id="${scoreInputId}" min="0" value="${match.gamesJ1 !== null ? match.gamesJ1 : 0}" ${isCompleted ? 'disabled' : ''} class="w-12 text-center border rounded-md p-1">
                    <span class="font-bold">Sets</span> 
                    <input type="number" id="${scoreInputId2}" min="0" value="${match.gamesJ2 !== null ? match.gamesJ2 : 0}" ${isCompleted ? 'disabled' : ''} class="w-12 text-center border rounded-md p-1">
                    <span class="font-medium w-1/3 text-left truncate">${match.jugador2}</span>
                </div>
                <button onclick="${clickHandler}" class="mt-3 w-full py-2 rounded-lg text-white font-semibold transition duration-150 ${isCompleted ? 'bg-green-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}" ${isCompleted ? 'disabled' : ''}>
                    ${isCompleted ? `Ganador: ${match.ganador} ${matchType === 'GRAN FINAL' ? '🏆' : ''}` : 'Registrar Marcador'}
                </button>
            </div>
        `;
    };
    
    // Helper para conectar el evento de click (ya que el HTML se inserta dinámicamente)
    window.registrarResultadoPlayoff = function(id) {
        if (id.startsWith('semi')) {
            const index = parseInt(id.split('-')[1]);
            registrarResultado(index, true); // index y isPlayoff=true para semis
        } else if (id === 'tercerPuesto') {
            registrarResultado(0, 'tercer');
        } else if (id === 'final') {
            registrarResultado(0, 'final');
        }
    };
    
    // Estructura de Playoffs
    let html = '<h3 class="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Cuadro de Eliminatorias (Top 4)</h3>';
    html += '<div class="playoff-bracket">';
    
    // Columna 1: Semifinales
    html += '<div class="playoff-column">';
    playoffs.semifinales.forEach((match, index) => {
        html += renderMatch(match, 'Semifinal', index, `semi-${index}`);
    });
    html += '</div>';

    // Columna 2: Tercer Puesto y Final
    html += '<div class="playoff-column justify-center items-center">';
    
    // Final
    if (playoffs.final && playoffs.final.jugador1) {
        html += renderMatch(playoffs.final, 'GRAN FINAL', undefined, 'final');
    } else {
        html += '<div class="text-center text-gray-500 p-4">Esperando Finalistas...</div>';
    }
    
    // 3ER PUESTO (va debajo de la final)
    if (playoffs.tercerPuesto && playoffs.tercerPuesto.jugador1) {
        html += renderMatch(playoffs.tercerPuesto, 'Partido por 3er Puesto', undefined, 'tercerPuesto');
    } else {
        html += '<div class="text-center text-gray-500 p-4">Esperando Perdedores...</div>';
    }
    
    html += '</div>';

    // Columna 3: Campeón
    html += '<div class="playoff-column justify-center items-center p-4 bg-yellow-50 rounded-xl">';
    if (playoffs.campeon) {
        html += `
            <h4 class="text-2xl font-extrabold text-green-700">🥇 CAMPEÓN</h4>
            <p class="text-4xl font-black text-indigo-800">${playoffs.campeon}</p>
        `;
    } else {
        html += '<p class="text-center text-gray-500">El Campeón se definirá en la Final.</p>';
    }
    html += '</div>';
    
    html += '</div>'; // Fin playoff-bracket
    
    container.innerHTML = html;
}

/**
 * Calcula el ranking general para todos los jugadores.
 */
function calcularRankingGeneral() {
    const allStats = new Map();
    
    // 1. Iniciar estadísticas de todos los participantes
    participantes.forEach(nombre => {
        allStats.set(nombre, { 
            nombre, 
            puntos: 0, 
            ganados: 0, 
            perdidos: 0, 
            sets_a_favor: 0, 
            sets_en_contra: 0, 
            jugados: 0,
            rankingLiguilla: 99, 
            rondaFinal: 'Liguilla'
        });
    });
    
    // 2. Acumular estadísticas de la Fase de Grupos
    partidos.filter(p => p.ganador).forEach(p => {
        const s1 = allStats.get(p.jugador1);
        const s2 = allStats.get(p.jugador2);

        if (!s1 || !s2) return; 

        s1.sets_a_favor += p.gamesJ1;
        s1.sets_en_contra += p.gamesJ2;
        s2.sets_a_favor += p.gamesJ2;
        s2.sets_en_contra += p.gamesJ1;
        s1.jugados++;
        s2.jugados++;

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

    // 3. Asignar el Ranking de Liguilla y Ronda Final
    for (const nombreGrupo in grupos) {
        const ranking = calcularRanking(grupos[nombreGrupo], nombreGrupo);
        ranking.forEach((p, index) => {
            const stats = allStats.get(p.nombre);
            if (stats) {
                stats.rankingLiguilla = index + 1;
                if (Object.keys(grupos).length === 2 && index < 2) { 
                     stats.rondaFinal = 'Semifinales';
                }
            }
        });
    }

    // 4. Actualizar Ronda Final con resultados de Playoffs
    if (playoffs.campeon) allStats.get(playoffs.campeon).rondaFinal = 'Campeón';
    if (playoffs.segundo) allStats.get(playoffs.segundo).rondaFinal = 'Segundo Lugar';
    if (playoffs.tercero) allStats.get(playoffs.tercero).rondaFinal = 'Tercer Lugar';
    if (playoffs.cuarto) allStats.get(playoffs.cuarto).rondaFinal = 'Cuarto Lugar';

    // 5. Incorporar sets y partidos de Playoffs para estadísticas
    const playoffMatches = [
        ...playoffs.semifinales, 
        playoffs.tercerPuesto, 
        playoffs.final
    ].filter(m => m && m.ganador);

    playoffMatches.forEach(m => {
        // Acumular sets y partidos jugados de playoffs
        [m.jugador1, m.jugador2].forEach(jName => {
            const stats = allStats.get(jName);
            if(stats) {
                // Solo añadir si el jugador realmente participó en ese partido (y no solo fue el ganador/perdedor asignado)
                if (m.jugador1 === jName || m.jugador2 === jName) {
                    stats.sets_a_favor += (m.jugador1 === jName ? m.gamesJ1 : m.gamesJ2);
                    stats.sets_en_contra += (m.jugador1 === jName ? m.gamesJ2 : m.gamesJ1);
                    stats.jugados++; 
                }
            }
        });
    });
    
    // 6. Ordenar el Ranking General
    let finalRanking = Array.from(allStats.values());
    
    // Orden de desempate de Rondas (menor es mejor)
    const rondaOrder = { 'Campeón': 1, 'Segundo Lugar': 2, 'Tercer Lugar': 3, 'Cuarto Lugar': 4, 'Semifinales': 5, 'Liguilla': 6 };

    finalRanking.sort((a, b) => {
        // 1. Por Ronda Final
        const roundA = rondaOrder[a.rondaFinal] || 99;
        const roundB = rondaOrder[b.rondaFinal] || 99;
        if (roundA !== roundB) return roundA - roundB;
        
        // 2. Para jugadores en la misma ronda, usar Puntos de Liguilla
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        
        // 3. Por Sets de Diferencia Total (Liguilla + Playoffs)
        const difA = a.sets_a_favor - a.sets_en_contra;
        const difB = b.sets_a_favor - b.sets_en_contra;
        if (difB !== difA) return difB - difA;
        
        // 4. Por Ranking de Liguilla (el mejor desempate final)
        return a.rankingLiguilla - b.rankingLiguilla;
    });

    // Mostrar el ranking
    mostrarRankingGeneralHTML(finalRanking);
}

function mostrarRankingGeneralHTML(ranking) {
    const tabla = document.getElementById('ranking-final');
    if (!tabla) return;
    
    let html = `
        <table class="w-full text-sm text-left text-gray-700 shadow-lg rounded-xl overflow-hidden">
            <thead class="text-xs text-white uppercase bg-indigo-600">
                <tr>
                    <th scope="col" class="py-2 px-3 rounded-tl-xl">#</th>
                    <th scope="col" class="py-2 px-3">Jugador</th>
                    <th scope="col" class="py-2 px-3">Ronda Final</th>
                    <th scope="col" class="py-2 px-3">Ptos Liga</th>
                    <th scope="col" class="py-2 px-3">Sets Dif Total</th>
                    <th scope="col" class="py-2 px-3 rounded-tr-xl">Partidos Jugados</th>
                </tr>
            </thead>
            <tbody>
    `;
    ranking.forEach((p, index) => {
        const setsDif = p.sets_a_favor - p.sets_en_contra;
        let bgClass = 'bg-white';
        let medal = '';
        if (index === 0) {
             bgClass = 'bg-yellow-100 font-extrabold';
             medal = '🥇';
        } else if (index === 1) {
             bgClass = 'bg-gray-200 font-semibold';
             medal = '🥈';
        } else if (index === 2) {
             bgClass = 'bg-yellow-50 font-medium';
             medal = '🥉';
        }
        
        html += `
            <tr class="${bgClass} border-b hover:bg-gray-50">
                <th scope="row" class="py-3 px-3 font-medium text-gray-900 whitespace-nowrap">${index + 1} ${medal}</th>
                <td class="py-3 px-3">${p.nombre}</td>
                <td class="py-3 px-3 font-bold text-indigo-700">${p.rondaFinal}</td>
                <td class="py-3 px-3">${p.puntos}</td>
                <td class="py-3 px-3">${setsDif}</td>
                <td class="py-3 px-3">${p.jugados}</td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    tabla.innerHTML = html;
}


function mostrarRanking(ranking, tablaId) { 
    const tabla = document.getElementById(tablaId);
    if (!tabla) return;
    
    let html = `
        <table class="w-full text-sm text-left text-gray-700">
            <thead class="text-xs text-white uppercase bg-indigo-600">
                <tr>
                    <th scope="col" class="py-2 px-3">#</th>
                    <th scope="col" class="py-2 px-3">Jugador</th>
                    <th scope="col" class="py-2 px-3">Ptos</th>
                    <th scope="col" class="py-2 px-3">G</th>
                    <th scope="col" class="py-2 px-3">P</th>
                    <th scope="col" class="py-2 px-3">Dif Sets</th>
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
    let allGroupsComplete = true;
    for (const nombreGrupo in grupos) {
        const jugadoresGrupo = grupos[nombreGrupo];
        const ranking = calcularRanking(jugadoresGrupo, nombreGrupo);
        mostrarRanking(ranking, `ranking-grupo-${nombreGrupo.toLowerCase()}`);
        
        // Verificar si este grupo está completo
        const partidosEnGrupo = partidos.filter(p => p.grupo === nombreGrupo);
        if (partidosEnGrupo.length > 0 && partidosEnGrupo.some(p => !p.ganador)) {
             allGroupsComplete = false;
        }
    }
    
    // Si todos los grupos están completos Y tenemos 2 grupos, generamos los playoffs.
    if (allGroupsComplete && Object.keys(grupos).length === 2) {
        generarPlayoffs();
        generarPlayoffsHTML();
    } else if (Object.keys(grupos).length > 2) {
         document.getElementById('playoffs-container').innerHTML = `<p class="text-red-600 font-semibold">⚠️ Nota: La Etapa Final (Playoffs) está deshabilitada para ${Object.keys(grupos).length} grupos. Solo soportado para 2 grupos (Top 4).</p>`;
    } else {
        generarPlayoffsHTML(); // Muestra el mensaje de 'Grupos Incompletos' si aplica
    }
    
    calcularRankingGeneral();
}


// ==========================================================
// FUNCIÓN DE ANÁLISIS DE GEMINI (IA)
// ==========================================================

async function generateTournamentAnalysis() {
    const resultsContainer = document.getElementById('analysis-results');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="flex items-center space-x-2 justify-center p-4 bg-gray-50 rounded-xl">
            <svg class="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-gray-600">Generando análisis estratégico de Tenis... Esto puede tardar unos segundos.</span>
        </div>
    `;

    const modelName = "gemini-2.5-flash-preview-05-20";
    const apiKey = ""; // Se inyecta en el entorno de la app
    const queryParam = apiKey ? `?key=${apiKey}` : ''; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent${queryParam}`; 

    const tournamentState = playoffs.campeon ? 'Finalizado' : 'en curso';
    
    const rankingData = Object.keys(grupos).map(nombre => {
        const ranking = calcularRanking(grupos[nombre], nombre);
        return `Grupo ${nombre}: ${ranking.map(r => `${r.nombre} (Ptos: ${r.puntos}, Dif Sets: ${r.dif})`).join('; ')}`;
    }).join('\n');


    let userQuery = `Eres un analista deportivo experto en el torneo de Tenis. Genera un análisis estratégico de este torneo.
    - Estado del Torneo: ${tournamentState}.
    - Número de grupos: ${NUM_GRUPOS}.
    - Jugadores inscritos: ${participantes.join(', ')}.
    - Ranking actual de Grupos:\n${rankingData}`;

    if (playoffs.final && playoffs.final.jugador1) {
        const pStatus = playoffs.campeon ? `Campeón: ${playoffs.campeon}, Segundo: ${playoffs.segundo}` : 'Playoffs en curso.';
        userQuery += `\n- Estado de Playoffs: ${pStatus}`;
    }
    
    userQuery += `\n\nProporciona un párrafo corto con: el mayor desafío táctico para el torneo, un pronóstico sobre el favorito y una sugerencia de regla de casa (house rule) divertida para añadir un giro.`;

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
                <div class="bg-white p-4 rounded-xl shadow-inner border border-indigo-200 mt-4 whitespace-pre-wrap">
                    <h5 class="text-lg font-bold text-indigo-700 mb-2">Análisis Estratégico de Gemini 🧠</h5>
                    <p class="text-gray-700">${analysisText}</p>
                </div>
            `;
            
        } else {
            resultsContainer.innerHTML = '<p class="text-red-500">Error: No se pudo obtener la respuesta del modelo o la respuesta estaba vacía.</p>';
        }

    } catch (error) {
        console.error("Fallo definitivo al generar análisis:", error);
        resultsContainer.innerHTML = `
            <div class="bg-red-100 p-3 rounded-xl border border-red-400 mt-4">
                <p class="text-red-700 font-semibold">Error al generar el análisis 🚨</p>
                <p class="text-red-600 text-sm mt-1">${error.message}</p>
                <p class="text-xs mt-1">Asegúrate de tener conexión y que la configuración del torneo esté completa.</p>
            </div>
        `;
    }
}


// ==========================================================
// PUNTO DE ENTRADA ÚNICO (Llamado desde index.html después de Firebase Auth)
// ==========================================================

window.loadAndInitializeLogic = function() {
    console.log("✅ Lógica de la aplicación inicializada después de la autenticación.");
    
    // 1. Cargar el estado más reciente (priorizando Local Storage)
    loadLocalStorageData(); 
    
    // 2. Si Firebase está disponible y tenemos un ID, iniciar la escucha en tiempo real
    if (window.db && currentTournamentId) {
        listenForTournamentChanges();
    }

    // 3. Conexión de Botones a Event Listeners
    
    // Configuración
    document.getElementById('btn-configurar-max')?.addEventListener('click', configurarMaxJugadores);
    document.getElementById('btn-configurar-grupos')?.addEventListener('click', configurarNumGrupos);

    // Registro
    document.getElementById('btn-agregar-participante')?.addEventListener('click', agregarParticipante);
    document.getElementById('btn-iniciar')?.addEventListener('click', iniciarTorneo);
    
    // Borrado 
    document.getElementById('btn-borrar-datos')?.addEventListener('click', borrarDatos);

    // Análisis
    document.getElementById('btn-generate-analysis')?.addEventListener('click', generateTournamentAnalysis);

    // 4. Sincronización inicial de la UI
    sincronizarUIConEstado(); 
};
