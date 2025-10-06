// my-app-logic.js
// Tennis Tournament Manager — Logic Layer (Pro Set to 8 Games con Bloqueo de Marcador)

// Global state
let players = [];
let maxPlayers = 10;
let numGroups = 2;
let mode = "singles"; // or "doubles"
let matches = [];

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
  const btnSetMax = document.getElementById("btn-configurar-max");
  const btnSetGroups = document.getElementById("btn-configurar-grupos");
  const addPlayerBtn = document.getElementById("btn-agregar-participante");
  const playerNameInput = document.getElementById("nombre-input");
  const matchTypeSelector = document.getElementById("match-type");
  const startBtn = document.getElementById("btn-generate-matches");
  const loadForm = document.getElementById("load-tournament-form");
  const externalIdInput = document.getElementById("external-id-input");
  const resetBtn = document.getElementById("btn-borrar-datos");

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
  const data = { players, maxPlayers, numGroups, mode, matches, timestamp: Date.now() };
  
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
  if (data.players) players = data.players;
  if (data.maxPlayers) maxPlayers = data.maxPlayers;
  if (data.numGroups) numGroups = data.numGroups;
  if (data.mode) mode = data.mode;
  if (data.matches) matches = data.matches;

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
            // Score now stores a single [p1_games, p2_games] entry
            scores: [undefined, undefined] 
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
            scores: [undefined, undefined],
          });
        }
      }
    });
  }

  renderMatches(); 
}

function renderMatches() {
    const container = document.getElementById("matches-container");
    
    if (matches.length === 0) {
        container.innerHTML = '<p class="text-gray-500 mt-4">No matches generated yet. Fill the players list and click "Generate Matches".</p>';
        document.getElementById("standings-list").innerHTML = '<p class="text-gray-500">No players registered or no matches have been played yet.</p>';
        return;
    }

    // ----------------------------------------------------------------
    // STEP 3: MATCHES SECTION
    // ----------------------------------------------------------------
    let html = `<section class="bg-white p-6 rounded-2xl shadow mb-8 mt-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">3. Enter Match Results (Pro Set to 8 Games)</h2>
        <p class="text-sm text-gray-600 mb-4">A match is won by the first player to reach **8 games** with a two-game lead (e.g., 8-6). If tied at **7-7**, a 10-point tiebreak is played, and the final score will be **8-7**.</p>
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
             // We use a container with a unique ID for dynamic updates
             html += `<div id="match-card-${match.id}">
                ${renderMatchCard(match)}
             </div>`;
        });
        
        html += `</div></div>`;
    }

    html += `</div></section>`; 

    // ----------------------------------------------------------------
    // STEP 4: STANDINGS SECTION
    // ----------------------------------------------------------------
    html += `<section class="bg-white p-6 rounded-2xl shadow mb-8 mt-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">4. Group Standings & Global Rank</h2>
        <div id="standings-list" class="text-gray-600">
            ${renderStandings(calculateStandings())}
        </div>
    </section>`;

    container.innerHTML = html;
    
    // Attach Event Listeners (only once after the initial render)
    // We attach the change listener to a wrapper function to handle the blocking logic
    document.querySelectorAll('.score-input').forEach(input => {
        // Use 'input' event for real-time saving and update
        input.addEventListener('input', handleScoreChange);
    });
    
    // Attach event listeners for the new "Block Score" button
    document.querySelectorAll('.btn-block-score').forEach(button => {
        button.addEventListener('click', toggleScoreBlock);
    });
}

// Renders the single match card HTML structure
function renderMatchCard(match) {
    const isCompleted = match.winner !== null;
    const p1Name = match.type === 'singles' ? match.p1 : match.p1.join(' / ');
    const p2Name = match.type === 'singles' ? match.p2 : match.p2.join(' / ');
    
    const cardClass = isCompleted ? 'match-card completed ring-4 ring-green-300' : 'match-card';
    
    let cardHtml = `
        <div class="${cardClass} p-4 bg-white rounded-lg shadow transition duration-200">
            <p class="text-lg font-bold text-gray-900 mb-2">Match ${match.group}: ${p1Name} vs ${p2Name}</p>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead>
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Team/Player</th>
                            <th class="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Total Games Won</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${renderScoreRow(match, 'p1', p1Name)}
                        ${renderScoreRow(match, 'p2', p2Name)}
                    </tbody>
                </table>
            </div>
            
            <div class="mt-3 flex justify-between items-center">
                <p class="text-sm font-semibold text-gray-900">
                    ${p1Name} vs ${p2Name} <span class="text-indigo-600 font-bold">${getMatchScoreString(match)}</span>
                </p>
                 <p class="text-sm font-semibold ${isCompleted ? 'text-green-700' : 'text-gray-500'}" id="winner-status-${match.id}">
                    ${isCompleted ? `🏆 **Winner:** ${match.winner}` : 'Status: In Progress'}
                </p>
                </div>
        </div>
    `;
    return cardHtml;
}

// Helper to render one row in the score table (Simplified for Pro Set)
function renderScoreRow(match, pKey, name) {
    const isP1 = pKey === 'p1';
    // Match.scores is now just a single array: [p1_games, p2_games]
    const games = isP1 ? match.scores[0] : match.scores[1]; 
    
    // Set input status based on match winner
    const isDisabled = match.winner !== null;

    // Max games is typically 9 or 10 for a pro set finish (e.g. 9-8)
    const maxGameInput = 10; 

    let rowHtml = `<tr>
        <td class="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 w-1/3">${name}</td>
        <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-center">
            <div class="flex flex-col items-center">
                <input type="number" min="0" max="${maxGameInput}" value="${games !== undefined ? games : ''}" 
                       data-match-id="${match.id}" data-player="${pKey}" 
                       class="score-input w-16 p-1 border border-gray-300 rounded-md text-center text-sm focus:ring-indigo-500 ${isDisabled ? 'bg-gray-200 cursor-not-allowed' : ''}"
                       ${isDisabled ? 'disabled' : ''}>
            </div>
        </td>
    </tr>`;
    return rowHtml;
}

// Helper to format the match score string for display
function getMatchScoreString(match) {
    const p1Games = match.scores[0];
    const p2Games = match.scores[1];
    
    if (p1Games === undefined || p2Games === undefined) return '0-0'; 

    return `${p1Games}-${p2Games}`;
}


// ---------------------------
// MATCH RESULT HANDLER
// ---------------------------
function handleScoreChange(event) {
    const input = event.target;
    const matchId = input.dataset.matchId;
    const pKey = input.dataset.player; 
    
    let value = input.value.trim() === '' ? undefined : parseInt(input.value.trim());

    // Find the match
    const matchIndex = matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return;
    const match = matches[matchIndex];
    
    // Block change if winner is already set
    if (match.winner !== null) {
        input.value = (pKey === 'p1' ? match.scores[0] : match.scores[1]) || '';
        showStatus("⚠️ Cannot change score for a completed match. Refresh to override.", "orange");
        return;
    }

    // Update the correct score position
    const scorePosition = pKey === 'p1' ? 0 : 1;
    
    match.scores[scorePosition] = value;
    
    // Check for match winner and update the match object
    const matchResult = checkMatchWinner(match);
    match.winner = matchResult.winner;

    // --- Dynamic UI Update ---
    // Instead of re-rendering the whole thing, let's update the specific card.
    // This is the cleanest way to enforce the disabled state and update all text fields.
    const cardContainer = document.getElementById(`match-card-${match.id}`);
    if (cardContainer) {
        cardContainer.innerHTML = renderMatchCard(match);
        // Re-attach event listeners to the newly rendered inputs in this card
        cardContainer.querySelectorAll('.score-input').forEach(newInput => {
            newInput.addEventListener('input', handleScoreChange);
        });
    }

    // Update Standings
    document.getElementById("standings-list").innerHTML = renderStandings(calculateStandings());
    
    // Save data to the cloud/local
    saveData(true);
}

// Logic to determine the match winner based on Pro Set rules (8 games, 2-game lead, 7-7 goes to 8-7)
function checkMatchWinner(match) {
    let winner = null;
    const p1Games = match.scores[0];
    const p2Games = match.scores[1];

    if (p1Games === undefined || p2Games === undefined) return { winner: null };

    // The two parties competing (Player 1 or Team 1, Player 2 or Team 2)
    const p1Id = match.type === 'singles' ? match.p1 : match.p1.join(' / ');
    const p2Id = match.type === 'singles' ? match.p2 : match.p2.join(' / ');

    const diff = Math.abs(p1Games - p2Games);

    // Rule 1: Win at 8 games with a 2-game lead (e.g., 8-6)
    if (p1Games >= 8 && diff >= 2) {
        winner = p1Id;
    } else if (p2Games >= 8 && diff >= 2) {
        winner = p2Id;
    } 
    
    // Rule 2: Win at 8-7 (after a 7-7 tiebreak)
    else if (p1Games === 8 && p2Games === 7) {
        winner = p1Id;
    } else if (p2Games === 8 && p1Games === 7) {
        winner = p2Id;
    }

    return { winner };
}

// ---------------------------
// RANKING SYSTEM
// ---------------------------

// Function to calculate standings for all players across all groups
function calculateStandings() {
    const stats = {};

    // 1. Initialize stats for all players
    players.forEach(p => {
        stats[p] = {
            player: p,
            matchesPlayed: 0,
            matchesWon: 0,
            gamesWon: 0,
            gamesLost: 0,
            gamesDiff: 0,
            group: 0 
        };
    });

    // 2. Aggregate stats from completed matches
    matches.forEach(match => {
        const isCompleted = match.winner !== null;

        const p1Name = match.type === 'singles' ? match.p1 : match.p1.join(' / ');
        const p2Name = match.type === 'singles' ? match.p2 : match.p2.join(' / ');

        const p1Members = match.type === 'singles' ? [match.p1] : match.p1;
        const p2Members = match.type === 'singles' ? [match.p2] : match.p2;

        // Scores array is [p1_games, p2_games]
        const totalGamesWonP1 = match.scores[0] || 0;
        const totalGamesWonP2 = match.scores[1] || 0;

        const winnerName = match.winner;

        // Update stats for all members of Team 1
        p1Members.forEach(member => {
            if (stats[member]) {
                stats[member].gamesWon += totalGamesWonP1;
                stats[member].gamesLost += totalGamesWonP2;
                stats[member].group = match.group;
                
                if (isCompleted) {
                    stats[member].matchesPlayed++;
                    stats[member].matchesWon += (winnerName === p1Name ? 1 : 0);
                }
            }
        });

        // Update stats for all members of Team 2
        p2Members.forEach(member => {
            if (stats[member]) {
                stats[member].gamesWon += totalGamesWonP2;
                stats[member].gamesLost += totalGamesWonP1;
                stats[member].group = match.group;

                if (isCompleted) {
                    stats[member].matchesPlayed++;
                    stats[member].matchesWon += (winnerName === p2Name ? 1 : 0);
                }
            }
        });
    });

    // 3. Calculate Games Difference and convert to array
    const standingsArray = Object.values(stats).map(stat => {
        stat.gamesDiff = stat.gamesWon - stat.gamesLost;
        return stat;
    });

    // 4. Sort (Ranking Criteria: 1. Matches Won, 2. Games Difference, 3. Games Won)
    standingsArray.sort((a, b) => {
        if (b.matchesWon !== a.matchesWon) {
            return b.matchesWon - a.matchesWon; // Primary: Matches Won (Higher is better)
        }
        if (b.gamesDiff !== a.gamesDiff) {
            return b.gamesDiff - a.gamesDiff; // Secondary: Games Diff (Higher is better)
        }
        return b.gamesWon - a.gamesWon; // Tertiary: Games Won (Higher is better)
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

    let html = `<div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Rank</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Group</th>
                    <th class="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Player/Team</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">M Won</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">G Won</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">G Lost</th>
                    <th class="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">G Diff</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">`;

    standingsArray.forEach((stat, index) => {
        html += `<tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">${index + 1}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">${stat.group || '-'}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${stat.player}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center">${stat.matchesWon}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center">${stat.gamesWon}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center">${stat.gamesLost}</td>
            <td class="px-4 py-4 whitespace-nowrap text-sm text-center font-bold text-${stat.gamesDiff >= 0 ? 'green-600' : 'red-600'}">${stat.gamesDiff}</td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
}
