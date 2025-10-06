// my-app-logic.js
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variables globales
let jugadores = [];
let torneoId = null;
let maxJugadores = 10;
let numGrupos = 2;

// 🔹 Inicialización principal
window.loadAndInitializeLogic = function () {
  console.log("✅ Lógica principal cargada correctamente.");
  inicializarUI();
  cargarDatosLocales();
  configurarEventos();
};

// ==============================
// 🔧 CONFIGURACIÓN Y EVENTOS
// ==============================

function inicializarUI() {
  document.getElementById("max-jugadores-actual").textContent = maxJugadores;
  document.getElementById("max-participantes-display").textContent = maxJugadores;
}

function configurarEventos() {
  document.getElementById("btn-configurar-max").addEventListener("click", () => {
    const nuevoMax = parseInt(document.getElementById("max-jugadores-input").value);
    if (nuevoMax >= 4 && nuevoMax % 2 === 0) {
      maxJugadores = nuevoMax;
      document.getElementById("max-jugadores-actual").textContent = maxJugadores;
      document.getElementById("max-participantes-display").textContent = maxJugadores;
      guardarLocal();
    } else {
      alert("El número máximo de jugadores debe ser par y al menos 4.");
    }
  });

  document.getElementById("btn-configurar-grupos").addEventListener("click", () => {
    const nuevoNum = parseInt(document.getElementById("num-grupos-input").value);
    if (nuevoNum >= 1 && nuevoNum <= 6 && maxJugadores % nuevoNum === 0) {
      numGrupos = nuevoNum;
      guardarLocal();
    } else {
      alert("El número de grupos debe dividir exactamente el total de jugadores.");
    }
  });

  document.getElementById("btn-agregar-participante").addEventListener("click", agregarJugador);
  document.getElementById("btn-borrar-datos").addEventListener("click", borrarDatosLocales);
  document.getElementById("load-tournament-form").addEventListener("submit", cargarTorneoExterno);
}

// ==============================
// 👥 GESTIÓN DE JUGADORES
// ==============================

function agregarJugador() {
  const nombreInput = document.getElementById("nombre-input");
  const nombre = nombreInput.value.trim();

  if (!nombre) {
    alert("Por favor ingresa un nombre válido.");
    return;
  }
  if (jugadores.includes(nombre)) {
    alert("Este jugador ya está registrado.");
    return;
  }
  if (jugadores.length >= maxJugadores) {
    alert("Ya has alcanzado el número máximo de jugadores.");
    return;
  }

  jugadores.push(nombre);
  nombreInput.value = "";
  actualizarListaJugadores();
  guardarLocal();
}

function actualizarListaJugadores() {
  const lista = document.getElementById("lista-participantes");
  lista.innerHTML = "";
  jugadores.forEach((j, idx) => {
    const li = document.createElement("li");
    li.textContent = j;
    li.classList.add("flex", "justify-between", "items-center");

    const btnEliminar = document.createElement("button");
    btnEliminar.textContent = "❌";
    btnEliminar.classList.add("text-red-500", "hover:text-red-700", "ml-2");
    btnEliminar.addEventListener("click", () => eliminarJugador(idx));

    li.appendChild(btnEliminar);
    lista.appendChild(li);
  });

  document.getElementById("contador-participantes").textContent = jugadores.length;
  document.getElementById("contador-participantes-list").textContent = jugadores.length;

  const btnIniciar = document.getElementById("btn-iniciar");
  btnIniciar.disabled = jugadores.length !== maxJugadores;
  btnIniciar.classList.toggle("opacity-50", jugadores.length !== maxJugadores);
  btnIniciar.classList.toggle("cursor-not-allowed", jugadores.length !== maxJugadores);
  btnIniciar.classList.toggle("bg-indigo-600", jugadores.length === maxJugadores);
  btnIniciar.classList.toggle("hover:bg-indigo-700", jugadores.length === maxJugadores);
}

function eliminarJugador(index) {
  jugadores.splice(index, 1);
  actualizarListaJugadores();
  guardarLocal();
}

// ==============================
// 💾 ALMACENAMIENTO LOCAL Y FIREBASE
// ==============================

function guardarLocal() {
  const data = {
    jugadores,
    maxJugadores,
    numGrupos,
    torneoId: torneoId || generarIdTorneo(),
    userId: window.userId || "anon",
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem("torneoData", JSON.stringify(data));
  torneoId = data.torneoId;

  // Si hay Firestore disponible, también guardamos ahí
  if (window.db) {
    const ref = doc(window.db, "torneos", data.torneoId);
    setDoc(ref, data)
      .then(() => console.log("✅ Torneo guardado en Firestore:", data.torneoId))
      .catch((err) => console.error("Error al guardar en Firestore:", err));
  }

  document.getElementById("tournament-id-display").innerHTML = `
    <p class="text-sm text-gray-600">🆔 ID del Torneo: <span class="font-bold">${torneoId}</span></p>
    <p class="text-xs text-gray-500">Usuario: ${window.userId}</p>
  `;
}

function cargarDatosLocales() {
  const data = JSON.parse(localStorage.getItem("torneoData"));
  if (data) {
    jugadores = data.jugadores || [];
    maxJugadores = data.maxJugadores || 10;
    numGrupos = data.numGrupos || 2;
    torneoId = data.torneoId;
    actualizarListaJugadores();
    inicializarUI();
  }
}

function borrarDatosLocales() {
  if (confirm("¿Estás seguro de borrar todos los datos del torneo?")) {
    localStorage.removeItem("torneoData");
    jugadores = [];
    torneoId = null;
    actualizarListaJugadores();
    inicializarUI();
    alert("Datos borrados. Puedes iniciar un nuevo torneo.");
  }
}

// ==============================
// 🌐 CARGAR TORNEO EXTERNO
// ==============================

async function cargarTorneoExterno(e) {
  e.preventDefault();
  const input = document.getElementById("external-id-input");
  const mensaje = document.getElementById("load-message");
  const id = input.value.trim();

  if (!id) return (mensaje.textContent = "Por favor ingresa un ID válido.");

  if (!window.db) {
    return (mensaje.textContent = "Firebase no está disponible. No se puede cargar.");
  }

  try {
    const ref = doc(window.db, "torneos", id);
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      const data = snapshot.data();
      jugadores = data.jugadores || [];
      maxJugadores = data.maxJugadores || 10;
      numGrupos = data.numGrupos || 2;
      torneoId = data.torneoId;

      actualizarListaJugadores();
      inicializarUI();
      guardarLocal();

      mensaje.textContent = "✅ Torneo cargado correctamente.";
      mensaje.classList.remove("text-red-500");
      mensaje.classList.add("text-green-600");
    } else {
      mensaje.textContent = "❌ No se encontró un torneo con ese ID.";
      mensaje.classList.add("text-red-500");
    }
  } catch (err) {
    console.error(err);
    mensaje.textContent = "Error al cargar el torneo.";
  }
}

// ==============================
// 🧩 UTILIDADES
// ==============================

function generarIdTorneo() {
  return "T-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}
