// my-app-logic.js - Versión corregida como módulo ES6
// Se inicializa vía window.loadAndInitializeLogic() desde index.html

import { doc, getDoc, addDoc, setDoc, onSnapshot, collection, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ==========================================================
// UTILITY: EXPONENTIAL BACKOFF FOR FIREBASE WRITES AND API CALLS
// ==========================================================

async function retryWithBackoff(operation, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            if (i === maxRetries - 1) {
                throw error;
            }
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

let currentTournamentId = localStorage.getItem('currentTournamentId') || null;

// Exponer funciones globales para onclick (necesario en módulo)
window.registrarResultado = null; // Se asigna más abajo
window.registrarResultadoPlayoff = null;
window.copyToClipboard = null;

// --- Funciones de Display ---
function displayTournamentInfo() {
    const displayElement = document.getElementById('tournament-id-display');
    const userId = typeof window.userId !== 'undefined' ? window.userId : 'No Autenticado';

    if (displayElement && currentTournamentId) {
        const shareText = `ID del Torneo (Compartir): ${currentTournamentId}`;
        const shareLink = `https://mi-app.com/torneo?id=${currentTournamentId}`;

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

// Helper para copiar al portapapeles (fix: usa Clipboard API moderna)
window.copyToClipboard = async function(text) {
    try {
        await navigator.clipboard.writeText(text);
        console.log("ID copiado al portapapeles.");
        // En app real, muestra un toast: alert("ID copiado!");
    } catch (err) {
        console.error('No se pudo copiar: ', err);
        // Fallback para navegadores viejos
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
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
        if (!isCompleted) allMatchesCompleted = false;
        
        // onclick ahora usa la función global
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
    
    const analysisButton = document.getElementById('btn-generate-analysis');
    if (analysisButton) {
        analysisButton.style.display = allMatchesCompleted ? 'block' : 'none';
        if (allMatchesCompleted) console.log("🏆 Fase de grupos completa. Listo para generar Playoffs.");
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
    const max = localStorage.getItem('maxJugadores');
    if (max) MAX_JUGADORES = parseInt(max);

    const numG = localStorage.getItem('numGrupos');
    if (numG) NUM_GRUPOS = parseInt(numG);
    
    participantes = JSON.parse(localStorage.getItem('participantes') || '[]');
    partidos = JSON.parse(localStorage.getItem('partidos') || '[]');
    grupos = JSON.parse(localStorage.getItem('grupos') || '{}'); 
    playoffs = JSON.parse(localStorage.getItem('playoffs') || '{"semifinales": [], "tercerPuesto": null, "final": null, "campeon": null, "segundo": null, "tercero": null, "cuarto": null}'); 
    currentTournamentId = localStorage.getItem('currentTournamentId') || null;

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

async function borrarDatos() {
    console.warn("⚠️ Aviso: Se han borrado todos los datos locales del torneo. Recargando...");
    // Borrar solo keys específicas (no todo localStorage)
    ['maxJugadores', 'numGrupos', 'participantes', 'partidos', 'grupos', 'playoffs', 'currentTournamentId'].forEach(key => localStorage.removeItem(key));
    
    if (window.db && currentTournamentId) {
        try {
            const torneosCollection = collection(window.db, "artifacts", window.appId, "public", "data", "torneos");
            await deleteDoc(doc(torneosCollection, currentTournamentId));
            console.log(`Documento de Firebase con ID ${currentTournamentId} eliminado.`);
        } catch (e) {
            console.error("No se pudo eliminar el documento de Firebase:", e);
        }
    }
    location.reload(); 
}

// --- LÓGICA DE FIREBASE ---

function listenForTournamentChanges() {
    if (!window.db || !window.appId) {
        console.warn("❌ Firebase no está inicializado. Ejecutando solo con Local Storage.");
        return;
    }
    
    const torneosRef = collection(window.db, "artifacts", window.appId, "public", "data", "torneos");
    
    if (currentTournamentId) {
        const docRef = doc(torneosRef, currentTournamentId);
        onSnapshot(docRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                console.log("⬇️ Datos del Torneo actualizados desde Firebase.");
                actualizarEstadoDesdeDB(data);
            } else {
                console.warn("El torneo guardado en Firebase ya no existe. Creando uno nuevo si es necesario.");
                currentTournamentId = null;
                guardarDatosLocal();
                saveTournamentConfig(); 
            }
        }, (error) => {
            console.error("Error al escuchar el documento:", error);
        });
    } else {
        console.log("Modo Creación de Torneo. El guardado creará un nuevo ID.");
    }
}

function actualizarEstadoDesdeDB(data) {
    MAX_JUGADORES = data.max_jugadores || MAX_JUGADORES;
    NUM_GRUPOS = data.num_grupos || NUM_GRUPOS;
    participantes = data.participantes || participantes;
    partidos = data.partidos || partidos;
    grupos = data.grupos || grupos;
    playoffs = data.playoffs || playoffs;
    
    guardarDatosLocal();
    sincronizarUIConEstado();
}

async function saveTournamentConfig() {
    if (!window.db) {
        console.error("❌ Firebase Firestore 'db' no está inicializado. No se puede guardar en la nube.");
        return;
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
        fecha_ultima_actualizacion: serverTimestamp(),
        estado: (playoffs.campeon ? 'Finalizado' : Object.keys(grupos).length > 0 ? 'En curso' : 'Pre-registro')
    };

    const operation = async () => {
        if (currentTournamentId) {
            const docRef = doc(torneosCollection, currentTournamentId);
            await setDoc(docRef, tournamentData, { merge: true }); 
            return { type: 'UPDATE', id: currentTournamentId };
        } else {
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
            listenForTournamentChanges(); 
        } else {
            console.log("⬆️ Configuración del torneo actualizada en Firebase:", result.id);
        }
        displayTournamentInfo(); 
    } catch (error) {
        console.error("❌ ERROR CRÍTICO: Falló la operación de guardado/actualización en Firebase.", error);
    }
}

// Función nueva: Cargar torneo externo por ID
async function loadExternalTournament() {
    const input = document.getElementById('external-id-input');
    const loadMessage = document.getElementById('load-message');
    const id = input.value.trim();

    if (!id) {
        loadMessage.textContent = 'Ingresa un ID válido.';
        loadMessage.className = 'text-sm text-red-500 mt-2';
        return;
    }

    if (!window.db) {
        loadMessage.textContent = 'Firebase no disponible. Usa localStorage.';
        loadMessage.className = 'text-sm text-red-500 mt-2';
        return;
    }

    try {
        loadMessage.textContent = 'Cargando...';
        loadMessage.className = 'text-sm text-indigo-500 mt-2';

        const torneosCollection = collection(window.db, "artifacts", window.appId, "public", "data", "torneos");
        const docRef = doc(torneosCollection, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            currentTournamentId = id;
            localStorage.setItem('currentTournamentId', id);
            actualizarEstadoDesdeDB(data);
            loadMessage.textContent = 'Torneo cargado exitosamente.';
            loadMessage.className = 'text-sm text-green-500 mt-2';
            input.value = '';
            listenForTournamentChanges(); // Activar real-time
        } else {
            loadMessage.textContent = 'ID de torneo no encontrado.';
            loadMessage.className = 'text-sm text-red-500 mt-2';
        }
    } catch (error) {
        console.error('Error al cargar torneo:', error);
        loadMessage.textContent = 'Error al cargar. Verifica conexión.';
        loadMessage.className = 'text-sm text-red-500 mt-2';
    }
}

// --- SINCRONIZACIÓN DE LA UI (COMPLETA) ---

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
    const isTournamentStarted = participantes
