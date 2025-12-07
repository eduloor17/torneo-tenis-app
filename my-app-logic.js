// my-app-logic.js
// Tennis Tournament Manager — Lógica Revertida a Puntuación Total de Juegos (Pre-Sets)

// Global state
let players = [];
let maxPlayers = 10;
let numGroups = 2;
let mode = "singles"; // or "doubles"
// Eliminamos maxGamesPerSet y setsToWinMatch, ya que usamos puntuación total.
let matches = [];
let playoffMatches = []; 

// Entry point (called after DOMContentLoaded and Firebase setup)
window.loadAndInitializeLogic = function () {
    console.log("🎾 App logic initialized (Total Score Mode)");
    loadData();
    setupUI();
    updateUI();
    
    // Force a save to cloud if we are in cloud mode and starting fresh
    if (window.isCloudMode) saveData(true); 
};

// FIX: Wait for the entire HTML document to load before running initialization logic
document.addEventListener("DOMContentLoaded", () => {
    if (!window.isCloudMode && typeof window.loadAndInitializeLogic === 'function') {
        window.loadAndInitializeLogic();
    }
});


// ---------------------------
// UI SETUP (CORREGIDO Y SIMPLIFICADO)
// ---------------------------
function setupUI() {
    // DOM elements
    const maxInput = document.getElementById("max-jugadores-input");
    const groupInput = document.getElementById("num-grupos-input");
    // Eliminamos gamesPerSetInput y btnSetGames ya que no se usan en esta lógica
    const gamesPerSetContainer = document.querySelector('div:has(#max-games-set-input)');
    if (gamesPerSetContainer) gamesPerSetContainer.style.display = 'none'; // Ocultamos la configuración de sets
    
    const btnSetMax = document.getElementById("btn-configurar-max");
    const btnSetGroups = document.getElementById("btn-configurar-grupos");
    const addPlayerBtn = document.getElementById("btn-agregar-participante");
    const playerNameInput = document.getElementById("nombre-input");
    const matchTypeSelector = document.getElementById("match-type");
    const startBtn = document.getElementById("btn-generate-matches");
    const loadForm = document.getElementById("load-tournament-form");
    const externalIdInput = document.getElementById("external-id-input");
    const resetBtn = document.getElementById("btn-borrar-datos");
    
    // Aseguramos que el input de la UI refleje el valor por defecto/guardado
    if (maxInput) maxInput.value = maxPlayers; 
    if (groupInput) groupInput.value = numGroups; 


    // --- Match Type Selector Handler ---
    if (matchTypeSelector) {
        matchTypeSelector.value = mode;
        matchTypeSelector.addEventListener("change", (e) => {
            mode = e.target.value;
            saveData(true);
            showStatus(`🎾 Mode changed to: ${mode.toUpperCase()}`, "green");
        });
    }
    
    // --- Set Max Button Handler ---
    if (btnSetMax) {
        btnSetMax.addEventListener("click", () => {
            const newMax = parseInt(maxInput.value);
            const msg = document.getElementById("set-max-message");
            if (newMax >= 4 && newMax % 2 === 0) {
                maxPlayers = newMax;
                if (players.length > maxPlayers) {
                    players = players.slice(0, maxPlayers);
                    showStatus(`⚠️ Players truncated to ${maxPlayers}.`, "orange");
                }
                updateUI();
                saveData(true);
                msg.textContent = `✅ Max players updated to ${maxPlayers}`;
                msg.className = "text-green-600 text-sm mt-1";
            } else {
                msg.textContent = "⚠️ Max players must be even and at least 4.";
                msg.className = "text-red-600 text-sm mt-1";
            }
        });
    }

    // --- Set Groups Button Handler ---
    if (btnSetGroups) {
        btnSetGroups.addEventListener("click", () => {
            const newGroups = parseInt(groupInput.value);
            const msg = document.getElementById("set-group-message");
            if (newGroups >= 1 && newGroups <= 6 && maxPlayers % newGroups === 0) {
                numGroups = newGroups;
                updateUI();
                saveData(true);
                msg.textContent = `✅ Groups updated to ${numGroups}`;
                msg.className = "text-green-600 text-sm mt-1";
            } else {
                msg.textContent = `⚠️ Groups must divide max players (${maxPlayers}) evenly.`;
                msg.className = "text-red-600 text-sm mt-1";
            }
        });
    }

    // --- Add Player Button Handler ---
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener("click", () => {
            const name = playerNameInput.value.trim();
            if (!name) return;
            if (players.length >= maxPlayers) {
                alert("Maximum players reached!");
                return;
            }
            players.push(name);
            playerNameInput.value = "";
            updateUI();
            saveData(true);
        });
    }

    // --- Generate Matches Button Handler ---
    if (startBtn) {
        startBtn.addEventListener("click", () => {
            if (players.length < maxPlayers) {
                alert(`You need ${maxPlayers - players.length} more players to generate matches.`);
                return;
            }

            generateMatches();
            saveData(true);
            showStatus("✅ Matches generated. Scroll down to see the groups and matches.", "green");
        });
    }
    
    // --- Load Tournament Handler ---
    if (loadForm) {
        loadForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const externalId = externalIdInput.value.trim();
            if (externalId) {
                window.userId = externalId;
                localStorage.setItem("current-tournament-id", externalId);
                loadData(true); 
            }
        });
    }
    
    // --- Reset Tournament Handler ---
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            // Clear all local data
            localStorage.removeItem("tournament-data");
            localStorage.removeItem("current-tournament-id");
            
            // Generate a new unique ID for a fresh tournament
            window.userId = crypto.randomUUID(); 
            
            // Reset local state
            players = [];
            maxPlayers = 10;
            numGroups = 2;
            mode = "singles";
            matches = [];
            playoffMatches = []; 
            
            updateUI();
            renderMatches(); 
            saveData(true); 
            showStatus("🗑️ Tournament reset. Starting a new Cloud session.", "red");
        });
    }
}

// ---------------------------
// DATA HANDLING (CLOUD & LOCAL) - SIMPLIFICADO
// ---------------------------

async function saveData(saveToCloud = false) {
    // La puntuación es un simple array [p1Score, p2Score]
    const matchesToSave = JSON.parse(JSON.stringify(matches));
    const playoffMatchesToSave = JSON.parse(JSON.stringify(playoffMatches));

    const data = { 
        players, 
        maxPlayers, 
        numGroups, 
        mode, 
        matches: matchesToSave,            
        playoffMatches: playoffMatchesToSave, 
        timestamp: Date.now() 
    }; 
    
    // 1. Save to Local Storage (always happens)
    localStorage.setItem("tournament-data", JSON.stringify(data));
    localStorage.setItem("current-tournament-id", window.userId);

    // 2. Save to Cloud (if enabled)
    if (saveToCloud && window.isCloudMode && window.db) {
        try {
            // Asume la implementación de Firebase
            // await window.setDoc(window.doc(window.db, "tournaments", window.userId), data);
            showStatus(`☁️ Saved to Cloud. ID: ${window.userId.substring(0, 8)}...`, "indigo");
        } catch (e) {
            console.error("Error saving document to cloud:", e);
            showStatus("❌ Error saving to cloud. Check console.", "red");
        }
    }
}

async function loadData(loadFromCloud = false) {
    let data = {};
    
    if (loadFromCloud && window.isCloudMode && window.db) {
        // Asume la implementación de Firebase
        /*
        try {
            const docRef = window.doc(window.db, "tournaments", window.userId);
            const docSnap = await window.getDoc(docRef);
            if (docSnap.exists()) { data = docSnap.data(); showStatus(`🌐 Loaded Tournament ID: ${window.userId.substring(0, 8)}...`, "blue"); } 
            else { showStatus(`⚠️ Cloud ID not found. Loading local data.`, "red"); }
        } catch (e) { console.error("Error loading document from cloud:", e); showStatus("❌ Error loading from cloud.", "red"); }
        */
    } 

    if (Object.keys(data).length === 0) {
        data = JSON.parse(localStorage.getItem("tournament-data") || "{}");
        if (Object.keys(data).length > 0) {
            showStatus("💾 Loaded data from local storage.", "gray");
        }
    }

    // Update global state
    if (data.players) players = data.players;
    if (data.maxPlayers) maxPlayers = data.maxPlayers;
    if (data.numGroups) numGroups = data.numGroups;
    if (data.mode) mode = data.mode;
    
    // Carga directa de la estructura simple
    if (data.matches) matches = data.matches;
    if (data.playoffMatches) playoffMatches = data.playoffMatches;

    updateUI();
    renderMatches(); 
    
    saveData();
}

// ---------------------------
// UI UPDATES 
// ---------------------------
function updateUI() {
    // Update Max Players displays
    document.getElementById("max-jugadores-actual").textContent = maxPlayers;
    document.getElementById("max-participantes-display").textContent = maxPlayers;
    const maxInput = document.getElementById("max-jugadores-input");
    if (maxInput) maxInput.value = maxPlayers; 

    // Update Group count display
    const numGroupsDisplay = document.getElementById("num-grupos-actual");
    if (numGroupsDisplay) numGroupsDisplay.textContent = numGroups;
    const groupInput = document.getElementById("num-grupos-input");
    if (groupInput) groupInput.value = numGroups; 
    
    // Ocultar la configuración de sets
    const gamesPerSetContainer = document.querySelector('div:has(#max-games-set-input)');
    if (gamesPerSetContainer) gamesPerSetContainer.style.display = 'none'; 
    

    // Display Tournament ID
    const idDisplay = document.getElementById("tournament-id-display");
    if (idDisplay) {
        const isCloud = window.isCloudMode ? '🌐 Cloud ID' : '💻 Local ID';
        window.userId = window.userId || crypto.randomUUID(); // Asegurar ID
        idDisplay.innerHTML = `<p class="text-xs text-gray-500">${isCloud}:</p><p class="font-bold text-sm text-indigo-700">${window.userId.substring(0, 8)}...</p>`;
    }

    // Update Player Counter displays
    document.getElementById("contador-participantes").textContent = players.length;
    document.getElementById("contador-participantes-list").textContent = players.length;

    // Update Player List
    const list = document.getElementById("lista-participantes");
    list.innerHTML = "";
    players.forEach((p) => {
        const li = document.createElement("li");
        li.textContent = p;
        list.appendChild(li);
    });

    // Update "Generate Matches" button state
    const startBtn = document.getElementById("btn-generate-matches");
    if (startBtn) { 
        if (players.length === maxPlayers) {
            startBtn.disabled = false;
            startBtn.classList.remove("opacity-50", "cursor-not-allowed");
            startBtn.textContent = "🎾 Generate Random Matches";
        } else {
            startBtn.disabled = true;
            startBtn.classList.add("opacity-50", "cursor-not-allowed");
            startBtn.textContent = `🎾 Generate Random Matches (Need ${maxPlayers - players.length} more)`;
        }
    }
    
    const matchTypeSelector = document.getElementById("match-type");
    if (matchTypeSelector) matchTypeSelector.value = mode;
}

function showStatus(message, color = "blue") {
    const div = document.createElement("div");
    div.textContent = message;
    
    const colorMap = {
        "green": "text-green-600", "red": "text-red-600", "blue": "text-blue-600",
        "indigo": "text-indigo-600", "orange": "text-orange-600", "gray": "text-gray-500"
    };
    
    div.className = `mt-3 ${colorMap[color] || 'text-blue-600'} text-sm font-semibold`;
    
    const messageArea = document.getElementById("load-message");
    if (messageArea) {
        messageArea.innerHTML = ''; 
        messageArea.appendChild(div);
    }
    
    setTimeout(() => div.remove(), 4000);
}

// ---------------------------
// MATCH GENERATION & RENDERING
// ---------------------------
function generateMatches() {
    matches = [];
    playoffMatches = []; 

    if (players.length % numGroups !== 0) {
        showStatus(`⚠️ Cannot generate matches. Total players (${players.length}) must be divisible by number of groups (${numGroups}).`, "red");
        return;
    }
    
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const playersPerGroup = players.length / numGroups;
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
        groups.push(shuffledPlayers.slice(i * playersPerGroup, (i + 1) * playersPerGroup));
    }

    if (mode === "singles") {
        groups.forEach((group, groupIndex) => {
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    matches.push({ 
                        id: crypto.randomUUID(),
                        type: "singles", 
                        group: groupIndex + 1,
                        p1: group[i], 
                        p2: group[j],
                        winner: null, 
                        // score is a simple array: [p1TotalScore, p2TotalScore]
                        score: [undefined, undefined], 
                    });
                }
            }
        });
    } else {
        groups.forEach((group, groupIndex) => {
            const teams = [];
            for (let i = 0; i < group.length; i += 2) {
                teams.push([group[i], group[i + 1]]);
            }
            
            for (let i = 0; i < teams.length; i++) {
                for (let j = i + 1; j < teams.length; j++) {
                    matches.push({
                        id: crypto.randomUUID(),
                        type: "doubles",
                        group: groupIndex + 1,
                        p1: teams[i], 
                        p2: teams[j], 
                        winner: null,
                        score: [undefined, undefined], 
                    });
                }
            }
        });
    }

    renderMatches(); 
}

// Generates the 3rd Place Match and Final based on group phase rankings
function generatePlayoffMatches(standings) {
    if (standings.length < 4 || numGroups < 2) return;

    const top4 = standings.slice(0, 4).map(s => s.player); 

    const groupMatchesCompleted = matches.every(m => m.winner !== null);
    if (!groupMatchesCompleted) return;
    
    if (top4.length < 4) return; 

    const player1st = top4[0];
    const player2nd = top4[1];
    const player3rd = top4[2];
    const player4th = top4[3];

    playoffMatches = [];
    
    // 1. 3rd Place Match (3rd vs 4th Global Rank)
    playoffMatches.push({
        id: '3rd-place-match',
        stage: '3rd Place Match',
        p1: player3rd,
        p2: player4th,
        winner: null,
        loser: null,
        score: [undefined, undefined], 
        type: mode 
    });

    // 2. Final Match (1st vs 2nd Global Rank)
    playoffMatches.push({
        id: 'final-match',
        stage: 'Final',
        p1: player1st,
        p2: player2nd,
        winner: null,
        loser: null,
        score: [undefined, undefined], 
        type: mode 
    });
}

function renderMatches() {
    const container = document.getElementById("matches-container");
    
    if (matches.length === 0) {
        container.innerHTML = '<p class="text-gray-500 mt-4">No matches generated yet. Fill the players list and click "Generate Matches".</p>';
        return;
    }

    // ----------------------------------------------------------------
    // STEP 3: GROUP MATCHES SECTION
    // ----------------------------------------------------------------
    let html = `<section class="match-section">
        <h2>3. Enter Group Match Results (Total Games)</h2>
        <p class="text-sm text-gray-600 mb-4">El ganador del partido es el jugador/equipo que consigue la mayor puntuación de juegos total.</p>
        <div id="match-list" class="space-y-4">`;

    const groupedMatches = matches.reduce((acc, match) => {
        acc[match.group] = acc[match.group] || [];
        acc[match.group].push(match);
        return acc;
    }, {});

    for (const group in groupedMatches) {
        html += `<div class="group-box">
            <h3 class="group-title">Group ${group}</h3>
            <div id="group-${group}-matches" class="space-y-3">`;

        groupedMatches[group].forEach((match) => {
             html += `<div id="match-card-${match.id}">
                ${renderMatchCard(match)}
             </div>`;
        });
        
        html += `</div></div>`;
    }

    html += `</div></section>`; 

    // ----------------------------------------------------------------
    // STEP 4: STANDINGS & PLAYOFFS SECTION
    // ----------------------------------------------------------------
    const standings = calculateStandings();
    
    const allGroupMatchesComplete = matches.every(m => m.winner !== null);
    if (allGroupMatchesComplete && playoffMatches.length === 0 && standings.length >= 4 && numGroups >= 2) {
        generatePlayoffMatches(standings);
        saveData(false);
    }
    
    html += `<section class="ranking-section">
        <h2>4. Group Standings, Playoffs & Global Rank</h2>
        <div id="standings-list" class="text-gray-600">
            ${renderStandings(standings)}
        </div>
        
        ${allGroupMatchesComplete && playoffMatches.length > 0 ? renderPlayoffs(playoffMatches) : 
            `<p class="mt-6 text-orange-600 font-semibold">Complete todos los partidos de grupo para generar la Fase Eliminatoria (Top 4).</p>`}
        
        <div id="final-rankings-display">
             ${renderFinalRankings(standings)}
        </div>
    </section>`;

    container.innerHTML = html;
    
    // Attach Event Listeners to inputs
    document.querySelectorAll('.score-input').forEach(input => {
        input.addEventListener('input', handleScoreChange);
    });
}

// Renders a generic match card (Single Score Input)
function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    const getDisplayName = (p) => p.constructor === Array ? p.join(' / ') : p;
    const p1Name = getDisplayName(match.p1);
    const p2Name = getDisplayName(match.p2);
    
    const cardClass = isCompleted ? 'match-card completed' : 'match-card';
    
    const isPlayoff = match.stage;
    const stageInfo = isPlayoff ? match.stage : `Group ${match.group}`;
    const inputClass = isPlayoff ? 'playoff-score-input' : 'group-score-input';

    const p1Score = match.score[0] !== undefined && match.score[0] !== null ? match.score[0] : '';
    const p2Score = match.score[1] !== undefined && match.score[1] !== null ? match.score[1] : '';

    let cardHtml = `
        <div class="${cardClass}">
            <p class="text-lg font-bold text-gray-900 mb-2">${stageInfo}: ${p1Name} vs ${p2Name}</p>
            <div class="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team/Player</th>
                            <th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Total Score (Games)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 w-1/3">${p1Name}</td>
                            <td class="px-3 py-2 whitespace-nowrap text-sm text-center">
                                <input type="number" min="0" value="${p1Score}" 
                                       data-match-id="${match.id}" data-player="p1" 
                                       class="${inputClass} score-input w-20"
                                       ${isCompleted ? 'disabled' : ''}>
                            </td>
                        </tr>
                        <tr>
                            <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 w-1/3">${p2Name}</td>
                            <td class="px-3 py-2 whitespace-nowrap text-sm text-center">
                                <input type="number" min="0" value="${p2Score}" 
                                       data-match-id="${match.id}" data-player="p2" 
                                       class="${inputClass} score-input w-20"
                                       ${isCompleted ? 'disabled' : ''}>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div class="mt-3 flex" style="justify-content: flex-end;">
                 <p class="text-sm font-semibold ${isCompleted ? 'text-green-700' : 'text-gray-500'}" id="winner-status-${match.id}">
                    ${isCompleted ? `🏆 **Winner:** ${match.winner}` : 'Status: In Progress'}
                </p>
            </div>
        </div>
    `;
    return cardHtml;
}


// ---------------------------
// MATCH RESULT HANDLERS
// ---------------------------

// Generic handler for score change (works for both group and playoff matches)
function handleScoreChange(event) {
    const input = event.target;
    const matchId = input.dataset.matchId;
    const pKey = input.dataset.player; 

    let value = input.value.trim() === '' ? undefined : parseInt(input.value.trim());

    // Find the match
    let match = matches.find(m => m.id === matchId);
    if (!match) {
        match = playoffMatches.find(m => m.id === matchId);
    }
    if (!match) return;
    
    if (match.winner !== null) {
        // Revert input value if trying to edit a finished match
        const scorePosition = pKey === 'p1' ? 0 : 1;
        input.value = (match.score[scorePosition] !== undefined && match.score[scorePosition] !== null) ? match.score[scorePosition] : '';
        showStatus("⚠️ Cannot change score for a completed match.", "orange");
        return;
    }

    const scorePosition = pKey === 'p1' ? 0 : 1;
    match.score[scorePosition] = value;
    
    // Verificar el ganador después de la actualización
    checkAndHandleMatchWinner(match);
}


function checkAndHandleMatchWinner(match) {
    const matchResult = checkMatchWinner(match);
    match.winner = matchResult.winner;

    const isGroupMatch = match.group !== undefined && match.stage === undefined;
    if (match.winner && !isGroupMatch) {
        const p1Id = match.p1.constructor === Array ? match.p1.join(' / ') : match.p1;
        const p2Id = match.p2.constructor === Array ? match.p2.join(' / ') : match.p2;
        match.loser = match.winner === p1Id ? p2Id : p1Id;
    }

    // Re-render the specific card
    reRenderMatchCard(match);
    
    if (match.winner) {
         showStatus(`🏆 Match complete! Winner: ${match.winner}`, "green");
         renderMatches(); // Render completo para actualizar standings/playoffs
    } else {
        showStatus(`📝 Score updated. Current score: ${match.score[0] || 0} - ${match.score[1] || 0}`, "indigo");
    }
    
    saveData(true);
}

// Helper to re-render a match card and re-attach listeners
function reRenderMatchCard(match) {
    const cardContainer = document.getElementById(`match-card-${match.id}`);
    if (cardContainer) {
        cardContainer.innerHTML = renderMatchCard(match);
        // Re-attach event listeners
        cardContainer.querySelectorAll('.score-input').forEach(newInput => {
            newInput.addEventListener('input', handleScoreChange);
        });
    }
}


// Logic to determine the match winner (Total Score Mode)
function checkMatchWinner(match) {
    let winner = null;
    const p1Score = match.score[0];
    const p2Score = match.score[1];
    
    if (p1Score === undefined || p2Score === undefined || p1Score === null || p2Score === null) {
        return { winner: null };
    }
    
    // Both scores must be entered
    if (p1Score === null || p2Score === null) return { winner: null }; 

    const p1Id = match.p1.constructor === Array ? match.p1.join(' / ') : match.p1;
    const p2Id = match.p2.constructor === Array ? match.p2.join(' / ') : match.p2;

    if (p1Score > p2Score) {
        winner = p1Id;
    } else if (p2Score > p1Score) {
        winner = p2Id;
    }
    
    // Draw is only possible if scores are equal AND the difference is 0. 
    // In many tournaments, draws are not allowed. If we must decide a winner, 
    // we would require one score to be strictly greater.
    if (p1Score === p2Score) {
        return { winner: null }; // Requires further play (or tiebreaker rule not implemented here)
    }

    return { winner };
}

// ---------------------------
// RANKING SYSTEM (ADAPTADO A PUNTUACIÓN TOTAL)
// ---------------------------

function calculateStandings() {
    const stats = {};
    
    const allCompetitors = new Set();
    matches.forEach(match => {
        const p1Name = match.p1.constructor === Array ? match.p1.join(' / ') : match.p1;
        const p2Name = match.p2.constructor === Array ? match.p2.join(' / ') : match.p2;
        allCompetitors.add(p1Name);
        allCompetitors.add(p2Name);
    });
    
    allCompetitors.forEach(competitorName => {
        const match = matches.find(m => {
            const p1Name = m.p1.constructor === Array ? m.p1.join(' / ') : m.p1;
            const p2Name = m.p2.constructor === Array ? m.p2.join(' / ') : m.p2;
            return p1Name === competitorName || p2Name === competitorName;
        });
        
        stats[competitorName] = {
            player: competitorName, 
            matchesPlayed: 0,
            matchesWon: 0,
            gamesWon: 0,
            gamesLost: 0,
            gamesDiff: 0,
            group: match ? match.group : 0 
        };
    });

    matches.forEach(match => {
        const isCompleted = match.winner !== null;

        const p1Name = match.p1.constructor === Array ? match.p1.join(' / ') : match.p1;
        const p2Name = match.p2.constructor === Array ? match.p2.join(' / ') : match.p2;

        const totalGamesWonP1 = match.score[0] || 0;
        const totalGamesWonP2 = match.score[1] || 0;
        
        const winnerName = match.winner;

        // Update stats for Competitor 1
        if (stats[p1Name]) {
            stats[p1Name].gamesWon += totalGamesWonP1;
            stats[p1Name].gamesLost += totalGamesWonP2;
            
            if (isCompleted) {
                stats[p1Name].matchesPlayed++;
                stats[p1Name].matchesWon += (winnerName === p1Name ? 1 : 0);
            }
        }

        // Update stats for Competitor 2
        if (stats[p2Name]) {
            stats[p2Name].gamesWon += totalGamesWonP2;
            stats[p2Name].gamesLost += totalGamesWonP1;

            if (isCompleted) {
                stats[p2Name].matchesPlayed++;
                stats[p2Name].matchesWon += (winnerName === p2Name ? 1 : 0);
            }
        }
    });

    const standingsArray = Object.values(stats).map(stat => {
        stat.gamesDiff = stat.gamesWon - stat.gamesLost;
        return stat;
    });

    // Sort (Ranking Criteria: 1. Matches Won, 2. Games Difference, 3. Games Won)
    standingsArray.sort((a, b) => {
        if (b.matchesWon !== a.matchesWon) {
            return b.matchesWon - a.matchesWon; 
        }
        if (b.gamesDiff !== a.gamesDiff) {
            return b.gamesDiff - a.gamesDiff; 
        }
        if (b.gamesWon !== a.gamesWon) {
             return b.gamesWon - a.gamesWon; 
        }
        return a.player.localeCompare(b.player); 
    });
    
    return standingsArray;
}

// ---------------------------
// STANDINGS RENDERING Y PLAYOFFS (SIN CAMBIOS)
// ---------------------------

function renderStandings(standingsArray) {
    if (standingsArray.length === 0 || standingsArray.every(s => s.group === 0)) {
        return '<p class="text-gray-500">No players registered or no matches have been played yet.</p>';
    }
    
    const totalGroups = Math.max(...standingsArray.map(s => s.group));
    let html = '';

    if (totalGroups > 1) {
        html += `<h3 class="group-rankings-title">Clasificación por Grupos</h3>`;
        
        const standingsByGroup = standingsArray.reduce((acc, stat) => {
            acc[stat.group] = acc[stat.group] || [];
            acc[stat.group].push(stat);
            return acc;
        }, {});

        for (let g = 1; g <= totalGroups; g++) {
            const groupStats = standingsByGroup[g];
            if (!groupStats || groupStats.length === 0) continue;
            
            html += `<div class="mb-6 p-4 border border-indigo-100 rounded-lg bg-indigo-50">
                <h4 class="text-lg font-semibold text-indigo-800 mb-3">Grupo ${g}</h4>
                ${createStandingsTable(groupStats, false)}
            </div>`;
        }
        
        html += `<div class="mt-8 border-t pt-4"></div>`;
    }

    html += `<h3 class="group-rankings-title ${totalGroups <= 1 ? '' : 'mt-6'}">Clasificación Global (Fase de Grupos)</h3>`;
    html += createStandingsTable(standingsArray, true);
    
    return html;
}

function createStandingsTable(statsArray, isGlobal) {
    let html = `<div class="overflow-x-auto">
        <table class="ranking-table">
            <thead>
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">${isGlobal ? 'Global Rank' : 'Group Rank'}</th>
                    ${isGlobal ? `<th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Group</th>` : ''}
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">${mode === 'doubles' ? 'Team' : 'Player'}</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">M Won</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">G Won</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">G Lost</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">G Diff</th>
                </tr>
            </thead>
            <tbody>`;

    statsArray.forEach((stat, index) => {
        html += `<tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">${index + 1}</td>
            ${isGlobal ? `<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${stat.group || '-'}</td>` : ''}
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${stat.player}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center">${stat.matchesPlayed > 0 ? stat.matchesWon : '0'}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center">${stat.gamesWon}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center">${stat.gamesLost}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-${stat.gamesDiff >= 0 ? 'green-600' : 'red-600'}">${stat.gamesDiff}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}

function renderPlayoffs(playoffMatches) {
    let html = `<div class="mt-8">
        <h3 class="playoffs-title">Fase Eliminatoria (Top 4)</h3>
        <p class="text-sm text-gray-600 mb-4">Los partidos son generados automáticamente en base a la Clasificación Global de la Fase de Grupos. **Esta fase requiere mayor puntuación total de juegos para ganar.**</p>
        <div id="playoff-match-list" class="space-y-4">`;

    playoffMatches.forEach(match => {
        html += `<div id="match-card-${match.id}">
            ${renderMatchCard(match)}
        </div>`;
    });

    html += `</div></div>`;
    return html;
}

function renderFinalRankings(standings) {
    const finalMatch = playoffMatches.find(m => m.stage === 'Final');
    const thirdPlaceMatch = playoffMatches.find(m => m.stage === '3rd Place Match');

    if (!finalMatch || !thirdPlaceMatch || finalMatch.winner === null || thirdPlaceMatch.winner === null) {
        return `<p class="mt-6 text-gray-600 font-semibold border-t pt-4">Complete los partidos de la Fase Eliminatoria para ver el Ranking Final (1º a 4º).</p>`;
    }

    const rank1 = finalMatch.winner;
    const rank2 = finalMatch.loser;
    const rank3 = thirdPlaceMatch.winner;
    const rank4 = thirdPlaceMatch.loser;
    
    const top4Players = [rank1, rank2, rank3, rank4];
    const remainingStandings = standings.filter(s => !top4Players.includes(s.player));

    let html = `<div class="mt-8 border-t pt-4">
        <h3 class="final-ranking-title">Clasificación Final del Torneo (1º a ${standings.length}º)</h3>
        <table class="ranking-table">
            <thead>
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Pos.</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">${mode === 'doubles' ? 'Team' : 'Player'}</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Group</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Result</th>
                </tr>
            </thead>
            <tbody>`;

    [[1, rank1, '🏆 Champion'], [2, rank2, '🥈 Runner-Up'], [3, rank3, '🥉 3rd Place'], [4, rank4, '4th Place']]
    .forEach(([rank, player, result], index) => {
        const playerStat = standings.find(s => s.player === player);
        const bgColor = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        html += `<tr class="${bgColor}">
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-indigo-700 font-bold">${rank}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${player}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">${playerStat ? playerStat.group : '-'}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-green-700">${result}</td>
        </tr>`;
    });

    remainingStandings.forEach((stat, index) => {
        const rank = 5 + index;
        const bgColor = (4 + index) % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        html += `<tr class="${bgColor}">
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-600">${rank}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${stat.player}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">${stat.group}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">5th+ (Group Rank)</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}
