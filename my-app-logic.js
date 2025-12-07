// my-app-logic.js (Versión 2: Modular y Mejorada)

// --- 1. ESTADO GLOBAL ---

let players = [];
let matches = [];
let playoffMatches = [];

// Configuración centralizada
let config = {
    maxPlayers: 10,
    numGroups: 2,
    setsToWin: 2,       // 2 para Mejor de 3, 3 para Mejor de 5
    maxGamesPerSet: 6,  // Juegos para ganar el set (ej: 6-4)
    matchType: 'singles', // 'singles' o 'doubles'
};

let currentStage = 'group'; // 'group' o 'playoff'
let currentStep = 'groups'; // 'groups' o 'finalStandings'

// Variables para el DOM (inicializadas en loadAndInitializeLogic)
let groupMatchesContainer, standingsContainer, playoffContainer, statusMessage;


// --- 2. GESTIÓN DE DATOS Y ESTADO (CLOUD/LOCAL) ---

/**
 * Carga los datos guardados, decodificando el campo 'scores' de Firestore.
 */
async function loadData() {
    let dataLoaded = false;
    let data = {};

    // 1. Intentar cargar desde Cloud (Firebase)
    if (window.isCloudMode && window.db && window.userId) {
        try {
            const docRef = window.doc(window.db, "tournaments", window.userId);
            const docSnap = await window.getDoc(docRef);

            if (docSnap.exists()) {
                data = docSnap.data();
                dataLoaded = true;
                showTournamentId(window.userId);
                showStatus("Tournament data loaded from Cloud.", "blue");
            } 
        } catch (e) {
            console.error("Error loading cloud data: ", e);
            showStatus("Error connecting to cloud. Loading local data.", "red");
        }
    }

    // 2. Si no se cargó de Cloud o no estamos en modo Cloud, cargar localmente
    if (!dataLoaded) {
        const localData = localStorage.getItem('tournamentData');
        if (localData) {
            data = JSON.parse(localData);
        }
    }

    // 3. Aplicar y Deserializar los datos cargados
    if (Object.keys(data).length > 0) {
        players = data.players || [];
        
        // Deserializar scores de cadena JSON a array de arrays (Solución Firebase)
        const deserializeMatches = (matchArray) => {
            return (matchArray || []).map(m => ({
                ...m,
                scores: typeof m.scores === 'string' ? JSON.parse(m.scores) : m.scores || [[undefined, undefined]]
            }));
        };

        matches = deserializeMatches(data.matches);
        playoffMatches = deserializeMatches(data.playoffMatches);
        
        currentStage = data.currentStage || 'group';
        currentStep = data.currentStep || 'groups';
        
        // Cargar configuración
        config.maxPlayers = parseInt(data.config?.maxPlayers || data.maxPlayers) || 10;
        config.numGroups = parseInt(data.config?.numGroups || data.numGroups) || 2;
        config.setsToWin = parseInt(data.config?.setsToWin || data.maxSetsToWin) || 2;
        config.maxGamesPerSet = parseInt(data.config?.maxGamesPerSet || data.maxGamesPerSet) || 6;
        config.matchType = data.config?.matchType || data.matchType || 'singles';
    }
}

/**
 * Guarda el estado actual del torneo. Serializa 'scores' para Firestore.
 */
function saveData(silent = false) {
    // 1. Crear el objeto de datos para guardar
    const data = {
        players,
        currentStage,
        currentStep,
        config, // Guardamos el objeto de configuración completo
        timestamp: new Date().toISOString()
    };
    
    // Función de serialización para Firestore
    const serializeMatches = (matchArray) => {
        return (matchArray || []).map(m => ({
            ...m,
            // Convertir scores (array de arrays) a string JSON para evitar el error de Firestore
            scores: JSON.stringify(m.scores)
        }));
    };
    
    // Datos serializados para Firestore
    const dataToSave = {
        ...data,
        matches: serializeMatches(matches),
        playoffMatches: serializeMatches(playoffMatches),
    };

    // 2. Guardar localmente (usamos el objeto sin serializar, ya que localStorage maneja bien arrays anidados)
    localStorage.setItem('tournamentData', JSON.stringify({ ...data, matches, playoffMatches }));

    // 3. Guardar en Cloud si está disponible
    if (window.isCloudMode && window.db && window.userId) {
        const docRef = window.doc(window.db, "tournaments", window.userId);
        window.setDoc(docRef, dataToSave)
            .then(() => {
                if (!silent) showStatus("Data synced to Cloud and saved locally.", "green");
            })
            .catch((e) => {
                console.error("Error saving cloud data: ", e);
                if (!silent) showStatus("Error syncing to Cloud. Data saved locally only.", "orange");
            });
    } else {
        if (!silent) showStatus("Data saved locally.", "green");
    }
}

/**
 * Muestra un mensaje temporal de estado.
 */
function showStatus(message, type) {
    if (!statusMessage) return;
    
    const classMap = {
        'green': 'bg-green-100 border-green-400 text-green-700',
        'red': 'bg-red-100 border-red-400 text-red-700',
        'blue': 'bg-blue-100 border-blue-400 text-blue-700',
        'indigo': 'bg-indigo-100 border-indigo-400 text-indigo-700',
        'orange': 'bg-orange-100 border-orange-400 text-orange-700',
    };
    
    statusMessage.textContent = message;
    statusMessage.className = `fixed top-4 left-1/2 transform -translate-x-1/2 p-3 rounded-lg border-l-4 font-medium transition-opacity z-50 ${classMap[type]}`;
    statusMessage.style.opacity = '1';

    if (window.statusTimeout) clearTimeout(window.statusTimeout);
    window.statusTimeout = setTimeout(() => {
        statusMessage.style.opacity = '0';
    }, 4000);
}

// --- 3. GESTIÓN DE JUGADORES Y CONFIGURACIÓN ---

/**
 * Actualiza la UI de configuración con los valores actuales.
 */
function updateConfigUI() {
    // Actualizar displays
    document.getElementById('max-jugadores-actual').textContent = config.maxPlayers;
    document.getElementById('num-grupos-actual').textContent = config.numGroups;
    document.getElementById('max-games-set-actual').textContent = config.maxGamesPerSet;
    document.getElementById('sets-to-win-actual').textContent = config.setsToWin;
    document.getElementById('max-participantes-display').textContent = config.maxPlayers;
    
    // Actualizar inputs/selects (usando data-config-key)
    document.querySelectorAll('[data-config-key]').forEach(element => {
        const key = element.dataset.configKey;
        // Convertir strings a números si es necesario
        element.value = config[key];
    });

    renderPlayerList();
}

/**
 * Gestiona los cambios en los inputs de configuración.
 */
function handleConfigChange(event) {
    const input = event.target;
    const key = input.dataset.configKey;
    let value = input.value;

    if (input.type === 'number') {
        value = parseInt(value);
    }
    
    if (key === 'maxPlayers' || key === 'numGroups') {
        if (value < 1 || (key === 'maxPlayers' && value % 2 !== 0 && players.length > 0)) {
            showStatus("Max Players must be an even number (min 4).", "red");
            input.value = config[key]; // Revertir
            return;
        }
        if (key === 'numGroups' && config.maxPlayers % value !== 0) {
            showStatus("Total players must be divisible by the number of groups.", "red");
            input.value = config[key]; // Revertir
            return;
        }
    }
    
    config[key] = value;
    updateConfigUI(); // Reflejar el cambio
    saveData(false);
}

/**
 * Renderiza la lista de jugadores registrados.
 */
function renderPlayerList() {
    const listContainer = document.getElementById('lista-participantes');
    const countDisplay = document.getElementById('contador-participantes');
    const countListDisplay = document.getElementById('contador-participantes-list');

    if (listContainer && countDisplay && countListDisplay) {
        listContainer.innerHTML = players.map(p => `
            <li class="flex justify-between items-center p-1 bg-gray-50 rounded">
                <span class="truncate flex items-center">
                    ${getPlayerAvatar(p)}
                    ${p.name} (G${p.group})
                </span>
                <button data-player-id="${p.id}" class="btn-remove-player text-red-500 hover:text-red-700 ml-2">X</button>
            </li>
        `).join('');
        
        countDisplay.textContent = players.length;
        countListDisplay.textContent = players.length;

        document.querySelectorAll('.btn-remove-player').forEach(btn => {
            btn.addEventListener('click', handleRemovePlayer);
        });
    }
}

/**
 * Obtiene el HTML del avatar o iniciales del jugador.
 */
function getPlayerAvatar(player) {
    if (player.photoURL) {
        return `<img src="${player.photoURL}" alt="${player.name}" class="player-avatar w-8 h-8 object-cover mr-2">`;
    }
    if (player.name.startsWith('Winner') || player.name.startsWith('Loser')) {
        return `<span class="player-avatar bg-transparent"></span>`;
    }
    const initial = player.name.charAt(0).toUpperCase();
    return `<div class="player-avatar bg-indigo-200 text-indigo-700 mr-2">${initial}</div>`;
}

/**
 * Gestiona el botón de agregar participante.
 */
function handleAddPlayer() {
    const nameInput = document.getElementById('nombre-input');
    const photoInput = document.getElementById('photo-url-input');
    const name = nameInput.value.trim();
    const photoURL = photoInput.value.trim();

    if (!name) {
        showStatus("Please enter a player name.", "red");
        return;
    }

    if (players.length >= config.maxPlayers) {
        showStatus(`Maximum player/team limit (${config.maxPlayers}) reached.`, "red");
        return;
    }
    
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showStatus("Player/Team name already exists.", "red");
        return;
    }

    // Asignar el grupo
    const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, config.numGroups);
    const groupIndex = players.length % config.numGroups;
    const group = groupLetters[groupIndex];

    players.push({ 
        id: crypto.randomUUID(), 
        name: name, 
        group: group, 
        photoURL: photoURL || null // Guardar URL de foto
    });

    nameInput.value = '';
    photoInput.value = '';
    renderPlayerList();
    saveData(true);
    showStatus(`Player ${name} added to Group ${group}.`, "blue");
}

/**
 * Gestiona la eliminación de un jugador.
 */
function handleRemovePlayer(event) {
    // ... (la lógica es la misma que antes: reajustar grupos y guardar) ...
    const playerId = event.target.dataset.playerId;
    players = players.filter(p => p.id !== playerId);
    
    // Reajustar grupos
    players.forEach((p, index) => {
        const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, config.numGroups);
        p.group = groupLetters[index % config.numGroups];
    });

    if (matches.length > 0) {
        matches = [];
        playoffMatches = [];
        currentStage = 'group';
        currentStep = 'groups';
        showStatus("Player removed. Matches reset, please regenerate.", "orange");
    }
    
    renderPlayerList();
    renderMatches();
    saveData(false);
}

/**
 * Gestiona el botón de generar partidos.
 */
function handleGenerateMatches() {
    if (players.length < 4 || players.length % 2 !== 0) {
        showStatus("Need an even number of players/teams (min 4) to generate matches.", "red");
        return;
    }

    generateMatches();
    playoffMatches = [];
    currentStage = 'group';
    currentStep = 'groups';
    
    renderMatches();
    saveData(false);
    showStatus(`Generated ${matches.length} group matches.`, "indigo");
}

/**
 * Reinicia completamente el torneo.
 */
function handleResetTournament() {
    if (confirm("WARNING: This will delete ALL tournament data (players, scores, settings). Are you sure you want to reset?")) {
        localStorage.removeItem('tournamentData');
        localStorage.removeItem('current-tournament-id');
        window.location.reload(); 
    }
}

// --- 4. LÓGICA CENTRAL DEL TORNEO ---

/**
 * Genera el enfrentamiento de todos contra todos dentro de cada grupo.
 */
function generateMatches() {
    // ... (la lógica de generación de Round Robin es la misma) ...
    matches = [];
    const groups = {};
    players.forEach(p => {
        if (!groups[p.group]) {
            groups[p.group] = [];
        }
        groups[p.group].push(p.name);
    });

    Object.keys(groups).forEach(groupKey => {
        const groupPlayers = groups[groupKey];
        for (let i = 0; i < groupPlayers.length; i++) {
            for (let j = i + 1; j < groupPlayers.length; j++) {
                const matchId = `M${matches.length + 1}-G${groupKey}`;
                matches.push({
                    id: matchId,
                    group: groupKey,
                    p1: groupPlayers[i],
                    p2: groupPlayers[j],
                    scores: [[undefined, undefined]], 
                    winner: null,
                });
            }
        }
    });
}

/**
 * Calcula el ganador del partido basado en los sets ganados.
 */
function checkMatchWinner(match) {
    let p1Sets = 0;
    let p2Sets = 0;
    let p1GamesWon = 0;
    let p2GamesWon = 0;
    const setsNeededToWinMatch = config.setsToWin; // Usamos la nueva config

    match.scores.forEach(([score1, score2]) => {
        const g1 = score1 !== undefined ? score1 : null;
        const g2 = score2 !== undefined ? score2 : null;
        
        if (g1 !== null && g2 !== null) {
            p1GamesWon += g1;
            p2GamesWon += g2;

            const gamesDiff = Math.abs(g1 - g2);
            const gamesToWin = config.maxGamesPerSet; // Usamos la nueva config

            // Regla de victoria del set (debe alcanzar gamesToWin Y tener diferencia de 2, O ganar por tie-break si aplica)
            const isSetCompleted = 
                (g1 >= gamesToWin && gamesDiff >= 2) || 
                (g2 >= gamesToWin && gamesDiff >= 2) || 
                (g1 === gamesToWin + 1 && g2 === gamesToWin) || 
                (g2 === gamesToWin + 1 && g1 === gamesToWin);
            
            if (isSetCompleted) {
                if (g1 > g2) {
                    p1Sets++;
                } else if (g2 > g1) {
                    p2Sets++;
                }
            }
        }
    });

    let winner = null;

    if (p1Sets >= setsNeededToWinMatch) {
        winner = match.p1;
    } else if (p2Sets >= setsNeededToWinMatch) {
        winner = match.p2;
    }

    return { winner, p1Sets, p2Sets, p1GamesWon, p2GamesWon };
}


// ... (Omitimos generatePlayoffStructure, updateNextPlayoffMatch, calculateStandings por ser similares) ...
// (Mantener esas funciones tal cual las tenías, asegurándote de usar 'config.setsToWin' y 'config.maxGamesPerSet' si aplican)


// --- 5. RENDERIZADO Y UI ---

function getPlayerDisplayInfo(pName) {
    const player = players.find(pl => pl.name === pName);

    if (player) {
        return { name: player.name, photoURL: player.photoURL };
    }
    // Para placeholders (Winner X, Loser Y)
    return { name: pName, photoURL: null };
}

function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    const p1Info = getPlayerDisplayInfo(match.p1);
    const p2Info = getPlayerDisplayInfo(match.p2);
    
    const isPlayoff = match.stage;
    const stageInfo = isPlayoff ? match.stage : `Group ${match.group}`;
    const inputClass = isPlayoff ? 'playoff-set-input' : 'group-set-input';

    const cardClass = isCompleted ? 'match-card completed ring-4 ring-green-300' : 'match-card';
    const maxInputGames = config.maxGamesPerSet + 1; // Máximo para entrada de datos

    let cardHtml = `
        <div class="${cardClass} p-4 bg-white rounded-lg shadow transition duration-200" id="match-card-${match.id}">
            <p class="text-lg font-bold text-gray-900 mb-2 flex items-center">
                ${stageInfo}
            </p>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team/Player</th>
                            ${match.scores.map((_, index) => 
                                `<th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Set ${index + 1}</th>`
                            ).join('')}
                            <th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Total Games Won</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${renderSetScoreRow(match, 'p1', p1Info, inputClass, maxInputGames)}
                        ${renderSetScoreRow(match, 'p2', p2Info, inputClass, maxInputGames)}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-3 flex justify-between items-center">
                 <button class="btn-add-set bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-2 py-1 rounded-md transition duration-150 ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}" 
                        data-match-id="${match.id}" ${isCompleted ? 'disabled' : ''}>
                    + Add Set
                </button>
                <p class="text-sm font-semibold text-gray-900">
                    Sets: <span class="text-indigo-600 font-bold">${getSetsScoreString(match)} (Best of ${config.setsToWin * 2 - 1})</span>
                </p>
                <p class="text-sm font-semibold ${isCompleted ? 'text-green-700' : 'text-gray-500'}" id="winner-status-${match.id}">
                    ${isCompleted ? `🏆 **Winner:** ${match.winner}` : 'Status: In Progress'}
                </p>
            </div>
        </div>
    `;
    return cardHtml;
}

function renderSetScoreRow(match, pKey, pInfo, inputClass, maxInputGames) {
    const isP1 = pKey === 'p1';
    const isDisabled = match.winner !== null;
    const name = pInfo.name;

    let totalGames = 0;
    
    let setInputsHtml = match.scores.map((setScore, setIndex) => {
        const playerIsPlaceholder = name.startsWith('Winner') || name.startsWith('Loser');
        const effectiveDisabled = isDisabled || playerIsPlaceholder;

        const games = isP1 ? setScore[0] : setScore[1];
        // CORRECCIÓN: Usar la nueva lógica de 'null' en lugar de 'undefined' si vienes de la DB
        const gameValue = games === null || games === undefined ? '' : games; 
        totalGames += (games !== null && games !== undefined) ? games : 0; 

        return `
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                <input type="number" min="0" max="${maxInputGames}" 
                        value="${gameValue}" 
                        data-match-id="${match.id}" data-player="${pKey}" data-set-index="${setIndex}"
                        class="${inputClass} set-score-input w-14 p-1 border border-gray-300 rounded-md text-center text-sm focus:ring-indigo-500 ${effectiveDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}"
                        ${effectiveDisabled ? 'disabled' : ''}>
            </td>
        `;
    }).join('');

    return `
        <tr>
            <td class="px-3 py-2 font-medium text-gray-900 flex items-center">
                ${getPlayerAvatar(pInfo)} ${name}
            </td>
            ${setInputsHtml}
            <td class="px-3 py-2 text-center text-sm font-bold text-indigo-600">${totalGames}</td>
        </tr>
    `;
}

function getSetsScoreString(match) {
    const result = checkMatchWinner(match);
    return `${result.p1Sets}-${result.p2Sets}`;
}

/**
 * Re-renderiza una sola tarjeta de partido. (CORRECCIÓN del error TypeError: newCard.querySelector is not a function)
 */
function reRenderMatchCard(match) {
    const oldCard = document.getElementById(`match-card-${match.id}`);
    if (oldCard) {
        const newHtml = renderMatchCard(match);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml;
        
        // 🚨 CORRECCIÓN CLAVE: Usar querySelector en el tempDiv para obtener el elemento
        const newCard = tempDiv.querySelector(`#match-card-${match.id}`);
        
        if (newCard) {
            oldCard.parentNode.replaceChild(newCard, oldCard);
            
            // Re-añadir listeners para el nuevo elemento renderizado
            newCard.querySelectorAll('.set-score-input').forEach(input => {
                input.removeEventListener('change', handleScoreChange);
                input.addEventListener('change', handleScoreChange);
            });
            newCard.querySelector('.btn-add-set')?.addEventListener('click', handleAddSet);
        }
    }
}

function renderMatches() {
    // 🛑 VALIDACIÓN DE INICIALIZACIÓN CRÍTICA
    if (!groupMatchesContainer || !playoffContainer || !standingsContainer) {
        console.error("DOM elements not initialized. Skipping renderMatches.");
        return; 
    }
    
    let currentMatches = currentStage === 'group' ? matches : playoffMatches;

    // Limpiar todos los contenedores antes de renderizar
    groupMatchesContainer.innerHTML = ''; 
    playoffContainer.innerHTML = '';
    standingsContainer.innerHTML = ''; 
    
    // Si la fase es final, renderizar solo eso.
    if (currentStep === 'finalStandings') {
        renderFinalStandings();
        return;
    }

    if (currentStage === 'group') {
        const groupedMatches = {};
        currentMatches.forEach(m => {
            if (!groupedMatches[m.group]) groupedMatches[m.group] = [];
            groupedMatches[m.group].push(m);
        });

        // Renderizar partidos de grupo
        Object.keys(groupedMatches).sort().forEach(groupKey => {
            const groupTitle = document.createElement('h2');
            groupTitle.className = 'text-2xl font-extrabold text-gray-800 my-4 border-b pb-2';
            groupTitle.textContent = `Group ${groupKey} Matches`;
            groupMatchesContainer.appendChild(groupTitle);

            const groupDiv = document.createElement('div');
            groupDiv.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
            groupedMatches[groupKey].forEach(match => {
                groupDiv.innerHTML += renderMatchCard(match);
            });
            groupMatchesContainer.appendChild(groupDiv);
        });

        // Renderizar Standings y botón de Playoff
        renderStandings(calculateStandings());
    } else {
        // Renderizar Playoff
        // ... (Tu lógica de renderizado de playoffs) ...
    }

    // Añadir listeners (especialmente para los botones generados dinámicamente)
    addEventListeners();
}

// ... (El resto de funciones como renderStandings, renderFinalStandings, etc. son similares) ...


// --- 6. GESTORES DE EVENTOS DE PARTIDOS ---

function addEventListeners() {
    // Event listeners para los inputs de score (añadidos en el renderizado inicial y en reRenderMatchCard)
    document.querySelectorAll('.set-score-input').forEach(input => {
        input.removeEventListener('change', handleScoreChange);
        input.addEventListener('change', handleScoreChange);
    });
    
    document.querySelectorAll('.btn-add-set').forEach(button => {
        button.removeEventListener('click', handleAddSet);
        button.addEventListener('click', handleAddSet);
    });
}

function handleScoreChange(event) {
    // ... (Tu lógica de cambio de marcador, que ahora llama a reRenderMatchCard correctamente) ...
    const input = event.target;
    const matchId = input.dataset.matchId;
    const pKey = input.dataset.player; 
    const setIndex = parseInt(input.dataset.setIndex);

    let match = matches.find(m => m.id === matchId);
    const isPlayoff = !match;
    if (isPlayoff) {
        match = playoffMatches.find(m => m.id === matchId);
    }
    if (!match || match.winner !== null) {
        if (match && match.winner !== null) showStatus("⚠️ Cannot change score for a completed match.", "orange");
        reRenderMatchCard(match); // Forzar el estado deshabilitado correcto
        return;
    }

    // Validación de placeholder (Winner/Loser)
    const playerName = pKey === 'p1' ? match.p1 : match.p2;
    if (typeof playerName === 'string' && (playerName.startsWith('Winner') || playerName.startsWith('Loser'))) {
        showStatus(`🚫 Score cannot be entered for placeholder '${playerName}'.`, "orange");
        return;
    }

    let value = input.value.trim() === '' ? undefined : parseInt(input.value.trim());

    const maxInputGames = config.maxGamesPerSet + 1;
    if (value !== undefined && (value < 0 || value > maxInputGames)) {
        showStatus(`Invalid game score. Must be between 0 and ${maxInputGames}.`, "red");
        input.value = '';
        value = undefined;
    }
    
    const scorePosition = pKey === 'p1' ? 0 : 1;
    
    if (!match.scores[setIndex]) {
        match.scores[setIndex] = [undefined, undefined];
    }
    
    match.scores[setIndex][scorePosition] = value;
    
    const matchResult = checkMatchWinner(match);
    match.winner = matchResult.winner;

    if (match.winner && isPlayoff) {
        match.loser = match.winner === match.p1 ? match.p2 : match.p1;
        // updateNextPlayoffMatch(match); // Asegúrate de implementar esta función
    }

    reRenderMatchCard(match); // Renderiza solo la tarjeta modificada

    // Si hubo ganador, forzar un renderizado completo para actualizar standings/playoffs
    if (match.winner) {
        renderMatches();
        showStatus(`🏆 Match complete! Winner: ${match.winner}`, "green");
    } else {
        showStatus(`📝 Score updated. Current sets: ${getSetsScoreString(match)}`, "indigo");
    }

    saveData(true);
}


// --- 7. INICIALIZACIÓN PRINCIPAL ---

window.loadAndInitializeLogic = async function() {
    
    // 🛑 PASO 1: INICIALIZAR LAS VARIABLES DEL DOM. (Usando IDs del nuevo HTML)
    statusMessage = document.getElementById('status-message');
    groupMatchesContainer = document.getElementById('group-matches-container');
    standingsContainer = document.getElementById('standings-container');
    playoffContainer = document.getElementById('playoff-container');

    if (!groupMatchesContainer || !standingsContainer || !playoffContainer) {
        console.error("Critical DOM elements (containers) are missing. Check index.html structure.");
        return;
    }
    
    await loadData();
    updateConfigUI(); 
    renderMatches();  

    // GESTORES DE EVENTOS GLOBALES (Configuración y Jugadores)
    document.querySelectorAll('[data-config-key]').forEach(element => {
        element.removeEventListener('change', handleConfigChange);
        element.addEventListener('change', handleConfigChange);
        // Si es un input de texto/número, también escuchar 'input' para feedback instantáneo
        if (element.tagName === 'INPUT') {
             element.removeEventListener('input', handleConfigChange);
             element.addEventListener('input', handleConfigChange);
        }
    });

    document.getElementById('btn-agregar-participante')?.addEventListener('click', handleAddPlayer);
    document.getElementById('btn-generate-matches')?.addEventListener('click', handleGenerateMatches);
    document.getElementById('btn-borrar-datos')?.addEventListener('click', handleResetTournament);
    document.getElementById('load-tournament-form')?.addEventListener('submit', handleLoadTournament);
    
    showTournamentId(window.userId);
};
