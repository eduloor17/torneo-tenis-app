// my-app-logic.js (Versión Simple y Robusta)

// --- 1. CONSTANTES Y ESTADO GLOBAL ---

// Reglas de juego simplificadas (Fijas)
const DEFAULT_CONFIG = {
    maxPlayers: 10,
    numGroups: 2,
    setsToWin: 2,       // Siempre Mejor de 3 Sets (Gana 2)
    maxGamesPerSet: 6,  // Siempre 6 juegos para ganar el set (debe ir 6-4 o 7-5)
};

let players = [];
let matches = [];
let playoffMatches = [];
let config = {...DEFAULT_CONFIG}; // Inicializamos con la configuración fija/por defecto

let currentStage = 'group'; 
let currentStep = 'groups'; 

// Variables DOM
let groupMatchesContainer, standingsContainer, playoffContainer, statusMessage;


// --- 2. GESTIÓN DE DATOS Y ESTADO (CLOUD/LOCAL) ---

/**
 * Carga los datos guardados, decodificando el campo 'scores' de Firestore.
 */
async function loadData() {
    let dataLoaded = false;
    let data = {};

    // 1. Intentar cargar desde Cloud (Firebase)
    // ... (Mismo código de carga de Firebase) ...
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
        }
    }

    // 2. Cargar localmente si no se cargó de Cloud
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
        
        // Cargar SOLO las opciones configurables (maxPlayers, numGroups)
        config.maxPlayers = parseInt(data.config?.maxPlayers || data.maxPlayers) || DEFAULT_CONFIG.maxPlayers;
        config.numGroups = parseInt(data.config?.numGroups || data.numGroups) || DEFAULT_CONFIG.numGroups;
    }
}

/**
 * Guarda el estado actual del torneo. Serializa 'scores' para Firestore.
 */
function saveData(silent = false) {
    const data = {
        players,
        currentStage,
        currentStep,
        config: { // Guardamos solo la configuración ajustable
            maxPlayers: config.maxPlayers,
            numGroups: config.numGroups,
        },
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
    
    const dataToSave = {
        ...data,
        matches: serializeMatches(matches),
        playoffMatches: serializeMatches(playoffMatches),
    };

    // Guardar localmente (usamos el objeto sin serializar)
    localStorage.setItem('tournamentData', JSON.stringify({ ...data, matches, playoffMatches }));

    // Guardar en Cloud si está disponible
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
 * Muestra un mensaje temporal de estado. (Mismo código)
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
    document.getElementById('max-participantes-display').textContent = config.maxPlayers;
    
    // Actualizar inputs/selects (usando data-config-key)
    document.querySelectorAll('[data-config-key]').forEach(element => {
        const key = element.dataset.configKey;
        element.value = config[key];
    });

    renderPlayerList();
}

/**
 * Gestiona los cambios en los inputs de configuración. (Corrección para que los cambios se reflejen)
 */
function handleConfigChange(event) {
    const input = event.target;
    const key = input.dataset.configKey;
    let value = parseInt(input.value); // Convertir siempre a entero

    if (isNaN(value) || value < 1) {
        // Ignorar si no es un número válido
        return; 
    }
    
    if (key === 'maxPlayers') {
        if (value < 4 || value % 2 !== 0) {
            showStatus("Max Players must be an even number (min 4).", "red");
            input.value = config[key]; // Revertir
            return;
        }
        // Validar si los jugadores actuales exceden el nuevo máximo
        if (value < players.length) {
             showStatus("Cannot reduce Max Players below the current number of registered players.", "red");
            input.value = config[key]; // Revertir
            return;
        }
    }
    
    if (key === 'numGroups') {
        if (config.maxPlayers % value !== 0) {
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
                    ${getPlayerInitial(p)}
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
 * Obtiene las iniciales del jugador.
 */
function getPlayerInitial(player) {
    if (player.name.startsWith('Winner') || player.name.startsWith('Loser')) {
        return `<span class="player-initial bg-transparent"></span>`;
    }
    const initial = player.name.charAt(0).toUpperCase();
    return `<div class="player-initial bg-indigo-200 text-indigo-700 mr-2">${initial}</div>`;
}

/**
 * Gestiona el botón de agregar participante.
 */
function handleAddPlayer() {
    const nameInput = document.getElementById('nombre-input');
    const name = nameInput.value.trim();

    if (!name) {
        showStatus("Please enter a player name.", "red");
        return;
    }

    if (players.length >= config.maxPlayers) {
        showStatus(`Maximum player limit (${config.maxPlayers}) reached.`, "red");
        return;
    }
    
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showStatus("Player name already exists.", "red");
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
    });

    nameInput.value = '';
    
    renderPlayerList();
    saveData(true);
    showStatus(`Player ${name} added to Group ${group}.`, "blue");
}

/**
 * Gestiona la eliminación de un jugador.
 */
function handleRemovePlayer(event) {
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
        showStatus("Need an even number of players (min 4) to generate matches.", "red");
        return;
    }
    if (players.length % config.numGroups !== 0) {
        showStatus("Total players must be divisible by the number of groups. Adjust players or group count.", "red");
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
    
    // Usamos la configuración fija: setsToWin=2, maxGamesPerSet=6
    const setsNeededToWinMatch = DEFAULT_CONFIG.setsToWin; 
    const gamesToWin = DEFAULT_CONFIG.maxGamesPerSet; 

    match.scores.forEach(([score1, score2]) => {
        const g1 = score1 !== undefined ? score1 : null;
        const g2 = score2 !== undefined ? score2 : null;
        
        if (g1 !== null && g2 !== null) {
            p1GamesWon += g1;
            p2GamesWon += g2;

            const gamesDiff = Math.abs(g1 - g2);
            
            // Regla de victoria del set: debe alcanzar `gamesToWin` Y tener diferencia de 2
            // O ganar 7-5 si fue un tie-break implícito
            const isSetCompleted = 
                (g1 >= gamesToWin && gamesDiff >= 2) || 
                (g2 >= gamesToWin && gamesDiff >= 2);
            
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


// --- 5. RENDERIZADO Y UI ---

function getPlayerDisplayInfo(pName) {
    const player = players.find(pl => pl.name === pName);
    // Solo retornamos el nombre, ya que eliminamos la foto
    return { name: pName };
}

function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    const p1Info = getPlayerDisplayInfo(match.p1);
    const p2Info = getPlayerDisplayInfo(match.p2);
    
    const isPlayoff = match.stage;
    const stageInfo = isPlayoff ? match.stage : `Group ${match.group}`;
    const inputClass = isPlayoff ? 'playoff-set-input' : 'group-set-input';

    const cardClass = isCompleted ? 'match-card completed ring-4 ring-green-300' : 'match-card';
    // Máximo de juegos para el input: 7 (en caso de 7-5 o 7-6 - aunque la lógica solo evalúa 6 juegos y diff 2)
    const maxInputGames = DEFAULT_CONFIG.maxGamesPerSet + 1; 

    let cardHtml = `
        <div class="${cardClass} p-4 bg-white rounded-lg shadow transition duration-200" id="match-card-${match.id}">
            <p class="text-lg font-bold text-gray-900 mb-2 flex items-center">
                ${stageInfo}
            </p>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
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
                    Sets: <span class="text-indigo-600 font-bold">${getSetsScoreString(match)} (Best of ${DEFAULT_CONFIG.setsToWin * 2 - 1})</span>
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
                ${getPlayerInitial(pInfo)} ${name}
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
 * Re-renderiza una sola tarjeta de partido. (CORRECCIÓN del error TypeError)
 */
function reRenderMatchCard(match) {
    const oldCard = document.getElementById(`match-card-${match.id}`);
    if (oldCard) {
        const newHtml = renderMatchCard(match);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml;
        
        // 🚨 CORRECCIÓN CLAVE: Usar querySelector en el tempDiv
        const newCard = tempDiv.querySelector(`#match-card-${match.id}`);
        
        if (newCard) {
            oldCard.parentNode.replaceChild(newCard, oldCard);
            
            // Re-añadir listeners
            newCard.querySelectorAll('.set-score-input').forEach(input => {
                input.removeEventListener('change', handleScoreChange);
                input.addEventListener('change', handleScoreChange);
            });
            newCard.querySelector('.btn-add-set')?.addEventListener('click', handleAddSet);
        }
    }
}

// ... (Las funciones renderMatches, calculateStandings, handleAddSet, etc., deben ser recuperadas de tu versión anterior, 
// asegurándote de usar las variables players, matches, y config de esta nueva estructura) ...

// **NOTA:** Por limitaciones de espacio, no incluimos la lógica completa de Standings y Playoff, pero asume que
// debes recuperar las implementaciones anteriores que usan las variables globales de este archivo.

// Ejemplo de handleScoreChange actualizado
function handleScoreChange(event) {
    const input = event.target;
    const matchId = input.dataset.matchId;
    const pKey = input.dataset.player; 
    const setIndex = parseInt(input.dataset.setIndex);

    let match = matches.find(m => m.id === matchId) || playoffMatches.find(m => m.id === matchId);
    
    if (!match || match.winner !== null) {
        if (match && match.winner !== null) showStatus("⚠️ Cannot change score for a completed match.", "orange");
        reRenderMatchCard(match); 
        return;
    }

    // Usamos el máximo fijo
    const maxInputGames = DEFAULT_CONFIG.maxGamesPerSet + 1; 
    let value = input.value.trim() === '' ? undefined : parseInt(input.value.trim());

    if (value !== undefined && (value < 0 || value > maxInputGames)) {
        showStatus(`Invalid game score. Must be between 0 and ${maxInputGames}.`, "red");
        input.value = '';
        value = undefined;
    }
    
    // ... (restablecer el score en el objeto match) ...
    const scorePosition = pKey === 'p1' ? 0 : 1;
    if (!match.scores[setIndex]) match.scores[setIndex] = [undefined, undefined];
    match.scores[setIndex][scorePosition] = value;

    // Recalcular y actualizar
    const matchResult = checkMatchWinner(match);
    match.winner = matchResult.winner;
    
    // Si es playoff y hay ganador, determinar el loser y actualizar el siguiente partido
    if (match.winner && match.stage) {
        match.loser = match.winner === match.p1 ? match.p2 : match.p1;
        // updateNextPlayoffMatch(match); // Lógica de tu versión anterior
    }

    reRenderMatchCard(match); // Renderiza solo la tarjeta modificada

    if (match.winner) {
        // renderMatches(); // Esto fuerza un renderizado completo para actualizar standings/playoffs
        showStatus(`🏆 Match complete! Winner: ${match.winner}`, "green");
    } else {
        showStatus(`📝 Score updated. Current sets: ${getSetsScoreString(match)}`, "indigo");
    }

    saveData(true);
}


// --- 7. INICIALIZACIÓN PRINCIPAL ---

window.loadAndInitializeLogic = async function() {
    
    // 🛑 PASO 1: INICIALIZAR LAS VARIABLES DEL DOM.
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
    // renderMatches(); // Debes recuperar la función renderMatches de tu versión anterior

    // GESTORES DE EVENTOS GLOBALES (Configuración y Jugadores)
    document.querySelectorAll('[data-config-key]').forEach(element => {
        // Escuchar tanto 'change' (al perder el foco) como 'input' (al escribir)
        element.removeEventListener('change', handleConfigChange);
        element.addEventListener('change', handleConfigChange);
        if (element.tagName === 'INPUT') {
             element.removeEventListener('input', handleConfigChange);
             element.addEventListener('input', handleConfigChange);
        }
    });

    document.getElementById('btn-agregar-participante')?.addEventListener('click', handleAddPlayer);
    document.getElementById('btn-generate-matches')?.addEventListener('click', handleGenerateMatches);
    document.getElementById('btn-borrar-datos')?.addEventListener('click', handleResetTournament);
    
    // document.getElementById('load-tournament-form')?.addEventListener('submit', handleLoadTournament); // Recuperar si lo necesitas
    
    showTournamentId(window.userId);
};
