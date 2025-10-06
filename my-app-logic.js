// my-app-logic.js
// Tennis Tournament Manager — Logic Layer

// Global state
let players = [];
let maxPlayers = 10;
let numGroups = 2;
let mode = "singles"; // or "doubles"
let matches = [];

// Entry point (called after Firebase auth)
window.loadAndInitializeLogic = function () {
  console.log("🎾 App logic initialized");
  loadData();
  setupUI();
  updateUI();
};

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
  const matchTypeSelector = document.getElementById("match-type"); // Corrected ID for match type
  const startBtn = document.getElementById("btn-generate-matches"); // Corrected ID for generate matches button

  // --- Match Type Selector Handler ---
  matchTypeSelector.value = mode; // Set initial value
  matchTypeSelector.addEventListener("change", (e) => {
    mode = e.target.value;
    saveData();
    showStatus(`🎾 Mode changed to: ${mode.toUpperCase()}`, "green");
  });

  // --- Set Max Button Handler ---
  btnSetMax.addEventListener("click", () => {
    const newMax = parseInt(maxInput.value);
    // Get the existing status message div we added to the HTML
    const msg = document.getElementById("set-max-message");
    if (newMax >= 4 && newMax % 2 === 0) {
      maxPlayers = newMax;
      updateUI();
      saveData();
      msg.textContent = `✅ Max players updated to ${maxPlayers}`;
      msg.className = "text-green-600 text-sm mt-1";
    } else {
      msg.textContent = "⚠️ Max players must be even and at least 4.";
      msg.className = "text-red-600 text-sm mt-1";
    }
  });

  // --- Set Groups Button Handler ---
  btnSetGroups.addEventListener("click", () => {
    const newGroups = parseInt(groupInput.value);
    // Get the existing status message div we added to the HTML
    const msg = document.getElementById("set-group-message");
    if (newGroups >= 1 && newGroups <= 6 && maxPlayers % newGroups === 0) {
      numGroups = newGroups;
      updateUI();
      saveData();
      msg.textContent = `✅ Groups updated to ${numGroups}`;
      msg.className = "text-green-600 text-sm mt-1";
    } else {
      msg.textContent = `⚠️ Groups must divide max players (${maxPlayers}) evenly.`;
      msg.className = "text-red-600 text-sm mt-1";
    }
  });

  // --- Add Player Button Handler ---
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
    saveData();
  });

  // --- Generate Matches Button Handler (formerly Start Tournament) ---
  startBtn.addEventListener("click", () => {
    if (players.length < maxPlayers) {
      alert(`You need ${maxPlayers - players.length} more players to generate matches.`);
      return;
    }

    generateMatches();
    // NOTE: You may want to add a function here to display the matches to the DOM.
    showStatus("✅ Matches generated. Check the console for match data.", "green");
    console.log(matches);
  });
}

// ---------------------------
// DATA HANDLING
// ---------------------------
function saveData() {
  const data = { players, maxPlayers, numGroups, mode };
  localStorage.setItem("tournament-data", JSON.stringify(data));
}

function loadData() {
  const data = JSON.parse(localStorage.getItem("tournament-data") || "{}");
  if (data.players) players = data.players;
  if (data.maxPlayers) maxPlayers = data.maxPlayers;
  if (data.numGroups) numGroups = data.numGroups;
  if (data.mode) mode = data.mode;
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
  if (numGroupsDisplay) numGroupsDisplay.textContent = numGroups; // Only update if element exists

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
  if (players.length === maxPlayers) {
    startBtn.disabled = false;
    startBtn.classList.remove("opacity-50", "cursor-not-allowed");
    startBtn.textContent = "🎾 Generate Random Matches";
  } else {
    startBtn.disabled = true;
    startBtn.classList.add("opacity-50", "cursor-not-allowed");
    startBtn.textContent = `🎾 Generate Random Matches (Need ${maxPlayers - players.length} more)`;
  }
  
  // Update mode selector to reflect current state
  const matchTypeSelector = document.getElementById("match-type");
  if (matchTypeSelector) matchTypeSelector.value = mode;

}

// Removed createStatusMessage function as we added the divs to the HTML

function showStatus(message, color = "blue") {
  const div = document.createElement("div");
  div.textContent = message;
  div.className = `mt-3 text-${color}-600 text-sm font-semibold`;
  document.querySelector("header").appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ---------------------------
// MATCH GENERATION
// ---------------------------
function generateMatches() {
  matches = [];

  // Simple check for valid group size
  if (players.length % numGroups !== 0) {
    showStatus(`⚠️ Cannot generate matches. Total players (${players.length}) must be divisible by number of groups (${numGroups}).`, "red");
    return;
  }

  // First, shuffle players
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  
  // Split players into groups
  const playersPerGroup = players.length / numGroups;
  const groups = [];
  for (let i = 0; i < numGroups; i++) {
    groups.push(shuffledPlayers.slice(i * playersPerGroup, (i + 1) * playersPerGroup));
  }
  console.log("Group setup:", groups);


  if (mode === "singles") {
    // Generate round-robin matches *within each group*
    groups.forEach((group, groupIndex) => {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          matches.push({ 
            type: "singles", 
            group: groupIndex + 1, // 1-based index
            p1: group[i], 
            p2: group[j] 
          });
        }
      }
    });
  } else {
    // Doubles mode: Randomly shuffle and pair players into teams for each group
    groups.forEach((group, groupIndex) => {
      const teams = [];
      for (let i = 0; i < group.length; i += 2) {
        teams.push([group[i], group[i + 1]]);
      }
      
      // Every team plays against each other within the group
      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          matches.push({
            type: "doubles",
            group: groupIndex + 1,
            team1: teams[i],
            team2: teams[j],
          });
        }
      }

      console.log(`🧩 Teams for Group ${groupIndex + 1}:`, teams);
    });
  }

  console.log("🎾 Matches generated:", matches);
  return matches;
}
