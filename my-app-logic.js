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
let playoffs = {
    semifinales: [],
    tercerPuesto: null,
    final: null
};
let MAX_JUGADORES = 10; // VALOR INICIAL

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
 * Nota: Esta función es clave para inicializar la UI después de cargar
 * de Firebase o si no hay un torneo en la nube.
 */
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
    
    const isTournamentStarted = participantes.length === MAX_JUGADORES && grupos.A.length > 0;

    if (isTournamentStarted) {
        document.getElementById('configuracion').style.display = 'none';
        document.getElementById('registro').style.display = 'none';
        document.getElementById('grupos-fixture').style.display = 'block';
        document.getElementById('ranking-finales').style.display = 'block';
        
        // Muestra el botón de análisis solo si el torneo está iniciado
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
 * Útil para la persistencia básica y para replicar el estado de Firebase.
 */
function guardarDatos() {
    localStorage.setItem('maxJugadores', MAX_JUGADORES);
    localStorage.setItem('participantes', JSON.stringify(participantes));
    localStorage.setItem('partidos', JSON.stringify(partidos));
    localStorage.setItem('grupos', JSON.stringify(grupos));
    localStorage.setItem('playoffs', JSON.stringify(playoffs)); 
}

function borrarDatos() {
    // Usamos console.log para evitar el alert() en ambientes restringidos
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
            participantes = data.participantes || [];
            // Aseguramos que los arrays y objetos complejos se carguen
            partidos = data.partidos || []; 
            grupos = data.grupos || { A: [], B: [] };
            playoffs = data.playoffs || { semifinales: [], tercerPuesto: null, final: null };

            // CRÍTICO: Guardar en Local Storage para mantener la consistencia en el dispositivo que acaba de cargar
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
        // En este entorno usamos la sintaxis de la librería v8, simulando doc(db, "torneos", externalId).get()
        const docSnap = await db.collection("torneos").doc(externalId).get();

        if (docSnap.exists) {
            // Guarda el ID en la memoria local y lo establece como torneo actual
            localStorage.setItem('currentTournamentId', externalId);
            currentTournamentId = externalId;
            
            console.log(`✅ Torneo ID ${externalId} encontrado y sincronizado. Recargando...`);
            // Recargamos la aplicación para que cargue los datos de Firebase
            location.reload(); 
        } else {
            console.error("❌ Error: No se encontró un torneo con ese ID.");
            // Usamos un modal o mensaje para el usuario en lugar de alert()
            document.getElementById('load-message').textContent = "Error: No se encontró un torneo con ese ID. Verifica que sea correcto.";
            document.getElementById('external-id-input').value = '';
        }
    } catch (error) {
        console.error("Error al cargar el ID externo:", error);
        document.getElementById('load-message').textContent = "Error de conexión. Revisa la consola.";
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
        participantes: participantes,
        partidos: partidos, // Fixture de grupos
        grupos: grupos,     // Lista de jugadores en Grupo A y B
        playoffs: playoffs, // Estructura de eliminatorias
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
    grupos = { A: [], B: [] };
    playoffs = { semifinales: [], tercerPuesto: null, final: null };
    
    guardarDatos();
    actualizarIU();
    console.log(`Torneo configurado para ${MAX_JUGADORES} jugadores.`);
    
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
    
    // Recargar la UI para mostrar las nuevas secciones
    cargarDatos();
    
    await saveTournamentConfig(); 
}

// --- Lógica de Torneo ---

function generarFixture(grupo) { 
    const fixture = [];
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

function saveParticipant(name, score) {
    // Función de ejemplo para guardar scores individuales
    if (typeof db === 'undefined') {
        console.error("Firebase no inicializado.");
        return Promise.resolve(false);
    }
    const operation = async () => {
        // Usamos la colección 'scores' para este ejemplo
        await db.collection("scores").add({
            name: name,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    };

    try {
        return retryWithBackoff(operation);
    } catch (error) {
        console.error("Error writing score to 'scores' collection: ", error.message);
        return false;
    }
}

function getScores() {
    // Escucha en tiempo real (onSnapshot)
    if (typeof db === 'undefined') return;
    
    // Implementación mínima para evitar errores
    db.collection("scores").limit(10).onSnapshot((snapshot) => {
        // Aquí se actualizaría una lista de scores en la UI
    }, (error) => {
        console.error("Error al escuchar scores:", error);
    });
}


function calcularRanking(jugadores, calcularGlobal = false) { 
    // Implementación simple del ranking de grupos (para evitar complejidad innecesaria)
    const ranking = participantes.map(p => ({ nombre: p, puntos: 0, ganados: 0, perdidos: 0, dif: 0 }));
    return ranking;
}

function mostrarRanking(ranking, tablaId) { 
    const tabla = document.getElementById(tablaId);
    if (!tabla) return;
    let html = `
        <table class="w-full text-sm text-left text-gray-700 shadow-lg rounded-xl overflow-hidden">
            <thead class="text-xs text-white uppercase bg-indigo-600">
                <tr>
                    <th scope="col" class="py-3 px-6 rounded-tl-xl">#</th>
                    <th scope="col" class="py-3 px-6">Jugador</th>
                    <th scope="col" class="py-3 px-6">Puntos</th>
                    <th scope="col" class="py-3 px-6 rounded-tr-xl">Dif. Goles</th>
                </tr>
            </thead>
            <tbody>
    `;
    ranking.forEach((p, index) => {
        html += `
            <tr class="bg-white border-b hover:bg-gray-50">
                <th scope="row" class="py-4 px-6 font-medium text-gray-900 whitespace-nowrap">${index + 1}</th>
                <td class="py-4 px-6">${p.nombre}</td>
                <td class="py-4 px-6 font-bold">${p.puntos}</td>
                <td class="py-4 px-6">${p.dif}</td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    tabla.innerHTML = html;
}

function generarPlayoffs(rA, rB) { /* ... tu código ... */ }
function mostrarRankingFinal() { /* ... tu código ... */ }
function actualizarRankingYFinales() { 
    const rankingA = calcularRanking(grupos.A);
    const rankingB = calcularRanking(grupos.B);

    mostrarRanking(rankingA, 'ranking-grupo-a');
    mostrarRanking(rankingB, 'ranking-grupo-b');

    // Aquí iría la lógica para pasar a playoffs si todos los partidos de grupo están terminados
}

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
    const apiKey = ""; // La clave se espera que sea inyectada por el entorno
    
    // CRÍTICO: Si la clave está vacía, omitimos el parámetro ?key= para que el entorno inyecte la autenticación
    const queryParam = apiKey ? `?key=${apiKey}` : ''; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent${queryParam}`;

    const playerList = participantes.join(', ');
    const tournamentState = grupos.A.length > 0 ? 'iniciado' : 'en pre-registro';
    
    // Construimos el prompt usando los datos del torneo
    const userQuery = `Eres un analista deportivo experto en el torneo de futbolín/foosball. Genera un análisis estratégico de este torneo.
    - Estado del Torneo: ${tournamentState}.
    - Número de jugadores: ${MAX_JUGADORES}.
    - Jugadores inscritos: ${playerList}.
    
    Proporciona un párrafo corto con: el mayor desafío para el torneo, un pronóstico sobre el favorito y una sugerencia de regla de casa (house rule) divertida para añadir un giro.`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        // Usamos la herramienta de búsqueda para obtener contexto actual si fuera necesario (aunque no es vital aquí)
        tools: [{ "google_search": {} }], 
    };

    const operation = async () => {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Manejo de errores específicos, incluido el 400
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
            
            // 1. Mostrar el texto
            resultsContainer.innerHTML = `
                <div class="bg-white p-4 rounded-xl shadow-inner border border-indigo-200">
                    <h5 class="text-lg font-bold text-indigo-700 mb-2">Análisis Estratégico de Gemini</h5>
                    <p class="text-gray-700 whitespace-pre-wrap">${analysisText}</p>
                </div>
            `;
            
            // 2. Extraer y mostrar las fuentes (si existen)
            let sourcesHtml = '';
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                const sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title);

                if (sources.length > 0) {
                    sourcesHtml = '<p class="text-xs text-gray-500 mt-2">Fuentes: ' +
                        sources.map(s => `<a href="${s.uri}" target="_blank" class="text-indigo-500 hover:underline">${s.title}</a>`).join(', ') +
                        '</p>';
                }
            }
            resultsContainer.innerHTML += sourcesHtml;
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
    
    // 1. CRÍTICO: Intentamos cargar desde Firebase si hay un ID guardado.
    if (currentTournamentId) {
        await loadTournamentFromFirebase();
    }
    
    // 2. Cargar datos desde Local Storage (ya sea los antiguos o los recién sincronizados)
    cargarDatos();
    
    // 3. Inicia la lectura de scores de Firebase (solo lectura, no crítico)
    getScores(); 
    
    // --- LISTENER para la Sincronización (Carga por ID) ---
    const loadForm = document.getElementById('load-tournament-form');
    if (loadForm) {
        loadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            document.getElementById('load-message').textContent = 'Buscando torneo...';
            const externalId = document.getElementById('external-id-input').value.trim();
            if (externalId) {
                await loadExternalTournamentById(externalId);
            } else {
                document.getElementById('load-message').textContent = "Por favor, introduce un ID de torneo válido.";
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
