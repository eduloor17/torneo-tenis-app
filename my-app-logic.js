import {
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let players = [];
let matches = [];
let maxPlayers = 10;
let numGroups = 2;
let matchType = "singles";
let tournamentId = null;

window.loadAndInitializeLogic = function () {
  console.log("✅ Logic initialized");
  loadLocalData();
  setupEvents();
  updateUI();
};

// === Event Setup ===
function setupEvents() {
  document.getElementById("btn-configurar-max").addEventListener("click", () => {
    const newMax = parseInt(document.getElementById("max-jugadores-input").value);
    if (newMax >= 4 && newMax % 2 === 0) {
      maxPlayers = newMax;
      updateUI();
      saveData();
      alert(`✅ Max players set to ${maxPlayers}`);
    } else {
      alert("Max players must be even and at least 4.");
    }
  });

  document.getElementById("btn-configurar-grupos").addEventListener("click", () => {
    const newGroups = parseInt(document.getElementById("num-grupos-input").value);
    if (newGroups >= 1 && newGroups <= 6 && maxPlayers % newGroups === 0) {
      numGroups = newGroups;
      saveData();
      alert(`✅ Groups set to ${numGroups}`);
    } else {
      alert("Groups must divide total players evenly.");
    }
  });

  document.getElementById("match-type").addEventListener("change", (e) => {
    matchType = e.target.value;
    saveData();
  });

  document.getElementById("btn-agregar-participante").addEventListener("click", addPlayer);
  document.getElementById("btn-borrar-datos").addEventListener("click", clearLocalData);
  document.getElementById("btn-generate-matches").addEventListener("click", generateMatches);
}

// === Player Logic ===
function addPlayer() {
  const input = document.getElementById("nombre-input");
  const name = input.value.trim();
  if (!name) return alert("Please enter a name.");
  if (players.includes(name)) return alert("This player already exists.");
  if (players.length >= maxPlayers) return alert("Max players reached.");

  players.push(name);
  input.value = "";
  updatePlayerList();
  saveData();
}

function removePlayer(index) {
  players.splice(index, 1);
  updatePlayerList();
  saveData();
}

function updatePlayerList() {
  const list = document.getElementById("lista-participantes");
  list.innerHTML = "";
  players.forEach((p, i) => {
    const li = document.createElement("li");
    li.textContent = p;
    const btn = document.createElement("button");
    btn.textContent = "❌";
    btn.classList.add("ml-2", "text-red-500");
    btn.onclick = () => removePlayer(i);
    li.appendChild(btn);
    list.appendChild(li);
  });
  document.getElementById("contador-participantes").textContent = players.length;
  document.getElementById("contador-participantes-list").textContent = players.length;
}

// === Match Generator ===
function generateMatches() {
  if (players.length < 2) return alert("Need at least 2 players.");

  const shuffled = [...players].sort(() => Math.random() - 0.5);
  matches = [];

  if (matchType === "singles") {
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) matches.push([shuffled[i], shuffled[i + 1]]);
    }
  } else {
    // DOUBLES: random partner assignment
    const pairs = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      if (shuffled[i + 1]) pairs.push([shuffled[i], shuffled[i + 1]]);
    }
    const shuffledPairs = [...pairs].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffledPairs.length; i += 2) {
      if (shuffledPairs[i + 1]) matches.push([shuffledPairs[i], shuffledPairs[i + 1]]);
    }
  }

  displayMatches();
  saveData();
}

function displayMatches() {
  const container = document.getElementById("matches-container");
  container.innerHTML = "<h3 class='font-semibold text-lg mb-2'>Generated Matches</h3>";
  matches.forEach((match, idx) => {
    const div = document.createElement("div");
    div.classList.add("p-2", "border", "rounded", "mb-1", "bg-gray-100");
    if (matchType === "singles") {
      div.textContent = `Match ${idx + 1}: ${match[0]} 🆚 ${match[1]}`;
    } else {
      div.textContent = `Match ${idx + 1}: ${match[0][0]} & ${match[0][1]} 🆚 ${match[1][0]} & ${match[1][1]}`;
    }
    container.appendChild(div);
  });
}

// === Save & Load ===
function saveData() {
  const data = { players, matches, maxPlayers, numGroups, matchType, userId: window.userId };
  localStorage.setItem("tournamentData", JSON.stringify(data));

  if (window.db) {
    const id = tournamentId || `T-${Math.random().toString(36).substring(2, 8)}`;
    tournamentId = id;
    const ref = doc(window.db, "tournaments", id);
    setDoc(ref, data).then(() => console.log("Saved tournament:", id));
  }
}

function loadLocalData() {
  const data = JSON.parse(localStorage.getItem("tournamentData"));
  if (data) {
    players = data.players || [];
    matches = data.matches || [];
    maxPlayers = data.maxPlayers || 10;
    numGroups = data.numGroups || 2;
    matchType = data.matchType || "singles";
    updatePlayerList();
    displayMatches();
  }
}

function clearLocalData() {
  if (confirm("Are you sure you want to clear all data?")) {
    localStorage.removeItem("tournamentData");
    players = [];
    matches = [];
    updatePlayerList();
    document.getElementById("matches-container").innerHTML = "";
  }
}

function updateUI() {
  document.getElementById("max-jugadores-actual").textContent = maxPlayers;
  document.getElementById("max-participantes-display").textContent = maxPlayers;
  document.getElementById("match-type").value = matchType;
}
