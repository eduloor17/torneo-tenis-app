// my-app-logic.js
// Tennis Tournament Manager — Logic Layer

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
    // If running in local mode (no Firebase), load the logic immediately.
    // If running in cloud mode, the logic is called inside index.html after Firebase Auth completes.
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
      saveData(true); // Save to cloud/local
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
      console.log(matches);
    });
  }
  
  // --- Load Tournament Handler ---
  loadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const externalId = externalIdInput.value.trim();
    if (externalId) {
        window.userId = externalId;
        localStorage.setItem("current-tournament-id", externalId);
        loadData(true); // Load from cloud
    }
  });
  
  // --- Reset Tournament Handler ---
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
    saveData(true); // Save the empty state to the new cloud ID
    showStatus("🗑️ Tournament reset. Starting a new Cloud session.", "red");
  });
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
      // The tournament ID is the unique Firestore Document ID
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
  renderMatches(); // <-- IMPORTANT: Render matches after loading data
  
  // Re-save to enforce the correct ID if we loaded an external one
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
  console.log("Group setup:", groups);


  if (mode === "singles") {
    groups.forEach((group, groupIndex) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          matches.push({ 
            id: crypto.randomUUID(), // Unique ID for match completion
            type: "singles", 
            group: groupIndex + 1,
            p1: group[i], 
            p2: group[j],
            winner: null, // Null means not played
            score: null
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
            id: crypto.randomUUID(), // Unique ID for match completion
            type: "doubles",
            group: groupIndex + 1,
            team1: teams[i],
            team2: teams[j],
            winner: null,
            score: null
          });
        }
      }
      console.log(`🧩 Teams for Group ${groupIndex + 1}:`, teams);
    });
  }

  console.log("🎾 Matches generated:", matches);
  renderMatches(); // <-- NEW CALL TO RENDER
}

function renderMatches() {
    const container = document.getElementById("matches-container");
    container.innerHTML = ''; // Clear previous content

    if (matches.length === 0) {
        container.innerHTML = '<p class="text-gray-500 mt-4">No matches generated yet. Fill the players list and click "Generate Matches".</p>';
        return;
    }

    // ----------------------------------------------------------------
    // STEP 3: MATCHES SECTION
    // ----------------------------------------------------------------
    let html = `<section class="bg-white p-6 rounded-2xl shadow mb-8 mt-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">3. Enter Match Results</h2>
        <div id="match-list" class="space-y-4">`;

    // Group matches by group number for better visual organization
    const groupedMatches = matches.reduce((acc, match) => {
        acc[match.group] = acc[match.group] || [];
        acc[match.group].push(match);
        return acc;
    }, {});

    for (const group in groupedMatches) {
        html += `<div class="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h3 class="text-xl font-semibold text-indigo-700 mb-3">Group ${group}</h3>
            <div class="space-y-3">`;

        groupedMatches[group].forEach((match, index) => {
            const isCompleted = match.winner !== null;
            let playerNames;
            let options;
            
            if (match.type === 'singles') {
                playerNames = `${match.p1} vs ${match.p2}`;
                options = `<option value="${match.p1}" ${match.winner === match.p1 ? 'selected' : ''}>Winner: ${match.p1}</option>
                           <option value="${match.p2}" ${match.winner === match.p2 ? 'selected' : ''}>Winner: ${match.p2}</option>`;
            } else { // Doubles
                const t1Name = match.team1.join(' / ');
                const t2Name = match.team2.join(' / ');
                playerNames = `${t1Name} vs ${t2Name}`;
                options = `<option value="${t1Name}" ${match.winner === t1Name ? 'selected' : ''}>Winner: ${t1Name}</option>
                           <option value="${t2Name}" ${match.winner === t2Name ? 'selected' : ''}>Winner: ${t2Name}</option>`;
            }
            
            const winnerText = match.winner ? `Winner: ${match.winner}` : 'Select Winner';
            const cardClass = isCompleted ? 'match-card completed ring-4 ring-green-300' : 'match-card';
            
            html += `
                <div class="${cardClass} p-4 bg-white rounded-lg shadow transition duration-200">
                    <p class="text-lg font-bold text-gray-900 mb-2">Match ${index + 1}: ${playerNames}</p>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <select data-match-id="${match.id}" data-type="${match.type}" class="match-winner-select p-2 border border-gray-300 rounded-lg flex-grow">
                            <option value="">-- ${winnerText} --</option>
                            ${options}
                        </select>
                    </div>
                </div>
            `;
        });
        
        html += `</div></div>`; // Close group div and space-y-3 div
    }

    html += `</div></section>`; // Close Step 3 section

    // ----------------------------------------------------------------
    // STEP 4: STANDINGS SECTION (Placeholder)
    // ----------------------------------------------------------------
    html += `<section class="bg-white p-6 rounded-2xl shadow mb-8 mt-6">
        <h2 class="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">4. Group Standings</h2>
        <div id="standings-list" class="text-gray-600">
            <p>Standings logic is not implemented yet, but the match results will appear here!</p>
        </div>
    </section>`;

    container.innerHTML = html;
    
    // --- Attach Event Listeners to the New Match Selectors ---
    document.querySelectorAll('.match-winner-select').forEach(select => {
        select.addEventListener('change', handleMatchResult);
    });
}


function handleMatchResult(event) {
    const select = event.target;
    const matchId = select.dataset.matchId;
    const winnerValue = select.value;
    
    const matchIndex = matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return;

    // Update the match data
    matches[matchIndex].winner = winnerValue || null;
    matches[matchIndex].score = winnerValue ? '1-0' : null; // Simple score for now

    // Re-render and save the data
    saveData(true);
    renderMatches();
    // After re-render, the updateUI will handle the "completed" card styling

    showStatus(`📝 Result saved! Winner: ${winnerValue}`, "indigo");
}


// ---------------------------
// MATCH GENERATION
// ---------------------------
// (The generateMatches function is above, inside the main flow for simplicity)
