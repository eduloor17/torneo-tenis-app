// my-app-logic.js
// Tennis Tournament Manager — Logic Layer (Sets, Quick Win Buttons, y Configuración Corregida)

// Global state
let players = [];
let maxPlayers = 10;
let numGroups = 2;
let mode = "singles"; // or "doubles"
let maxGamesPerSet = 6; // Máximo de juegos por set por defecto es 6 (Pro Set)
let setsToWinMatch = 2; // 2 sets para ganar TODOS los partidos
let matches = [];
let playoffMatches = []; 

// Entry point (called after DOMContentLoaded and Firebase setup)
window.loadAndInitializeLogic = function () {
    console.log("🎾 App logic initialized");
    loadData();
    setupUI();
    updateUI();
    
    // Force a save to cloud if we are in cloud mode and starting fresh
    if (window.isCloudMode) saveData(true); 
};

// FIX: Wait for the entire HTML document to load before running initialization logic
document.addEventListener("DOMContentLoaded", () => {
    // Only run loadAndInitializeLogic here if we are NOT in cloud mode (i.e., no Firebase setup needed)
    // If in cloud mode, it's called after Firebase initialization completes.
    if (!window.isCloudMode && typeof window.loadAndInitializeLogic === 'function') {
        window.loadAndInitializeLogic();
    }
});


// ---------------------------
// UI SETUP (CORREGIDO PARA CONFIGURACIÓN)
// ---------------------------
function setupUI() {
    // DOM elements
    const maxInput = document.getElementById("max-jugadores-input");
    const groupInput = document.getElementById("num-grupos-input");
    const gamesPerSetInput = document.getElementById("max-games-set-input"); 
    const btnSetMax = document.getElementById("btn-configurar-max");
    const btnSetGroups = document.getElementById("btn-configurar-grupos");
    const btnSetGames = document.getElementById("btn-configurar-juegos"); 
    const addPlayerBtn = document.getElementById("btn-agregar-participante");
    const playerNameInput = document.getElementById("nombre-input");
    const matchTypeSelector = document.getElementById("match-type");
    const startBtn = document.getElementById("btn-generate-matches");
    const loadForm = document.getElementById("load-tournament-form");
    const externalIdInput = document.getElementById("external-id-input");
    const resetBtn = document.getElementById("btn-borrar-datos");
    
    // Aseguramos que el input de la UI refleje el valor por defecto/guardado (CORRECCIÓN)
    if (gamesPerSetInput) gamesPerSetInput.value = maxGamesPerSet;
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
    
    // --- Set Games Per Set Button Handler (NEW) ---
    if (btnSetGames) {
        btnSetGames.addEventListener("click", () => {
            const newMaxGames = parseInt(gamesPerSetInput.value);
            const msg = document.getElementById("set-games-message");
            if (newMaxGames >= 4 && newMaxGames % 2 === 0) {
                maxGamesPerSet = newMaxGames;
                updateUI();
                saveData(true);
                msg.textContent = `✅ Max games per set updated to ${maxGamesPerSet}`;
                msg.className = "text-green-600 text-sm mt-1";
            } else {
                msg.textContent = "⚠️ Max games must be even and at least 4.";
                msg.className = "text-red-600 text-sm mt-1";
            }
        });
    }

    // --- Set Max Button Handler (CORRECCIÓN) ---
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
                updateUI(); // ¡CRUCIAL! Para actualizar los contadores y la lista
                saveData(true);
                msg.textContent = `✅ Max players updated to ${maxPlayers}`;
                msg.className = "text-green-600 text-sm mt-1";
            } else {
                msg.textContent = "⚠️ Max players must be even and at least 4.";
                msg.className = "text-red-600 text-sm mt-1";
            }
        });
    }

    // --- Set Groups Button Handler (CORRECCIÓN) ---
    if (btnSetGroups) {
        btnSetGroups.addEventListener("click", () => {
            const newGroups = parseInt(groupInput.value);
            const msg = document.getElementById("set-group-message");
            if (newGroups >= 1 && newGroups <= 6 && maxPlayers % newGroups === 0) {
                numGroups = newGroups;
                updateUI(); // ¡CRUCIAL! Para actualizar la UI
                saveData(true);
                msg.textContent = `✅ Groups updated to ${numGroups}`;
                msg.className = "text-green-600 text-sm mt-1";
            } else {
                msg.textContent = `⚠️ Groups must divide max players (${maxPlayers}) evenly.`;
                msg.className = "text-red-600 text-sm mt-1";
            }
        });
    }

    // --- Add Player Button Handler (CORRECCIÓN) ---
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
            updateUI(); // ¡CRUCIAL! Para actualizar el contador y la lista
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
            maxGamesPerSet = 6; 
            setsToWinMatch = 2; 
            matches = [];
            playoffMatches = []; 
            
            updateUI();
            renderMatches(); // Clear match display
            saveData(true); 
            showStatus("🗑️ Tournament reset. Starting a new Cloud session.", "red");
        });
    }
}

// ---------------------------
// DATA HANDLING (CLOUD & LOCAL)
// ---------------------------

async function saveData(saveToCloud = false) {
    // Deep copy and transform matches for Firebase compatibility (convert [p1, p2] array to "p1-p2" string)
    const matchesToSave = JSON.parse(JSON.stringify(matches)).map(m => {
        m.scores = m.scores.map(setScore => {
            // Convert set score array [p1Games, p2Games] to a string "p1Games-p2Games"
            // Handle undefined or null scores (for unplayed sets)
            const p1 = (setScore[0] !== undefined && setScore[0] !== null) ? setScore[0] : '';
            const p2 = (setScore[1] !== undefined && setScore[1] !== null) ? setScore[1] : '';
            return `${p1}-${p2}`;
        });
        return m;
    });
    
    // Deep copy and transform playoffMatches
    const playoffMatchesToSave = JSON.parse(JSON.stringify(playoffMatches)).map(m => {
        m.scores = m.scores.map(setScore => {
            const p1 = (setScore[0] !== undefined && setScore[0] !== null) ? setScore[0] : '';
            const p2 = (setScore[1] !== undefined && setScore[1] !== null) ? setScore[1] : '';
            return `${p1}-${p2}`;
        });
        return m;
    });

    const data = { 
        players, 
        maxPlayers, 
        numGroups, 
        mode, 
        maxGamesPerSet, 
        setsToWinMatch, 
        matches: matchesToSave,             // Usar la versión compatible
        playoffMatches: playoffMatchesToSave, // Usar la versión compatible
        timestamp: Date.now() 
    }; 
    
    // 1. Save to Local Storage (always happens)
    localStorage.setItem("tournament-data", JSON.stringify(data));
    localStorage.setItem("current-tournament-id", window.userId);

    // 2. Save to Cloud (if enabled)
    if (saveToCloud && window.isCloudMode && window.db) {
        try {
            // This is where the Firebase call happens with the compatible data structure
            await window.setDoc(window.doc(window.db, "tournaments", window.userId), data);
            showStatus(`☁️ Saved to Cloud. ID: ${window.userId.substring(0, 8)}...`, "indigo");
        } catch (e) {
            console.error("Error saving document to cloud:", e);
            showStatus("❌ Error saving to cloud. Check console. Did you enable Firestore?", "red");
        }
    }
}

async function loadData(loadFromCloud = false) {
    let data = {};
    
    if (loadFromCloud && window.isCloudMode && window.db) {
        // Attempt to load from Cloud
        try {
            const docRef = window.doc(window.db, "tournaments", window.userId);
            const docSnap = await window.getDoc(docRef);
            
            if (docSnap.exists()) {
                data = docSnap.data();
                showStatus(`🌐 Loaded Tournament ID: ${window.userId.substring(0, 8)}...`, "blue");
            } else {
                showStatus(`⚠️ Cloud ID '${window.userId.substring(0, 8)}...' not found. Loading local data.`, "red");
            }
        } catch (e) {
            console.error("Error loading document from cloud:", e);
            showStatus("❌ Error loading from cloud. Check console.", "red");
        }
    } 

    // If cloud load failed or we are in local mode, load from local storage
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
    
    // FIX: Doble verificación para asegurar que maxGamesPerSet es un número válido.
    const loadedMaxGames = data.maxGamesPerSet;
    if (typeof loadedMaxGames === 'number' && loadedMaxGames >= 4) {
        maxGamesPerSet = loadedMaxGames;
    } else {
        maxGamesPerSet = 6; // Default fallback to 6
    }
    
    // Forzar a 2 sets si se está cargando un valor antiguo (1)
    setsToWinMatch = data.setsToWinMatch !== undefined && data.setsToWinMatch >= 1 ? data.setsToWinMatch : 2; 

    // --- REVERTIR LA TRANSFORMACIÓN DE SCORES (Convertir "p1-p2" string a [p1, p2] array) ---
    const transformScores = (dataMatches) => {
        return dataMatches.map(m => {
            m.scores = m.scores.map(setScoreString => {
                const parts = setScoreString.split('-');
                // Convert to number or undefined if empty string
                const p1Games = parts[0] !== '' ? parseInt(parts[0]) : undefined;
                const p2Games = parts[1] !== '' ? parseInt(parts[1]) : undefined;
                return [p1Games, p2Games];
            });
            return m;
        });
    };
    
    if (data.matches) {
        matches = transformScores(data.matches);
    }

    if (data.playoffMatches) {
        playoffMatches = transformScores(data.playoffMatches);
    }
    // ---------------------------------------------

    updateUI();
    renderMatches(); 
    
    // Save back to ensure local storage reflects the current cloud/local state
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
    if (maxInput) maxInput.value = maxPlayers; // Asegura que el input refleje el valor

    // Update Group count display
    const numGroupsDisplay = document.getElementById("num-grupos-actual");
    if (numGroupsDisplay) numGroupsDisplay.textContent = numGroups;
    const groupInput = document.getElementById("num-grupos-input");
    if (groupInput) groupInput.value = numGroups; // Asegura que el input refleje el valor
    
    // Update Max Games Per Set display (NEW)
    const maxGamesDisplay = document.getElementById("max-games-set-actual");
    if (maxGamesDisplay) maxGamesDisplay.textContent = maxGamesPerSet;
    const gamesPerSetInput = document.getElementById("max-games-set-input");
    if (gamesPerSetInput) gamesPerSetInput.value = maxGamesPerSet; // Ensure input field also reflects current value

    // Display Tournament ID
    const idDisplay = document.getElementById("tournament-id-display");
    if (idDisplay) {
        const isCloud = window.isCloudMode ? '🌐 Cloud ID' : '💻 Local ID';
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
    
    // Update match type selector
    const matchTypeSelector = document.getElementById("match-type");
    if (matchTypeSelector) matchTypeSelector.value = mode;
}

function showStatus(message, color = "blue") {
    const div = document.createElement("div");
    div.textContent = message;
    
    // Convert Tailwind classes to standard CSS classes/styles if necessary, 
    // or rely on the provided CSS file's definitions.
    // Assuming the provided CSS covers these colors:
    const colorMap = {
        "green": "text-green-600",
        "red": "text-red-600",
        "blue": "text-blue-600",
        "indigo": "text-indigo-600",
        "orange": "text-orange-600",
        "gray": "text-gray-500"
    };
    
    div.className = `mt-3 ${colorMap[color] || 'text-blue-600'} text-sm font-semibold`;
    
    // Get the element where messages are displayed (Load Message area)
    const messageArea = document.getElementById("load-message");
    if (messageArea) {
        messageArea.innerHTML = ''; // Clear previous message
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
    
    // Establecer a 2 sets para ganar en TODOS los partidos
    setsToWinMatch = 2;
    saveData(false); // Update local setting

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
                        // scores is an array of set scores [ [p1_set1, p2_set1], ... ]
                        scores: [[undefined, undefined]], 
                    });
                }
            }
        });
    } else {
        groups.forEach((group, groupIndex) => {
            const teams = [];
            // Group players into teams of 2
            for (let i = 0; i < group.length; i += 2) {
                teams.push([group[i], group[i + 1]]);
            }
            
            // Generate matches between teams
            for (let i = 0; i < teams.length; i++) {
                for (let j = i + 1; j < teams.length; j++) {
                    matches.push({
                        id: crypto.randomUUID(),
                        type: "doubles",
                        group: groupIndex + 1,
                        p1: teams[i], // Array of 2 players
                        p2: teams[j], // Array of 2 players
                        winner: null,
                        // scores is an array of set scores
                        scores: [[undefined, undefined]], 
                    });
                }
            }
        });
    }

    renderMatches(); 
}

// Generates the 3rd Place Match and Final based on group phase rankings (using team names)
function generatePlayoffMatches(standings) {
    if (standings.length < 4 || numGroups < 2) return;

    const top4 = standings.slice(0, 4).map(s => s.player); 

    if (top4.length < 4) return; 

    const groupMatchesCompleted = matches.every(m => m.winner !== null);
    if (!groupMatchesCompleted) return;
    
    // El setsToWinMatch ya está establecido en 2
    saveData(false); // Update local setting

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
        scores: [[undefined, undefined]], // Initialize with one set
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
        scores: [[undefined, undefined]], // Initialize with one set
        type: mode 
    });
}

function renderMatches() {
    const container = document.getElementById("matches-container");
    
    if (matches.length === 0) {
        container.innerHTML = '<p class="text-gray-500 mt-4">No matches generated yet. Fill the players list and click "Generate Matches".</p>';
        document.getElementById("standings-list").innerHTML = '<p class="text-gray-500">No players registered or no matches have been played yet.</p>';
        return;
    }

    // ----------------------------------------------------------------
    // STEP 3: GROUP MATCHES SECTION
    // ----------------------------------------------------------------
    let html = `<section class="match-section">
        <h2>3. Enter Group Match Results (Best of 3 Sets)</h2>
        <p class="text-sm text-gray-600 mb-4">A set is won by the first player to reach **${maxGamesPerSet} games** with a two-game lead. If tied at **${maxGamesPerSet - 1}-${maxGamesPerSet - 1}**, a tiebreak is played, and the final score will be **${maxGamesPerSet}-${maxGamesPerSet - 1}**. **All matches are decided by winning 2 sets.**</p>
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
    document.querySelectorAll('.set-score-input').forEach(input => {
        input.addEventListener('input', handleScoreChange);
    });
    
    // Attach Event Listeners to "Add Set" button
    document.querySelectorAll('.btn-add-set').forEach(button => {
        button.addEventListener('click', handleAddSet);
    });
    
    // *** Attach Event Listeners to "Quick Win" buttons ***
    document.querySelectorAll('.btn-quick-set-win').forEach(button => {
        button.addEventListener('click', handleQuickSetWin);
    });
}

// Renders a generic match card (Set/Game Inputs)
function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    const getDisplayName = (p) => p.constructor === Array ? p.join(' / ') : p;
    const p1Name = getDisplayName(match.p1);
    const p2Name = getDisplayName(match.p2);
    
    const cardClass = isCompleted ? 'match-card completed' : 'match-card';
    
    const isPlayoff = match.stage;
    const stageInfo = isPlayoff ? match.stage : `Group ${match.group}`;
    const inputClass = isPlayoff ? 'playoff-set-input' : 'group-set-input';

    // Determinar el índice del set actual (último set no completado)
    let currentSetIndex = match.scores.length - 1;
    // Buscamos si el último set ya está completo para determinar si se necesita el siguiente set
    let lastSetFinished = match.scores.length > 0 && checkSetWinner(match.scores[match.scores.length - 1]) !== null;

    // Si el último set está acabado, el 'currentSetIndex' debe apuntar al siguiente set que AÚN NO EXISTE.
    // Si el último set NO está acabado, el 'currentSetIndex' apunta al set actual.
    // Para renderizar correctamente, solo necesitamos saber si el último set existente está acabado para habilitar el botón "+Add Set".
    
    const isCurrentSetFinished = lastSetFinished;
    const disableQuickWin = isCompleted || isCurrentSetFinished;
    const currentSetIdxToRenderQuickWin = isCurrentSetFinished ? match.scores.length : match.scores.length - 1;


    let cardHtml = `
        <div class="${cardClass}">
            <p class="text-lg font-bold text-gray-900 mb-2">${stageInfo}: ${p1Name} vs ${p2Name}</p>
            <div class="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team/Player</th>
                            ${match.scores.map((_, index) => 
                                `<th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Set ${index + 1}</th>`
                            ).join('')}
                            <th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Total Games Won</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${renderSetScoreRow(match, 'p1', p1Name, inputClass, disableQuickWin, currentSetIdxToRenderQuickWin)}
                        ${renderSetScoreRow(match, 'p2', p2Name, inputClass, disableQuickWin, currentSetIdxToRenderQuickWin)}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-3 flex">
                 <button class="btn-add-set ${isCompleted || !isCurrentSetFinished ? 'disabled' : ''}" 
                        data-match-id="${match.id}" ${isCompleted || !isCurrentSetFinished ? 'disabled' : ''}>
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

// Helper to render one row in the score table (Multiple Sets)
function renderSetScoreRow(match, pKey, name, inputClass, disableQuickWin, currentSetIndex) {
    const isP1 = pKey === 'p1';
    const isDisabled = match.winner !== null;

    // Calculate total games won for the final column
    let totalGames = 0;
    
    let setInputsHtml = match.scores.map((setScore, setIndex) => {
        const games = isP1 ? setScore[0] : setScore[1];
        totalGames += games || 0;
        
        // Max score input should be the set limit + 1 
        const maxInputGames = maxGamesPerSet + 1; 
        const inputValue = (games !== undefined && games !== null) ? games : ''; 
        
        // Determinar si es el set actual para mostrar el botón de Quick Win
        // Solo mostramos el Quick Win si el set está ABIERTO (setIndex == match.scores.length - 1)
        const isSetCurrentOpen = setIndex === match.scores.length - 1 && !isDisabled && checkSetWinner(setScore) === null;
        
        let content;
        
        // Si el set está en el índice final Y NO ESTÁ COMPLETADO:
        if (isSetCurrentOpen) {
            content = `
                <div class="flex">
                    <input type="number" min="0" max="${maxInputGames}" value="${inputValue}" 
                           data-match-id="${match.id}" data-player="${pKey}" data-set-index="${setIndex}"
                           class="${inputClass} set-score-input"
                           ${isDisabled ? 'disabled' : ''}>
                    <button class="btn-quick-set-win ${disableQuickWin ? 'disabled' : ''}" 
                            data-match-id="${match.id}" data-player="${pKey}" data-set-index="${setIndex}"
                            ${disableQuickWin ? 'disabled' : ''}>
                        Set Win (${maxGamesPerSet}-${maxGamesPerSet - 2})
                    </button>
                </div>
            `;
        } else {
             // Si el set está completado o es un set anterior, solo se muestra el input
             content = `
                 <input type="number" min="0" max="${maxInputGames}" value="${inputValue}" 
                       data-match-id="${match.id}" data-player="${pKey}" data-set-index="${setIndex}"
                       class="${inputClass} set-score-input ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}"
                       ${isDisabled ? 'disabled' : ''}>
             `;
        }


        return `
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                ${content}
            </td>
        `;
    }).join('');

    let rowHtml = `<tr>
        <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 w-1/3">${name}</td>
        ${setInputsHtml}
        <td class="px-3 py-2 whitespace-nowrap text-sm text-center font-bold text-gray-700">${totalGames}</td>
    </tr>`;
    return rowHtml;
}

// Helper to format the match score string for sets (e.g., 1-0 (6-4, -))
function getSetsScoreString(match) {
    if (match.scores.length === 0) return '0-0 (0 Sets)';

    let p1Sets = 0;
    let p2Sets = 0;

    const gameScores = match.scores.map(set => {
        const p1Games = set[0];
        const p2Games = set[1];
        
        // Solo contamos sets completos para la puntuación total de sets
        const setWinner = checkSetWinner(set);
        if (setWinner === 'p1') {
            p1Sets++;
        } else if (setWinner === 'p2') {
            p2Sets++;
        }

        if (p1Games === undefined || p2Games === undefined || p1Games === null || p2Games === null) return '-'; 
        return `${p1Games}-${p2Games}`;
    }).join(', ');
    
    return `${p1Sets}-${p2Sets} (${gameScores})`;
}


// ---------------------------
// MATCH RESULT HANDLERS
// ---------------------------

// Handles adding a new set input row
function handleAddSet(event) {
    const button = event.target;
    const matchId = button.dataset.matchId;

    // Find the match in either matches or playoffMatches
    let match = matches.find(m => m.id === matchId);
    if (!match) {
        match = playoffMatches.find(m => m.id === matchId);
    }
    if (!match) return;
    
    // Check if the match is already completed before adding a set
    if (match.winner !== null) {
        showStatus("⚠️ Cannot add a set to a completed match.", "orange");
        return;
    }
    
    // Solo permitir añadir un set si el último set ya está completo
    if (match.scores.length > 0 && checkSetWinner(match.scores[match.scores.length - 1]) === null) {
        // Esto no debería suceder si el botón está deshabilitado correctamente, pero es una buena salvaguarda.
        showStatus("⚠️ Please complete the current set before adding a new one.", "orange");
        return;
    }
    
    // Solo permitir añadir hasta el set de desempate (máximo 3 sets en total)
    if (match.scores.length >= 3) {
        showStatus("⚠️ The match already has 3 sets (Max allowed in Best of 3).", "orange");
        return;
    }

    // Add a new set slot
    match.scores.push([undefined, undefined]);
    
    // Re-render the match card
    reRenderMatchCard(match);
    
    saveData(true);
}

// *** NUEVA FUNCIÓN: Registro rápido de Set Ganado (ej. 6-4) ***
function handleQuickSetWin(event) {
    const button = event.target;
    const matchId = button.dataset.matchId;
    const pKey = button.dataset.player; 
    const setIndex = parseInt(button.dataset.setIndex);

    // Find the match
    let match = matches.find(m => m.id === matchId);
    if (!match) {
        match = playoffMatches.find(m => m.id === matchId);
    }
    if (!match) return;
    
    if (match.winner !== null) return; 
    
    const maxGames = maxGamesPerSet;
    const isP1 = pKey === 'p1';
    
    // Aplicar el marcador estándar de set ganado por diferencia de 2 (ej. 6-4)
    let p1Games = isP1 ? maxGames : maxGames - 2;
    let p2Games = isP1 ? maxGames - 2 : maxGames;
    
    // Asegurarse de que la puntuación no es negativa si maxGames es muy pequeño (aunque ya validamos min=4)
    if (maxGames - 2 < 0) { 
        p1Games = isP1 ? maxGames : 0;
        p2Games = isP1 ? 0 : maxGames;
    }
    
    // Actualizar el score del set
    match.scores[setIndex][0] = p1Games;
    match.scores[setIndex][1] = p2Games;

    // Ejecutar la lógica de manejo de score para verificar el ganador del partido
    checkAndHandleMatchWinner(match);
}

// Función centralizada para manejar el cambio de score y verificar el ganador
function checkAndHandleMatchWinner(match) {
    const matchResult = checkMatchWinner(match);
    match.winner = matchResult.winner;

    // Si ganador encontrado, set loser for playoffs
    const isGroupMatch = match.group !== undefined && match.stage === undefined;
    if (match.winner && !isGroupMatch) {
        // En los playoffs, el perdedor pasa a la siguiente fase o se le asigna posición.
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
        showStatus(`📝 Score updated. Current sets: ${getSetsScoreString(match)}`, "indigo");
    }
    
    saveData(true);
}


// Generic handler for score change (works for both group and playoff matches)
function handleScoreChange(event) {
    const input = event.target;
    const matchId = input.dataset.matchId;
    const pKey = input.dataset.player; 
    const setIndex = parseInt(input.dataset.setIndex);

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
        input.value = (match.scores[setIndex][scorePosition] !== undefined && match.scores[setIndex][scorePosition] !== null) ? match.scores[setIndex][scorePosition] : '';
        showStatus("⚠️ Cannot change score for a completed match.", "orange");
        return;
    }

    const scorePosition = pKey === 'p1' ? 0 : 1;
    match.scores[setIndex][scorePosition] = value;
    
    // Verificar el ganador después de la actualización
    checkAndHandleMatchWinner(match);
}

// Helper to re-render a match card and re-attach listeners
function reRenderMatchCard(match) {
    const cardContainer = document.getElementById(`match-card-${match.id}`);
    if (cardContainer) {
        cardContainer.innerHTML = renderMatchCard(match);
        // Re-attach event listeners
        cardContainer.querySelectorAll('.set-score-input').forEach(newInput => {
            newInput.addEventListener('input', handleScoreChange);
        });
        cardContainer.querySelectorAll('.btn-add-set').forEach(button => {
            button.addEventListener('click', handleAddSet);
        });
        // Re-attach Quick Win listeners
        cardContainer.querySelectorAll('.btn-quick-set-win').forEach(button => {
            button.addEventListener('click', handleQuickSetWin);
        });
    }
}

// Logic to determine the set winner based on Pro Set rules
function checkSetWinner(setScore) {
    const max = maxGamesPerSet; // Max games configured by user (default 6)
    const p1Games = setScore[0];
    const p2Games = setScore[1];
    
    // Check for null or undefined before comparison
    if (p1Games === undefined || p2Games === undefined || p1Games === null || p2Games === null) return null;

    const diff = Math.abs(p1Games - p2Games);

    // Rule 1: Win at 'max' games with a 2-game lead (e.g., 6-4)
    if (p1Games >= max && diff >= 2) {
        return 'p1';
    } else if (p2Games >= max && diff >= 2) {
        return 'p2';
    } 
    
    // Rule 2: Score reaches max+1, but the difference is 1 (e.g., 7-6) - Only if max is reached.
    // If scores are 6-5, 5-6, 7-6, 6-7, etc., it must continue until diff >= 2 OR a Tiebreak score.
    
    // Rule 3: Tiebreak (Assumed at max-1/max-1, resulting in max/max-1 or max-1/max)
    // We assume the input records the final score. If p1Games or p2Games reaches max and the other is max-1.
    // This handles the scenario where the tiebreak is implicitly won and the score is logged as 7-6 (if max=6).
    if (max > 2) { // Only applies if max is reasonably large (e.g., 6)
        if (p1Games === max + 1 && p2Games === max) { // Example 7-6 (P1 wins)
             return 'p1';
        } else if (p2Games === max + 1 && p1Games === max) { // Example 6-7 (P2 wins)
             return 'p2';
        }
    }
    
    // Handles scores like 8-6, 9-7 where max is passed but diff is 2
    if (p1Games > max && diff >= 2) {
        return 'p1';
    } else if (p2Games > max && diff >= 2) {
        return 'p2';
    }
    
    return null; // Set not finished
}

// Logic to determine the match winner
function checkMatchWinner(match) {
    let winner = null;
    let p1SetWins = 0;
    let p2SetWins = 0;
    
    // El umbral es siempre 2 sets para ganar
    const threshold = setsToWinMatch; 

    // Check set results
    match.scores.forEach(set => {
        const setWinner = checkSetWinner(set);
        if (setWinner === 'p1') {
            p1SetWins++;
        } else if (setWinner === 'p2') {
            p2SetWins++;
        }
    });

    // Determine the name of the competitors
    const p1Id = match.p1.constructor === Array ? match.p1.join(' / ') : match.p1;
    const p2Id = match.p2.constructor === Array ? match.p2.join(' / ') : match.p2;

    // El ganador es quien alcanza el umbral de sets ganados.
    if (p1SetWins >= threshold) {
        winner = p1Id;
    } else if (p2SetWins >= threshold) {
        winner = p2Id;
    }

    return { winner };
}

// ---------------------------
// RANKING SYSTEM (SIN CAMBIOS RELEVANTES AQUÍ)
// ---------------------------

// Function to calculate standings for all players/teams across all groups
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

    // 3. Aggregate stats from completed matches (Group Matches only)
    matches.forEach(match => {
        const isCompleted = match.winner !== null;

        const p1Name = match.p1.constructor === Array ? match.p1.join(' / ') : match.p1;
        const p2Name = match.p2.constructor === Array ? match.p2.join(' / ') : match.p2;

        let totalGamesWonP1 = 0;
        let totalGamesWonP2 = 0;
        
        // Sum games across all sets for total games won/lost (for ranking criteria)
        match.scores.forEach(set => {
            totalGamesWonP1 += set[0] || 0;
            totalGamesWonP2 += set[1] || 0;
        });
        
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

    // 4. Calculate Games Difference and convert to array
    const standingsArray = Object.values(stats).map(stat => {
        stat.gamesDiff = stat.gamesWon - stat.gamesLost;
        return stat;
    });

    // 5. Sort (Ranking Criteria: 1. Matches Won, 2. Games Difference, 3. Games Won)
    standingsArray.sort((a, b) => {
        if (b.matchesWon !== a.matchesWon) {
            return b.matchesWon - a.matchesWon; // Primary: Matches Won (Higher is better)
        }
        if (b.gamesDiff !== a.gamesDiff) {
            return b.gamesDiff - a.gamesDiff; // Secondary: Games Diff (Higher is better)
        }
        if (b.gamesWon !== a.gamesWon) {
             return b.gamesWon - a.gamesWon; // Tertiary: Games Won (Higher is better)
        }
        return a.player.localeCompare(b.player); 
    });
    
    return standingsArray;
}

// ---------------------------
// STANDINGS RENDERING (SIN CAMBIOS RELEVANTES AQUÍ)
// ---------------------------

function renderStandings(standingsArray) {
    if (standingsArray.length === 0 || standingsArray.every(s => s.group === 0)) {
        return '<p class="text-gray-500">No players registered or no matches have been played yet.</p>';
    }
    
    const totalGroups = Math.max(...standingsArray.map(s => s.group));
    let html = '';

    // --- 1. Render Group Standings (if more than one group) ---
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

    // --- 2. Render Global Standings (Group Phase Only) ---
    html += `<h3 class="group-rankings-title ${totalGroups <= 1 ? '' : 'mt-6'}">Clasificación Global (Fase de Grupos)</h3>`;
    html += createStandingsTable(standingsArray, true);
    
    return html;
}

// Helper function to create the actual HTML table structure
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
        <p class="text-sm text-gray-600 mb-4">Los partidos son generados automáticamente en base a la Clasificación Global de la Fase de Grupos. **Esta fase requiere ganar 2 sets (Mejor de 3).**</p>
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
