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
  const maxDisplay = document.getElementById("max-jugadores-actual");
  const btnSetMax = document.getElementById("btn-configurar-max");
  const btnSetGroups = document.getElementById("btn-configurar-grupos");
  const addPlayerBtn = document.getElementById("btn-agregar-participante");
  const playerNameInput = document.getElementById("nombre-input");
  const participantList = document.getElementById("lista-participantes");
  const participantCounter = document.getElementById("contador-participantes");
  const maxDisplay2 = document.getElementById("max-participantes-display");
  const startBtn = document.getElementById("btn-iniciar");

  // 🎾 Add match type selector
  const modeSelectorContainer = document.createElement("div");
  modeSelectorContainer.className = "mt-4 flex space-x-4";
  modeSelectorContainer.innerHTML = `
    <label class="flex items-center space-x-2">
      <input type="radio" name="mode" value="singles" checked class="text-indigo-600">
      <span>Singles</span>
    </label>
    <label class="flex items-center space-x-2">
      <input type="radio" name="mode" value="doubles" class="text-indigo-600">
      <span>Doubles (Random partners)</span>
    </label>
  `;
  document.querySelector("#configuracion").appendChild(modeSelectorContainer);

  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      mode = e.target.value;
      saveData();
      showStatus(`🎾 Mode changed to: ${mode.toUpperCase()}`, "green");
    });
  });

  // --- Button Handlers ---
  btnSetMax.addEventListener("click", () => {
    const newMax = parseInt(maxInput.value);
    const msg = document.getElementById("set-max-message") || createStatusMessage("max");
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

  btnSetGroups.addEventListener("click", () => {
    const newGroups = parseInt(groupInput.value);
    const msg = document.getElementById("set-group-message") || createStatusMessage("group");
    if (newGroups >= 1 && newGroups <= 6 && maxPlayers % newGroups === 0) {
      numGroups = newGroups;
      updateUI();
      saveData();
      msg.textContent = `✅ Groups updated to ${numGroups}`;
      msg.className = "text-green-600 text-sm mt-1";
    } else {
      msg.textContent = "⚠️ Groups must divide total players evenly.";
      msg.className = "text-red-600 text-sm mt-1";
    }
  });

  // Add player
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

  // Start tournament
  startBtn.addEventListener("click", () => {
    if (players.length < maxPlayers) {
      alert(`You need ${maxPlayers - players.length} more players.`);
      return;
    }

    generateMatches();
    showStatus("✅ Tournament started! Matches generated.", "green");
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
  document.getElementById("max-jugadores-actual").textContent = maxPlayers;
  document.getElementById("max-participantes-display").textContent = maxPlayers;
  document.getElementById("contador-participantes").textContent = players.length;
  document.getElementById("contador-participantes-list").textContent = players.length;

  const list = document.getElementById("lista-participantes");
  list.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = p;
    list.appendChild(li);
  });

  const startBtn = document.getElementById("btn-iniciar");
  if (players.length === maxPlayers) {
    startBtn.disabled = false;
    startBtn.classList.remove("opacity-50", "cursor-not-allowed");
    startBtn.textContent = "Start Tournament!";
  } else {
    startBtn.disabled = true;
    startBtn.classList.add("opacity-50", "cursor-not-allowed");
    startBtn.textContent = `Start Tournament (Need ${maxPlayers - players.length} more)`;
  }

  // Update mode selector
  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.checked = radio.value === mode;
  });
}

function createStatusMessage(type) {
  const target =
    type === "max"
      ? document.querySelector("#btn-configurar-max").parentNode
      : document.querySelector("#btn-configurar-grupos").parentNode;
  const msg = document.createElement("p");
  msg.id = type === "max" ? "set-max-message" : "set-group-message";
  target.appendChild(msg);
  return msg;
}

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

  if (mode === "singles") {
    // Round-robin between all players
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        matches.push({ type: "singles", p1: players[i], p2: players[j] });
      }
    }
  } else {
    // Randomly shuffle and pair players into teams
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const teams = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      teams.push([shuffled[i], shuffled[i + 1]]);
    }

    // Every team plays against each other
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          type: "doubles",
          team1: teams[i],
          team2: teams[j],
        });
      }
    }

    console.log("🧩 Teams:", teams);
  }

  console.log("🎾 Matches generated:", matches);
  return matches;
}
