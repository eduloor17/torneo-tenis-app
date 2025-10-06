// my-app-logic.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ===== Global Variables =====
let players = [];
let tournamentId = null;
let maxPlayers = 10;
let numGroups = 2;

// Entry point (called from index.html after Firebase is ready)
window.loadAndInitializeLogic = function () {
  console.log("✅ Main logic initialized.");
  initializeUI();
  loadLocalData();
  setupEventHandlers();
};

// ==============================
// 🧩 INITIALIZATION & EVENTS
// ==============================

function initializeUI() {
  document.getElementById("max-jugadores-actual").textContent = maxPlayers;
  document.getElementById("max-participantes-display").textContent = maxPlayers;
}

function setupEventHandlers() {
  document.getElementById("btn-configurar-max").addEventListener("click", () => {
    const newMax = parseInt(document.getElementById("max-jugadores-input").value);
    if (newMax >= 4 && newMax % 2 === 0) {
      maxPlayers = newMax;
      document.getElementById("max-jugadores-actual").textContent = maxPlayers;
      document.getElementById("max-participantes-display").textContent = maxPlayers;
      saveData();
    } else {
      alert("Maximum number of players must be even and at least 4.");
    }
  });

  document.getElementById("btn-configurar-grupos").addEventListener("click", () => {
    const newGroups = parseInt(document.getElementById("num-grupos-input").value);
    if (newGroups >= 1 && newGroups <= 6 && maxPlayers % newGroups === 0) {
      numGroups = newGroups;
      saveData();
    } else {
      alert("The number of groups must evenly divide the total number of players.");
    }
  });

  document.getElementById("btn-agregar-participante").addEventListener("click", addPlayer);
  document.getElementById("btn-borrar-datos").addEventListener("click", clearLocalData);
  document.getElementById("load-tournament-form").addEventListener("submit", loadExternalTournament);
}

// ==============================
// 👥 PLAYER MANAGEMENT
// ==============================

function addPlayer() {
  const nameInput = document.getElementById("nombre-input");
  const name = nameInput.value.trim();

  if (!name) {
    alert("Please enter a valid player name.");
    return;
  }
  if (players.includes(name)) {
    alert("This player is already registered.");
    return;
  }
  if (players.length >= maxPlayers) {
    alert("You have reached the maximum number of players.");
    return;
  }

  players.push(name);
  nameInput.value = "";
  updatePlayerList();
  saveData();
}

function updatePlayerList() {
  const list = document.getElementById("lista-participantes");
  list.innerHTML = "";

  players.forEach((p, index) => {
    const li = document.createElement("li");
    li.textContent = p;
    li.classList.add("flex", "justify-between", "items-center");

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "❌";
    removeBtn.classList.add("text-red-500", "hover:text-red-700", "ml-2");
    removeBtn.addEventListener("click", () => removePlayer(index));

    li.appendChild(removeBtn);
    list.appendChild(li);
  });

  document.getElementById("contador-participantes").textContent = players.length;
  document.getElementById("contador-participantes-list").textContent = players.length;

  const startBtn = document.getElementById("btn-iniciar");
  const ready = players.length === maxPlayers;

  startBtn.disabled = !ready;
  startBtn.classList.toggle("opacity-50", !ready);
  startBtn.classList.toggle("cursor-not-allowed", !ready);
  startBtn.classList.toggle("bg-indigo-600", ready);
  startBtn.classList.toggle("hover:bg-indigo-700", ready);
}

function removePlayer(index) {
  players.splice(index, 1);
  updatePlayerList();
  saveData();
}

// ==============================
// 💾 LOCAL STORAGE & FIREBASE SYNC
// ==============================

function saveData() {
  const data = {
    players,
    maxPlayers,
    numGroups,
    tournamentId: tournamentId || generateTournamentId(),
    userId: window.userId || "anonymous",
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem("tournamentData", JSON.stringify(data));
  tournamentId = data.tournamentId;

  // Save to Firestore if available
  if (window.db) {
    const ref = doc(window.db, "tournaments", data.tournamentId);
    setDoc(ref, data)
      .then(() => console.log("✅ Tournament saved in Firestore:", data.tournamentId))
      .catch((err) => console.error("Error saving in Firestore:", err));
  }

  document.getElementById("tournament-id-display").innerHTML = `
    <p class="text-sm text-gray-600">🆔 Tournament ID: <span class="font-bold">${tournamentId}</span></p>
    <p class="text-xs text-gray-500">User: ${window.userId}</p>
  `;
}

function loadLocalData() {
  const data = JSON.parse(localStorage.getItem("tournamentData"));
  if (data) {
    players = data.players || [];
    maxPlayers = data.maxPlayers || 10;
    numGroups = data.numGroups || 2;
    tournamentId = data.tournamentId;
    updatePlayerList();
    initializeUI();
  }
}

function clearLocalData() {
  if (confirm("Are you sure you want to reset the tournament? This will delete all local data.")) {
    localStorage.removeItem("tournamentData");
    players = [];
    tournamentId = null;
    updatePlayerList();
    initializeUI();
    alert("Local data cleared. You can start a new tournament.");
  }
}

// ==============================
// 🌐 LOAD EXISTING TOURNAMENT
// ==============================

async function loadExternalTournament(e) {
  e.preventDefault();
  const input = document.getElementById("external-id-input");
  const message = document.getElementById("load-message");
  const id = input.value.trim();

  if (!id) return (message.textContent = "Please enter a valid tournament ID.");

  if (!window.db) {
    return (message.textContent = "Firebase is not available. Cannot load external tournaments.");
  }

  try {
    const ref = doc(window.db, "tournaments", id);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      const data = snapshot.data();
      players = data.players || [];
      maxPlayers = data.maxPlayers || 10;
      numGroups = data.numGroups || 2;
      tournamentId = data.tournamentId;

      updatePlayerList();
      initializeUI();
      saveData();

      message.textContent = "✅ Tournament loaded successfully.";
      message.classList.remove("text-red-500");
      message.classList.add("text-green-600");
    } else {
      message.textContent = "❌ No tournament found with that ID.";
      message.classList.add("text-red-500");
    }
  } catch (err) {
    console.error(err);
    message.textContent = "Error loading the tournament.";
  }
}

// ==============================
// 🧩 UTILITIES
// ==============================

function generateTournamentId() {
  return "T-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}
