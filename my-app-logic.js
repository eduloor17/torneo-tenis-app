// my-app-logic.js
// Script para gestionar un torneo de tenis/pádel (Grupos y Eliminatorias)

// --- 1. CONFIGURACIÓN INICIAL ---
let players = [];
let matches = [];
let playoffMatches = [];
let maxSetsToWin = 2; // Por ejemplo, ganar 2 sets de 3.
let maxGamesPerSet = 6; // Por ejemplo, sets de 6 juegos (con desempate si es 6-6)

// El estado del torneo determina qué fase renderizar
let currentStage = 'group'; // 'group' o 'playoff'
let currentStep = 'groups'; // 'groups' o 'finalStandings'

// IDs de los contenedores
const matchesContainer = document.getElementById('matches-container');
const standingsContainer = document.getElementById('standings-container');
const playoffContainer = document.getElementById('playoff-container');
const statusMessage = document.getElementById('status-message');
const playerInput = document.getElementById('player-name-input');

// --- 2. GESTIÓN DE DATOS Y ESTADO ---

/**
 * Carga los datos guardados o inicializa los datos por defecto.
 */
function loadData() {
    const savedPlayers = localStorage.getItem('tournamentPlayers');
    const savedMatches = localStorage.getItem('tournamentMatches');
    const savedPlayoffMatches = localStorage.getItem('tournamentPlayoffMatches');
    const savedStage = localStorage.getItem('currentStage');
    const savedStep = localStorage.getItem('currentStep');
    const savedMaxSets = localStorage.getItem('maxSetsToWin');
    const savedMaxGames = localStorage.getItem('maxGamesPerSet');

    if (savedPlayers && savedMatches) {
        players = JSON.parse(savedPlayers);
        matches = JSON.parse(savedMatches);
        playoffMatches = savedPlayoffMatches ? JSON.parse(savedPlayoffMatches) : [];
        currentStage = savedStage || 'group';
        currentStep = savedStep || 'groups';
        maxSetsToWin = parseInt(savedMaxSets) || 2;
        maxGamesPerSet = parseInt(savedMaxGames) || 6;

        // Asegurarse de que los nombres de los jugadores en los partidos sean string
        // Esto previene errores si se guardan como objetos en alguna versión antigua.
        matches.forEach(m => {
            if (m.p1 && typeof m.p1 === 'object' && m.p1.name) m.p1 = m.p1.name;
            if (m.p2 && typeof m.p2 === 'object' && m.p2.name) m.p2 = m.p2.name;
        });
        
    } else {
        // Datos de ejemplo
        players = [
            { id: 'p1', name: 'Rafa Nadal', group: 'A', photoURL: 'https://i.ibb.co/6P0jL6y/rafa.jpg' },
            { id: 'p2', name: 'Roger Federer', group: 'A', photoURL: 'https://i.ibb.co/wJ10L3b/roger.jpg' },
            { id: 'p3', name: 'Novak Djokovic', group: 'B', photoURL: 'https://i.ibb.co/Xz9tG9q/novak.jpg' },
            { id: 'p4', name: 'Andy Murray', group: 'B', photoURL: 'https://i.ibb.co/5cQG9rS/andy.jpg' },
            { id: 'p5', name: 'Daniil Medvedev', group: 'C' },
            { id: 'p6', name: 'Alexander Zverev', group: 'C' },
        ];
        generateMatches();
        showStatus("Tournament initialized with example data.", "blue");
    }
}

/**
 * Guarda el estado actual del torneo en el almacenamiento local.
 * @param {boolean} silent Si es true, no muestra el mensaje de estado.
 */
function saveData(silent = false) {
    localStorage.setItem('tournamentPlayers', JSON.stringify(players));
    localStorage.setItem('tournamentMatches', JSON.stringify(matches));
    localStorage.setItem('tournamentPlayoffMatches', JSON.stringify(playoffMatches));
    localStorage.setItem('currentStage', currentStage);
    localStorage.setItem('currentStep', currentStep);
    localStorage.setItem('maxSetsToWin', maxSetsToWin.toString());
    localStorage.setItem('maxGamesPerSet', maxGamesPerSet.toString());
    if (!silent) {
        showStatus("Data saved successfully.", "green");
    }
}

/**
 * Muestra un mensaje temporal de estado.
 * @param {string} message El mensaje a mostrar.
 * @param {string} type El tipo de mensaje (ej: 'green', 'red', 'blue', 'indigo', 'orange').
 */
function showStatus(message, type) {
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

// --- 3. LÓGICA DEL TORNEO ---

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
 * @param {object} match El objeto partido.
 * @returns {object} {winner: string|null, p1Sets: number, p2Sets: number}
 */
function checkMatchWinner(match) {
    let p1Sets = 0;
    let p2Sets = 0;
    let p1GamesWon = 0;
    let p2GamesWon = 0;
    let allScoresValid = true;

    match.scores.forEach(([score1, score2]) => {
        const g1 = score1 !== undefined ? score1 : null;
        const g2 = score2 !== undefined ? score2 : null;
        
        if (g1 === null || g2 === null) {
            allScoresValid = false;
        }

        if (g1 !== null && g2 !== null) {
            p1GamesWon += g1;
            p2GamesWon += g2;

            const gamesDiff = Math.abs(g1 - g2);

            // Regla de victoria del set: 
            // Debe alcanzar al menos `maxGamesPerSet` (ej: 6) Y tener una diferencia de al menos 2.
            // O, si es un tie-break (7-6), se gana con 7.
            const isSetCompleted = (g1 >= maxGamesPerSet || g2 >= maxGamesPerSet) && gamesDiff >= 2 || (g1 === maxGamesPerSet + 1 && g2 === maxGamesPerSet) || (g2 === maxGamesPerSet + 1 && g1 === maxGamesPerSet);
            
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
    const setsNeededToWin = maxSetsToWin;

    if (p1Sets >= setsNeededToWin) {
        winner = match.p1;
    } else if (p2Sets >= setsNeededToWin) {
        winner = match.p2;
    }

    return { winner, p1Sets, p2Sets, p1GamesWon, p2GamesWon };
}

/**
 * Genera la estructura de la fase eliminatoria (cuartos, semis, final).
 */
function generatePlayoffStructure(standings) {
    // Tomar los 8 mejores o los 4 mejores si hay menos grupos/jugadores.
    // Ejemplo: 2 mejores de cada grupo A, B, C (si hubiera 3 grupos)
    // Para 2 grupos (A y B) y 6 jugadores, tomamos 2 de cada uno y llenamos con los mejores terceros.
    
    // Simplificado: Tomar los 8 mejores clasificados
    const topPlayers = standings.sort((a, b) => b.points - a.points || (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost)).slice(0, 8);
    
    // Si hay menos de 8 jugadores, ajusta la estructura.
    if (topPlayers.length < 4) {
        showStatus("Not enough players for playoffs (min 4 recommended).", "orange");
        return;
    }

    playoffMatches = [];
    
    // Cuartos de Final (QF) - Solo si hay 8 jugadores
    if (topPlayers.length === 8) {
        playoffMatches.push(
            // QF1
            { id: 'QF1', stage: 'Quarter Final 1', p1: topPlayers[0].name, p2: topPlayers[7].name, scores: [[undefined, undefined]], winner: null }, 
            // QF2
            { id: 'QF2', stage: 'Quarter Final 2', p1: topPlayers[3].name, p2: topPlayers[4].name, scores: [[undefined, undefined]], winner: null }, 
            // QF3
            { id: 'QF3', stage: 'Quarter Final 3', p1: topPlayers[2].name, p2: topPlayers[5].name, scores: [[undefined, undefined]], winner: null }, 
            // QF4
            { id: 'QF4', stage: 'Quarter Final 4', p1: topPlayers[1].name, p2: topPlayers[6].name, scores: [[undefined, undefined]], winner: null }
        );
    }
    
    // Semifinales (SF) - 4 jugadores (ganadores de QF o top 4 si no hay QF)
    let p1SF1 = topPlayers.length === 8 ? 'Winner QF1' : topPlayers[0].name;
    let p2SF1 = topPlayers.length === 8 ? 'Winner QF2' : topPlayers[3].name;
    let p1SF2 = topPlayers.length === 8 ? 'Winner QF3' : topPlayers[1].name;
    let p2SF2 = topPlayers.length === 8 ? 'Winner QF4' : topPlayers[2].name;

    playoffMatches.push(
        // SF1
        { id: 'SF1', stage: 'Semi Final 1', p1: p1SF1, p2: p2SF1, scores: [[undefined, undefined]], winner: null, loser: null }, 
        // SF2
        { id: 'SF2', stage: 'Semi Final 2', p1: p1SF2, p2: p2SF2, scores: [[undefined, undefined]], winner: null, loser: null }
    );

    // Final
    playoffMatches.push(
        // Final
        { id: 'FINAL', stage: 'Final', p1: 'Winner SF1', p2: 'Winner SF2', scores: [[undefined, undefined]], winner: null, loser: null }
    );
    
    // Cambiar a la etapa de playoffs
    currentStage = 'playoff';
    currentStep = 'playoff';
    saveData(true);
    showStatus("Playoff structure generated and saved.", "blue");
}


/**
 * Actualiza los nombres de los jugadores en la siguiente fase eliminatoria.
 * @param {object} currentMatch El partido que acaba de terminar.
 */
function updateNextPlayoffMatch(currentMatch) {
    const winnerName = currentMatch.winner;
    const loserName = currentMatch.loser;
    let winnerPlaceholder = '';
    let loserPlaceholder = '';

    if (currentMatch.id.startsWith('QF')) {
        winnerPlaceholder = `Winner ${currentMatch.id}`;
        loserPlaceholder = `Loser ${currentMatch.id}`;
    } else if (currentMatch.id.startsWith('SF')) {
        winnerPlaceholder = `Winner ${currentMatch.id}`;
        loserPlaceholder = `Loser ${currentMatch.id}`;
    }

    // Busca los partidos donde el placeholder del ganador deba ser reemplazado
    playoffMatches.forEach(nextMatch => {
        if (nextMatch.p1 === winnerPlaceholder) {
            nextMatch.p1 = winnerName;
        }
        if (nextMatch.p2 === winnerPlaceholder) {
            nextMatch.p2 = winnerName;
        }
        // Para el partido por el 3er lugar (opcional, no implementado aquí)
        // if (nextMatch.p1 === loserPlaceholder) {
        //     nextMatch.p1 = loserName;
        // }
        // if (nextMatch.p2 === loserPlaceholder) {
        //     nextMatch.p2 = loserName;
        // }
    });
}

// --- 4. CÁLCULO DE POSICIONES (STANDINGS) ---

/**
 * Calcula las posiciones y estadísticas de los jugadores en la fase de grupos.
 * @returns {Array} Lista de objetos de posiciones.
 */
function calculateStandings() {
    const playerStats = {};

    // Inicializar estadísticas de los jugadores
    players.forEach(p => {
        playerStats[p.name] = {
            name: p.name,
            group: p.group,
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
            points: 0, // 3 por victoria, 1 por sets perdidos (opcional, aquí 3 por W, 0 por L)
        };
    });

    // Procesar resultados de los partidos de grupo
    matches.forEach(match => {
        const p1Name = match.p1;
        const p2Name = match.p2;

        const result = checkMatchWinner(match);
        const p1Sets = result.p1Sets;
        const p2Sets = result.p2Sets;
        const p1GamesWon = result.p1GamesWon;
        const p2GamesWon = result.p2GamesWon;

        // Si el partido está completo
        if (match.winner !== null) {
            // Stats para P1
            playerStats[p1Name].matchesPlayed++;
            playerStats[p1Name].setsWon += p1Sets;
            playerStats[p1Name].setsLost += p2Sets;
            playerStats[p1Name].gamesWon += p1GamesWon;
            playerStats[p1Name].gamesLost += p2GamesWon;
            
            // Stats para P2
            playerStats[p2Name].matchesPlayed++;
            playerStats[p2Name].setsWon += p2Sets;
            playerStats[p2Name].setsLost += p1Sets;
            playerStats[p2Name].gamesWon += p2GamesWon;
            playerStats[p2Name].gamesLost += p1GamesWon;

            // Puntos
            if (match.winner === p1Name) {
                playerStats[p1Name].matchesWon++;
                playerStats[p2Name].matchesLost++;
                playerStats[p1Name].points += 3; // 3 puntos por victoria
            } else if (match.winner === p2Name) {
                playerStats[p2Name].matchesWon++;
                playerStats[p1Name].matchesLost++;
                playerStats[p2Name].points += 3;
            }
        }
    });

    // Ordenar posiciones: 1. Puntos, 2. Diferencia de sets (SW - SL), 3. Diferencia de juegos (GW - GL)
    const standingsArray = Object.values(playerStats);
    standingsArray.sort((a, b) => {
        // 1. Puntos
        if (b.points !== a.points) return b.points - a.points;
        
        // 2. Diferencia de Sets
        const aSetDiff = a.setsWon - a.setsLost;
        const bSetDiff = b.setsWon - b.setsLost;
        if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff;

        // 3. Diferencia de Juegos
        const aGameDiff = a.gamesWon - a.gamesLost;
        const bGameDiff = b.gamesWon - b.gamesLost;
        return bGameDiff - aGameDiff;
    });

    return standingsArray;
}


// --- 5. RENDERIZADO Y UI ---

/**
 * Obtiene la información de display (nombre y foto) para un jugador o equipo.
 */
function getPlayerDisplayInfo(p) {
    const pName = typeof p === 'string' ? p : p.name;
    const player = players.find(pl => pl.name === pName);

    if (player) {
        return { name: player.name, photoURL: player.photoURL };
    }
    // Para placeholders de playoffs
    return { name: pName, photoURL: null };
}

/**
 * Renders a generic match card (Set/Game Inputs)
 * @param {object} match El objeto partido.
 * @returns {string} HTML de la tarjeta.
 */
function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    
    // Obtener información del jugador/equipo incluyendo foto
    const p1Info = getPlayerDisplayInfo(match.p1);
    const p2Info = getPlayerDisplayInfo(match.p2);
    
    const p1Name = p1Info.name;
    const p2Name = p2Info.name;
    
    // Helper para generar el avatar
    const getAvatarHtml = (info) => {
        if (info.photoURL) {
            return `<img src="${info.photoURL}" alt="${info.name}" class="w-8 h-8 rounded-full object-cover mr-2 inline-block shadow">`;
        }
        // Evita mostrar iniciales para placeholders de playoffs
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

/**
 * Helper para renderizar una fila de la tabla de puntuación (un jugador).
 * @param {object} match Objeto partido.
 * @param {string} pKey 'p1' o 'p2'.
 * @param {string} name Nombre del jugador.
 * @param {string} inputClass Clase CSS para el input.
 * @returns {string} HTML de la fila de la tabla.
 */
function renderSetScoreRow(match, pKey, name, inputClass) {
    const isP1 = pKey === 'p1';
    // CORRECCIÓN CLAVE: Verificar si hay un ganador para deshabilitar los inputs.
    const isDisabled = match.winner !== null;

    // Calculate total games won for the final column
    let totalGames = 0;
    
    let setInputsHtml = match.scores.map((setScore, setIndex) => {
        // Si el jugador es un placeholder de playoff, deshabilitar edición.
        const playerIsPlaceholder = name.startsWith('Winner') || name.startsWith('Loser');
        const effectiveDisabled = isDisabled || playerIsPlaceholder;

        const games = isP1 ? setScore[0] : setScore[1];
        totalGames += games || 0;
        
        // Max score input should be the set limit + 1 (for the X-(X-1) case in an X-game set)
        const maxInputGames = maxGamesPerSet + 1; 

        return `
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                <input type="number" min="0" max="${maxInputGames}" value="${games !== undefined ? games : ''}" 
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

/**
 * Obtiene la puntuación de sets en formato "X-Y".
 */
function getSetsScoreString(match) {
    const result = checkMatchWinner(match);
    return `${result.p1Sets}-${result.p2Sets}`;
}

/**
 * Re-renderiza una tarjeta de partido específica para actualizar el estado.
 */
function reRenderMatchCard(match) {
    const oldCard = document.getElementById(`match-card-${match.id}`);
    if (oldCard) {
        const newHtml = renderMatchCard(match);
        // Crear un div temporal para el nuevo HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newHtml;
        const newCard = tempDiv.firstChild;
        
        // Reemplazar la tarjeta antigua
        oldCard.parentNode.replaceChild(newCard, oldCard);
        
        // Vuelve a añadir el listener para el botón de 'Add Set' en la nueva tarjeta
        newCard.querySelector('.btn-add-set')?.addEventListener('click', handleAddSet);
    }
}


/**
 * Renderiza la lista de partidos de la fase actual (Grupos o Playoffs).
 */
function renderMatches() {
    let currentMatches = currentStage === 'group' ? matches : playoffMatches;

    if (currentStep === 'finalStandings') {
        matchesContainer.innerHTML = '<h2>Tournament Concluded</h2>';
        playoffContainer.innerHTML = '';
        renderFinalStandings();
        return;
    }
    
    matchesContainer.innerHTML = '';
    playoffContainer.innerHTML = '';

    const containerToUse = currentStage === 'group' ? matchesContainer : playoffContainer;

    if (currentStage === 'group') {
        // Agrupar por grupo para el renderizado
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

        // Asegurarse de renderizar las posiciones de grupo junto a los partidos
        renderStandings(calculateStandings());
    } else {
        // Renderizar Playoffs
        const stages = ['Quarter Final 1', 'Quarter Final 2', 'Quarter Final 3', 'Quarter Final 4', 'Semi Final 1', 'Semi Final 2', 'Final'];
        
        stages.forEach(stageName => {
            const stageMatches = currentMatches.filter(m => m.stage === stageName);
            if (stageMatches.length > 0) {
                const stageTitle = document.createElement('h2');
                stageTitle.className = 'text-2xl font-extrabold text-indigo-700 my-4 border-b pb-2';
                stageTitle.textContent = stageName.includes('Final') ? stageName : `Stage: ${stageName}`;
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

    // Volver a añadir event listeners después de renderizar el HTML
    addEventListeners();
}

/**
 * Renderiza la tabla de posiciones de la fase de grupos.
 */
function renderStandings(standings) {
    if (currentStage !== 'group') {
        standingsContainer.innerHTML = '';
        return;
    }
    
    // Agrupar por grupo para la tabla
    const groupedStandings = {};
    standings.forEach(s => {
        if (!groupedStandings[s.group]) groupedStandings[s.group] = [];
        groupedStandings[s.group].push(s);
    });

    let html = '<h2 class="text-2xl font-extrabold text-gray-800 mt-6 mb-4 border-b pb-2">Group Standings</h2>';

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

    // Botón para pasar a Playoffs
    const allMatchesCompleted = matches.every(m => m.winner !== null);
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
    
    // Listener para el botón de playoffs
    if (allMatchesCompleted) {
        document.getElementById('btn-start-playoffs')?.addEventListener('click', () => {
            const standings = calculateStandings();
            generatePlayoffStructure(standings);
            renderMatches();
        });
    }
}

/**
 * Renderiza la clasificación final (solo después de la final de playoffs).
 */
function renderFinalStandings() {
    const finalMatch = playoffMatches.find(m => m.id === 'FINAL');
    
    if (finalMatch && finalMatch.winner) {
        const winner = finalMatch.winner;
        const loser = finalMatch.loser;
        
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

/**
 * Asocia los gestores de eventos a los elementos interactivos.
 */
function addEventListeners() {
    // Escuchar cambios en cualquier input de marcador
    document.querySelectorAll('.set-score-input').forEach(input => {
        input.removeEventListener('change', handleScoreChange); // Prevenir duplicados
        input.addEventListener('change', handleScoreChange);
    });
    
    // Escuchar clics en el botón de añadir set
    document.querySelectorAll('.btn-add-set').forEach(button => {
        button.removeEventListener('click', handleAddSet); // Prevenir duplicados
        button.addEventListener('click', handleAddSet);
    });
    
    // Botón principal de cambio de fase
    document.getElementById('btn-toggle-stage')?.removeEventListener('click', toggleStage);
    document.getElementById('btn-toggle-stage')?.addEventListener('click', toggleStage);

    // Botón de gestión de jugadores
    document.getElementById('btn-manage-players')?.removeEventListener('click', renderPlayerManagement);
    document.getElementById('btn-manage-players')?.addEventListener('click', renderPlayerManagement);
    
    // Guardar configuración
    document.getElementById('btn-save-settings')?.removeEventListener('click', handleSaveSettings);
    document.getElementById('btn-save-settings')?.addEventListener('click', handleSaveSettings);
}


/**
 * Generic handler for score change (works for both group and playoff matches)
 */
function handleScoreChange(event) {
    const input = event.target;
    const matchId = input.dataset.matchId;
    const pKey = input.dataset.player; 
    const setIndex = parseInt(input.dataset.setIndex);

    // Find the match
    let match = matches.find(m => m.id === matchId);
    const isPlayoff = !match;
    if (isPlayoff) {
        match = playoffMatches.find(m => m.id === matchId);
    }
    if (!match) return;
    
    // CORRECCIÓN CLAVE: VALIDACIÓN INICIAL PARA EVITAR EDICIÓN
    if (match.winner !== null) {
        // Si un usuario intenta editar un campo deshabilitado, forzamos la recarga del valor anterior.
        const prevValue = (pKey === 'p1' ? match.scores[setIndex][0] : match.scores[setIndex][1]) || '';
        input.value = prevValue;
        showStatus("⚠️ Cannot change score for a completed match.", "orange");
        // Aseguramos que el input esté realmente deshabilitado si por alguna razón no lo estaba
        input.disabled = true;
        return;
    }

    // Comprobar si el jugador es un placeholder y bloquear edición si lo es.
    const playerName = pKey === 'p1' ? match.p1 : match.p2;
    if (typeof playerName === 'string' && (playerName.startsWith('Winner') || playerName.startsWith('Loser'))) {
        const prevValue = (pKey === 'p1' ? match.scores[setIndex][0] : match.scores[setIndex][1]) || '';
        input.value = prevValue;
        showStatus(`🚫 Score cannot be entered for placeholder '${playerName}'.`, "orange");
        return;
    }


    let value = input.value.trim() === '' ? undefined : parseInt(input.value.trim());

    // Validar el valor
    const maxInputGames = maxGamesPerSet + 1;
    if (value !== undefined && (value < 0 || value > maxInputGames)) {
        showStatus(`Invalid game score. Must be between 0 and ${maxInputGames}.`, "red");
        input.value = '';
        value = undefined;
    }
    
    const scorePosition = pKey === 'p1' ? 0 : 1;
    
    // Inicializar el set si es necesario (debe ser un array)
    if (!match.scores[setIndex]) {
        match.scores[setIndex] = [undefined, undefined];
    }
    
    match.scores[setIndex][scorePosition] = value;
    
    // Check for match winner
    const matchResult = checkMatchWinner(match);
    match.winner = matchResult.winner;

    // Si se encuentra un ganador en un playoff, actualiza el siguiente partido
    if (match.winner && isPlayoff) {
        match.loser = match.winner === match.p1 ? match.p2 : match.p1;
        updateNextPlayoffMatch(match);
    }

    // Re-render the specific card (Esto asegura que los inputs se deshabiliten correctamente)
    reRenderMatchCard(match);
    
    if (match.winner) {
          showStatus(`🏆 Match complete! Winner: ${match.winner}`, "green");
    } else {
        showStatus(`📝 Score updated. Current sets: ${getSetsScoreString(match)}`, "indigo");
    }

    // Re-renderizar todo para actualizar posiciones/siguiente fase
    renderMatches();
    
    // Comprobar si la final de playoff ha terminado
    if (match.id === 'FINAL' && match.winner) {
        currentStep = 'finalStandings';
        renderMatches(); // Llama a renderFinalStandings
    }
    
    saveData(true);
}

/**
 * Gestiona el clic para añadir un nuevo set a un partido.
 */
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

    // Comprobar si el último set está vacío antes de añadir uno nuevo
    const lastSet = match.scores[match.scores.length - 1];
    if (lastSet[0] === undefined && lastSet[1] === undefined) {
        showStatus("Fill out the current set before adding a new one.", "orange");
        return;
    }
    
    // Añadir un nuevo set (inicializado con undefined para ambos jugadores)
    match.scores.push([undefined, undefined]);
    
    reRenderMatchCard(match);
    saveData(true);
}

/**
 * Cambia entre la fase de grupos y la fase eliminatoria.
 */
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


// --- 7. GESTIÓN DE JUGADORES/CONFIGURACIÓN ---

/**
 * Renderiza la interfaz de gestión de jugadores.
 */
function renderPlayerManagement() {
    const managementSection = document.getElementById('management-section');
    managementSection.classList.remove('hidden');
    matchesContainer.classList.add('hidden');
    standingsContainer.classList.add('hidden');
    playoffContainer.classList.add('hidden');
    
    let html = `
        <h2 class="text-3xl font-extrabold text-indigo-700 my-4 border-b pb-2">Tournament Settings & Players</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-gray-50 p-6 rounded-lg shadow">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Match Rules</h3>
                <div class="mb-4">
                    <label for="sets-to-win" class="block text-sm font-medium text-gray-700">Sets needed to win the match:</label>
                    <input type="number" id="sets-to-win" min="1" max="5" value="${maxSetsToWin}" class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                </div>
                <div class="mb-4">
                    <label for="games-per-set" class="block text-sm font-medium text-gray-700">Games required to win a set (must lead by 2):</label>
                    <input type="number" id="games-per-set" min="4" max="7" value="${maxGamesPerSet}" class="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                </div>
                <button id="btn-save-settings" class="w-full px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition">Save Rules & Settings</button>
            </div>

            <div class="bg-gray-50 p-6 rounded-lg shadow">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Manage Players (${players.length})</h3>
                <div class="flex mb-4">
                    <input type="text" id="player-name-input" placeholder="Player Name" class="flex-grow p-2 border border-gray-300 rounded-l-md shadow-sm">
                    <input type="text" id="player-group-input" placeholder="Group (A, B, C...)" class="w-24 p-2 border border-gray-300 shadow-sm">
                    <button id="btn-add-player" class="px-4 py-2 bg-indigo-600 text-white font-bold rounded-r-md hover:bg-indigo-700 transition">Add</button>
                </div>
                
                <ul id="player-list" class="space-y-2 max-h-64 overflow-y-auto pr-2">
                    ${players.map(p => `
                        <li class="flex justify-between items-center p-2 bg-white border border-gray-200 rounded-md shadow-sm">
                            <span class="font-medium">${p.name} (Group ${p.group})</span>
                            <button class="btn-remove-player text-red-500 hover:text-red-700 font-bold" data-player-name="${p.name}">Remove</button>
                        </li>
                    `).join('')}
                </ul>
            </div>
        </div>
        
        <div class="mt-8 text-center">
            <button id="btn-rebuild-matches" class="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition mr-4">
                ⚠️ Rebuild Matches (Resets scores!)
            </button>
            <button id="btn-back-to-matches" class="px-4 py-2 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition">
                Back to Matches
            </button>
        </div>
    `;

    managementSection.innerHTML = html;
    
    // Add Listeners para la sección de gestión
    document.getElementById('btn-add-player')?.addEventListener('click', handleAddPlayer);
    document.querySelectorAll('.btn-remove-player').forEach(btn => {
        btn.addEventListener('click', handleRemovePlayer);
    });
    document.getElementById('btn-rebuild-matches')?.addEventListener('click', handleRebuildMatches);
    document.getElementById('btn-back-to-matches')?.addEventListener('click', () => {
        managementSection.classList.add('hidden');
        matchesContainer.classList.remove('hidden');
        standingsContainer.classList.remove('hidden');
        playoffContainer.classList.remove('hidden');
        renderMatches();
    });
    document.getElementById('btn-save-settings')?.addEventListener('click', handleSaveSettings);
}

/**
 * Añade un nuevo jugador.
 */
function handleAddPlayer() {
    const name = document.getElementById('player-name-input').value.trim();
    const group = document.getElementById('player-group-input').value.trim().toUpperCase();

    if (name && group) {
        if (players.some(p => p.name === name)) {
            showStatus("Player name already exists.", "red");
            return;
        }
        players.push({ id: `p${players.length + 1}`, name: name, group: group, photoURL: null });
        document.getElementById('player-name-input').value = '';
        document.getElementById('player-group-input').value = '';
        saveData(true);
        renderPlayerManagement(); // Re-renderiza la lista
        showStatus(`Player ${name} added to Group ${group}.`, "blue");
    } else {
        showStatus("Please enter both Name and Group.", "red");
    }
}

/**
 * Elimina un jugador.
 */
function handleRemovePlayer(event) {
    const playerName = event.target.dataset.playerName;
    players = players.filter(p => p.name !== playerName);
    saveData(true);
    renderPlayerManagement();
    showStatus(`Player ${playerName} removed.`, "red");
}

/**
 * Reconstruye todos los partidos y reinicia los marcadores.
 */
function handleRebuildMatches() {
    if (confirm("WARNING: This will delete all current match scores and regenerate all group matches. Are you sure?")) {
        generateMatches();
        playoffMatches = [];
        currentStage = 'group';
        currentStep = 'groups';
        saveData(false);
        // Volver a la vista de partidos
        document.getElementById('management-section').classList.add('hidden');
        matchesContainer.classList.remove('hidden');
        standingsContainer.classList.remove('hidden');
        playoffContainer.classList.remove('hidden');
        renderMatches();
        showStatus("Matches rebuilt and scores reset.", "red");
    }
}

/**
 * Guarda la configuración de reglas del partido.
 */
function handleSaveSettings() {
    const newSetsToWin = parseInt(document.getElementById('sets-to-win').value);
    const newGamesPerSet = parseInt(document.getElementById('games-per-set').value);

    if (newSetsToWin >= 1 && newSetsToWin <= 5 && newGamesPerSet >= 4 && newGamesPerSet <= 7) {
        maxSetsToWin = newSetsToWin;
        maxGamesPerSet = newGamesPerSet;
        saveData(false);
        showStatus(`Match rules updated: Win by ${maxSetsToWin} sets, ${maxGamesPerSet} games per set.`, "green");
    } else {
        showStatus("Invalid rule settings. Sets (1-5), Games (4-7).", "red");
    }
}

// --- 8. INICIALIZACIÓN ---

function init() {
    loadData();
    // Inicializar listeners globales (que no dependen del renderizado de tarjetas)
    document.getElementById('btn-toggle-stage').addEventListener('click', toggleStage);
    document.getElementById('btn-manage-players').addEventListener('click', renderPlayerManagement);
    
    // Configurar el texto inicial del botón de fase
    document.getElementById('btn-toggle-stage').textContent = currentStage === 'group' ? '🚀 Go to Playoff Stage' : '⬅️ Back to Group Stage';

    renderMatches();
}

// Iniciar la aplicación
init();
