// my-app-logic.js
// Tennis Tournament Manager — Logic Layer (Sets Variables y Registro por Set/Juego)

// Global state
let players = [];
let maxPlayers = 10;
let numGroups = 2;
let mode = "singles"; // or "doubles"
let maxGamesPerSet = 6; // Máximo de juegos por set por defecto es 6 (Pro Set)
let setsToWinMatch = 1; // Por defecto: 1 set para ganar (para la fase de grupos Pro Set)
let matches = [];
let playoffMatches = []; 

// ---------------------------
// FOTO UTILITIES
// ---------------------------

/**
 * Reads a File object and converts it into a Base64 Data URL string.
 * @param {File} file
 * @returns {Promise<string|null>} The Data URL or null if an error occurs.
 */
function readImageAsDataURL(file) {
    return new Promise((resolve) => {
        if (!file) return resolve(null);
        
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => {
            console.error("Error reading file:", file);
            resolve(null);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Busca la información de la foto para un nombre de jugador/equipo dado.
 * @param {string|string[]} competitor - Nombre del jugador o array de nombres de equipo.
 * @returns {{ name: string, photoURL: string|null, isTeam: boolean }}
 */
function getPlayerDisplayInfo(competitor) {
    const isTeam = competitor.constructor === Array;
    const name = isTeam ? competitor.join(' / ') : competitor;

    if (isTeam) {
        // Para dobles: encuentra la foto del primer miembro si está disponible
        const teamMember = competitor[0];
        const playerObj = players.find(p => p.name === teamMember);
        
        // El photoURL será el del primer miembro, o null
        const teamPhotoURL = playerObj ? playerObj.photoURL : null;

        return {
            name: name,
            photoURL: teamPhotoURL,
            isTeam: true,
        };
    } else {
        // Para singles: encuentra la foto del jugador
        const playerObj = players.find(p => p.name === competitor);
        return {
            name: name,
            photoURL: playerObj ? playerObj.photoURL : null,
            isTeam: false,
        };
    }
}


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
    if (!window.isCloudMode && typeof window.loadAndInitializeLogic === 'function') {
        window.loadAndInitializeLogic();
    }
});


// ---------------------------
// UI SETUP
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
  
  // Aseguramos que el input de la UI refleje el valor por defecto
  if (gamesPerSetInput) gamesPerSetInput.value = maxGamesPerSet;

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
        addPlayerBtn.addEventListener("click", async () => {
            const name = playerNameInput.value.trim();
            const photoInput = document.getElementById("foto-input");
            
            if (!name) return;
            if (players.length >= maxPlayers) {
                alert("Maximum players reached!");
                return;
            }
            
            // Lógica para leer la foto (async)
            const photoFile = photoInput.files.length > 0 ? photoInput.files[0] : null;
            const photoURL = await readImageAsDataURL(photoFile);
            
            // Guardar jugador como objeto
            players.push({ name: name, photoURL: photoURL });
            
            playerNameInput.value = "";
            photoInput.value = ""; // Limpiar el input de la foto
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
        maxGamesPerSet = 6; 
        setsToWinMatch = 1; // Reset to default 1 set to win
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
  const data = { 
    players, 
    maxPlayers, 
    numGroups, 
    mode, 
    maxGamesPerSet, 
    setsToWinMatch, // Save new variable
    matches, 
    playoffMatches, 
    timestamp: Date.now() 
}; 
  
  // 1. Save to Local Storage (always happens)
  localStorage.setItem("tournament-data", JSON.stringify(data));
  localStorage.setItem("current-tournament-id", window.userId);

  // 2. Save to Cloud (if enabled)
  if (saveToCloud && window.isCloudMode && window.db) {
    try {
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
  if (data.players) {
      // Asegurar compatibilidad: si son strings, convertirlos a objetos de jugador.
      players = data.players.map(p => typeof p === 'string' ? { name: p, photoURL: null } : p);
  }
  if (data.maxPlayers) maxPlayers = data.maxPlayers;
  if (data.numGroups) numGroups = data.numGroups;
  if (data.mode) mode = data.mode;
  // If data.maxGamesPerSet exists, use it. Otherwise, use the new default (6).
  maxGamesPerSet = data.maxGamesPerSet !== undefined ? data.maxGamesPerSet : 6;
  // If data.setsToWinMatch exists, use it. Otherwise, use the new default (1).
  setsToWinMatch = data.setsToWinMatch !== undefined ? data.setsToWinMatch : 1; 
  
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

  // Update Group count display
  const numGroupsDisplay = document.getElementById("num-grupos-actual");
  if (numGroupsDisplay) numGroupsDisplay.textContent = numGroups;
  
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

  // Update Player List (Añade manejo de fotos/avatares)
  const list = document.getElementById("lista-participantes");
  list.innerHTML = "";
  players.forEach((p) => {
    // Aseguramos que p sea un objeto. Si es solo un nombre (de datos antiguos), lo convertimos.
    const playerObj = typeof p === 'string' ? { name: p, photoURL: null } : p;
    
    const li = document.createElement("li");
    li.className = "flex items-center space-x-2 py-1";
    
    // Añadir la imagen si existe
    if (playerObj.photoURL) {
      const img = document.createElement("img");
      img.src = playerObj.photoURL;
      img.className = "w-8 h-8 rounded-full object-cover shadow";
      li.appendChild(img);
    } else {
      // Placeholder si no hay foto
      const initial = playerObj.name.charAt(0).toUpperCase();
      const placeholder = document.createElement("div");
      placeholder.className = "w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700";
      placeholder.textContent = initial;
      li.appendChild(placeholder);
    }
    
    const nameSpan = document.createElement("span");
    nameSpan.textContent = playerObj.name;
    li.appendChild(nameSpan);
    
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
  div.className = `mt-3 text-${color}-600 text-sm font-semibold`;
  
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
  
  // Establecer a 1 set para ganar en la fase de grupos (Pro Set)
  setsToWinMatch = 1;
  saveData(false); // Update local setting

  // Usamos solo los nombres para la generación de partidos
  const playerNames = players.map(p => p.name);
  const shuffledPlayers = [...playerNames].sort(() => Math.random() - 0.5);
  const playersPerGroup = playerNames.length / numGroups;
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
    
    // Establecer a 2 sets para ganar en la fase eliminatoria (Mejor de 3)
    setsToWinMatch = 2; 

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
        return;
    }

    // ----------------------------------------------------------------
    // STEP 3: GROUP MATCHES SECTION
    // ----------------------------------------------------------------
    let html = `<section class="bg-white p-6 rounded-2xl shadow mb-8 mt-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">3. Enter Group Match Results (Pro Set to ${maxGamesPerSet} Games)</h2>
        <p class="text-sm text-gray-600 mb-4">A match is won by the first player to reach **${maxGamesPerSet} games** with a two-game lead. If tied at **${maxGamesPerSet - 1}-${maxGamesPerSet - 1}**, a tiebreak is played, and the final score will be **${maxGamesPerSet}-${maxGamesPerSet - 1}**. **Groups are decided by winning 1 set.**</p>
        <div id="match-list" class="space-y-4">`;

    const groupedMatches = matches.reduce((acc, match) => {
        acc[match.group] = acc[match.group] || [];
        acc[match.group].push(match);
        return acc;
    }, {});

    for (const group in groupedMatches) {
        html += `<div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 class="text-xl font-semibold text-indigo-700 mb-3">Group ${group}</h3>
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
    
    html += `<section class="bg-white p-6 rounded-2xl shadow mb-8 mt-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">4. Group Standings, Playoffs & Global Rank</h2>
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
    
    // Attach Event Listeners to group match inputs
    document.querySelectorAll('.set-score-input').forEach(input => {
        input.addEventListener('input', handleScoreChange);
    });
    
    // Attach Event Listeners to "Add Set" button
    document.querySelectorAll('.btn-add-set').forEach(button => {
        button.addEventListener('click', handleAddSet);
    });
}

// Renders a generic match card (Set/Game Inputs)
function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    
    // Obtener información del jugador/equipo incluyendo foto
    const p1Info = getPlayerDisplayInfo(match.p1.constructor === Array ? match.p1 : match.p1);
    const p2Info = getPlayerDisplayInfo(match.p2.constructor === Array ? match.p2 : match.p2);
    
    const p1Name = p1Info.name;
    const p2Name = p2Info.name;
    
    // Helper para generar el avatar
    const getAvatarHtml = (info) => {
        if (info.photoURL) {
            return `<img src="${info.photoURL}" alt="${info.name}" class="w-8 h-8 rounded-full object-cover mr-2 inline-block shadow">`;
        }
        const initial = info.name.charAt(0).toUpperCase();
        return `<div class="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-bold text-gray-700 mr-2 inline-block">${initial}</div>`;
    };
    
    const cardClass = isCompleted ? 'match-card completed ring-4 ring-green-300' : 'match-card';
    
    const isPlayoff = match.stage;
    const stageInfo = isPlayoff ? match.stage : `Group ${match.group}`;
    const inputClass = isPlayoff ? 'playoff-set-input' : 'group-set-input';

    let cardHtml = `
        <div class="${cardClass} p-4 bg-white rounded-lg shadow transition duration-200">
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

// Helper to render one row in the score table (Multiple Sets)
function renderSetScoreRow(match, pKey, name, inputClass) {
    const isP1 = pKey === 'p1';
    const isDisabled = match.winner !== null;

    // Calculate total games won for the final column
    let totalGames = 0;
    
    let setInputsHtml = match.scores.map((setScore, setIndex) => {
        const games = isP1 ? setScore[0] : setScore[1];
        totalGames += games || 0;
        
        // Max score input should be the set limit + 1 (for the X-(X-1) case in an X-game set)
        const maxInputGames = maxGamesPerSet + 1; 

        return `
            <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
                <input type="number" min="0" max="${maxInputGames}" value="${games !== undefined ? games : ''}" 
                       data-match-id="${match.id}" data-player="${pKey}" data-set-index="${setIndex}"
                       class="${inputClass} set-score-input w-14 p-1 border border-gray-300 rounded-md text-center text-sm focus:ring-indigo-500 ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}"
                       ${isDisabled ? 'disabled' : ''}>
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

        if (p1Games === undefined || p2Games === undefined) return '-'; 
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

    // Add a new set slot
    match.scores.push([undefined, undefined]);
    
    // Re-render the match card
    reRenderMatchCard(match);
    
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
    const isPlayoff = !match;
    if (isPlayoff) {
        match = playoffMatches.find(m => m.id === matchId);
    }
    if (!match) return;
    
    if (match.winner !== null) {
        // Revert input value if trying to edit a finished match
        input.value = (pKey === 'p1' ? match.scores[setIndex][0] : match.scores[setIndex][1]) || '';
        showStatus("⚠️ Cannot change score for a completed match.", "orange");
        return;
    }

    const scorePosition = pKey === 'p1' ? 0 : 1;
    match.scores[setIndex][scorePosition] = value;
    
    // Check for match winner (based on total games won)
    const matchResult = checkMatchWinner(match);
    match.winner = matchResult.winner;

    // If winner found, set loser for playoffs
    if (match.winner && isPlayoff) {
        match.loser = match.winner === match.p1 ? match.p2 : match.p1;
    }

    // Re-render the specific card
    reRenderMatchCard(match);
    
    if (match.winner) {
         showStatus(`🏆 Match complete! Winner: ${match.winner}`, "green");
    } else {
        showStatus(`📝 Score updated. Current sets: ${getSetsScoreString(match)}`, "indigo");
    }

    // Full render only if this was a group match and we need to check for playoffs
    if (!isPlayoff) {
        renderMatches(); 
    } else {
        // Update standings for final rankings if it was a playoff match
         renderMatches();
    }
    
    saveData(true);
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
    }
}

// Logic to determine the set winner based on Pro Set rules
function checkSetWinner(setScore) {
    const max = maxGamesPerSet;
    const p1Games = setScore[0];
    const p2Games = setScore[1];

    if (p1Games === undefined || p2Games === undefined) return null;

    const diff = Math.abs(p1Games - p2Games);

    // Rule 1: Win at max games with a 2-game lead (e.g., 6-4)
    if (p1Games >= max && diff >= 2) {
        return 'p1';
    } else if (p2Games >= max && diff >= 2) {
        return 'p2';
    } 
    
    // Rule 2: Win at max-(max-1) (e.g., 6-5 after a tiebreak for a 6-game set, or 8-7 for an 8-game set)
    // Note: This rule assumes a tiebreak is played at (max - 1) all, resulting in a score of max-(max-1)
    // The previous rule covers scores like 6-0, 6-1, 6-2, 6-3, 7-5, 8-6, etc.
    else if (p1Games === max && p2Games === max - 1) {
        return 'p1';
    } else if (p2Games === max && p1Games === max - 1) {
        return 'p2';
    }
    return null; // Set not finished
}

// Logic to determine the match winner
function checkMatchWinner(match) {
    let winner = null;
    let p1SetWins = 0;
    let p2SetWins = 0;
    
    // Determinar el umbral de sets a ganar: 1 para grupos, 2 para playoffs.
    const threshold = match.group ? 1 : 2; 

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
// RANKING SYSTEM
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
// STANDINGS RENDERING
// ---------------------------

function renderStandings(standingsArray) {
    if (standingsArray.length === 0 || standingsArray.every(s => s.group === 0)) {
        return '<p class="text-gray-500">No players registered or no matches have been played yet.</p>';
    }
    
    const totalGroups = Math.max(...standingsArray.map(s => s.group));
    let html = '';

    // --- 1. Render Group Standings (if more than one group) ---
    if (totalGroups > 1) {
        html += `<h3 class="text-xl font-bold text-gray-700 mb-4 mt-6 border-b pb-2">Clasificación por Grupos</h3>`;
        
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
    html += `<h3 class="text-xl font-bold text-gray-700 mb-4 ${totalGroups <= 1 ? '' : 'mt-6'} border-b pb-2">Clasificación Global (Fase de Grupos)</h3>`;
    html += createStandingsTable(standingsArray, true);
    
    return html;
}

// Helper function to create the actual HTML table structure
function createStandingsTable(statsArray, isGlobal) {
    let html = `<div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
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
            <tbody class="bg-white divide-y divide-gray-200">`;

    statsArray.forEach((stat, index) => {
        const playerInfo = getPlayerDisplayInfo(stat.player);
        const playerAvatarHtml = playerInfo.photoURL
            ? `<img src="${playerInfo.photoURL}" alt="${stat.player}" class="w-6 h-6 rounded-full object-cover mr-2 inline-block">`
            : `<div class="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 mr-2 inline-block">${stat.player.charAt(0)}</div>`;

        html += `<tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">${index + 1}</td>
            ${isGlobal ? `<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${stat.group || '-'}</td>` : ''}
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                ${playerAvatarHtml} ${stat.player}
            </td>
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
        <h3 class="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Fase Eliminatoria (Top 4)</h3>
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
        <h3 class="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Clasificación Final del Torneo (1º a ${standings.length}º)</h3>
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Pos.</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">${mode === 'doubles' ? 'Team' : 'Player'}</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Group</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Result</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">`;

    [[1, rank1, '🏆 Champion'], [2, rank2, '🥈 Runner-Up'], [3, rank3, '🥉 3rd Place'], [4, rank4, '4th Place']]
    .forEach(([rank, player, result], index) => {
        const playerStat = standings.find(s => s.player === player);
        const playerInfo = getPlayerDisplayInfo(player); // Obtener info de foto
        const playerAvatarHtml = playerInfo.photoURL
            ? `<img src="${playerInfo.photoURL}" alt="${player}" class="w-6 h-6 rounded-full object-cover mr-2 inline-block">`
            : `<div class="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 mr-2 inline-block">${player.charAt(0)}</div>`;

        const bgColor = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        html += `<tr class="${bgColor}">
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-indigo-700 font-bold">${rank}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                ${playerAvatarHtml} ${player}
            </td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">${playerStat ? playerStat.group : '-'}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-green-700">${result}</td>
        </tr>`;
    });

    remainingStandings.forEach((stat, index) => {
        const rank = 5 + index;
        const bgColor = (4 + index) % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        const playerInfo = getPlayerDisplayInfo(stat.player); // Obtener info de foto
        const playerAvatarHtml = playerInfo.photoURL
            ? `<img src="${playerInfo.photoURL}" alt="${stat.player}" class="w-6 h-6 rounded-full object-cover mr-2 inline-block">`
            : `<div class="w-6 h-6 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 mr-2 inline-block">${stat.player.charAt(0)}</div>`;

        html += `<tr class="${bgColor}">
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-600">${rank}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                ${playerAvatarHtml} ${stat.player}
            </td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">${stat.group}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center text-gray-500">5th+ (Group Rank)</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}
