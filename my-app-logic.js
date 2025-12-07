// my-app-logic.js (Versión Cloud/Firebase Adaptada y COMPLETA)

// --- 1. CONFIGURACIÓN INICIAL ---
let players = [];
let matches = [];
let playoffMatches = [];

// Configuración de reglas (se actualiza desde el HTML)
let maxPlayers = 10;
let numGroups = 2;
let maxSetsToWin = 2; // Para ganar el partido (ej: 2 de 3)
let maxGamesPerSet = 6; // Para ganar el set (ej: 6-4)
let matchType = 'singles';

// El estado del torneo determina qué fase renderizar
let currentStage = 'group'; // 'group' o 'playoff'
let currentStep = 'groups'; // 'groups' o 'finalStandings'

// Variables para el DOM (se inicializan en loadAndInitializeLogic)
let matchesContainer, standingsContainer, playoffContainer, statusMessage;


// --- 2. GESTIÓN DE DATOS Y ESTADO (ADAPTADO A CLOUD) ---

/**
 * Carga los datos guardados, priorizando Cloud si está disponible.
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
            } else {
                showStatus("No cloud data found. Initializing new tournament.", "blue");
            }
        } catch (e) {
            console.error("Error loading cloud data: ", e);
            showStatus("Error connecting to cloud. Loading local data.", "red");
        }
    }

    // 2. Si no se cargó de Cloud o si no estamos en modo Cloud, cargar localmente
    if (!dataLoaded) {
        const localData = localStorage.getItem('tournamentData');
        if (localData) {
            data = JSON.parse(localData);
        }
    }

    // Aplicar los datos cargados
    if (Object.keys(data).length > 0) {
        players = data.players || [];
        matches = data.matches || [];
        playoffMatches = data.playoffMatches || [];
        currentStage = data.currentStage || 'group';
        currentStep = data.currentStep || 'groups';
        maxPlayers = parseInt(data.maxPlayers) || 10;
        numGroups = parseInt(data.numGroups) || 2;
        maxSetsToWin = parseInt(data.maxSetsToWin) || 2;
        maxGamesPerSet = parseInt(data.maxGamesPerSet) || 6;
        matchType = data.matchType || 'singles';
    }
}

/**
 * Guarda el estado actual del torneo en Cloud y en el almacenamiento local.
 */
function saveData(silent = false) {
    const data = {
        players,
        matches,
        playoffMatches,
        currentStage,
        currentStep,
        maxPlayers,
        numGroups,
        maxSetsToWin,
        maxGamesPerSet,
        matchType,
        timestamp: new Date().toISOString()
    };

    // 1. Guardar localmente
    localStorage.setItem('tournamentData', JSON.stringify(data));

    // 2. Guardar en Cloud si está disponible
    if (window.isCloudMode && window.db && window.userId) {
        const docRef = window.doc(window.db, "tournaments", window.userId);
        window.setDoc(docRef, data)
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
 * Muestra el ID del torneo en el header.
 */
function showTournamentId(id) {
    const display = document.getElementById('tournament-id-display');
    if (display) {
        display.innerHTML = `**Tournament ID:** ${id.substring(0, 8)}...`;
    }
}

/**
 * Muestra un mensaje temporal de estado.
 */
function showStatus(message, type) {
    if (!statusMessage) return; // Validación de inicialización de DOM
    
    const classMap = {
        'green': 'bg-green-100 border-green-400 text-green-700',
        'red': 'bg-red-100 border-red-400 text-red-700',
        'blue': 'bg-blue-100 border-blue-400 text-blue-700',
        'indigo': 'bg-indigo-100 border-indigo-400 text-indigo-700',
        'orange': 'bg-orange-100 border-orange-400 text-orange-700',
    };
    
    statusMessage.textContent = message;
    statusMessage.className = `p-3 rounded-lg border-l-4 font-medium transition duration-300 ${classMap[type]}`;
    statusMessage.style.opacity = '1';

    setTimeout(() => {
        statusMessage.style.opacity = '0';
    }, 3000);
}

// --- 3. GESTIÓN DE JUGADORES Y CONFIGURACIÓN ---

/**
 * Actualiza la UI de configuración con los valores actuales.
 */
function updateConfigUI() {
    document.getElementById('max-jugadores-actual').textContent = maxPlayers;
    document.getElementById('max-jugadores-input').value = maxPlayers;
    document.getElementById('num-grupos-actual').textContent = numGroups;
    document.getElementById('num-grupos-input').value = numGroups;
    document.getElementById('max-games-set-actual').textContent = maxGamesPerSet;
    document.getElementById('max-games-set-input').value = maxGamesPerSet;
    document.getElementById('match-type').value = matchType;
    document.getElementById('max-participantes-display').textContent = maxPlayers;
    
    renderPlayerList();
    
    // Configurar el texto inicial del botón de fase (si existe)
    const btnToggle = document.getElementById('btn-toggle-stage');
    if (btnToggle) {
        btnToggle.textContent = currentStage === 'group' ? '🚀 Go to Playoff Stage' : '⬅️ Back to Group Stage';
    }
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
                <span class="truncate">${p.name} (G${p.group})</span>
                <button data-player-id="${p.id}" class="btn-remove-player text-red-500 hover:text-red-700 ml-2">X</button>
            </li>
        `).join('');
        
        countDisplay.textContent = players.length;
        countListDisplay.textContent = players.length;

        // Añadir listeners para eliminar jugadores
        document.querySelectorAll('.btn-remove-player').forEach(btn => {
            btn.addEventListener('click', handleRemovePlayer);
        });
    }
}

/**
 * Gestiona el botón de establecer el máximo de jugadores.
 */
function handleSetMaxPlayers() {
    const input = document.getElementById('max-jugadores-input');
    const newMax = parseInt(input.value);
    
    if (newMax >= 4 && newMax % 2 === 0) {
        maxPlayers = newMax;
        updateConfigUI();
        saveData(false);
    } else {
        showStatus("Max Players must be an even number, minimum 4.", "red");
        input.value = maxPlayers; // Restaurar el valor
    }
}

/**
 * Gestiona el botón de establecer el número de grupos.
 */
function handleSetNumGroups() {
    const input = document.getElementById('num-grupos-input');
    const newNumGroups = parseInt(input.value);

    // Validación simplificada: número positivo y no más de la mitad de jugadores
    if (newNumGroups >= 1 && newNumGroups <= maxPlayers / 2) {
         // Validación de divisibilidad
        if (maxPlayers % newNumGroups !== 0) {
            showStatus(`Total players (${maxPlayers}) must be divisible by the number of groups (${newNumGroups}).`, "red");
            input.value = numGroups;
            return;
        }

        numGroups = newNumGroups;
        updateConfigUI();
        saveData(false);
    } else {
        showStatus(`Groups must be between 1 and ${maxPlayers / 2}.`, "red");
        input.value = numGroups; // Restaurar el valor
    }
}

/**
 * Gestiona el botón de establecer los juegos por set.
 */
function handleSetMaxGamesPerSet() {
    const input = document.getElementById('max-games-set-input');
    const newGames = parseInt(input.value);

    // Permitir 4, 6, 8, etc. (juegos para ganar)
    if (newGames >= 4 && newGames % 2 === 0) {
        maxGamesPerSet = newGames;
        updateConfigUI();
        saveData(false);
    } else {
        showStatus("Games per set must be an even number (e.g., 4, 6, 8).", "red");
        input.value = maxGamesPerSet;
    }
}

/**
 * Gestiona el cambio de tipo de partido.
 */
function handleMatchTypeChange(event) {
    matchType = event.target.value;
    saveData(false);
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

    if (players.length >= maxPlayers) {
        showStatus(`Maximum player limit (${maxPlayers}) reached.`, "red");
        return;
    }
    
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showStatus("Player name already exists.", "red");
        return;
    }

    // Asignar el grupo automáticamente
    const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, numGroups);
    const groupIndex = players.length % numGroups;
    const group = groupLetters[groupIndex];

    players.push({ 
        id: crypto.randomUUID(), 
        name: name, 
        group: group, 
        photoURL: null 
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
        const groupLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, numGroups);
        p.group = groupLetters[index % numGroups];
    });

    // Reiniciar partidos si ya se habían generado
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
    if (players.length === 0 || players.length % 2 !== 0) {
        showStatus("Need an even number of players (min 4) to generate matches.", "red");
        return;
    }
    
    if (players.length < 4) {
        showStatus("Minimum 4 players required for a full group round robin.", "red");
        return;
    }

    // Generar partidos y reiniciar
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
        window.userId = crypto.randomUUID(); // Generar un nuevo ID de torneo local
        
        // Limpiar variables
        players = [];
        matches = [];
        playoffMatches = [];
        
        // Recargar el estado inicial de la aplicación
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
                    scores: [[undefined, undefined]], // Inicializa con un set
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
    const setsNeededToWinMatch = maxSetsToWin;

    match.scores.forEach(([score1, score2]) => {
        const g1 = score1 !== undefined ? score1 : null;
        const g2 = score2 !== undefined ? score2 : null;
        
        if (g1 !== null && g2 !== null) {
            p1GamesWon += g1;
            p2GamesWon += g2;

            const gamesDiff = Math.abs(g1 - g2);

            // Regla de victoria del set (debe alcanzar maxGamesPerSet Y tener diferencia de 2, O ganar por 7-6)
            const isSetCompleted = 
                (g1 >= maxGamesPerSet || g2 >= maxGamesPerSet) && gamesDiff >= 2 || 
                (g1 === maxGamesPerSet + 1 && g2 === maxGamesPerSet) || 
                (g2 === maxGamesPerSet + 1 && g1 === maxGamesPerSet);
            
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

/**
 * Genera la estructura de la fase eliminatoria (cuartos, semis, final). (Simplificado)
 */
function generatePlayoffStructure(standings) {
    const topPlayers = standings.sort((a, b) => b.points - a.points || (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost)).slice(0, 8);
    
    if (topPlayers.length < 4) {
        showStatus("Not enough players (min 4 required) to start playoffs.", "orange");
        return;
    }

    playoffMatches = [];
    
    const isEightPlayers = topPlayers.length >= 8; // Usar 8 si hay 8 o más, sino 4
    const finalCut = isEightPlayers ? topPlayers.slice(0, 8) : topPlayers.slice(0, 4);

    let pList = isEightPlayers 
        ? [finalCut[0].name, finalCut[7].name, finalCut[3].name, finalCut[4].name, 
           finalCut[2].name, finalCut[5].name, finalCut[1].name, finalCut[6].name]
        : [finalCut[0].name, finalCut[3].name, finalCut[1].name, finalCut[2].name];

    let nextStagePlaceholders = [];

    // QF (si hay 8)
    if (isEightPlayers) {
        for (let i = 0; i < 4; i++) {
            const id = `QF${i + 1}`;
            nextStagePlaceholders.push(`Winner ${id}`);
            playoffMatches.push({ id: id, stage: `Quarter Final ${i + 1}`, p1: pList[i * 2], p2: pList[i * 2 + 1], scores: [[undefined, undefined]], winner: null, loser: null });
        }
    } else {
        // SF directa si hay 4
        nextStagePlaceholders.push('Winner SF1', 'Winner SF2');
    }

    // SF
    for (let i = 0; i < 2; i++) {
        const id = `SF${i + 1}`;
        const p1 = isEightPlayers ? nextStagePlaceholders[i * 2] : pList[i * 2];
        const p2 = isEightPlayers ? nextStagePlaceholders[i * 2 + 1] : pList[i * 2 + 1];
        playoffMatches.push({ id: id, stage: `Semi Final ${i + 1}`, p1: p1, p2: p2, scores: [[undefined, undefined]], winner: null, loser: null });
    }

    // Final
    playoffMatches.push({ id: 'FINAL', stage: 'Final', p1: 'Winner SF1', p2: 'Winner SF2', scores: [[undefined, undefined]], winner: null, loser: null });
    
    currentStage = 'playoff';
    currentStep = 'playoff';
    saveData(true);
    showStatus("Playoff structure generated and saved.", "blue");
}

/**
 * Actualiza los nombres de los jugadores en la siguiente fase eliminatoria.
 */
function updateNextPlayoffMatch(currentMatch) {
    const winnerName = currentMatch.winner;
    const loserName = currentMatch.loser;
    const winnerPlaceholder = `Winner ${currentMatch.id}`;
    const loserPlaceholder = `Loser ${currentMatch.id}`;

    playoffMatches.forEach(nextMatch => {
        if (nextMatch.p1 === winnerPlaceholder) {
            nextMatch.p1 = winnerName;
        }
        if (nextMatch.p2 === winnerPlaceholder) {
            nextMatch.p2 = winnerName;
        }
        // Asumiendo que también hay un partido por el tercer puesto
        if (nextMatch.p1 === loserPlaceholder) {
            nextMatch.p1 = loserName;
        }
        if (nextMatch.p2 === loserPlaceholder) {
            nextMatch.p2 = loserName;
        }
    });
}

/**
 * Calcula las posiciones y estadísticas de los jugadores en la fase de grupos.
 */
function calculateStandings() {
    const playerStats = {};
    players.forEach(p => {
        playerStats[p.name] = {
            name: p.name,
            group: p.group,
            matchesPlayed: 0, matchesWon: 0, matchesLost: 0,
            setsWon: 0, setsLost: 0,
            gamesWon: 0, gamesLost: 0,
            points: 0,
        };
    });

    matches.forEach(match => {
        const p1Name = match.p1;
        const p2Name = match.p2;
        const result = checkMatchWinner(match);
        const p1Sets = result.p1Sets;
        const p2Sets = result.p2Sets;
        const p1GamesWon = result.p1GamesWon;
        const p2GamesWon = result.p2GamesWon;

        if (match.winner !== null) {
            playerStats[p1Name].matchesPlayed++;
            playerStats[p2Name].matchesPlayed++;
            playerStats[p1Name].setsWon += p1Sets;
            playerStats[p1Name].setsLost += p2Sets;
            playerStats[p2Name].setsWon += p2Sets;
            playerStats[p2Name].setsLost += p1Sets;
            playerStats[p1Name].gamesWon += p1GamesWon;
            playerStats[p1Name].gamesLost += p2GamesWon;
            playerStats[p2Name].gamesWon += p2GamesWon;
            playerStats[p2Name].gamesLost += p1GamesWon;

            if (match.winner === p1Name) {
                playerStats[p1Name].matchesWon++;
                playerStats[p2Name].matchesLost++;
                playerStats[p1Name].points += 3;
            } else if (match.winner === p2Name) {
                playerStats[p2Name].matchesWon++;
                playerStats[p1Name].matchesLost++;
                playerStats[p2Name].points += 3;
            }
        }
    });

    const standingsArray = Object.values(playerStats);
    standingsArray.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const aSetDiff = a.setsWon - a.setsLost;
        const bSetDiff = b.setsWon - b.setsLost;
        if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;
        const aGameDiff = a.gamesWon - a.gamesLost;
        const bGameDiff = b.gamesWon - b.gamesLost;
        return bGameDiff - aGameDiff;
    });

    return standingsArray;
}


// --- 5. RENDERIZADO Y UI ---

function getPlayerDisplayInfo(p) {
    const pName = typeof p === 'string' ? p : p.name;
    const player = players.find(pl => pl.name === pName);

    if (player) {
        return { name: player.name, photoURL: player.photoURL };
    }
    return { name: pName, photoURL: null };
}

function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    const p1Info = getPlayerDisplayInfo(match.p1);
    const p2Info = getPlayerDisplayInfo(match.p2);
    const p1Name = p1Info.name;
    const p2Name = p2Info.name;
    
    const getAvatarHtml = (info) => {
        if (info.photoURL) {
            return `<img src="${info.photoURL}" alt="${info.name}" class="w-8 h-8 rounded-full object-cover mr-2 inline-block shadow">`;
        }
        if (info.name.startsWith('Winner') || info.name.startsWith('Loser')) {
             return `<span class="mr-2 inline-block"></span>`;
        }
        const initial = info.name.charAt(0).toUpperCase();
        return `<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-700 mr-2 inline-block">${initial}</div>`;
    };
    
    const cardClass = isCompleted ? 'match-card completed ring-4 ring-green-300' : 'match-card';
    const isPlayoff = match.stage;
    const stageInfo = isPlayoff ? match.stage : `Group ${match.group}`;
    const inputClass = isPlayoff ? 'playoff-set-input' : 'group-set-input';

    let cardHtml = `
        <div class="${cardClass} p-4 bg-white rounded-lg shadow transition duration-200" id="match-card-${match.id}">
            <p class="text-lg font-bold text-gray-900 mb-2 flex items-center">
                ${stageInfo}: ${getAvatarHtml(p1Info)} ${p1Name} vs ${getAvatarHtml(p2Info)} ${p2Name}
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
                        ${renderSetScoreRow(match, 'p1', p1Name, inputClass)}
                        ${renderSetScoreRow(match, 'p2', p2Name, inputClass)}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-3 flex justify-between items-center">
                 <button class="btn-add-set bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-2 py-1 rounded-md transition duration-150 ${isCompleted ? 'opacity-50 cursor-not-allowed' : ''}" 
                        data-match-id="${match.id}" ${isCompleted ? 'disabled' : ''}>
                    + Add Set
                </button>
                <p class="text-sm font-semibold text-gray-900">
                    Sets: <span class="text-indigo-600 font-bold">${getSetsScoreString(match)}</span>
                </p>
                    <p class="text-sm font-semibold ${isCompleted ? 'text-green-700' : 'text-gray-500'}" id="winner-status-${match.id}">
                    ${isCompleted ? `🏆 **Winner:** ${match.winner}` : 'Status: In Progress'}
                </p>
            </div>
        </div>
    `;
    return cardHtml;
}

function renderSetScoreRow(match, pKey, name, inputClass) {
    const isP1 = pKey === 'p1';
    const isDisabled = match.winner !== null;

    let totalGames = 0;
    
    let setInputsHtml = match.scores.map((setScore, setIndex) => {
        const playerIsPlaceholder = name.startsWith('Winner') || name.startsWith('Loser');
        const effectiveDisabled = isDisabled || playerIsPlaceholder;

        const games = isP1 ? setScore[0] : setScore[1];
        totalGames += (games !== null && games !== undefined) ? games : 0; // Contar solo valores numéricos

        const maxInputGames = maxGamesPerSet + 1; 

        return `
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                <input type="number" min="0" max="${maxInputGames}" 
                        value="${games === null || games === undefined ? '' : games}" 
                        data-match-id="${match.id}" data-player="${pKey}" data-set-index="${setIndex}"
                        class="${inputClass} set-score-input w-14 p-1 border border-gray-300 rounded-md text-center text-sm focus:ring-indigo-500 ${effectiveDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}"
                        ${effectiveDisabled ? 'disabled' : ''}>
            </td>
        `;
    }).join('');

    return `
        <tr>
            <td class="px-3 py-2 font-medium text-gray-900">${name}</td>
            ${setInputsHtml}
            <td class="px-3 py-2 text-center text-sm font-bold text-indigo-600">${totalGames}</td>
        </tr>
    `;
}

function getSetsScoreString(match) {
    const result = checkMatchWinner(match);
    return `${result.p1Sets}-${result.p2Sets}`;
}

function reRenderMatchCard(match) {
    const oldCard = document.getElementById(`match-card-${match.id}`);
    if (oldCard) {
        const newHtml = renderMatchCard(match);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml;
        const newCard = tempDiv.firstChild;
        
        oldCard.parentNode.replaceChild(newCard, oldCard);
        
        newCard.querySelector('.btn-add-set')?.addEventListener('click', handleAddSet);
    }
}

function renderMatches() {
    // 🛑 VALIDACIÓN DE INICIALIZACIÓN CRÍTICA
    if (!matchesContainer || !playoffContainer || !standingsContainer) {
        console.error("DOM elements not initialized. Skipping renderMatches.");
        return; 
    }
    
    let currentMatches = currentStage === 'group' ? matches : playoffMatches;

    if (currentStep === 'finalStandings') {
        matchesContainer.innerHTML = '';
        playoffContainer.innerHTML = '';
        standingsContainer.innerHTML = '';
        renderFinalStandings();
        return;
    }
    
    // Linea 634: Aquí se produce el error si el contenedor es null.
    matchesContainer.innerHTML = ''; 
    playoffContainer.innerHTML = '';
    standingsContainer.innerHTML = ''; 

    const containerToUse = currentStage === 'group' ? matchesContainer : playoffContainer;

    if (currentStage === 'group') {
        const groupedMatches = {};
        currentMatches.forEach(m => {
            if (!groupedMatches[m.group]) groupedMatches[m.group] = [];
            groupedMatches[m.group].push(m);
        });

        Object.keys(groupedMatches).sort().forEach(groupKey => {
            const groupTitle = document.createElement('h2');
            groupTitle.className = 'text-2xl font-extrabold text-gray-800 my-4 border-b pb-2';
            groupTitle.textContent = `Group ${groupKey} Matches`;
            containerToUse.appendChild(groupTitle);

            const groupDiv = document.createElement('div');
            groupDiv.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
            groupedMatches[groupKey].forEach(match => {
                groupDiv.innerHTML += renderMatchCard(match);
            });
            containerToUse.appendChild(groupDiv);
        });

        renderStandings(calculateStandings());
    } else {
        const stages = playoffMatches.map(m => m.stage).filter((v, i, a) => a.indexOf(v) === i);
        
        stages.forEach(stageName => {
            const stageMatches = currentMatches.filter(m => m.stage === stageName);
            if (stageMatches.length > 0) {
                const stageTitle = document.createElement('h2');
                stageTitle.className = 'text-2xl font-extrabold text-indigo-700 my-4 border-b pb-2';
                stageTitle.textContent = stageName;
                containerToUse.appendChild(stageTitle);
                
                const stageDiv = document.createElement('div');
                stageDiv.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-8';
                stageMatches.forEach(match => {
                    stageDiv.innerHTML += renderMatchCard(match);
                });
                containerToUse.appendChild(stageDiv);
            }
        });
    }

    addEventListeners();
}

function renderStandings(standings) {
    if (currentStage !== 'group') {
        standingsContainer.innerHTML = '';
        return;
    }
    
    const groupedStandings = {};
    standings.forEach(s => {
        if (!groupedStandings[s.group]) groupedStandings[s.group] = [];
        groupedStandings[s.group].push(s);
    });

    // Como el index.html no tiene un contenedor específico para Standings, 
    // lo crearemos dinámicamente o lo inyectaremos justo después de matches-container.
    // Usaremos un elemento que debe estar definido, si no lo está, lo inyectaremos en el padre.
    
    let html = '<h2 class="text-2xl font-extrabold text-gray-800 mt-6 mb-4 border-b pb-2">Group Standings</h2>';
    // ... (omito el cuerpo de la tabla por ser largo, asumo que ya funciona) ...
    // ...

    Object.keys(groupedStandings).sort().forEach(groupKey => {
        html += `<h3 class="text-xl font-bold text-gray-700 mt-4 mb-2">Group ${groupKey}</h3>`;
        html += `
            <div class="overflow-x-auto shadow-lg rounded-lg mb-6">
                <table class="min-w-full divide-y divide-gray-200 bg-white">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">MP</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">W</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">L</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">SW</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">SL</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">GW</th>
                            <th class="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">GL</th>
                            <th class="px-3 py-2 text-center text-xs font-bold text-indigo-600 uppercase">Points</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
        `;

        groupedStandings[groupKey].forEach((stat, index) => {
            const playerInfo = getPlayerDisplayInfo(stat.name);
            html += `
                <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                    <td class="px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-900 text-left">${index + 1}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-left flex items-center">
                        ${playerInfo.photoURL ? `<img src="${playerInfo.photoURL}" alt="${playerInfo.name}" class="w-6 h-6 rounded-full object-cover mr-2">` : ''}
                        ${stat.name}
                    </td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">${stat.matchesPlayed}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">${stat.matchesWon}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">${stat.matchesLost}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">${stat.setsWon}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">${stat.setsLost}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">${stat.gamesWon}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">${stat.gamesLost}</td>
                    <td class="px-3 py-2 whitespace-nowrap text-sm font-bold text-indigo-600 text-center">${stat.points}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
    });
    
    const allMatchesCompleted = matches.length > 0 && matches.every(m => m.winner !== null);
    if (allMatchesCompleted) {
        html += `
            <div class="mt-6 text-center">
                <button id="btn-start-playoffs" class="px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-xl hover:bg-green-700 transition duration-200">
                    🚀 Start Playoffs Stage
                </button>
            </div>
        `;
    }

    standingsContainer.innerHTML = html;
    
    if (allMatchesCompleted) {
        document.getElementById('btn-start-playoffs')?.addEventListener('click', () => {
            const standings = calculateStandings();
            generatePlayoffStructure(standings);
            renderMatches();
        });
    }
}

function renderFinalStandings() {
    const finalMatch = playoffMatches.find(m => m.id === 'FINAL');
    
    if (finalMatch && finalMatch.winner) {
        const winner = finalMatch.winner;
        const loser = finalMatch.winner === finalMatch.p1 ? finalMatch.p2 : finalMatch.p1;
        
        let html = `
            <div class="text-center p-8 bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl shadow-2xl mt-8">
                <h1 class="text-4xl font-extrabold text-yellow-700 mb-4">🏆 Tournament Final Standings 🏆</h1>
                <p class="text-2xl font-semibold text-gray-800 mb-6">Match: ${finalMatch.p1} vs ${finalMatch.p2}</p>
                <div class="inline-block bg-white p-6 rounded-lg shadow-inner ring-4 ring-yellow-500">
                    <h2 class="text-3xl font-bold text-green-600">Champion: ${winner}</h2>
                    <p class="text-xl text-gray-700 mt-2">Runner-up: ${loser}</p>
                </div>
            </div>
        `;
        playoffContainer.innerHTML = html;
    } else {
        playoffContainer.innerHTML = '<p class="text-xl text-gray-600 text-center mt-8">Final not yet completed.</p>';
    }
}


// --- 6. GESTORES DE EVENTOS ---

function addEventListeners() {
    document.querySelectorAll('.set-score-input').forEach(input => {
        input.removeEventListener('change', handleScoreChange);
        input.addEventListener('change', handleScoreChange);
    });
    
    document.querySelectorAll('.btn-add-set').forEach(button => {
        button.removeEventListener('click', handleAddSet);
        button.addEventListener('click', handleAddSet);
    });
    
    // Asume que este botón existe en el HTML (puede no existir en la fase de registro)
    document.getElementById('btn-toggle-stage')?.removeEventListener('click', toggleStage);
    document.getElementById('btn-toggle-stage')?.addEventListener('click', toggleStage);
}


function handleScoreChange(event) {
    const input = event.target;
    const matchId = input.dataset.matchId;
    const pKey = input.dataset.player; 
    const setIndex = parseInt(input.dataset.setIndex);

    let match = matches.find(m => m.id === matchId);
    const isPlayoff = !match;
    if (isPlayoff) {
        match = playoffMatches.find(m => m.id === matchId);
    }
    if (!match) return;
    
    if (match.winner !== null) {
        const prevValue = (pKey === 'p1' ? match.scores[setIndex][0] : match.scores[setIndex][1]) || '';
        input.value = prevValue;
        showStatus("⚠️ Cannot change score for a completed match.", "orange");
        input.disabled = true;
        return;
    }

    const playerName = pKey === 'p1' ? match.p1 : match.p2;
    if (typeof playerName === 'string' && (playerName.startsWith('Winner') || playerName.startsWith('Loser'))) {
        const prevValue = (pKey === 'p1' ? match.scores[setIndex][0] : match.scores[setIndex][1]) || '';
        input.value = prevValue;
        showStatus(`🚫 Score cannot be entered for placeholder '${playerName}'.`, "orange");
        return;
    }

    let value = input.value.trim() === '' ? undefined : parseInt(input.value.trim());

    const maxInputGames = maxGamesPerSet + 1;
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
        updateNextPlayoffMatch(match);
    }

    reRenderMatchCard(match);
    
    if (match.winner) {
          showStatus(`🏆 Match complete! Winner: ${match.winner}`, "green");
    } else {
        showStatus(`📝 Score updated. Current sets: ${getSetsScoreString(match)}`, "indigo");
    }

    renderMatches();
    
    if (match.id === 'FINAL' && match.winner) {
        currentStep = 'finalStandings';
        renderMatches();
    }
    
    saveData(true);
}

function handleAddSet(event) {
    const button = event.target;
    const matchId = button.dataset.matchId;

    let match = matches.find(m => m.id === matchId);
    const isPlayoff = !match;
    if (isPlayoff) {
        match = playoffMatches.find(m => m.id === matchId);
    }
    if (!match) return;

    if (match.winner !== null) {
        showStatus("Cannot add set to a completed match.", "orange");
        return;
    }

    const lastSet = match.scores[match.scores.length - 1];
    if (lastSet[0] === undefined || lastSet[1] === undefined) {
        showStatus("Fill out the current set before adding a new one.", "orange");
        return;
    }
    
    match.scores.push([undefined, undefined]);
    
    reRenderMatchCard(match);
    saveData(true);
}

function toggleStage() {
    if (currentStage === 'group') {
        currentStage = 'playoff';
        document.getElementById('btn-toggle-stage').textContent = '⬅️ Back to Group Stage';
    } else {
        currentStage = 'group';
        document.getElementById('btn-toggle-stage').textContent = '🚀 Go to Playoff Stage';
    }
    renderMatches();
    saveData(true);
}

function handleLoadTournament(event) {
    event.preventDefault();
    const externalId = document.getElementById('external-id-input').value.trim();
    if (externalId) {
        localStorage.setItem("current-tournament-id", externalId);
        window.userId = externalId;
        window.location.reload();
    }
}


// --- 7. INICIALIZACIÓN PRINCIPAL ---

/**
 * Inicializa la lógica una vez que la conexión a Firebase/Cloud ha terminado.
 */
window.loadAndInitializeLogic = async function() {
    
    // 🛑 PASO 1: INICIALIZAR LAS VARIABLES DEL DOM. (Solución al error anterior)
    matchesContainer = document.getElementById('matches-container');
    // ATENCIÓN: Estos IDs NO EXISTEN en tu index.html. Se deben agregar o usar otros.
    // Usaré el padre del matches-container y crearé los contenedores faltantes.
    standingsContainer = document.getElementById('standings-container');
    playoffContainer = document.getElementById('playoff-container');
    statusMessage = document.getElementById('status-message');

    // SOLUCIÓN AL ERROR DE ID: Tu HTML solo tiene 'matches-container' y 'status-message'.
    // Añadiremos los contenedores faltantes ('standings-container' y 'playoff-container') dinámicamente
    // justo después del matches-container si no existen.
    const parentContainer = matchesContainer ? matchesContainer.parentNode : null;
    if (parentContainer) {
        if (!standingsContainer) {
            standingsContainer = document.createElement('div');
            standingsContainer.id = 'standings-container';
            parentContainer.appendChild(standingsContainer);
        }
        if (!playoffContainer) {
            playoffContainer = document.createElement('div');
            playoffContainer.id = 'playoff-container';
            parentContainer.appendChild(playoffContainer);
        }
    } else {
        // Fallback si matchesContainer no existe (error en el HTML principal)
        console.error("Critical: matches-container element is missing from the HTML.");
        return;
    }
    
    // Re-obtener statusMessage ya que estaba fuera del main-container
    if (!statusMessage) {
        statusMessage = document.getElementById('status-message');
        if (!statusMessage) {
             console.warn("Status message element is missing.");
        }
    }
    // -------------------------------------------------------------------------
    
    await loadData();
    updateConfigUI(); // Configura los valores iniciales en el HTML
    renderMatches();  // Dibuja los partidos y posiciones

    // GESTORES DE EVENTOS GLOBALES (Configuración y Jugadores)
    document.getElementById('btn-configurar-max')?.addEventListener('click', handleSetMaxPlayers);
    document.getElementById('btn-configurar-grupos')?.addEventListener('click', handleSetNumGroups);
    document.getElementById('btn-configurar-juegos')?.addEventListener('click', handleSetMaxGamesPerSet);
    document.getElementById('match-type')?.addEventListener('change', handleMatchTypeChange);
    
    document.getElementById('btn-agregar-participante')?.addEventListener('click', handleAddPlayer);
    document.getElementById('btn-generate-matches')?.addEventListener('click', handleGenerateMatches);
    document.getElementById('btn-borrar-datos')?.addEventListener('click', handleResetTournament);
    document.getElementById('load-tournament-form')?.addEventListener('submit', handleLoadTournament);
    
    // Asegurar que el ID se muestre
    showTournamentId(window.userId);

    // Los listeners de los marcadores y Add Set se añaden en renderMatches/addEventListeners
};
