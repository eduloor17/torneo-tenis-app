// my-app-logic.js (Versión Simple y Robusta - Final)

// --- 1. CONSTANTES Y ESTADO GLOBAL ---

// Reglas de juego simplificadas (Fijas)
const DEFAULT_CONFIG = {
    maxPlayers: 10,
    numGroups: 2,
    setsToWin: 2,       
    maxGamesPerSet: 6,  
    matchType: 'singles', // 'singles' o 'doubles'
};

let players = [];
let matches = [];
let playoffMatches = [];
let config = {...DEFAULT_CONFIG}; 

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
        
        // Cargar SOLO las opciones configurables
        config.maxPlayers = parseInt(data.config?.maxPlayers || data.maxPlayers) || DEFAULT_CONFIG.maxPlayers;
        config.numGroups = parseInt(data.config?.numGroups || data.numGroups) || DEFAULT_CONFIG.numGroups;
        config.matchType = data.config?.matchType || DEFAULT_CONFIG.matchType; // <-- CARGA DEL TIPO DE PARTIDO
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
        config: { 
            maxPlayers: config.maxPlayers,
            numGroups: config.numGroups,
            matchType: config.matchType, // <-- GUARDAR TIPO DE PARTIDO
        },
        timestamp: new Date().toISOString()
    };
    
    // Serialización para Firestore (Solución para arrays anidados)
    const serializeMatches = (matchArray) => {
        return (matchArray || []).map(m => ({
            ...m,
            scores: JSON.stringify(m.scores)
        }));
    };
    
    const dataToSave = {
        ...data,
        matches: serializeMatches(matches),
        playoffMatches: serializeMatches(playoffMatches),
    };

    localStorage.setItem('tournamentData', JSON.stringify({ ...data, matches, playoffMatches }));

    if (window.isCloudMode && window.db && window.userId) {
        const docRef = window.doc(window.db, "tournaments", window.userId);
        window.setDoc(docRef, dataToSave)
            .then(() => { if (!silent) showStatus("Data synced to Cloud and saved locally.", "green"); })
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

function showTournamentId(id) {
    const display = document.getElementById('tournament-id-display');
    if (display) {
        display.innerHTML = `ID: <span class="font-bold">${id.substring(0, 8)}...</span>`;
    }
}

// --- 3. GESTIÓN DE JUGADORES Y CONFIGURACIÓN ---

/**
 * Actualiza la UI de configuración con los valores actuales. (Corregido)
 */
function updateConfigUI() {
    const entityType = config.matchType === 'singles' ? 'Player' : 'Team';
    const entityTypePlural = config.matchType === 'singles' ? 'players' : 'teams';

    // 1. Actualizar displays de texto
    document.getElementById('max-jugadores-actual').textContent = config.maxPlayers;
    document.getElementById('num-grupos-actual').textContent = config.numGroups;
    document.getElementById('max-participantes-display').textContent = config.maxPlayers;
    
    // 2. Actualizar etiquetas de registro
    const playerTypeLabel = document.getElementById('player-type-label');
    if (playerTypeLabel) playerTypeLabel.textContent = entityType;
    
    const counterDisplay = document.getElementById('contador-participantes').parentElement;
    if (counterDisplay) {
        counterDisplay.innerHTML = `<span id="contador-participantes" class="font-bold text-indigo-600">${players.length}</span> of <span id="max-participantes-display" class="font-bold text-indigo-600">${config.maxPlayers}</span> ${entityTypePlural} registered.`;
    }

    // 3. Actualizar inputs/selects (incluido el nuevo matchType)
    document.querySelectorAll('[data-config-key]').forEach(element => {
        const key = element.dataset.configKey;
        if (config[key] !== undefined) {
             element.value = config[key];
        }
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
        if (isNaN(value) || value < 1) return;
    }
    
    if (key === 'maxPlayers') {
        if (value < 4 || value % 2 !== 0) {
            showStatus("Max Players must be an even number (min 4).", "red");
            input.value = config[key]; 
            return;
        }
        if (value < players.length) {
             showStatus("Cannot reduce Max Players below the current number of registered players.", "red");
            input.value = config[key]; 
            return;
        }
    }
    
    if (key === 'numGroups') {
        if (config.maxPlayers % value !== 0) {
            showStatus("Total players must be divisible by the number of groups.", "red");
            input.value = config[key]; 
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
    const countListDisplay = document.getElementById('contador-participantes-list');

    if (listContainer && countListDisplay) {
        listContainer.innerHTML = players.map(p => `
            <li class="flex justify-between items-center p-1 bg-gray-50 rounded">
                <span class="truncate flex items-center">
                    ${getPlayerInitial(p)}
                    ${p.name} (G${p.group})
                </span>
                <button data-player-id="${p.id}" class="btn-remove-player text-red-500 hover:text-red-700 ml-2">X</button>
            </li>
        `).join('');
        
        document.getElementById('contador-participantes').textContent = players.length;
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
    const initial = player.name.charAt(0).toUpperCase();
    return `<div class="player-initial bg-indigo-200 text-indigo-700 mr-2">${initial}</div>`;
}

/**
 * Gestiona el botón de agregar participante.
 */
function handleAddPlayer() {
    const nameInput = document.getElementById('nombre-input');
    const name = nameInput.value.trim();
    const entityType = config.matchType === 'singles' ? 'Player' : 'Team';

    if (!name) {
        showStatus(`Please enter a ${entityType} name.`, "red");
        return;
    }

    if (players.length >= config.maxPlayers) {
        showStatus(`Maximum ${entityType} limit (${config.maxPlayers}) reached.`, "red");
        return;
    }
    
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showStatus(`${entityType} name already exists.`, "red");
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
    
    updateConfigUI(); // Llama a esto para actualizar el contador en la lista
    saveData(true);
    showStatus(`${entityType} ${name} added to Group ${group}.`, "blue");
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
    
    updateConfigUI(); 
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

// --- 4. LÓGICA CENTRAL DEL TORNEO (Necesitas tus funciones de Standings y Playoff aquí) ---

function generateMatches() {
    // ... (Tu lógica de Round Robin) ...
}

function checkMatchWinner(match) {
    // ... (Tu lógica de Sets ganados, usando DEFAULT_CONFIG) ...
}

function calculateStandings() {
    // ⚠️ RECUERDA: Implementa aquí tu lógica de cálculo de clasificación
    console.warn("calculateStandings function not fully implemented in this version.");
    return []; // Retorna datos de standings
}

function handleGeneratePlayoff() {
    // ⚠️ RECUERDA: Implementa aquí la lógica para generar el bracket de playoff
    console.warn("handleGeneratePlayoff function not fully implemented in this version.");
    currentStage = 'playoff';
    // generatePlayoffStructure();
    // renderMatches();
    saveData(false);
}


// --- 5. RENDERIZADO Y UI ---

function getPlayerDisplayInfo(pName) {
    const player = players.find(pl => pl.name === pName);
    return { name: pName, isPlaceholder: !player };
}

function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    const p1Info = getPlayerDisplayInfo(match.p1);
    const p2Info = getPlayerDisplayInfo(match.p2);
    
    const stageInfo = match.stage ? match.stage : `Group ${match.group}`;
    const cardClass = isCompleted ? 'match-card completed ring-4 ring-green-300' : 'match-card';
    const maxInputGames = DEFAULT_CONFIG.maxGamesPerSet + 1; 

    let cardHtml = `
        <div class="${cardClass} p-4 bg-white rounded-lg shadow transition duration-200" id="match-card-${match.id}">
            <p class="text-lg font-bold text-gray-900 mb-2 flex items-center">${stageInfo}</p>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">${config.matchType === 'singles' ? 'Player' : 'Team'}</th>
                            ${match.scores.map((_, index) => 
                                `<th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Set ${index + 1}</th>`
                            ).join('')}
                            <th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Total Games Won</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${renderSetScoreRow(match, 'p1', p1Info, maxInputGames)}
                        ${renderSetScoreRow(match, 'p2', p2Info, maxInputGames)}
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

function renderSetScoreRow(match, pKey, pInfo, maxInputGames) {
    const isP1 = pKey === 'p1';
    const isDisabled = match.winner !== null || pInfo.isPlaceholder;
    const name = pInfo.name;

    let totalGames = 0;
    
    let setInputsHtml = match.scores.map((setScore, setIndex) => {
        const games = isP1 ? setScore[0] : setScore[1];
        const gameValue = games === null || games === undefined ? '' : games; 
        totalGames += (games !== null && games !== undefined) ? games : 0; 

        return `
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                <input type="number" min="0" max="${maxInputGames}" 
                        value="${gameValue}" 
                        data-match-id="${match.id}" data-player="${pKey}" data-set-index="${setIndex}"
                        class="set-score-input w-14 p-1 border border-gray-300 rounded-md text-center text-sm focus:ring-indigo-500 ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}"
                        ${isDisabled ? 'disabled' : ''}>
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
 * Re-renderiza una sola tarjeta de partido. (Corrección del error TypeError)
 */
function reRenderMatchCard(match) {
    const oldCard = document.getElementById(`match-card-${match.id}`);
    if (oldCard) {
        const newHtml = renderMatchCard(match);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml;
        
        // CORRECCIÓN CLAVE
        const newCard = tempDiv.querySelector(`#match-card-${match.id}`);
        
        if (newCard) {
            oldCard.parentNode.replaceChild(newCard, oldCard);
            
            newCard.querySelectorAll('.set-score-input').forEach(input => {
                input.removeEventListener('change', handleScoreChange);
                input.addEventListener('change', handleScoreChange);
            });
            newCard.querySelector('.btn-add-set')?.addEventListener('click', handleAddSet);
        }
    }
}

function renderMatches() {
    if (!groupMatchesContainer || !playoffContainer || !standingsContainer) {
        return; 
    }
    
    groupMatchesContainer.innerHTML = ''; 
    playoffContainer.innerHTML = '';
    standingsContainer.innerHTML = ''; 
    
    if (currentStep === 'finalStandings') {
        // renderFinalStandings();
        return;
    }

    if (currentStage === 'group') {
        // Renderizar partidos de grupo
        // ... (Tu lógica para agrupar y renderizar partidos por grupo) ...
        
        // Renderizar Standings y botón de Playoff
        // ⚠️ DEBES RECUPERAR calculateStandings()
        const standingsData = calculateStandings();
        // renderStandings(standingsData); 
        
        const groupMatchesCompleted = matches.every(m => m.winner !== null);
        const hasSufficientPlayers = players.length >= 4;

        if (groupMatchesCompleted && hasSufficientPlayers) {
            const btnContainer = document.createElement('div');
            btnContainer.className = 'mt-6 pt-4 border-t';
            btnContainer.innerHTML = `
                <button id="btn-generate-playoff"
                    class="w-full py-3 rounded-xl text-white font-extrabold transition duration-150 bg-green-600 hover:bg-green-700">
                    🥇 Generate Playoff Bracket (Top players from Groups)
                </button>
            `;
            standingsContainer.appendChild(btnContainer);
            document.getElementById('btn-generate-playoff')?.addEventListener('click', handleGeneratePlayoff);
        }

    } else if (currentStage === 'playoff') {
        // Renderizar partidos de playoff
        // ...
    }

    addEventListeners();
}

function addEventListeners() {
    document.querySelectorAll('.set-score-input').forEach(input => {
        input.removeEventListener('change', handleScoreChange);
        input.addEventListener('change', handleScoreChange);
    });
    
    document.querySelectorAll('.btn-add-set').forEach(button => {
        button.removeEventListener('click', handleAddSet);
        // button.addEventListener('click', handleAddSet); // ⚠️ Asegúrate de que handleAddSet existe
    });
}

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

    const maxInputGames = DEFAULT_CONFIG.maxGamesPerSet + 1; 
    let value = input.value.trim() === '' ? undefined : parseInt(input.value.trim());

    if (value !== undefined && (value < 0 || value > maxInputGames)) {
        showStatus(`Invalid game score. Must be between 0 and ${maxInputGames}.`, "red");
        input.value = '';
        value = undefined;
    }
    
    const scorePosition = pKey === 'p1' ? 0 : 1;
    if (!match.scores[setIndex]) match.scores[setIndex] = [undefined, undefined];
    match.scores[setIndex][scorePosition] = value;

    const matchResult = checkMatchWinner(match);
    match.winner = matchResult.winner;
    
    if (match.winner) {
        renderMatches(); 
        showStatus(`🏆 Match complete! Winner: ${match.winner}`, "green");
    } else {
        showStatus(`📝 Score updated. Current sets: ${getSetsScoreString(match)}`, "indigo");
    }

    reRenderMatchCard(match); 
    saveData(true);
}


// --- 7. INICIALIZACIÓN PRINCIPAL ---

window.loadAndInitializeLogic = async function() {
    
    // 1. INICIALIZAR VARIABLES DEL DOM.
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

    // 2. GESTORES DE EVENTOS GLOBALES (Configuración y Jugadores)
    document.querySelectorAll('[data-config-key]').forEach(element => {
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
